'use client';
import { useEffect } from 'react';
import { Box, Container, Grid, Paper, Typography, CircularProgress } from '@mui/material';
import { useAuth } from '../../../hooks/use-auth';
import { useRoom } from '../../../hooks/use-room';
import { useRoomClipboard } from '../../../hooks/use-room-clipboard';
import { useDevicePresence } from '../../../hooks/use-device-presence';
import ClipboardInput from '../../../components/clipboard/clipboard-input';
import ClipboardList from '../../../components/clipboard/clipboard-list';
import RoomHeader from '../../../components/room/room-header';
import RoomDeviceList from '../../../components/room/room-device-list';
import { useParams, useRouter } from 'next/navigation';
import { useDispatch } from 'react-redux';
import { addRecentRoom } from '../../../store/slices/recent-rooms-slice';

export default function RoomPage() {
  const params = useParams();
  const roomId = params['room-id'] as string;
  const { user } = useAuth();
  const router = useRouter();
  const dispatch = useDispatch();

  const { room, isLoading: roomLoading } = useRoom(roomId);
  const { items, isLoading: clipboardLoading } = useRoomClipboard(roomId);

  useDevicePresence(user?.uid, roomId);

  useEffect(() => {
    if (!user) {
      router.push('/login');
    }
  }, [user, router]);

  useEffect(() => {
    if (room) {
      dispatch(addRecentRoom({
        id: room.id,
        name: room.name,
        syncCode: room.syncCode,
        lastAccessed: Date.now()
      }));
    }
  }, [room, dispatch]);

  if (roomLoading || !room) {
    return (
      <Box sx={{ minHeight: '100vh', bgcolor: '#0a0d14', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <CircularProgress sx={{ color: "GrayText" }} />
      </Box>
    );
  }

  const paperStyle = {
    p: 3,
    borderRadius: 4,
    bgcolor: 'background.paper',
    border: '1px solid',
    borderColor: 'divider',
    boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', color: 'text.primary', fontFamily: 'Inter, sans-serif' }}>
      <Container maxWidth="lg" sx={{ py: 6 }}>

        <Box sx={{ mb: 2 }}>
          <RoomHeader room={room} />
        </Box>

        <Grid container spacing={4}>
          <Grid item xs={12} md={8}>
            <Paper elevation={0} sx={{ ...paperStyle, mb: 4 }}>
              <ClipboardInput roomId={roomId} />
            </Paper>
            <Paper elevation={0} sx={{ ...paperStyle, minHeight: '50vh' }}>
              <Typography variant="h6" fontWeight={600} sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1, color: "#fff" }}>
                Clipboard History
              </Typography>
              <ClipboardList items={items} loading={clipboardLoading} />
            </Paper>
          </Grid>

          <Grid item xs={12} md={4}>
            <Paper elevation={0} sx={{ ...paperStyle, position: 'sticky', top: 24 }}>
              <Typography variant="h6" fontWeight={600} sx={{ mb: 3, color: "#fff" }}>
                Connected Devices
              </Typography>
              <RoomDeviceList roomId={roomId} />
            </Paper>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
}
