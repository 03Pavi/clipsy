'use client';
import { useEffect, useState } from 'react';
import { Box, Typography, Button, Stack } from '@mui/material';
import { Phone, CallEnd } from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import { collectionGroup, query, where, onSnapshot, doc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../config/firebase-client';
import { useAuth } from '../../hooks/use-auth';
import { deviceStorage } from '../../lib/device/device-storage';

export default function GlobalCallListener() {
  const { user } = useAuth();
  const router = useRouter();
  const [incomingCall, setIncomingCall] = useState<any | null>(null);

  useEffect(() => {
    if (!user) {
      setIncomingCall(null);
      return;
    }

    // Use a Firestore collectionGroup query to find any pending call targeting this user across all rooms
    const q = query(
      collectionGroup(db, 'video-calls'),
      where('targetUserId', '==', user.uid),
      where('status', '==', 'pending')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        // Active incoming call detected
        const callData = snapshot.docs[0].data();
        setIncomingCall(callData);
      } else {
        setIncomingCall(null);
      }
    }, (error) => {
      console.error('GlobalCallListener error:', error);
    });

    return () => unsubscribe();
  }, [user]);

  const handleAcceptCall = async () => {
    if (!incomingCall || !user) return;
    try {
      // Reference call request doc within the specific parent room
      const callRef = doc(db, 'rooms', incomingCall.roomId, 'video-calls', incomingCall.id);
      const tempRoomId = incomingCall.tempRoomId;

      // 1. Create the temporary room document
      await setDoc(doc(db, 'rooms', tempRoomId), {
        id: tempRoomId,
        name: `Chat: ${incomingCall.callerName} & ${user.displayName || 'Guest'}`,
        syncCode: Math.random().toString(36).substring(2, 8).toUpperCase(),
        createdBy: incomingCall.callerId,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        isPrivate: false,
        isTemporary: true
      });

      // 2. Register participants in the new temporary room
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

      // 3. Mark the call request as approved
      await updateDoc(callRef, { status: 'approved' });

      // 4. Clear overlay and redirect receiver to the temporary video room
      setIncomingCall(null);
      router.push(`/room/${tempRoomId}`);
    } catch (err) {
      console.error('Failed to accept call globally:', err);
    }
  };

  const handleDeclineCall = async () => {
    if (!incomingCall) return;
    try {
      const callRef = doc(db, 'rooms', incomingCall.roomId, 'video-calls', incomingCall.id);
      await updateDoc(callRef, { status: 'rejected' });
      setIncomingCall(null);
    } catch (err) {
      console.error('Failed to decline call globally:', err);
    }
  };

  if (!incomingCall) return null;

  return (
    <Box
      sx={{
        position: 'fixed',
        top: 24,
        right: 24,
        bgcolor: 'rgba(17, 22, 34, 0.95)',
        backdropFilter: 'blur(16px)',
        border: '1px solid rgba(0, 198, 255, 0.25)',
        boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
        borderRadius: 4,
        p: 3,
        zIndex: 99999,
        width: 320,
        animation: 'pulseBorderIncoming 2s infinite ease-in-out'
      }}
    >
      <style>{`
        @keyframes pulseBorderIncoming {
          0% { border-color: rgba(0, 198, 255, 0.25); }
          50% { border-color: rgba(0, 198, 255, 0.7); }
          100% { border-color: rgba(0, 198, 255, 0.25); }
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
            bgcolor: 'rgba(0, 198, 255, 0.1)',
            color: '#00c6ff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            animation: 'incomingPulse 1.5s infinite ease-in-out'
          }}
        >
          <Phone />
        </Box>
        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="subtitle2" fontWeight={600} sx={{ color: '#fff' }}>
            Incoming Call
          </Typography>
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.6)' }}>
            {incomingCall.callerName} wants to video chat.
          </Typography>
        </Box>
      </Stack>
      <Stack direction="row" spacing={1.5} justifyContent="flex-end">
        <Button
          size="small"
          variant="outlined"
          color="error"
          onClick={handleDeclineCall}
          sx={{ textTransform: 'none', borderRadius: 2, fontWeight: 600 }}
        >
          Decline
        </Button>
        <Button
          size="small"
          variant="contained"
          color="success"
          onClick={handleAcceptCall}
          sx={{ textTransform: 'none', borderRadius: 2, fontWeight: 600, bgcolor: '#22c55e', '&:hover': { bgcolor: '#16a34a' } }}
        >
          Accept
        </Button>
      </Stack>
    </Box>
  );
}
