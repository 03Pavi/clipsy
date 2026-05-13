import { ContentCopy, Share, Delete, Code, Link as LinkIcon, Description, Palette, Image as ImageIcon, PushPin, ExpandMore, Add, MoreVert, AddPhotoAlternate, Send, CloudDone, CloudOff, Wifi, FormatBold, FormatItalic, FormatUnderlined, Code as CodeIcon, FormatListBulleted, FormatListNumbered } from '@mui/icons-material';
import { Box, Card, CardContent, CardActions, Typography, IconButton, Chip, Avatar, AvatarGroup, Button, Divider, Snackbar, Alert, Menu, MenuItem, ListItemIcon, ListItemText, TextField, InputAdornment, Switch, Tooltip } from '@mui/material';
import { useAppSelector } from '@/shared/lib/redux';
import { useState, useEffect } from 'react';
import { auth, db } from '@/shared/api/firebase';
import { EditorContent, useEditor } from '@tiptap/react';
import { collection, query, where, onSnapshot, orderBy, limit } from 'firebase/firestore';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import ImageResize from 'tiptap-extension-resize-image';

import { ClipboardItem } from '@/entities/clipboard/model/types';

import { useDevice } from '@/entities/device/lib/use-device';
import { usePresence } from '@/entities/device/lib/use-presence';

