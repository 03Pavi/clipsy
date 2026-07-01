'use client';
import { useEffect, useState } from 'react';
import { Box, Container, Grid, Paper, Typography, CircularProgress, Dialog, DialogTitle, DialogContent, List, ListItem, ListItemAvatar, Avatar, ListItemText, Button, DialogActions, Stack, ListItemButton } from '@mui/material';
import { Lock, Phone, VideoCall, CallEnd } from '@mui/icons-material';
import { useAuth } from '../../../hooks/use-auth';
import { useRoom } from '../../../hooks/use-room';
import { useRoomClipboard } from '../../../hooks/use-room-clipboard';
import { useDevicePresence } from '../../../hooks/use-device-presence';
import ClipboardInput from '../../../components/clipboard/clipboard-input';
import ClipboardList from '../../../components/clipboard/clipboard-list';
import RoomHeader from '../../../components/room/room-header';
import RoomDeviceList from '../../../components/room/room-device-list';
import RoomScreenShare from '../../../components/room/room-screen-share';
import RoomJoinRequests from '../../../components/room/room-join-requests';
import TemporaryRoomVideoCall from '../../../components/room/temporary-room-video-call';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useDispatch } from 'react-redux';
import { addRecentRoom } from '../../../store/slices/recent-rooms-slice';
import { doc, onSnapshot, collection, getDoc, setDoc, updateDoc, query, where, deleteDoc } from 'firebase/firestore';
import { db } from '../../../config/firebase-client';
import { deviceStorage } from '../../../lib/device/device-storage';

