'use client';
import { useState, useEffect } from 'react';
import { Box, Button, Container, TextField, Typography, Paper, Stack, AppBar, Toolbar, IconButton, Avatar, Tooltip } from '@mui/material';
import { useAuth } from '../../hooks/use-auth';
import { useSyncRoom } from '../../hooks/use-sync-room';
import { ArrowForward, AddCircleOutline, Key, ArrowCircleRight, Logout, LightMode, DarkMode, DeleteOutline, Lock } from '@mui/icons-material';
import { signOut, deleteUser } from 'firebase/auth';
import { auth, db } from '../../config/firebase-client';
import { collection, query, where, getDocs, writeBatch, doc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { useThemeToggle } from '../../components/ui/theme-registry';
import { useDispatch } from 'react-redux';
import { resetStore, persistor } from '../../store';
import { deleteRoomFromFirebase } from '../../services/room/delete-room';
import { subscribeUserRooms } from '../../services/room/get-user-rooms';

export default function DashboardPage() {
  const { user } = useAuth();
  const { handleJoinRoom, handleCreateRoom, isLoading, error, requestStatus, setRequestStatus } = useSyncRoom();
  const [syncCode, setSyncCode] = useState('');
  const [roomName, setRoomName] = useState('');
  const [showAllRooms, setShowAllRooms] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [syncedRooms, setSyncedRooms] = useState<any[]>([]);
  const [copiedRoomId, setCopiedRoomId] = useState<string | null>(null);
  const router = useRouter();
  const dispatch = useDispatch();
  const { toggleTheme, mode } = useThemeToggle();

  useEffect(() => {
    if (user?.uid) {
      const unsubscribe = subscribeUserRooms(user.uid, (rooms) => {
        setSyncedRooms(rooms);
      });
      return () => unsubscribe();
    }
  }, [user]);

  const allRooms = syncedRooms;
  const displayedRooms = showAllRooms ? allRooms : allRooms.slice(0, 3);

  if (!user) return null;

  const handleLogout = async () => {
    try {
      // If anonymous, delete their created rooms, associated data, and delete user account
      if (user.isAnonymous) {
        setIsDeleting(true);
        
        // 1. Delete all rooms created by this user
        const deletePromises = syncedRooms.map(room => deleteRoomFromFirebase(room.id));
        await Promise.all(deletePromises);

        // 2. Batch delete all associated firestore documents (devices, clipboard items, user doc)
        try {
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
        } catch (firestoreErr) {
          console.warn('⚠️ [Firestore Cleanup Failed]:', firestoreErr);
        }

        // 3. Delete user account from Firebase Auth
        if (auth.currentUser) {
          try {
            await deleteUser(auth.currentUser);
          } catch (authErr) {
            console.error('Error deleting firebase user:', authErr);
            await signOut(auth);
          }
        }
        
        setIsDeleting(false);
      } else {
        await signOut(auth);
      }

      // Clear redux persist state and reset store immediately
      await persistor.purge();
      dispatch(resetStore());

      router.push('/login');
    } catch (err) {
      console.error(err);
      setIsDeleting(false);
    }
  };

  const handleDeleteRoom = async (e: React.MouseEvent, roomId: string) => {
    e.stopPropagation();
    if (window.confirm("Are you sure you want to delete this room from your history and Firebase?")) {
      setIsDeleting(true);
      try {
        await deleteRoomFromFirebase(roomId);
      } catch (err) {
        console.warn('Could not delete from Firebase:', err);
      } finally {
        setIsDeleting(false);
      }
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', color: 'text.primary', fontFamily: 'Inter, sans-serif' }}>
      <AppBar position="static" elevation={0} sx={{ bgcolor: 'transparent', borderBottom: '1px solid', borderColor: 'divider' }}>
        <Toolbar sx={{ justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 32,
                height: 32,
                borderRadius: 1.5,
                background: 'linear-gradient(135deg, #0070f3, #00c6ff)',
              }}
            >
              <ArrowCircleRight sx={{ color: '#fff', fontSize: 20 }} />
            </Box>
            <Typography variant="h6" fontWeight={700} sx={{ letterSpacing: '-0.5px' }}>
              onePaste
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Tooltip title="Toggle Theme">
              <IconButton onClick={toggleTheme} sx={{ color: 'text.secondary', '&:hover': { color: 'text.primary', bgcolor: 'action.hover' } }}>
                {mode === 'dark' ? <LightMode fontSize="small" /> : <DarkMode fontSize="small" />}
              </IconButton>
            </Tooltip>
            <Tooltip title={user.isAnonymous ? 'Anonymous' : user.displayName || 'Anonymous'}>
              <Avatar src={user.photoURL || ''} alt={user.displayName || 'Anonymous'} sx={{ width: 32, height: 32, bgcolor: 'action.selected', border: '1px solid', borderColor: 'divider' }}>
                {(user.displayName || 'A')[0].toUpperCase()}
              </Avatar>
            </Tooltip>
            <Tooltip title="Logout">
              <IconButton onClick={handleLogout} sx={{ color: 'text.secondary', '&:hover': { color: 'text.primary', bgcolor: 'action.hover' } }}>
                <Logout fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        </Toolbar>
      </AppBar>

      <Container maxWidth="md" sx={{ py: 8 }}>
        <Box sx={{ mb: 6 }}>
          <Typography variant="h4" fontWeight={700} sx={{ letterSpacing: '-0.5px', lineHeight: 1, color: 'text.primary' }}>
            Dashboard
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Welcome back, {user.isAnonymous ? 'Anonymous' : user.displayName || 'Anonymous'}
          </Typography>
        </Box>

        {error && (
          <Box sx={{ mb: 4, p: 2, borderRadius: 2, bgcolor: 'rgba(211,47,47,0.1)', border: '1px solid rgba(211,47,47,0.3)', color: '#ffb4ab' }}>
            <Typography variant="body2">{error}</Typography>
          </Box>
        )}

        {allRooms.length > 0 && (
          <Box sx={{ mb: 4 }}>
            <Box sx={{ mb: 2 }}>
              <Typography variant="h6" fontWeight={600} color="text.primary">Recent Rooms</Typography>
            </Box>
            <Stack direction="row" spacing={2} sx={{ overflowX: 'auto', pb: 1, flexWrap: showAllRooms ? 'wrap' : 'nowrap', gap: showAllRooms ? 2 : 0 }}>
              {displayedRooms.map((room) => (
                <Paper
                  key={room.id}
                  elevation={0}
                  onClick={() => router.push(`/room/${room.id}`)}
                  sx={{
                    p: 2.5,
                    minWidth: 240,
                    maxWidth: 280,
                    flex: showAllRooms ? '1 1 auto' : 'none',
                    borderRadius: 3,
                    bgcolor: 'background.paper',
                    border: '1px solid',
                    borderColor: 'divider',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    position: 'relative',
                    '&:hover': { bgcolor: 'action.hover', borderColor: 'primary.main' },
                    ...(showAllRooms && { ml: '0 !important' }) // Fix Stack spacing when wrapping
                  }}
                >
                  <IconButton
                    size="small"
                    onClick={(e) => handleDeleteRoom(e, room.id)}
                    sx={{ position: 'absolute', top: 8, right: 8, color: 'text.secondary', '&:hover': { color: 'error.main', bgcolor: 'error.light' } }}
                  >
                    <DeleteOutline fontSize="small" />
                  </IconButton>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, pr: 3, mb: 0.5 }}>
                    <Typography variant="subtitle1" fontWeight={600} color="text.primary" noWrap sx={{ maxWidth: '180px' }}>{room.name}</Typography>
                    {room.isPrivate && (
                      <Tooltip title="Private Room">
                        <Lock sx={{ fontSize: 14, color: 'secondary.main' }} />
                      </Tooltip>
                    )}
                  </Box>
                  <Tooltip title={copiedRoomId === room.id ? 'Copied!' : 'Copy Sync Code'}>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigator.clipboard.writeText(room.syncCode);
                        setCopiedRoomId(room.id);
                        setTimeout(() => setCopiedRoomId(null), 1000);
                      }}
                      sx={{
                        display: 'inline-block',
                        mt: 0.5,
                        letterSpacing: 2,
                        fontFamily: 'monospace',
                        fontWeight: 600,
                        px: 1,
                        py: 0.5,
                        borderRadius: 1,
                        bgcolor: 'action.hover',
                        '&:hover': { bgcolor: 'action.selected', color: 'primary.main' }
                      }}
                    >
                      {room.syncCode}
                    </Typography>
                  </Tooltip>
                </Paper>
              ))}

              {allRooms.length > 3 && (
                <Paper
                  elevation={0}
                  onClick={() => setShowAllRooms(!showAllRooms)}
                  sx={{
                    p: 2.5,
                    minWidth: 140,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 3,
                    bgcolor: 'transparent',
                    border: '1px dashed',
                    borderColor: 'divider',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    '&:hover': { bgcolor: 'action.hover', borderColor: 'primary.main' },
                    ...(showAllRooms && { ml: '0 !important' })
                  }}
                >
                  <Typography variant="subtitle2" fontWeight={600} color="text.secondary">
                    {showAllRooms ? 'Show Less' : `+${allRooms.length - 3} More`}
                  </Typography>
                </Paper>
              )}
            </Stack>
          </Box>
        )}

        <Stack direction={{ xs: 'column', md: 'row' }} spacing={3}>
          {/* Join Room Card */}
          <Paper
            elevation={0}
            sx={{
              flex: 1,
              p: 4,
              borderRadius: 4,
              bgcolor: 'background.paper',
              border: '1px solid',
              borderColor: 'divider',
              boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
              <Key sx={{ color: 'primary.main' }} />
              <Typography variant="h6" fontWeight={600} color="text.primary">Connect Device</Typography>
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
              Enter a 6-character sync code from an active mesh room to link this device.
            </Typography>

            <Box sx={{ mt: 'auto' }}>
              <TextField
                fullWidth
                placeholder="Enter Sync Code"
                variant="outlined"
                value={syncCode}
                onChange={(e) => setSyncCode(e.target.value.toUpperCase())}
                inputProps={{ maxLength: 6, style: { letterSpacing: '4px', textAlign: 'center', fontFamily: 'monospace', fontSize: '1.2rem' } }}
                sx={{ mb: 2 }}
              />
              <Button
                fullWidth
                variant="contained"
                onClick={() => handleJoinRoom(syncCode)}
                disabled={syncCode.length !== 6 || isLoading || isDeleting}
                endIcon={<ArrowForward />}
                sx={{
                  py: 1.5,
                  bgcolor: 'primary.main',
                  color: 'primary.contrastText',
                  fontWeight: 600,
                  textTransform: 'none',
                  borderRadius: 2,
                  '&:hover': { bgcolor: 'primary.dark' },
                  '&.Mui-disabled': { bgcolor: 'action.disabledBackground', color: 'text.disabled' }
                }}
              >
                Join Mesh Room
              </Button>
            </Box>
          </Paper>

          {/* Create Room Card */}
          <Paper
            elevation={0}
            sx={{
              flex: 1,
              p: 4,
              borderRadius: 4,
              bgcolor: 'background.paper',
              border: '1px solid',
              borderColor: 'divider',
              boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
              <AddCircleOutline sx={{ color: 'secondary.main' }} />
              <Typography variant="h6" fontWeight={600} color="text.primary">Create New Mesh</Typography>
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
              Start a new secure room to synchronize clipboard data across multiple devices.
            </Typography>

            <Box sx={{ mt: 'auto' }}>
              <TextField
                fullWidth
                placeholder="Room Name (Optional)"
                variant="outlined"
                value={roomName}
                inputProps={{ maxLength: 20 }}
                onChange={(e) => setRoomName(e.target.value)}
                disabled={user.isAnonymous && syncedRooms.length >= 1}
                sx={{ mb: 2 }}
              />

              <Tooltip title={user.isAnonymous && syncedRooms.length >= 1 ? "Anonymous users can only create 1 active room." : ""}>
                <span>
                  <Button
                    fullWidth
                    variant="outlined"
                    onClick={() => handleCreateRoom(roomName || 'My Sync Room')}
                    disabled={isLoading || isDeleting || (user.isAnonymous && syncedRooms.length >= 1)}
                    sx={{
                      py: 1.5,
                      borderColor: 'divider',
                      color: 'text.primary',
                      fontWeight: 600,
                      textTransform: 'none',
                      borderRadius: 2,
                      '&:hover': { borderColor: 'primary.main', bgcolor: 'action.hover' },
                      '&.Mui-disabled': { borderColor: 'action.disabledBackground', color: 'text.disabled' }
                    }}
                  >
                    Initialize Room
                  </Button>
                </span>
              </Tooltip>
            </Box>
          </Paper>
        </Stack>
      </Container>

      {/* Real-time Door Knocking Overlay */}
      {requestStatus === 'pending' && (
        <Box
          sx={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            bgcolor: 'rgba(0, 0, 0, 0.85)',
            backdropFilter: 'blur(10px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            p: 3
          }}
        >
          <Paper
            elevation={0}
            sx={{
              p: 5,
              borderRadius: 4,
              bgcolor: 'background.paper',
              border: '1px solid rgba(255,255,255,0.08)',
              maxWidth: 440,
              textAlign: 'center',
              boxShadow: '0 24px 48px rgba(0,0,0,0.5)'
            }}
          >
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 64,
                height: 64,
                borderRadius: '50%',
                bgcolor: 'rgba(0, 112, 243, 0.1)',
                color: 'primary.main',
                mx: 'auto',
                mb: 3,
                animation: 'pulse 1.8s infinite'
              }}
            >
              <Lock sx={{ fontSize: 32 }} />
            </Box>
            <Typography variant="h5" fontWeight={700} sx={{ mb: 1, color: 'text.primary' }}>
              Knocking at the Door...
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 4 }}>
              This mesh room is <b>Private</b>. A join request has been sent to the room owner. Please wait for approval.
            </Typography>
            
            <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2 }}>
              <Button
                variant="outlined"
                onClick={() => {
                  setRequestStatus('idle');
                }}
                sx={{
                  px: 4,
                  py: 1,
                  borderRadius: 2,
                  textTransform: 'none',
                  borderColor: 'divider',
                  color: 'text.secondary'
                }}
              >
                Cancel Request
              </Button>
            </Box>
          </Paper>
        </Box>
      )}
    </Box>
  );
}
