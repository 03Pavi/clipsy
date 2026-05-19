import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../config/firebase-client';
import { Box, Button, List, ListItem, ListItemText, Typography, CircularProgress } from '@mui/material';
import { Check, Close, Lock } from '@mui/icons-material';

interface JoinRequest {
  userId: string;
  userName: string;
  deviceName: string;
  requestedAt: number;
  status: 'pending' | 'approved' | 'rejected';
}

export default function RoomJoinRequests({ roomId }: { roomId: string }) {
  const [requests, setRequests] = useState<JoinRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const requestsRef = collection(db, 'rooms', roomId, 'requests');
    const q = query(requestsRef, where('status', '==', 'pending'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: JoinRequest[] = [];
      snapshot.forEach((doc) => {
        list.push(doc.data() as JoinRequest);
      });
      setRequests(list);
      setIsLoading(false);
    }, (error) => {
      console.error('Error fetching door requests:', error);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [roomId]);

  const handleResolve = async (userId: string, approve: boolean) => {
    try {
      const requestRef = doc(db, 'rooms', roomId, 'requests', userId);
      await updateDoc(requestRef, {
        status: approve ? 'approved' : 'rejected'
      });
    } catch (err) {
      console.error('Failed to resolve join request:', err);
    }
  };

  if (isLoading) {
    return <CircularProgress size={20} sx={{ color: 'rgba(255,255,255,0.4)', my: 2 }} />;
  }

  if (requests.length === 0) {
    return (
      <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem', fontStyle: 'italic' }}>
        No pending door requests.
      </Typography>
    );
  }

  return (
    <List sx={{ pt: 0 }}>
      {requests.map((request) => (
        <ListItem
          key={request.userId}
          sx={{
            px: 2,
            py: 1.5,
            mb: 1.5,
            borderRadius: 3,
            bgcolor: 'rgba(0, 112, 243, 0.05)',
            border: '1px solid rgba(0, 112, 243, 0.15)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'stretch',
            gap: 1.5
          }}
        >
          <ListItemText
            primary={request.deviceName || 'Anonymous Node'}
            primaryTypographyProps={{ sx: { color: '#fff', fontSize: '0.85rem', fontWeight: 600 } }}
            secondary="Knocking at the door..."
            secondaryTypographyProps={{ sx: { color: '#00c6ff', fontSize: '0.75rem', mt: 0.25 } }}
          />
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              fullWidth
              size="small"
              variant="contained"
              color="success"
              onClick={() => handleResolve(request.userId, true)}
              startIcon={<Check />}
              sx={{
                fontSize: '0.75rem',
                textTransform: 'none',
                py: 0.5,
                borderRadius: 1.5,
                background: 'linear-gradient(135deg, #22c55e, #15803d)',
                boxShadow: '0 2px 8px rgba(34, 197, 94, 0.2)'
              }}
            >
              Approve
            </Button>
            <Button
              fullWidth
              size="small"
              variant="outlined"
              color="error"
              onClick={() => handleResolve(request.userId, false)}
              startIcon={<Close />}
              sx={{
                fontSize: '0.75rem',
                textTransform: 'none',
                py: 0.5,
                borderRadius: 1.5,
                borderColor: 'rgba(239, 68, 68, 0.3)',
                color: '#ef4444',
                '&:hover': {
                  bgcolor: 'rgba(239, 68, 68, 0.05)',
                  borderColor: '#ef4444'
                }
              }}
            >
              Deny
            </Button>
          </Box>
        </ListItem>
      ))}
    </List>
  );
}
