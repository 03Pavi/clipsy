import { ContentCopy, Delete, Link as LinkIcon, Description, Image as ImageIcon, PushPin, MoreVert, AddPhotoAlternate, Send, CloudDone, CloudOff, Wifi, FormatBold, FormatItalic, FormatUnderlined, Code as CodeIcon, FormatListBulleted, FormatListNumbered } from '@mui/icons-material';
import { Box, Card, CardContent, Typography, IconButton, Chip, Button, Divider, Snackbar, Alert, Menu, MenuItem, ListItemIcon, ListItemText, CircularProgress, Tooltip } from '@mui/material';
import { useRouter } from 'next/navigation';
import { useAppSelector, useAppDispatch } from '@/shared/lib/redux';
import { useState, useEffect } from 'react';
import { auth, db } from '@/shared/api/firebase';
import { EditorContent, useEditor } from '@tiptap/react';
import { collection, query, where, onSnapshot, orderBy, limit } from 'firebase/firestore';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import ImageResize from 'tiptap-extension-resize-image';

import { ClipboardItem } from '@/entities/clipboard/model/types';
import { setItems as setReduxItems } from '@/entities/clipboard/model/slice';

import { useDevice } from '@/entities/device/lib/use-device';
import { usePresence } from '@/entities/device/lib/use-presence';

