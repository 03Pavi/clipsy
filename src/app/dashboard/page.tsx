'use client';
import { useState, useEffect } from 'react';
import { Box, Container, Typography, Tabs, Tab } from '@mui/material';
import { useAuth } from '../../hooks/use-auth';
import { useSyncRoom } from '../../hooks/use-sync-room';
import { signOut, deleteUser } from 'firebase/auth';
import { auth, db } from '../../config/firebase-client';
import { collection, query, where, getDocs, writeBatch, doc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { useThemeToggle } from '../../components/ui/theme-registry';
import { useDispatch } from 'react-redux';
import { resetStore, persistor } from '../../store';
import { deleteRoomFromFirebase } from '../../services/room/delete-room';
import { subscribeUserRooms } from '../../services/room/get-user-rooms';
import { Stack } from '@mui/material';

// Import short dashboard components
import {
  DashboardHeader,
  RoomsSection,
  JoinRoomCard,
  CreateRoomCard,
  KnockingOverlay
} from '../../components/dashboard';

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
  const [tabValue, setTabValue] = useState(0);

  useEffect(() => {
    if (user?.uid) {
      const unsubscribe = subscribeUserRooms(user.uid, (rooms) => {
        setSyncedRooms(rooms);
      });
      return () => unsubscribe();
    }
  }, [user]);

  const myRooms = syncedRooms.filter((room) => room.createdBy === user?.uid);
  const joinedRooms = syncedRooms.filter((room) => room.createdBy !== user?.uid);

  if (!user) return null;

  const handleLogout = async () => {
    try {
      // If anonymous, delete their created rooms, associated data, and delete user account
      if (user.isAnonymous) {
        setIsDeleting(true);

        // 1. Delete all rooms created by this user
        const deletePromises = syncedRooms.map(room => deleteRoomFromFirebase(room.id, user.uid));
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
      <DashboardHeader
        user={user}
        mode={mode}
        toggleTheme={toggleTheme}
        handleLogout={handleLogout}
      />

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

        <Tabs
          value={tabValue}
          onChange={(e, val) => {
            setTabValue(val);
            setShowAllRooms(false);
          }}
          sx={{
            mb: 4,
            borderBottom: '1px solid',
            borderColor: 'divider',
            '& .MuiTab-root': {
              textTransform: 'none',
              fontWeight: 600,
              fontSize: '1rem',
              color: 'text.secondary',
              mr: 2,
              minWidth: 0,
              px: 1,
              '&.Mui-selected': {
                color: 'primary.main',
              },
            },
            '& .MuiTabs-indicator': {
              height: 3,
              borderRadius: '3px 3px 0 0',
              background: 'linear-gradient(135deg, #0070f3, #00c6ff)',
            }
          }}
        >
          <Tab label="Recently Joined Rooms" />
          <Tab label="My Created Rooms" />
        </Tabs>

        {/* Recently Joined Rooms Section */}
        {tabValue === 0 && (
          <RoomsSection
            title="Recently Joined Rooms"
            rooms={joinedRooms}
            showAllRooms={showAllRooms}
            setShowAllRooms={setShowAllRooms}
            showDelete={false}
            copiedRoomId={copiedRoomId}
            setCopiedRoomId={setCopiedRoomId}
          />
        )}
        
        {/* My Created Rooms Section */}
        {tabValue === 1 && (
          <RoomsSection
            title="My Created Rooms"
            rooms={myRooms}
            showAllRooms={showAllRooms}
            setShowAllRooms={setShowAllRooms}
            showDelete={true}
            onDelete={handleDeleteRoom}
            copiedRoomId={copiedRoomId}
            setCopiedRoomId={setCopiedRoomId}
          />
        )}


        {/* Join and Create room Cards */}
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={3}>
          <JoinRoomCard
            syncCode={syncCode}
            setSyncCode={setSyncCode}
            handleJoinRoom={handleJoinRoom}
            isLoading={isLoading}
            isDeleting={isDeleting}
          />

          <CreateRoomCard
            roomName={roomName}
            setRoomName={setRoomName}
            handleCreateRoom={handleCreateRoom}
            isLoading={isLoading}
            isDeleting={isDeleting}
            isAnonymous={user.isAnonymous}
            roomsCount={myRooms.length}
          />
        </Stack>
      </Container>

      {/* Real-time Door Knocking Overlay */}
      <KnockingOverlay
        requestStatus={requestStatus}
        setRequestStatus={setRequestStatus}
      />
    </Box>
  );
}
