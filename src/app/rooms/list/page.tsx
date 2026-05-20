'use client';
import { useState, useEffect } from 'react';
import { Box, Button, Container, Typography, Paper, Stack, AppBar, Toolbar, IconButton, Avatar, Tooltip, CircularProgress, Divider } from '@mui/material';
import { useAuth } from '../../../hooks/use-auth';
import { ArrowBack, DeleteOutline, Lock, Logout, LightMode, DarkMode, ArrowCircleRight } from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import { useThemeToggle } from '../../../components/ui/theme-registry';
import { deleteRoomFromFirebase } from '../../../services/room/delete-room';
import { subscribeUserRooms } from '../../../services/room/get-user-rooms';
import { signOut } from 'firebase/auth';
import { auth } from '../../../config/firebase-client';
import { useDispatch } from 'react-redux';
import { resetStore, persistor } from '../../../store';

export default function RoomsListPage() {
  const { user } = useAuth();
  const router = useRouter();
  const dispatch = useDispatch();
  const { toggleTheme, mode } = useThemeToggle();
  const [rooms, setRooms] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [copiedRoomId, setCopiedRoomId] = useState<string | null>(null);

  useEffect(() => {
    if (user?.uid) {
      const unsubscribe = subscribeUserRooms(user.uid, (allRooms) => {
        // Only show rooms created by this user
        const createdRooms = allRooms.filter(room => room.createdBy === user.uid);
        setRooms(createdRooms);
        setIsLoading(false);
      });
      return () => unsubscribe();
    }
  }, [user]);

  if (!user) return null;

  const handleLogout = async () => {
    try {
      await signOut(auth);
      await persistor.purge();
      dispatch(resetStore());
      router.push('/login');
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteRoom = async (e: React.MouseEvent, roomId: string) => {
    e.stopPropagation();
    if (window.confirm("Are you sure you want to delete this room from your history and Firebase?")) {
      setIsDeleting(true);
      try {
        await deleteRoomFromFirebase(roomId, user.uid);
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
            <IconButton
              onClick={() => router.push('/dashboard')}
              sx={{
                mr: 1,
                bgcolor: 'action.hover',
                color: 'text.primary',
                '&:hover': { bgcolor: 'action.selected' }
              }}
            >
              <ArrowBack fontSize="small" />
            </IconButton>
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
            <Avatar src={user.photoURL || ''} alt={user.displayName || 'Anonymous'} sx={{ width: 32, height: 32, bgcolor: 'action.selected', border: '1px solid', borderColor: 'divider' }}>
              {(user.displayName || 'A')[0].toUpperCase()}
            </Avatar>
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
            My Created Rooms
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Manage and view all mesh sync rooms created by you.
          </Typography>
        </Box>

        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress sx={{ color: 'text.secondary' }} />
          </Box>
        ) : rooms.length === 0 ? (
          <Paper
            elevation={0}
            sx={{
              p: 6,
              borderRadius: 4,
              bgcolor: 'background.paper',
              border: '1px dashed',
              borderColor: 'divider',
              textAlign: 'center'
            }}
          >
            <Typography variant="subtitle1" fontWeight={600} color="text.secondary" sx={{ mb: 1 }}>
              No Rooms Created Yet
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              You haven't created any secure mesh rooms yet. Go back to the dashboard to initialize one.
            </Typography>
            <Button
              variant="contained"
              onClick={() => router.push('/dashboard')}
              sx={{
                py: 1,
                px: 3,
                bgcolor: 'primary.main',
                color: 'primary.contrastText',
                fontWeight: 600,
                textTransform: 'none',
                borderRadius: 2,
                '&:hover': { bgcolor: 'primary.dark' }
              }}
            >
              Go to Dashboard
            </Button>
          </Paper>
        ) : (
          <Stack spacing={2.5}>
            {rooms.map((room) => (
              <Paper
                key={room.id}
                elevation={0}
                onClick={() => router.push(`/room/${room.id}`)}
                sx={{
                  p: 3,
                  borderRadius: 4,
                  bgcolor: 'background.paper',
                  border: '1px solid',
                  borderColor: 'divider',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  '&:hover': { bgcolor: 'action.hover', borderColor: 'primary.main' }
                }}
              >
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="subtitle1" fontWeight={700} color="text.primary">{room.name}</Typography>
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
                        letterSpacing: 2,
                        fontFamily: 'monospace',
                        fontWeight: 600,
                        px: 1,
                        py: 0.5,
                        borderRadius: 1,
                        bgcolor: 'action.hover',
                        width: 'fit-content',
                        '&:hover': { bgcolor: 'action.selected', color: 'primary.main' }
                      }}
                    >
                      {room.syncCode}
                    </Typography>
                  </Tooltip>
                </Box>
                <IconButton
                  size="small"
                  disabled={isDeleting}
                  onClick={(e) => handleDeleteRoom(e, room.id)}
                  sx={{
                    color: 'text.secondary',
                    bgcolor: 'action.hover',
                    '&:hover': { color: 'error.main', bgcolor: 'error.light' }
                  }}
                >
                  <DeleteOutline fontSize="medium" />
                </IconButton>
              </Paper>
            ))}
          </Stack>
        )}
      </Container>
    </Box>
  );
}
