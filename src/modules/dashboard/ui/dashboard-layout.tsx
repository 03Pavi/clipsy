'use client';

import { useState, useEffect } from 'react';
import { Box, Typography, IconButton, InputBase, Avatar, Popover, Button, Divider, Snackbar, Alert, Menu, MenuItem, ListItemIcon, ListItemText, useMediaQuery, Drawer } from '@mui/material';
import { Search, NotificationsNone, Logout, Person, Keyboard, History, MoreVert, ContentCopy, Delete, PushPin, Close, Menu as MenuIcon } from '@mui/icons-material';
import { auth, db } from '@/shared/api/firebase';
import { signOut, deleteUser } from 'firebase/auth';
import { doc, onSnapshot, collection, query, where, getDocs, writeBatch } from 'firebase/firestore';
import { deleteRoomFromFirebase } from '@/services/room/delete-room';
import { useAppDispatch, useAppSelector } from '@/shared/lib/redux';
import { setPreviewTheme } from '@/entities/user';
import { ClipboardItem } from '@/entities/clipboard/model/types';
import { Sidebar } from '../components/sidebar';
import { ClipboardHub } from '../components/clipboard-hub';
import { DeviceMesh } from '../components/device-mesh';
import { Settings } from '../components/settings';

export function DashboardLayout() {
  const user = useAppSelector(state => state.user.info);
  const previewTheme = useAppSelector(state => state.user.previewTheme);
  const clipboardItems = useAppSelector(state => state.clipboard.items);
  const dispatch = useAppDispatch();
  const isMobile = useMediaQuery('(max-width:960px)');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('hub');
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);
  const [toast, setToast] = useState<{ open: boolean; message: string }>({ open: false, message: '' });
  const [userSettings, setUserSettings] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [searchResults, setSearchResults] = useState<ClipboardItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchMenuAnchor, setSearchMenuAnchor] = useState<null | HTMLElement>(null);
  const [activeSearchItem, setActiveSearchItem] = useState<ClipboardItem | null>(null);

  const themes: any = {
    space: { primary: "#0070ff", bg: '#050914' },
    violet: { primary: '#a855f7', bg: '#0c0714' },
    emerald: { primary: '#10b981', bg: '#061410' },
    amber: { primary: '#f59e0b', bg: '#141107' }
  };

  const currentTheme = previewTheme as keyof typeof themes;
  const theme = themes[currentTheme] || themes.space;

  const handleProfileClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget as HTMLButtonElement);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleSignOut = async () => {
    try {
      if (user?.isAnonymous) {
        // 1. Find all rooms created by this user
        const roomsQuery = query(collection(db, 'rooms'), where('createdBy', '==', user.uid));
        const roomsSnap = await getDocs(roomsQuery);
        
        // 2. Delete all rooms
        const deletePromises = roomsSnap.docs.map(doc => deleteRoomFromFirebase(doc.id));
        await Promise.all(deletePromises);

        // 3. Batch delete devices, clipboard items, and user doc
        const batch = writeBatch(db);
        
        // Query devices for user
        const devicesQuery = query(collection(db, 'devices'), where('userId', '==', user.uid));
        const devicesSnap = await getDocs(devicesQuery);
        devicesSnap.forEach((doc) => {
          batch.delete(doc.ref);
        });

        // Query clipboard items for user
        const clipsQuery = query(collection(db, 'clipboard'), where('userId', '==', user.uid));
        const clipsSnap = await getDocs(clipsQuery);
        clipsSnap.forEach((doc) => {
          batch.delete(doc.ref);
        });

        // Delete user document
        batch.delete(doc(db, 'users', user.uid));

        await batch.commit();

        // 4. Delete user account from Firebase Auth
        if (auth.currentUser) {
          try {
            await deleteUser(auth.currentUser);
          } catch (authErr) {
            console.error('Error deleting firebase user:', authErr);
            await signOut(auth);
          }
        }
      } else {
        await signOut(auth);
      }
    } catch (err) {
      console.error('Error signing out anonymous user:', err);
      await signOut(auth);
    }
    handleClose();
  };

  useEffect(() => {
    if (!user) return;

    // REAL-TIME SETTINGS SYNC
    const userDocRef = doc(db, 'users', user.uid);
    const unsubscribe = onSnapshot(userDocRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        if (data.hotkeys) {
          setUserSettings(data.hotkeys);
        }
        if (data.theme) {
          dispatch(setPreviewTheme(data.theme));
        }
      }
    }, (err) => {
      console.error('🔥 [Settings Sync Error]:', err);
    });

    return () => unsubscribe();
  }, [user]);

  // LOAD RECENT SEARCHES
  useEffect(() => {
    const saved = localStorage.getItem('recent_searches');
    if (saved) setRecentSearches(JSON.parse(saved));
  }, []);

  const saveSearch = (query: string) => {
    if (!query.trim()) return;
    const updated = [query, ...recentSearches.filter(s => s !== query)].slice(0, 5);
    setRecentSearches(updated);
    localStorage.setItem('recent_searches', JSON.stringify(updated));
  };

  // DEBOUNCED SEARCH API HANDSHAKE
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    // LOCAL SEARCH FOR ANONYMOUS USERS
    if (user?.isAnonymous) {
      const query = searchQuery.toLowerCase();
      const localResults = clipboardItems.filter(item => 
        item.content.toLowerCase().includes(query) ||
        (item.title && item.title.toLowerCase().includes(query)) ||
        item.type.toLowerCase().includes(query)
      );
      setSearchResults(localResults);
      return;
    }

    const delayDebounceFn = setTimeout(async () => {
      try {
        setIsSearching(true);
        const idToken = await auth.currentUser?.getIdToken();
        const response = await fetch(`/api/clipboard/search?q=${encodeURIComponent(searchQuery)}`, {
          headers: {
            'Authorization': `Bearer ${idToken}`
          }
        });
        const data = await response.json();
        if (data.items) {
          setSearchResults(data.items);
        }
      } catch (error) {
        console.error('🔍 [Search Handshake Failed]:', error);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery, user?.isAnonymous, clipboardItems]);

  useEffect(() => {
    const handleGlobalHotkeys = (e: KeyboardEvent) => {
      // Use user settings or defaults
      const hotkeys = userSettings || {
        forceSync: '⌘ S',
        openDashboard: '⌘ D',
        togglePrivacy: '⌥ P',
        clearLogs: '⌃ C'
      };

      const checkMatch = (setting: string) => {
        const parts = setting.split(' ');
        const key = parts[parts.length - 1].toUpperCase();
        const modCmd = setting.includes('⌘');
        const modAlt = setting.includes('⌥');
        const modShift = setting.includes('⇧');

        const matchMod = (modCmd === (e.metaKey || e.ctrlKey)) &&
          (modAlt === e.altKey) &&
          (modShift === e.shiftKey);

        return matchMod && e.key.toUpperCase() === key;
      };

      if (checkMatch(hotkeys.forceSync)) {
        e.preventDefault();
        setToast({ open: true, message: `🚀 Force Sync Initiated` });
      } else if (checkMatch(hotkeys.openDashboard)) {
        e.preventDefault();
        setActiveTab('hub');
        setToast({ open: true, message: `🖥️ Switching to Dashboard` });
      } else if (checkMatch(hotkeys.togglePrivacy)) {
        e.preventDefault();
        setToast({ open: true, message: `🔐 Privacy Mode Toggled` });
      } else if (checkMatch(hotkeys.clearLogs)) {
        e.preventDefault();
        setToast({ open: true, message: `🧹 Logs Cleared` });
      }
    };

    window.addEventListener('keydown', handleGlobalHotkeys);
    return () => window.removeEventListener('keydown', handleGlobalHotkeys);
  }, [userSettings]);

  const handleSearchMenuOpen = (event: React.MouseEvent<HTMLElement>, item: ClipboardItem) => {
    event.stopPropagation();
    setSearchMenuAnchor(event.currentTarget);
    setActiveSearchItem(item);
  };

  const handleSearchMenuClose = () => {
    setSearchMenuAnchor(null);
    setActiveSearchItem(null);
  };

  const handleSearchCopy = (content: string) => {
    navigator.clipboard.writeText(content);
    setToast({ open: true, message: '📋 Copied to clipboard' });
    handleSearchMenuClose();
  };

  const getHeaders = async () => {
    const token = await auth.currentUser?.getIdToken();
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  };

  const handleSearchDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/clipboard?id=${id}`, {
        method: 'DELETE',
        headers: await getHeaders()
      });
      if (res.ok) {
        setSearchResults(prev => prev.filter(item => item.id !== id));
        setToast({ open: true, message: '🗑️ Item deleted' });
      }
    } catch (error) {
      console.error('Delete failed:', error);
    }
    handleSearchMenuClose();
  };

  const handleSearchTogglePin = async (id: string, currentPin: boolean) => {
    try {
      const res = await fetch('/api/clipboard', {
        method: 'PATCH',
        headers: await getHeaders(),
        body: JSON.stringify({ id, isPinned: !currentPin })
      });
      if (res.ok) {
        setSearchResults(prev => prev.map(item =>
          item.id === id ? { ...item, isPinned: !currentPin } : item
        ));
        setToast({ open: true, message: currentPin ? '📌 Item unpinned' : '📌 Item pinned' });
      }
    } catch (error) {
      console.error('Pin toggle failed:', error);
    }
    handleSearchMenuClose();
  };

  const open = Boolean(anchorEl);

  return (
    <Box className={`theme-${previewTheme}`} sx={{
      display: 'flex',
      height: '100vh',
      width: '100vw',
      overflow: 'hidden',
      bgcolor: 'var(--theme-bg)',
      transition: 'all 0.5s ease',
    }}>
      {!isMobile ? (
        <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      ) : (
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          PaperProps={{
            sx: {
              width: 280,
              bgcolor: 'var(--theme-bg)',
              borderRight: '1px solid var(--theme-border)'
            }
          }}
        >
          <Sidebar 
            activeTab={activeTab} 
            setActiveTab={(tab) => {
              setActiveTab(tab);
              setMobileOpen(false);
            }} 
          />
        </Drawer>
      )}

      <Box component="main" sx={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        width: isMobile ? '100%' : 'auto'
      }}>
        {/* Top Header */}
        <Box component="header" sx={{
          px: isMobile ? 2 : 4, py: 2,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          bgcolor: 'transparent',
          zIndex: 10,
          gap: 2
        }}>
          {isMobile && (
            <IconButton 
              onClick={() => setMobileOpen(true)}
              sx={{ color: 'var(--text-primary)', bgcolor: 'rgba(255,255,255,0.05)', borderRadius: 2 }}
            >
              <MenuIcon />
            </IconButton>
          )}
          {/* Search Bar */}
          <Box sx={{
            display: 'flex',
            flexDirection: 'column',
            position: 'relative',
            flex: 1,
            maxWidth: isMobile ? 'none' : 400,
            zIndex: 100
          }}>
            <Box sx={{
              display: 'flex',
              alignItems: 'center',
              bgcolor: 'var(--theme-card-bg)',
              px: 2, py: 0.5,
              borderRadius: 2,
              border: `1px solid ${isSearchFocused ? 'var(--theme-primary)' : 'var(--theme-border)'}`,
              transition: 'all 0.2s',
              boxShadow: isSearchFocused ? `0 0 15px rgba(0,112,255,0.2)` : 'none'
            }}>
              <Search sx={{ color: isSearchFocused ? 'var(--theme-primary)' : 'rgba(255,255,255,0.3)', mr: 1, fontSize: 20 }} />
              <InputBase
                placeholder={activeTab === 'hub' ? "Search clipboard history..." : "Search devices..."}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setIsSearchFocused(true)}
                onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
                sx={{ color: 'var(--text-primary)', fontSize: '0.85rem', flex: 1 }}
              />
              {searchQuery && (
                <IconButton
                  size="small"
                  onClick={() => setSearchQuery('')}
                  sx={{ color: 'var(--text-dim)', '&:hover': { color: 'var(--text-primary)' } }}
                >
                  <Close sx={{ fontSize: 18 }} />
                </IconButton>
              )}
            </Box>

            {/* Search Results Overlay */}
            {(isSearchFocused || Boolean(searchMenuAnchor)) && (
              <Box sx={{
                position: 'absolute',
                top: '120%',
                left: 0,
                right: 0,
                bgcolor: 'var(--theme-bg)',
                backdropFilter: 'blur(16px)',
                borderRadius: 3,
                border: '1px solid var(--theme-border)',
                boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
                p: 1.5,
                display: 'flex',
                flexDirection: 'column',
                gap: 0.5,
                animation: 'slideDown 0.2s ease-out'
              }}>
                {searchQuery ? (
                  <>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 1, py: 0.5 }}>
                      <Typography variant="caption" sx={{ color: 'var(--text-muted)', fontWeight: 700, letterSpacing: 1 }}>
                        RESULTS FOR "{searchQuery.toUpperCase()}"
                      </Typography>
                      {isSearching && <Typography variant="caption" sx={{ color: 'var(--theme-primary)', animation: 'pulse 1s infinite' }}>...</Typography>}
                    </Box>
                    {searchResults.length > 0 ? searchResults.map((item) => (
                      <Box key={item.id} onClick={() => saveSearch(searchQuery)} sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 2,
                        p: 1.5,
                        borderRadius: 2,
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' }
                      }}>
                        <Box sx={{ bgcolor: 'rgba(255,255,255,0.05)', p: 1, borderRadius: 1.5, color: 'var(--theme-primary)' }}>
                          <Search sx={{ fontSize: 16 }} />
                        </Box>
                        <Box sx={{ flex: 1, overflow: 'hidden' }}>
                          <Typography variant="body2" sx={{ color: 'var(--text-primary)', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {item?.content}
                          </Typography>
                          <Typography variant="caption" sx={{ color: 'var(--text-muted)' }}>{item.type.toUpperCase()}</Typography>
                        </Box>
                        <Typography variant="caption" sx={{ color: 'var(--text-dim)' }}>
                          {item.timestamp ? new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'recently'}
                        </Typography>
                        <IconButton
                          size="small"
                          onClick={(e) => handleSearchMenuOpen(e, item)}
                          sx={{
                            color: 'rgba(255,255,255,0.2)',
                            '&:hover': { color: 'white', bgcolor: 'rgba(255,255,255,0.05)' }
                          }}
                        >
                          <MoreVert sx={{ fontSize: 18 }} />
                        </IconButton>
                      </Box>
                    )) : !isSearching && (
                      <Typography variant="caption" sx={{ color: 'var(--text-dim)', textAlign: 'center', py: 2 }}>No matching assets found.</Typography>
                    )}
                  </>
                ) : (
                  <>
                    <Typography variant="caption" sx={{ color: 'var(--text-muted)', px: 1, py: 0.5, fontWeight: 700, letterSpacing: 1 }}>
                      RECENT
                    </Typography>
                    {recentSearches.length > 0 ? recentSearches.map((s, i) => (
                      <Box key={i} onClick={() => setSearchQuery(s)} sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 2,
                        p: 1.5,
                        borderRadius: 2,
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' }
                      }}>
                        <History sx={{ fontSize: 16, color: 'var(--text-dim)' }} />
                        <Typography variant="body2" sx={{ color: 'var(--text-secondary)', flex: 1 }}>{s}</Typography>
                      </Box>
                    )) : (
                      <Typography variant="caption" sx={{ color: 'var(--text-dim)', textAlign: 'center', py: 2 }}>No recent search history.</Typography>
                    )}
                  </>
                )}

                <Divider sx={{ borderColor: 'rgba(255,255,255,0.05)', my: 1 }} />
                <Typography variant="caption" sx={{ color: 'var(--theme-primary)', textAlign: 'center', py: 1, cursor: 'pointer', fontWeight: 600 }}>
                  View All Hub Assets
                </Typography>
              </Box>
            )}
          </Box>

          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <IconButton sx={{ color: 'rgba(255,255,255,0.6)' }}><NotificationsNone /></IconButton>
            <IconButton onClick={handleProfileClick} sx={{ color: 'rgba(255,255,255,0.6)' }}>
              <Avatar src={user?.avatarUrl} sx={{ width: 32, height: 32, bgcolor: 'rgba(255,255,255,0.1)', fontSize: '0.8rem' }}>
                {user?.name?.[0]}
              </Avatar>
            </IconButton>

            <Popover
              open={open}
              anchorEl={anchorEl}
              onClose={handleClose}
              anchorOrigin={{
                vertical: 'bottom',
                horizontal: 'right',
              }}
              transformOrigin={{
                vertical: 'top',
                horizontal: 'right',
              }}
              PaperProps={{
                sx: {
                  bgcolor: 'var(--theme-bg)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--theme-border)',
                  mt: 1.5,
                  p: 2,
                  minWidth: 240,
                  borderRadius: 3,
                  boxShadow: '0 8px 32px rgba(0,0,0,0.5)'
                }
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                <Avatar src={user?.avatarUrl} sx={{ width: 48, height: 48 }} />
                <Box>
                  <Typography variant="body1" fontWeight={600}>{user?.name}</Typography>
                  <Typography variant="caption" color="rgba(255,255,255,0.4)">{user?.email}</Typography>
                </Box>
              </Box>
              <Divider sx={{ borderColor: 'rgba(255,255,255,0.05)', my: 1.5 }} />
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                <Button
                  fullWidth
                  startIcon={<Person fontSize="small" />}
                  sx={{ color: 'rgba(255,255,255,0.6)', justifyContent: 'flex-start', textTransform: 'none' }}
                >
                  Edit Profile
                </Button>
                <Button
                  fullWidth
                  startIcon={<Logout fontSize="small" />}
                  onClick={handleSignOut}
                  sx={{ color: '#ef4444', justifyContent: 'flex-start', textTransform: 'none' }}
                >
                  Sign Out
                </Button>
              </Box>
            </Popover>
          </Box>
        </Box>

        {/* Content Area */}
        <Box sx={{
          flex: 1,
          p: { xs: 2, md: 4 },
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 3
        }}>
          {/* Page Title & Subtext */}
          <Box sx={{ mb: 1 }}>
            <Typography variant={isMobile ? "h5" : "h4"} fontWeight={700} color="var(--text-primary)" gutterBottom>
              {activeTab === 'hub' && 'Clipboard Hub'}
              {activeTab === 'devices' && 'Connected Devices'}
              {activeTab === 'settings' && 'Settings & Privacy'}
            </Typography>
            <Typography variant="body2" color="var(--text-muted)">
              {activeTab === 'hub' && 'Unified stream of your synchronized assets across all enterprise devices.'}
              {activeTab === 'devices' && 'Manage and monitor your active workspace endpoints in real-time.'}
              {activeTab === 'settings' && 'Configure your environment preferences, security protocols, and data retention policies.'}
            </Typography>
          </Box>

          <Box sx={{ flex: 1 }}>
            {activeTab === 'hub' && <ClipboardHub />}
            {activeTab === 'devices' && <DeviceMesh />}
            {activeTab === 'settings' && <Settings />}
          </Box>
        </Box>
      </Box>
      <Snackbar
        open={toast.open}
        autoHideDuration={2000}
        onClose={() => setToast({ ...toast, open: false })}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert
          icon={<Keyboard sx={{ color: "var(--theme-primary)" }} />}
          sx={{
            bgcolor: 'var(--theme-bg)',
            color: 'var(--text-primary)',
            borderRadius: 3,
            border: '1px solid var(--theme-border)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            fontWeight: 600
          }}
        >
          {toast.message}
        </Alert>
      </Snackbar>

      <Menu
        anchorEl={searchMenuAnchor}
        open={Boolean(searchMenuAnchor)}
        onClose={handleSearchMenuClose}
        PaperProps={{
          sx: {
            bgcolor: 'var(--theme-bg)',
            border: '1px solid var(--theme-border)',
            boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
            '& .MuiMenuItem-root': { color: 'var(--text-secondary)', fontSize: '0.85rem' }
          }
        }}
      >
        <MenuItem onClick={() => activeSearchItem && handleSearchTogglePin(activeSearchItem.id, !!activeSearchItem.isPinned)}>
          <ListItemIcon><PushPin sx={{ fontSize: 18, color: activeSearchItem?.isPinned ? '#ff3d00' : 'var(--text-primary)' }} /></ListItemIcon>
          <ListItemText primary={activeSearchItem?.isPinned ? "Unpin" : "Pin"} />
        </MenuItem>
        <MenuItem onClick={() => activeSearchItem && handleSearchCopy(activeSearchItem.content)}>
          <ListItemIcon><ContentCopy sx={{ fontSize: 18, color: 'var(--text-primary)' }} /></ListItemIcon>
          <ListItemText primary="Copy" />
        </MenuItem>
        <MenuItem onClick={() => activeSearchItem && handleSearchDelete(activeSearchItem.id)} sx={{ '&:hover': { bgcolor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' } }}>
          <ListItemIcon><Delete sx={{ fontSize: 18, color: 'var(--text-primary)' }} /></ListItemIcon>
          <ListItemText primary="Delete" />
        </MenuItem>
      </Menu>
    </Box>
  );
}