export function ClipboardHub() {
  const { profile } = useDevice();
  usePresence(profile);

  const [items, setItems] = useState<ClipboardItem[]>([]);
  const [filter, setFilter] = useState('All');
  const [syncMode, setSyncMode] = useState<'global' | 'private'>('global');
  const [newContent, setNewContent] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [dbStatus, setDbStatus] = useState<'online' | 'offline'>('online');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [hasMedia, setHasMedia] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [activeItemId, setActiveItemId] = useState<null | string>(null);
  const user = useAppSelector(state => state.user.info);

  const getHeaders = async () => {
    const token = await auth.currentUser?.getIdToken();
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  };

  const compressImage = (base64Str: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.src = base64Str;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1200;
        let width = img.width;
        let height = img.height;

        if (width > MAX_WIDTH) {
          height *= MAX_WIDTH / width;
          width = MAX_WIDTH;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
      img.onerror = () => {
        reject(new Error('Failed to load image'));
      };
    });
  };

  const editor = useEditor({
    extensions: [StarterKit, Underline, ImageResize],
    content: '',
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      const text = editor.getText();
      const html = editor.getHTML();
      setNewContent(text);
      setHasMedia(html.includes('<img'));
    },
    editorProps: {
      handlePaste: (view, event) => {
        const items = Array.from(event.clipboardData?.items || []);
        const imageItem = items.find(item => item.type.startsWith('image'));

        if (imageItem) {
          const file = imageItem.getAsFile();
          if (file) {
            const reader = new FileReader();
            reader.onload = async () => {
              if (typeof reader.result === 'string') {
                const compressed = await compressImage(reader.result);
                editor?.commands.setImage({ src: compressed });
              }
            };
            reader.readAsDataURL(file);
            return true;
          }
        }
        return false;
      }
    }
  });

  const fetchItems = async () => {
    if (!user) return;
    try {
      const res = await fetch('/api/clipboard', {
        headers: await getHeaders()
      });
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      const data = await res.json();
      if (data.items) {
        setItems(data.items);
        setDbStatus('online');
        setErrorMsg(null);
      }
    } catch (error) {
      console.error('Fetch failed:', error);
      setDbStatus('offline');
      setErrorMsg('Failed to fetch clipboard items');
    }
  };

  useEffect(() => {
    if (!user) return;

    // Real-time Clipboard Listener
    console.info('🔗 [Firebase Sync] Initializing listener for UID:', user.uid);

    const qClips = query(
      collection(db, 'clipboard'),
      where('userId', '==', user.uid),
      orderBy('timestamp', 'desc'),
      limit(10)
    );

    const unsubscribeClips = onSnapshot(qClips, (snapshot) => {
      const cloudItems = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ClipboardItem[];

      setItems(prev => {
        // Filter out optimistic items that now exist in cloud
        const optimisticItems = prev.filter(item => item.id.startsWith('temp-'));
        const confirmedItems = cloudItems;

        // Remove optimistic items if a cloud item with same content/timestamp exists
        const filteredOptimistic = optimisticItems.filter(opt =>
          !confirmedItems.some(cloud => cloud.timestamp === opt.timestamp || cloud.content === opt.content)
        );

        const merged = [...filteredOptimistic, ...confirmedItems];
        return merged.sort((a, b) => {
          if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
          return (b.timestamp || 0) - (a.timestamp || 0);
        });
      });

      setIsLoading(false);
      setDbStatus('online');
      setErrorMsg(null);
    }, (error) => {
      console.error('🔥 [Firebase Sync Error]:', error.code, error.message);
      setDbStatus('offline');

      if (error.code === 'permission-denied') {
        setErrorMsg('Access Denied: Check your Firestore Security Rules.');
      } else if (error.code === 'failed-precondition') {
        setErrorMsg('Index Missing: Visit the Firebase Console to create the required composite index.');
      } else {
        setErrorMsg(`Sync Failed: ${error.message}`);
      }
    });

    // AUTO-REGISTER THIS DEVICE
    const registerThisDevice = async () => {
      if (!profile) return;
      try {
        await fetch('/api/devices', {
          method: 'POST',
          headers: await getHeaders(),
          body: JSON.stringify(profile)
        });
      } catch (e) {
        console.error('Device auto-registration failed:', e);
      }
    };
    registerThisDevice();

    return () => {
      unsubscribeClips();
    };
  }, [user]);

  const handleCopy = (content: string) => {
    navigator.clipboard.writeText(content);
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/clipboard?id=${id}`, {
        method: 'DELETE',
        headers: await getHeaders()
      });
      if (res.ok) {
        setItems(prev => prev.filter(item => item.id !== id));
        setMenuAnchor(null);
      }
    } catch (error) {
      console.error('Delete failed:', error);
      setErrorMsg('Failed to delete item');
    }
  };

  const handleTogglePin = async (id: string, currentPin: boolean) => {
    try {
      const res = await fetch('/api/clipboard', {
        method: 'PATCH',
        headers: await getHeaders(),
        body: JSON.stringify({ id, isPinned: !currentPin })
      });
      if (!res.ok) throw new Error('Pin failed');
      setMenuAnchor(null);
    } catch (error) {
      console.error('Pin toggle failed:', error);
      setErrorMsg('Failed to update pin status');
    }
  };

  const handleAddClip = async () => {
    if (!editor || !user) return;

    const html = editor.getHTML();
    const text = editor.getText();

    // Check if it's empty (Tiptap returns <p></p> when empty)
    if (!text.trim() && !html.includes('<img')) return;

    // Detect if there's an image in the HTML
    const imgMatch = html.match(/<img src="([^"]+)"/);
    const imageUrl = imgMatch ? imgMatch[1] : undefined;

    const clipData = {
      content: text.trim() || 'no content',
      type: imageUrl ? 'image' : (text.startsWith('http') ? 'link' : 'text'),
      title: text.trim() ? (text.split('\n')[0].substring(0, 30)) : 'Image Clip',
      imageUrl: imageUrl,
      sourceDeviceId: profile?.deviceId,
      syncLinkId: syncMode === 'global' ? 'global' : 'private_link',
      metadata: 'Rich Text Editor',
      isPinned: false,
      timestamp: Date.now()
    };

    // OPTIMISTIC UPDATE: Put it at the top immediately
    setItems(prev => [{ id: `temp-${Date.now()}`, ...clipData } as any, ...prev]);

    setIsSyncing(true);
    try {
      const res = await fetch('/api/clipboard', {
        method: 'POST',
        headers: await getHeaders(),
        body: JSON.stringify(clipData)
      });

      if (res.ok) {
        editor.commands.setContent('');
        setNewContent('');
        // fetchItems() removed, onSnapshot handles live updates
      } else {
        const errData = await res.json();
        setErrorMsg(errData.error || 'Sync failed');
      }
    } catch (error: any) {
      console.error('Add failed:', error);
      setErrorMsg('Network error: Cloud unreachable');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, id: string) => {
    setMenuAnchor(event.currentTarget);
    setActiveItemId(id);
  };

  const handleMenuClose = () => {
    setMenuAnchor(null);
    setActiveItemId(null);
  };

  const formatTime = (timestamp: any) => {
    if (!timestamp) return 'Just now';
    const date = timestamp.seconds ? new Date(timestamp.seconds * 1000) : new Date(timestamp);
    const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
    const diff = (date.getTime() - Date.now()) / 1000;
    if (Math.abs(diff) < 60) return 'Just now';
    if (Math.abs(diff) < 3600) return rtf.format(Math.round(diff / 60), 'minute');
    if (Math.abs(diff) < 86400) return rtf.format(Math.round(diff / 3600), 'hour');
    return rtf.format(Math.round(diff / 86400), 'day');
  };

  const displayItems = items;

  const filteredItems = filter === 'All' ? displayItems : displayItems.filter(item => {
    if (filter === 'Text') return item.type === 'text' || item.type === 'code' || item.type === 'doc';
    if (filter === 'Links') return item.type === 'link';
    if (filter === 'Images') return item.type === 'image';
    return true;
  });

  const handleImageUpload = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e: Event) => {
      const target = e.target as HTMLInputElement;
      const file = target.files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = async () => {
          if (typeof reader.result === 'string') {
            const compressed = await compressImage(reader.result);
            editor?.chain().focus().setImage({ src: compressed }).run();
          }
        };
        reader.readAsDataURL(file);
      }
    };
    input.click();
  };

  const handleAddClipWithReset = async () => {
    await handleAddClip();
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h6" fontWeight={700}>Clipboard Hub</Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Chip
            icon={dbStatus === 'online' ? <CloudDone sx={{ fontSize: '1rem !important' }} /> : <CloudOff sx={{ fontSize: '1rem !important' }} />}
            label={dbStatus === 'online' ? "Firebase Live" : "Connection Lost"}
            size="small"
            sx={{
              bgcolor: dbStatus === 'online' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
              color: dbStatus === 'online' ? '#10b981' : '#ef4444',
              fontWeight: 700,
              fontSize: '0.65rem',
              border: `1px solid ${dbStatus === 'online' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`
            }}
          />
          {isSyncing && (
            <Typography variant="caption" sx={{ color: 'var(--theme-primary)', display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Wifi sx={{ fontSize: 12, animation: 'pulse 1s infinite' }} /> SYNCING...
            </Typography>
          )}
        </Box>
      </Box>

      <Box sx={{ mb: 4 }}>
        <Box sx={{
          maxWidth: "calc(100vw - 340px)",
          mx: 'auto',
          bgcolor: '#050914',
          borderRadius: 4,
          border: '1px solid rgba(255,255,255,0.08)',
          overflow: 'hidden',
          transition: 'all 0.3s',
          '&:focus-within': {
            borderColor: 'rgba(0,112,255,0.4)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)'
          }
        }}>
          {editor && (
            <Box>
              <Box sx={{ borderBottom: '1px solid rgba(255,255,255,0.1)', bgcolor: 'rgba(255,255,255,0.05)' }}>
                <Box sx={{ display: 'flex', gap: 0.5, p: 0.5, flexWrap: 'wrap', alignItems: 'center' }}>
                  <IconButton
                    size="small"
                    onClick={() => editor.chain().focus().toggleBold().run()}
                    sx={{ color: editor.isActive('bold') ? "var(--theme-primary)" : 'rgba(255,255,255,0.7)', bgcolor: editor.isActive('bold') ? 'rgba(0,112,255,0.1)' : 'transparent', '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' } }}
                  >
                    <FormatBold fontSize="small" />
                  </IconButton>
                  <IconButton
                    size="small"
                    onClick={() => editor.chain().focus().toggleItalic().run()}
                    sx={{ color: editor.isActive('italic') ? "var(--theme-primary)" : 'rgba(255,255,255,0.7)', bgcolor: editor.isActive('italic') ? 'rgba(0,112,255,0.1)' : 'transparent', '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' } }}
                  >
                    <FormatItalic fontSize="small" />
                  </IconButton>
                  <IconButton
                    size="small"
                    onClick={() => editor.chain().focus().toggleUnderline().run()}
                    sx={{ color: editor.isActive('underline') ? "var(--theme-primary)" : 'rgba(255,255,255,0.7)', bgcolor: editor.isActive('underline') ? 'rgba(0,112,255,0.1)' : 'transparent', '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' } }}
                  >
                    <FormatUnderlined fontSize="small" />
                  </IconButton>

                  <Divider orientation="vertical" flexItem sx={{ mx: 1, borderColor: 'rgba(255,255,255,0.1)', height: 20, my: 'auto' }} />

                  <IconButton
                    size="small"
                    onClick={() => editor.chain().focus().toggleCode().run()}
                    sx={{ color: editor.isActive('code') ? "var(--theme-primary)" : 'rgba(255,255,255,0.7)', bgcolor: editor.isActive('code') ? 'rgba(0,112,255,0.1)' : 'transparent', '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' } }}
                  >
                    <CodeIcon fontSize="small" />
                  </IconButton>
                  <IconButton
                    size="small"
                    onClick={() => editor.chain().focus().toggleBulletList().run()}
                    sx={{ color: editor.isActive('bulletList') ? "var(--theme-primary)" : 'rgba(255,255,255,0.7)', bgcolor: editor.isActive('bulletList') ? 'rgba(0,112,255,0.1)' : 'transparent', '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' } }}
                  >
                    <FormatListBulleted fontSize="small" />
                  </IconButton>
                  <IconButton
                    size="small"
                    onClick={() => editor.chain().focus().toggleOrderedList().run()}
                    sx={{ color: editor.isActive('orderedList') ? "var(--theme-primary)" : 'rgba(255,255,255,0.7)', bgcolor: editor.isActive('orderedList') ? 'rgba(0,112,255,0.1)' : 'transparent', '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' } }}
                  >
                    <FormatListNumbered fontSize="small" />
                  </IconButton>

                  <Divider orientation="vertical" flexItem sx={{ mx: 1, borderColor: 'rgba(255,255,255,0.1)', height: 20, my: 'auto' }} />

                  <IconButton size="small" onClick={handleImageUpload} sx={{ color: 'rgba(255,255,255,0.7)', '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' } }}>
                    <AddPhotoAlternate fontSize="small" />
                  </IconButton>
                </Box>
              </Box>
              <Box sx={{
                p: 2,
                minHeight: '150px',
                maxHeight: '400px',
                overflowY: 'auto',
                '& .ProseMirror': {
                  outline: 'none',
                  color: 'white',
                  fontSize: '0.9rem',
                  fontFamily: '"Fira Code", monospace',
                  lineHeight: 1.6,
                  overflowWrap: 'anywhere',
                  wordBreak: 'break-word',
                  '& p': { m: 0 },
                  '& img': { maxWidth: '100%', borderRadius: 2, mt: 1 }
                }
              }}>
                <EditorContent editor={editor} />
              </Box>
            </Box>
          )}
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', p: 1.5, borderTop: '1px solid rgba(255,255,255,0.05)', bgcolor: 'rgba(255,255,255,0.02)' }}>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.2)' }}>
                {newContent.length} characters
              </Typography>
              <Button
                onClick={handleAddClipWithReset}
                variant="contained"
                disabled={!newContent.trim() && !hasMedia}
                startIcon={<Send fontSize="small" />}
                sx={{
                  bgcolor: "var(--theme-primary)",
                  borderRadius: 2,
                  textTransform: 'none',
                  px: 4,
                  fontWeight: 600,
                  boxShadow: '0 4px 14px rgba(0,112,255,0.4)'
                }}
              >
                Sync to Cloud
              </Button>
            </Box>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', gap: 1, mt: 3, justifyContent: 'start' }}>
          {['All', 'Text', 'Links', 'Images'].map((label) => (
            <Chip
              key={label}
              label={label}
              onClick={() => setFilter(label)}
              sx={{
                bgcolor: filter === label ? "var(--theme-primary)" : 'rgba(255,255,255,0.05)',
                color: filter === label ? 'white' : 'rgba(255,255,255,0.4)',
                border: '1px solid rgba(255,255,255,0.08)',
                fontWeight: 500,
                fontSize: '0.75rem',
                '&:hover': { bgcolor: filter === label ? '#0062e3' : 'rgba(255,255,255,0.1)' }
              }}
            />
          ))}
        </Box>
      </Box>

      <Box sx={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gridAutoRows: 'minmax(160px, auto)',
        gridAutoFlow: 'dense',
        gap: 3
      }}>
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} sx={{ bgcolor: 'rgba(255, 255, 255, 0.03)', backdropFilter: 'blur(24px)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '20px', height: 180 }}>
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
                  <Box sx={{ width: 40, height: 40, borderRadius: 1.5, bgcolor: 'rgba(255,255,255,0.05)', animation: 'pulse 1.5s infinite' }} />
                  <Box sx={{ flex: 1 }}>
                    <Box sx={{ width: '60%', height: 12, borderRadius: 1, bgcolor: 'rgba(255,255,255,0.05)', mb: 1, animation: 'pulse 1.5s infinite' }} />
                    <Box sx={{ width: '40%', height: 8, borderRadius: 1, bgcolor: 'rgba(255,255,255,0.02)', animation: 'pulse 1.5s infinite' }} />
                  </Box>
                </Box>
                <Box sx={{ width: '100%', height: 60, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.02)', animation: 'pulse 1.5s infinite' }} />
              </CardContent>
            </Card>
          ))
        ) : filteredItems.length === 0 ? (
          <Box sx={{ gridColumn: '1 / -1', py: 10, textAlign: 'center', opacity: 0.5 }}>
            <Typography variant="body1">No clips found. Start by syncing something above!</Typography>
          </Box>
        ) : (
          filteredItems.map((item: ClipboardItem) => (
            <Card
              key={item.id}
              sx={{
                bgcolor: 'rgba(255, 255, 255, 0.03)',
                backdropFilter: 'blur(24px)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '20px',
                color: 'white',
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                gridColumn: item.type === 'code' || item.type === 'doc' ? 'span 2' : 'span 1',
                gridRow: item.type === 'image' ? 'span 2' : 'span 1',
                transition: 'transform 0.2s, box-shadow 0.2s',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: '0 12px 40px rgba(0, 0, 0, 0.4)',
                  border: '1px solid rgba(255, 255, 255, 0.15)'
                }
              }}
            >
              <CardContent sx={{ p: 3, flex: 1, display: 'flex', flexDirection: 'column' }}>
                <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
                  <Box display="flex" alignItems="center" gap={1.5}>
                    <Box sx={{ bgcolor: 'rgba(0,112,255,0.1)', p: 1, borderRadius: 1.5, display: 'flex', position: 'relative' }}>
                      {item.type === 'code' && <Code sx={{ color: "var(--theme-primary)", fontSize: 18 }} />}
                      {item.type === 'link' && <LinkIcon sx={{ color: "var(--theme-primary)", fontSize: 18 }} />}
                      {item.type === 'image' && <ImageIcon sx={{ color: "var(--theme-primary)", fontSize: 18 }} />}
                      {(item.type === 'doc' || item.type === 'text') && <Description sx={{ color: "var(--theme-primary)", fontSize: 18 }} />}
                      {item.type === 'palette' && <Palette sx={{ color: "var(--theme-primary)", fontSize: 18 }} />}
                      {item.isPinned && (
                        <PushPin sx={{
                          position: 'absolute',
                          top: -6,
                          right: -6,
                          fontSize: 14,
                          color: '#ff3d00',
                          bgcolor: '#0f172a',
                          borderRadius: '50%',
                          p: 0.2,
                          border: '1px solid rgba(255,255,255,0.1)'
                        }} />
                      )}
                    </Box>
                    <Box>
                      <Typography variant="body2" fontWeight={600}>{item.title || item.content.split('\n')[0].substring(0, 30)}</Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Chip
                          icon={(item as any).sourceDeviceId === profile?.deviceId ? <CloudDone sx={{ fontSize: '0.7rem !important' }} /> : <Wifi sx={{ fontSize: '0.7rem !important' }} />}
                          label={(item as any).sourceDeviceId === profile?.deviceId ? 'This Device' : 'Remote Mesh'}
                          size="small"
                          sx={{ bgcolor: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.4)', fontSize: '0.55rem', height: 18 }}
                        />
                        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.3)' }}>{formatTime(item.timestamp)}</Typography>
                      </Box>
                    </Box>
                  </Box>
                  <IconButton
                    size="small"
                    onClick={(e) => handleMenuOpen(e, item.id)}
                    sx={{ color: 'rgba(255,255,255,0.2)', '&:hover': { color: 'white', bgcolor: 'rgba(255,255,255,0.05)' } }}
                  >
                    <MoreVert sx={{ fontSize: 18 }} />
                  </IconButton>
                </Box>

                <Box sx={{ flex: 1 }}>
                  {item.type === 'code' && (
                    <Box sx={{
                      bgcolor: '#050914',
                      p: 2,
                      borderRadius: 2,
                      fontFamily: 'monospace',
                      fontSize: '0.75rem',
                      color: 'rgba(255,255,255,0.7)',
                      whiteSpace: 'pre-wrap',
                      border: '1px solid rgba(255,255,255,0.05)',
                      height: '100%',
                      maxHeight: 240,
                      overflow: 'hidden'
                    }}>
                      {item.content}
                    </Box>
                  )}

                  {item.type === 'link' && (
                    <Box>
                      <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>{item.title}</Typography>
                      <Typography variant="caption" sx={{ color: "var(--theme-primary)", display: 'block', wordBreak: 'break-all' }}>{item.content}</Typography>
                    </Box>
                  )}

                  {item.type === 'image' && (
                    <Box sx={{
                      width: '100%',
                      flex: 1,
                      minHeight: 200,
                      bgcolor: 'rgba(0,0,0,0.3)',
                      borderRadius: 2,
                      mt: 1,
                      display: 'flex',
                      flexDirection: 'column',
                      overflow: 'hidden'
                    }}>
                      <Box
                        component="img"
                        src={item.fileUrl || item.imageUrl || "https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=400&auto=format&fit=crop"}
                        sx={{ width: '100%', flex: 1, objectFit: 'cover', opacity: 0.8 }}
                      />
                      <Box sx={{ p: 2, bgcolor: 'rgba(0,0,0,0.4)' }}>
                        <Typography variant="caption" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <ImageIcon sx={{ fontSize: 14 }} /> {item.content}
                        </Typography>
                      </Box>
                    </Box>
                  )}
                  {item.type === 'doc' && (
                    <Box>
                      <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.6)', lineHeight: 1.6 }}>{item.content}</Typography>
                      <Box display="flex" justifyContent="space-between" alignItems="center" mt={3}>
                        <Avatar src={user?.avatarUrl || ''} sx={{ width: 24, height: 24, border: '1px solid #050914' }}>
                          {user?.name?.[0]}
                        </Avatar>
                        <Box sx={{ bgcolor: 'rgba(0, 112, 255, 1)', p: 0.5, borderRadius: 1.5, display: 'flex' }}>
                          <Add sx={{ color: 'white', fontSize: 20 }} />
                        </Box>
                      </Box>
                    </Box>
                  )}

                  {item.type === 'palette' && (
                    <Box display="flex" gap={1} mt={1}>
                      {item.content.split(',').map((color: string) => (
                        <Box key={color} sx={{ bgcolor: color, width: 44, height: 44, borderRadius: 1.5, border: '1px solid rgba(255,255,255,0.1)' }} />
                      ))}
                    </Box>
                  )}
                </Box>
              </CardContent>
            </Card>
          ))
        )}
      </Box>

      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={handleMenuClose}
        PaperProps={{
          sx: {
            bgcolor: '#0f172a',
            border: '1px solid rgba(255,255,255,0.1)',
            boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
            '& .MuiMenuItem-root': { color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem' }
          }
        }}
      >
        <MenuItem onClick={() => {
          const item = items.find(i => i.id === activeItemId);
          if (item) handleCopy(item.content);
          handleMenuClose();
        }}>
          <ListItemIcon><ContentCopy sx={{ fontSize: 18, color: 'var(--text-primary)' }} /></ListItemIcon>
          <ListItemText primary="Copy" />
        </MenuItem>
        <MenuItem onClick={() => activeItemId && handleDelete(activeItemId)} sx={{ '&:hover': { bgcolor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' } }}>
          <ListItemIcon><Delete sx={{ fontSize: 18, color: 'var(--text-primary)' }} /></ListItemIcon>
          <ListItemText primary="Delete" />
        </MenuItem>
        <MenuItem onClick={() => {
          const item = items.find(i => i.id === activeItemId);
          if (item) handleTogglePin(item.id, !!item.isPinned);
        }}>
          <ListItemIcon><PushPin sx={{ fontSize: 18, color: (items.find(i => i.id === activeItemId)?.isPinned) ? '#ff3d00' : 'inherit' }} /></ListItemIcon>
          <ListItemText primary={items.find(i => i.id === activeItemId)?.isPinned ? "Unpin" : "Pin"} />
        </MenuItem>
      </Menu>

      <Snackbar open={!!errorMsg} autoHideDuration={6000} onClose={() => setErrorMsg(null)}>
        <Alert onClose={() => setErrorMsg(null)} severity="error" variant="filled" sx={{ width: '100%' }}>
          {errorMsg}
        </Alert>
      </Snackbar>

      <Box sx={{
        '@keyframes pulse': {
          '0%': { opacity: 0.4 },
          '50%': { opacity: 1 },
          '100%': { opacity: 0.4 }
        }
      }} />
    </Box>
  );
}