export function ClipboardHub() {
  const { profile } = useDevice();
  usePresence(profile);

  const dispatch = useAppDispatch();
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
  const [authLoading, setAuthLoading] = useState(false);
  const router = useRouter();
  const user = useAppSelector(state => state.user.info);

  // Sync local items with Redux
  useEffect(() => {
    dispatch(setReduxItems(items));
  }, [items, dispatch]);

  const getHeaders = async () => {
    const token = await auth.currentUser?.getIdToken();
    const pairedMesh = localStorage.getItem('clipsy_paired_mesh') || 'public_mesh';
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'x-paired-mesh': pairedMesh
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

  useEffect(() => {
    if (!user) return;

    // LOAD LOCAL ITEMS FOR ANONYMOUS
    if (user.isAnonymous) {
      const local = localStorage.getItem(`clipsy_anon_${user.uid}`);
      if (local) {
        setItems(JSON.parse(local));
      }
    }

    // Real-time Clipboard Listener
    console.info('🔗 [Firebase Sync] Initializing listener for UID:', user.uid);

    const qClips = query(
      collection(db, 'clipboard'),
      where('userId', '==', user.uid),
      orderBy('timestamp', 'desc'),
      limit(20)
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
    if (user?.isAnonymous) {
      setItems(prev => {
        const updated = prev.filter(item => item.id !== id);
        localStorage.setItem(`clipsy_anon_${user.uid}`, JSON.stringify(updated));
        return updated;
      });
      setMenuAnchor(null);
      return;
    }
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
    if (user?.isAnonymous) {
      setItems(prev => {
        const updated = prev.map(item => item.id === id ? { ...item, isPinned: !currentPin } : item);
        localStorage.setItem(`clipsy_anon_${user.uid}`, JSON.stringify(updated));
        return updated;
      });
      setMenuAnchor(null);
      return;
    }
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

    // OPTIMISTIC UPDATE
    const tempId = `temp-${Date.now()}`;
    const newItem = { id: tempId, ...clipData, isTransient: !!user.isAnonymous };

    // SAVE TO LOCAL STORAGE AND UPDATE STATE IF ANONYMOUS (LIMIT 3)
    if (user.isAnonymous) {
      setItems(prev => {
        // Filter out existing transient items if we are adding a new one and near limit
        const updated = [newItem as any, ...prev].slice(0, 3);
        localStorage.setItem(`clipsy_anon_${user.uid}`, JSON.stringify(updated));
        return updated;
      });
    } else {
      setItems(prev => [newItem as any, ...prev]);
    }

    setIsSyncing(true);
    try {
      const res = await fetch('/api/clipboard', {
        method: 'POST',
        headers: await getHeaders(),
        body: JSON.stringify({ ...clipData, isTransient: !!user.isAnonymous })
      });

      if (res.ok) {
        editor.commands.setContent('');
        setNewContent('');
      } else {
        const errData = await res.json();
        // If it's anonymous and failed, we still have it locally so it's fine, but log it
        if (!user.isAnonymous) setErrorMsg(errData.error || 'Sync failed');
      }
    } catch (error: any) {
      console.error('Add failed:', error);
      if (!user.isAnonymous) setErrorMsg('Network error: Cloud unreachable');
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

  return (
    <Box sx={{ pb: 8 }}>
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

      {user?.isAnonymous && (
        <Alert
          severity="warning"
          variant="outlined"
          sx={{
            mb: 3,
            bgcolor: 'rgba(245, 158, 11, 0.05)',
            borderColor: 'rgba(245, 158, 11, 0.2)',
            color: '#f59e0b',
            borderRadius: 3,
            '& .MuiAlert-icon': { color: '#f59e0b' }
          }}
          action={
            <Button
              color="inherit"
              size="small"
              sx={{ textTransform: 'none', fontWeight: 600 }}
              onClick={() => router.push('/auth/login?mode=signin')}
              disabled={authLoading}
            >
              {authLoading ? <CircularProgress size={20} sx={{ color: "GrayText" }} /> : 'Sign In / Migrate'}
            </Button>
          }
        >
          <Typography variant="body2" fontWeight={600}>Incognito Session Active</Typography>
          <Typography variant="caption">Activate your mesh identity to sync clips across devices!</Typography>
        </Alert>
      )}

      <Box sx={{ mb: 4 }}>
        <Box sx={{
          width: '100%',
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
            <Box sx={{ bgcolor: "var(--theme-bg)", width: "100%" }}>
              <Box sx={{ borderBottom: '1px solid var(--theme-bg)', bgcolor: 'rgba(255,255,255,0.05)' }}>
                <Box sx={{ display: 'flex', gap: 0.5, p: 0.5, flexWrap: 'wrap', alignItems: 'center' }}>
                  <Tooltip title="Bold (⌘+B)">
                    <IconButton
                      size="small"
                      onClick={() => editor.chain().focus().toggleBold().run()}
                      sx={{ color: editor.isActive('bold') ? "var(--theme-primary)" : 'rgba(255,255,255,0.7)', bgcolor: editor.isActive('bold') ? 'rgba(0,112,255,0.1)' : 'transparent', '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' } }}
                    >
                      <FormatBold fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Italic (⌘+I)">
                    <IconButton
                      size="small"
                      onClick={() => editor.chain().focus().toggleItalic().run()}
                      sx={{ color: editor.isActive('italic') ? "var(--theme-primary)" : 'rgba(255,255,255,0.7)', bgcolor: editor.isActive('italic') ? 'rgba(0,112,255,0.1)' : 'transparent', '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' } }}
                    >
                      <FormatItalic fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Underline (⌘+U)">
                    <IconButton
                      size="small"
                      onClick={() => editor.chain().focus().toggleUnderline().run()}
                      sx={{ color: editor.isActive('underline') ? "var(--theme-primary)" : 'rgba(255,255,255,0.7)', bgcolor: editor.isActive('underline') ? 'rgba(0,112,255,0.1)' : 'transparent', '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' } }}
                    >
                      <FormatUnderlined fontSize="small" />
                    </IconButton>
                  </Tooltip>

                  <Divider orientation="vertical" flexItem sx={{ mx: 1, borderColor: 'rgba(255,255,255,0.1)', height: 20, my: 'auto' }} />

                  <Tooltip title="Code Snippet">
                    <IconButton
                      size="small"
                      onClick={() => editor.chain().focus().toggleCode().run()}
                      sx={{ color: editor.isActive('code') ? "var(--theme-primary)" : 'rgba(255,255,255,0.7)', bgcolor: editor.isActive('code') ? 'rgba(0,112,255,0.1)' : 'transparent', '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' } }}
                    >
                      <CodeIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Bullet List">
                    <IconButton
                      size="small"
                      onClick={() => editor.chain().focus().toggleBulletList().run()}
                      sx={{ color: editor.isActive('bulletList') ? "var(--theme-primary)" : 'rgba(255,255,255,0.7)', bgcolor: editor.isActive('bulletList') ? 'rgba(0,112,255,0.1)' : 'transparent', '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' } }}
                    >
                      <FormatListBulleted fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Ordered List">
                    <IconButton
                      size="small"
                      onClick={() => editor.chain().focus().toggleOrderedList().run()}
                      sx={{ color: editor.isActive('orderedList') ? "var(--theme-primary)" : 'rgba(255,255,255,0.7)', bgcolor: editor.isActive('orderedList') ? 'rgba(0,112,255,0.1)' : 'transparent', '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' } }}
                    >
                      <FormatListNumbered fontSize="small" />
                    </IconButton>
                  </Tooltip>

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
              <Box sx={{ p: 1.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center', bgcolor: 'rgba(255,255,255,0.02)' }}>
                <Typography variant="caption" color="rgba(255,255,255,0.3)">
                  {newContent.length} characters {user?.isAnonymous && '[3 Item Limit]'}
                </Typography>
                <Button
                  variant="contained"
                  onClick={handleAddClip}
                  disabled={!newContent.trim() && !hasMedia}
                  startIcon={<Send sx={{ fontSize: 16 }} />}
                  sx={{
                    bgcolor: 'var(--theme-primary)',
                    borderRadius: 2,
                    textTransform: 'none',
                    fontWeight: 600,
                    px: 3
                  }}
                >
                  Sync to Cloud
                </Button>
              </Box>
            </Box>
          )}
        </Box>
      </Box>

      {/* Filter Tabs */}
      <Box sx={{ display: 'flex', gap: 1.5, mb: 4, overflowX: 'auto', pb: 1, '&::-webkit-scrollbar': { display: 'none' } }}>
        {['All', 'Text', 'Links', 'Images'].map((label) => (
          <Button
            key={label}
            onClick={() => setFilter(label)}
            sx={{
              borderRadius: 10,
              px: 3,
              py: 0.8,
              textTransform: 'none',
              fontWeight: 600,
              fontSize: '0.85rem',
              bgcolor: filter === label ? 'var(--theme-primary)' : 'rgba(255,255,255,0.05)',
              color: filter === label ? 'white' : 'var(--text-secondary)',
              border: '1px solid',
              borderColor: filter === label ? 'var(--theme-primary)' : 'rgba(255,255,255,0.1)',
              whiteSpace: 'nowrap'
            }}
          >
            {label}
          </Button>
        ))}
      </Box>

      <Box sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: 'repeat(3, 1fr)' },
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
          filteredItems.map((item) => (
            <Card
              key={item.id}
              sx={{
                bgcolor: 'rgba(255, 255, 255, 0.03)',
                borderRadius: 4,
                border: '1px solid rgba(255, 255, 255, 0.08)',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                '&:hover': {
                  bgcolor: 'rgba(255, 255, 255, 0.06)',
                  transform: 'translateY(-4px)',
                  borderColor: 'rgba(255, 255, 255, 0.15)',
                  boxShadow: '0 12px 24px rgba(0,0,0,0.3)'
                }
              }}
            >
              <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Box sx={{ bgcolor: 'rgba(255, 255, 255, 0.05)', p: 1.2, borderRadius: 2.5, display: 'flex', color: 'var(--theme-primary)' }}>
                      {item.type === 'text' && <Description fontSize="small" />}
                      {item.type === 'link' && <LinkIcon fontSize="small" />}
                      {item.type === 'image' && <ImageIcon fontSize="small" />}
                    </Box>
                    {item.isPinned && (
                      <Box sx={{ bgcolor: 'rgba(255, 61, 0, 0.1)', p: 1.2, borderRadius: 2.5, display: 'flex', color: '#ff3d00' }}>
                        <PushPin fontSize="small" />
                      </Box>
                    )}
                  </Box>
                  <IconButton size="small" onClick={(e) => handleMenuOpen(e, item.id)} sx={{ color: 'rgba(255,255,255,0.3)' }}>
                    <MoreVert fontSize="small" />
                  </IconButton>
                </Box>

                {item.type === 'image' ? (
                  <Box sx={{ width: '100%', height: 120, borderRadius: 2, overflow: 'hidden', mb: 1 }}>
                    <img src={item.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </Box>
                ) : (
                  <Typography variant="body2" sx={{ color: 'var(--text-primary)', fontWeight: 600, mb: 1, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {item.content}
                  </Typography>
                )}

                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 2 }}>
                  <Typography variant="caption" sx={{ color: 'var(--text-muted)' }}>{formatTime(item.timestamp)}</Typography>
                  {item.isTransient && <Chip label="TRANSIENT" size="small" sx={{ height: 16, fontSize: '0.6rem', bgcolor: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b' }} />}
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
            bgcolor: 'var(--theme-bg)',
            border: '1px solid var(--theme-border)',
            boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
            '& .MuiMenuItem-root': { color: 'var(--text-secondary)', fontSize: '0.85rem' }
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