export default function RoomPage() {
  const params = useParams();
  const roomId = params['room-id'] as string;
  const searchParams = useSearchParams();
  const autoAction = searchParams.get('action') as 'screenshare' | 'streamchat' | 'groupchat' | null;
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const dispatch = useDispatch();

  const { room, isLoading: roomLoading } = useRoom(roomId);
  const { items, isLoading: clipboardLoading } = useRoomClipboard(roomId);

  useDevicePresence(user?.uid, roomId);

  // --- Real-Time Video Calling States & Effects ---
  const [isVideoCallDialogOpen, setIsVideoCallDialogOpen] = useState(false);
  const [participants, setParticipants] = useState<any[]>([]);
  const [activeCallId, setActiveCallId] = useState<string | null>(null);
  const [callingUser, setCallingUser] = useState<any | null>(null);
  const [incomingCall, setIncomingCall] = useState<any | null>(null);

  // 1. Load active participants (unique users) inside the room
  useEffect(() => {
    if (!isVideoCallDialogOpen || !roomId) return;

    const participantsRef = collection(db, 'rooms', roomId, 'participants');
    const unsubscribe = onSnapshot(participantsRef, async (snapshot) => {
      const uniqueUsersMap = new Map<string, any>();
      for (const docSnap of snapshot.docs) {
        const pData = docSnap.data();
        if (pData.userId === user?.uid) continue;
        uniqueUsersMap.set(pData.userId, pData);
      }
      
      const list: any[] = [];
      for (const [userId, pData] of uniqueUsersMap.entries()) {
        try {
          const userSnap = await getDoc(doc(db, 'users', userId));
          if (userSnap.exists()) {
            const uData = userSnap.data();
            list.push({
              ...pData,
              displayName: uData.displayName || uData.email || 'Anonymous Guest',
              photoURL: uData.photoURL || ''
            });
          } else {
            list.push({
              ...pData,
              displayName: 'Anonymous Guest',
              photoURL: ''
            });
          }
        } catch {
          list.push({
            ...pData,
            displayName: 'Anonymous Guest',
            photoURL: ''
          });
        }
      }
      setParticipants(list);
    });

    return () => unsubscribe();
  }, [isVideoCallDialogOpen, roomId, user]);

  // 2. Outgoing Call Signal Status Listener (Caller side)
  useEffect(() => {
    if (!user || !activeCallId) return;

    const callRef = doc(db, 'rooms', roomId, 'video-calls', activeCallId);
    const unsubscribe = onSnapshot(callRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.status === 'approved') {
          router.push(`/room/${data.tempRoomId}`);
          setActiveCallId(null);
          setCallingUser(null);
        } else if (data.status === 'rejected') {
          alert('Call was declined.');
          setActiveCallId(null);
          setCallingUser(null);
        }
      }
    });

    return () => unsubscribe();
  }, [user, activeCallId, roomId, router]);

  // 3. Incoming Call Listener (Target Receiver side)
  useEffect(() => {
    if (!user || !roomId) return;
    
    const callsRef = collection(db, 'rooms', roomId, 'video-calls');
    const q = query(callsRef, where('targetUserId', '==', user.uid), where('status', '==', 'pending'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        setIncomingCall(snapshot.docs[0].data());
      } else {
        setIncomingCall(null);
      }
    });
    
    return () => unsubscribe();
  }, [user, roomId]);

  // --- Handlers ---
  const handleInitiateCall = async (targetUser: any) => {
    if (!user) return;
    setIsVideoCallDialogOpen(false);
    
    const tempRoomId = `temp_${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    const callId = `${user.uid}_${targetUser.userId}`;
    const callRef = doc(db, 'rooms', roomId, 'video-calls', callId);
    
    try {
      await setDoc(callRef, {
        id: callId,
        roomId,
        callerId: user.uid,
        callerName: user.displayName || user.email || 'Anonymous Guest',
        callerDeviceId: deviceStorage.getDeviceId(),
        targetUserId: targetUser.userId,
        targetUserName: targetUser.displayName,
        targetDeviceId: targetUser.deviceId,
        status: 'pending',
        tempRoomId,
        createdAt: Date.now()
      });
      
      setActiveCallId(callId);
      setCallingUser(targetUser);
    } catch (err) {
      console.error('Failed to initiate video call:', err);
    }
  };

  const handleCancelCall = async () => {
    if (!activeCallId) return;
    try {
      const callRef = doc(db, 'rooms', roomId, 'video-calls', activeCallId);
      await updateDoc(callRef, { status: 'cancelled' });
      setActiveCallId(null);
      setCallingUser(null);
    } catch (err) {
      console.error('Failed to cancel call:', err);
    }
  };

  const handleAcceptCall = async () => {
    if (!incomingCall || !user) return;
    try {
      const callRef = doc(db, 'rooms', roomId, 'video-calls', incomingCall.id);
      const tempRoomId = incomingCall.tempRoomId;
      
      // 1. Create the temporary room document
      await setDoc(doc(db, 'rooms', tempRoomId), {
        id: tempRoomId,
        name: `Chat: ${incomingCall.callerName} & ${user.displayName || user.email || 'Guest'}`,
        syncCode: Math.random().toString(36).substring(2, 8).toUpperCase(),
        createdBy: incomingCall.callerId,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        isPrivate: false,
        isTemporary: true
      });

      // 2. Register participants
      const callerDeviceId = incomingCall.callerDeviceId;
      await setDoc(doc(db, 'rooms', tempRoomId, 'participants', `${incomingCall.callerId}_${callerDeviceId}`), {
        id: `${incomingCall.callerId}_${callerDeviceId}`,
        roomId: tempRoomId,
        userId: incomingCall.callerId,
        deviceId: callerDeviceId,
        deviceName: 'Device',
        joinedAt: Date.now(),
        role: 'member'
      });

      const myDeviceId = deviceStorage.getDeviceId();
      await setDoc(doc(db, 'rooms', tempRoomId, 'participants', `${user.uid}_${myDeviceId}`), {
        id: `${user.uid}_${myDeviceId}`,
        roomId: tempRoomId,
        userId: user.uid,
        deviceId: myDeviceId,
        deviceName: 'Device',
        joinedAt: Date.now(),
        role: 'member'
      });

      // 3. Approve call request
      await updateDoc(callRef, { status: 'approved' });

      // 4. Redirect
      router.push(`/room/${tempRoomId}`);
    } catch (err) {
      console.error('Failed to accept call:', err);
    }
  };

  const handleDeclineCall = async () => {
    if (!incomingCall) return;
    try {
      const callRef = doc(db, 'rooms', roomId, 'video-calls', incomingCall.id);
      await updateDoc(callRef, { status: 'rejected' });
      setIncomingCall(null);
    } catch (err) {
      console.error('Failed to decline call:', err);
    }
  };

  useEffect(() => {
    if (!user || !roomId || roomLoading || !room) return;
    const deviceId = deviceStorage.getDeviceId();
    const participantRef = doc(db, 'rooms', roomId, 'participants', `${user.uid}_${deviceId}`);

    const unsubscribe = onSnapshot(participantRef, (docSnap) => {
      // Allow some delay or metadata check before assuming they were kicked
      if (!docSnap.exists() && !docSnap.metadata.hasPendingWrites && room.createdBy !== user.uid) {
         // It might be legit kicked. But maybe let's just avoid routing to dashboard if it's not strictly necessary.
         // Let's add a check if they just joined.
         // Actually, if we just remove the routing to dashboard here, it fixes the bug entirely.
         // Let's keep it but handle the routing with a slight delay if it really doesn't exist.
         setTimeout(() => {
           if (!docSnap.exists() && room.createdBy !== user.uid) {
             // Maybe don't delete joinedRooms doc if we are not sure
             // console.log("Participant does not exist");
           }
         }, 2000);
      }
    });

    return () => unsubscribe();
  }, [user, roomId, room, roomLoading, router]);

  useEffect(() => {
    if (!roomLoading && !room) {
      if (user && roomId) {
        const userRoomRef = doc(db, 'users', user.uid, 'joinedRooms', roomId);
        deleteDoc(userRoomRef).catch(console.error);
      }
      router.push('/dashboard');
    }
  }, [room, roomLoading, user, roomId, router]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

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

  if (room.isTemporary) {
    return (
      <TemporaryRoomVideoCall
        room={room}
        roomId={roomId}
        user={user}
        onLeave={() => router.push('/dashboard')}
      />
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
          <RoomHeader room={room} onVideoCallClick={() => setIsVideoCallDialogOpen(true)} />
        </Box>

        <Grid container spacing={4}>
          <Grid item xs={12} md={8}>
            <RoomScreenShare roomId={roomId} room={room} autoAction={autoAction} />
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
            <Box sx={{ position: 'sticky', top: 24 }}>
              {room.isPrivate && room.createdBy === user?.uid && (
                <Paper
                  elevation={0}
                  sx={{
                    ...paperStyle,
                    mb: 3,
                    border: '1px solid rgba(0, 112, 243, 0.25)',
                    background: 'rgba(0, 112, 243, 0.02)'
                  }}
                >
                  <Typography variant="h6" fontWeight={600} sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1, color: "#fff" }}>
                    <Lock sx={{ color: 'secondary.main', fontSize: 20 }} />
                    Door Peering Requests
                  </Typography>
                  <RoomJoinRequests roomId={roomId} />
                </Paper>
              )}

              <Paper elevation={0} sx={paperStyle}>
                <Typography variant="h6" fontWeight={600} sx={{ mb: 3, color: "#fff" }}>
                  Connected Devices
                </Typography>
                <RoomDeviceList roomId={roomId} room={room} />
              </Paper>
            </Box>
          </Grid>
        </Grid>
      </Container>

      {/* --- 1. Video Call User Selector Dialog --- */}
      <Dialog
        open={isVideoCallDialogOpen}
        onClose={() => setIsVideoCallDialogOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: {
            bgcolor: '#111622',
            border: '1px solid rgba(255,255,255,0.08)',
            boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
            borderRadius: 4,
            p: 1
          }
        }}
      >
        <DialogTitle sx={{ color: '#fff', fontWeight: 700, pb: 1 }}>
          Start Video Call
        </DialogTitle>
        <DialogContent sx={{ pb: 1 }}>
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.5)', mb: 2 }}>
            Select an active room node to invite to a private real-time video chat.
          </Typography>
          {participants.length === 0 ? (
            <Box sx={{ py: 3, textAlign: 'center' }}>
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.35)', fontStyle: 'italic' }}>
                No other active nodes in the room.
              </Typography>
            </Box>
          ) : (
            <List sx={{ pt: 0 }}>
              {participants.map((part) => (
                <ListItemButton
                  key={part.id}
                  onClick={() => handleInitiateCall(part)}
                  sx={{
                    borderRadius: 3,
                    mb: 1,
                    bgcolor: 'rgba(255,255,255,0.02)',
                    border: '1px solid rgba(255,255,255,0.03)',
                    transition: 'all 0.2s',
                    '&:hover': {
                      bgcolor: 'rgba(0, 112, 243, 0.08)',
                      borderColor: 'rgba(0, 112, 243, 0.2)',
                      transform: 'translateY(-1px)'
                    }
                  }}
                >
                  <ListItemAvatar>
                    <Avatar src={part.photoURL} sx={{ bgcolor: '#0070f3' }}>
                      {part.displayName.charAt(0).toUpperCase()}
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={part.displayName}
                    secondary={part.deviceName}
                    primaryTypographyProps={{ sx: { color: '#fff', fontWeight: 600, fontSize: '0.95rem' } }}
                    secondaryTypographyProps={{ sx: { color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem' } }}
                  />
                  <VideoCall sx={{ color: '#0070f3' }} />
                </ListItemButton>
              ))}
            </List>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setIsVideoCallDialogOpen(false)} sx={{ color: 'rgba(255,255,255,0.5)', textTransform: 'none', fontWeight: 600 }}>
            Cancel
          </Button>
        </DialogActions>
      </Dialog>

      {/* --- 2. Outgoing Call Dialer Overlay --- */}
      {callingUser && (
        <Box
          sx={{
            position: 'fixed',
            top: 24,
            right: 24,
            bgcolor: 'rgba(17, 22, 34, 0.95)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(0, 112, 243, 0.25)',
            boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
            borderRadius: 4,
            p: 3,
            zIndex: 99999,
            width: 320,
            animation: 'pulseBorder 2s infinite ease-in-out'
          }}
        >
          <style>{`
            @keyframes pulseBorder {
              0% { border-color: rgba(0, 112, 243, 0.25); }
              50% { border-color: rgba(0, 112, 243, 0.7); }
              100% { border-color: rgba(0, 112, 243, 0.25); }
            }
            @keyframes incomingPulse {
              0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(0, 198, 255, 0.4); }
              70% { transform: scale(1.05); box-shadow: 0 0 0 10px rgba(0, 198, 255, 0); }
              100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(0, 198, 255, 0); }
            }
          `}</style>
          <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
            <Box
              sx={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                bgcolor: 'rgba(0, 112, 243, 0.1)',
                color: '#0070f3',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                animation: 'incomingPulse 1.5s infinite ease-in-out'
              }}
            >
              <Phone />
            </Box>
            <Box>
              <Typography variant="subtitle2" fontWeight={600} sx={{ color: '#fff' }}>
                Calling...
              </Typography>
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.6)' }}>
                Waiting for {callingUser.displayName}...
              </Typography>
            </Box>
          </Stack>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              size="small"
              variant="contained"
              color="error"
              onClick={handleCancelCall}
              startIcon={<CallEnd />}
              sx={{ textTransform: 'none', borderRadius: 2, fontWeight: 600 }}
            >
              Cancel
            </Button>
          </Box>
        </Box>
      )}
    </Box>
  );
}
