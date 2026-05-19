import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, orderBy, doc, deleteDoc, getDoc } from 'firebase/firestore';
import { db } from '../../config/firebase-client';
import { 
  Box, 
  List, 
  ListItem, 
  ListItemIcon, 
  ListItemText, 
  Typography, 
  Chip, 
  IconButton, 
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Avatar,
  Divider,
  CircularProgress
} from '@mui/material';
import { Computer, PhoneIphone, DeleteOutline } from '@mui/icons-material';
import { Room } from '../../types/room.types';
import { useAuthStore } from '../../stores/auth-store';

interface Participant {
  id: string;
  roomId: string;
  userId: string;
  deviceId: string;
  deviceName: string;
  joinedAt: number;
  role: 'owner' | 'member';
}

export default function RoomDeviceList({ roomId, room }: { roomId: string; room: Room }) {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuthStore();
  
  // Modal / popover details state
  const [selectedParticipant, setSelectedParticipant] = useState<Participant | null>(null);
  const [ownerDetails, setOwnerDetails] = useState<any | null>(null);
  const [loadingOwner, setLoadingOwner] = useState(false);

  const isOwner = room.createdBy === user?.uid;

  useEffect(() => {
    const participantsRef = collection(db, 'rooms', roomId, 'participants');
    const q = query(participantsRef, orderBy('joinedAt', 'asc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: Participant[] = [];
      snapshot.forEach((doc) => {
        list.push(doc.data() as Participant);
      });
      setParticipants(list);
      setIsLoading(false);
    }, (error) => {
      console.error('Error fetching participants presence:', error);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [roomId]);

  const handleKick = async (e: React.MouseEvent, participantId: string, participantUserId: string) => {
    e.stopPropagation(); // Stop item click modal trigger
    if (window.confirm('Are you sure you want to remove this device from the room?')) {
      try {
        // Remove participant presence doc
        await deleteDoc(doc(db, 'rooms', roomId, 'participants', participantId));
        // Remove door peering request doc so they are fully booted and must knock to rejoin
        await deleteDoc(doc(db, 'rooms', roomId, 'requests', participantUserId));
      } catch (err) {
        console.error('Failed to kick device node:', err);
      }
    }
  };

  const handleDeviceClick = async (participant: Participant) => {
    setSelectedParticipant(participant);
    setLoadingOwner(true);
    setOwnerDetails(null);
    try {
      const userSnap = await getDoc(doc(db, 'users', participant.userId));
      if (userSnap.exists()) {
        setOwnerDetails(userSnap.data());
      } else {
        setOwnerDetails({
          displayName: 'Anonymous Guest',
          isAnonymous: true,
          photoURL: '',
          email: 'No Email Provided (Anonymous)'
        });
      }
    } catch (err) {
      console.error('Failed to fetch node owner details:', err);
      setOwnerDetails({
        displayName: 'Anonymous Mesh Node',
        isAnonymous: true,
        photoURL: '',
        email: 'No Email (External Device)'
      });
    } finally {
      setLoadingOwner(false);
    }
  };

  if (isLoading) {
    return <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.9rem' }}>Loading participants presence...</Typography>;
  }

  if (participants.length === 0) {
    return <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.9rem' }}>No participants joined.</Typography>;
  }

  return (
    <>
      <List sx={{ pt: 0 }}>
        {participants.map((participant) => {
          const isPhone = participant.deviceName.toLowerCase().includes('phone') || 
                          participant.deviceName.toLowerCase().includes('android') || 
                          participant.deviceName.toLowerCase().includes('ios');
          
          const isSelf = participant.userId === user?.uid && participant.deviceId === user?.uid; // simple self check
          const showKick = isOwner && participant.userId !== user?.uid;

          return (
            <ListItem 
              key={participant.id} 
              onClick={() => handleDeviceClick(participant)}
              sx={{ 
                px: 2, 
                py: 1.5,
                mb: 1.2,
                borderRadius: 3,
                bgcolor: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.05)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
                transition: 'all 0.2s',
                '&:hover': {
                  bgcolor: 'rgba(255,255,255,0.04)',
                  borderColor: 'rgba(255,255,255,0.1)'
                }
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <ListItemIcon sx={{ minWidth: 'auto', color: 'rgba(255,255,255,0.6)' }}>
                  {isPhone ? <PhoneIphone fontSize="small" /> : <Computer fontSize="small" />}
                </ListItemIcon>
                <ListItemText 
                  primary={participant.deviceName}
                  primaryTypographyProps={{ sx: { color: '#fff', fontSize: '0.9rem', fontWeight: 600 } }}
                  secondary={participant.role === 'owner' ? 'Room Initiator' : 'Active Node'}
                  secondaryTypographyProps={{ 
                    sx: { 
                      color: participant.role === 'owner' ? '#0070f3' : 'rgba(255,255,255,0.4)', 
                      fontSize: '0.75rem', 
                      fontWeight: participant.role === 'owner' ? 600 : 400,
                      mt: 0.25 
                    } 
                  }}
                />
              </Box>
              
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                
                {showKick && (
                  <Tooltip title="Remove node device">
                    <IconButton 
                      size="small" 
                      onClick={(e) => handleKick(e, participant.id, participant.userId)}
                      sx={{ 
                        color: 'rgba(255,255,255,0.4)', 
                        '&:hover': { color: 'error.main', bgcolor: 'rgba(244, 67, 54, 0.1)' } 
                      }}
                    >
                      <DeleteOutline fontSize="small" />
                    </IconButton>
                  </Tooltip>
                )}
              </Box>
            </ListItem>
          );
        })}
      </List>

      {/* Device & Owner Profile Info Dialog */}
      <Dialog
        open={Boolean(selectedParticipant)}
        onClose={() => setSelectedParticipant(null)}
        PaperProps={{
          sx: {
            bgcolor: '#111622',
            backgroundImage: 'none',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 4,
            p: 1,
            color: '#fff',
            minWidth: { xs: 280, sm: 360 }
          }
        }}
      >
        <DialogTitle sx={{ fontWeight: 600, pb: 1, color: '#fff' }}>Device Node Info</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          {loadingOwner ? (
            <Box display="flex" justifyContent="center" py={4}>
              <CircularProgress size={30} sx={{ color: 'primary.main' }} />
            </Box>
          ) : (
            selectedParticipant && (
              <Box display="flex" flexDirection="column" gap={3} mt={1}>
                {/* Device Info */}
                <Box display="flex" alignItems="center" gap={2}>
                  <Box sx={{ p: 1.5, bgcolor: 'rgba(0,112,243,0.1)', border: '1px solid rgba(0,112,243,0.25)', borderRadius: 3, display: 'flex', color: '#0070f3' }}>
                    {selectedParticipant.deviceName.toLowerCase().includes('phone') || 
                     selectedParticipant.deviceName.toLowerCase().includes('android') || 
                     selectedParticipant.deviceName.toLowerCase().includes('ios') ? (
                      <PhoneIphone fontSize="medium" />
                    ) : (
                      <Computer fontSize="medium" />
                    )}
                  </Box>
                  <Box>
                    <Typography variant="subtitle1" fontWeight={700} color="#fff">
                      {selectedParticipant.deviceName}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', display: 'block' }}>
                      Role: {selectedParticipant.role.toUpperCase()}
                    </Typography>
                  </Box>
                </Box>

                <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)' }} />

                {/* Node Owner Info */}
                <Box>
                  <Typography variant="caption" display="block" sx={{ color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '1px', mb: 1.5, fontWeight: 700 }}>
                    Node Owner Profile
                  </Typography>
                  <Box display="flex" alignItems="center" gap={2} p={2} sx={{ bgcolor: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', borderRadius: 3 }}>
                    <Avatar 
                      src={ownerDetails?.photoURL} 
                      sx={{ bgcolor: 'primary.main', width: 44, height: 44, fontSize: '1.1rem', fontWeight: 600 }}
                    >
                      {ownerDetails?.displayName?.charAt(0) || 'U'}
                    </Avatar>
                    <Box>
                      <Typography variant="body2" fontWeight={600} color="#fff">
                        {ownerDetails?.displayName || 'Anonymous Guest'}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', display: 'block', wordBreak: 'break-all' }}>
                        {ownerDetails?.email || 'No email attached'}
                      </Typography>
                      <Chip 
                        label={ownerDetails?.isAnonymous ? "Guest Node" : "Verified Node"}
                        size="small"
                        sx={{ 
                          mt: 0.75, 
                          height: 18, 
                          fontSize: '0.6rem', 
                          fontWeight: 700,
                          bgcolor: ownerDetails?.isAnonymous ? 'rgba(255, 167, 38, 0.15)' : 'rgba(76, 175, 80, 0.15)',
                          color: ownerDetails?.isAnonymous ? '#ffa726' : '#66bb6a',
                          border: '1px solid',
                          borderColor: ownerDetails?.isAnonymous ? 'rgba(255, 167, 38, 0.3)' : 'rgba(76, 175, 80, 0.3)'
                        }}
                      />
                    </Box>
                  </Box>
                </Box>
              </Box>
            )
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 1 }}>
          <Button 
            variant="outlined" 
            onClick={() => setSelectedParticipant(null)} 
            sx={{ 
              borderColor: 'rgba(255,255,255,0.1)', 
              color: 'rgba(255,255,255,0.6)', 
              textTransform: 'none', 
              '&:hover': { borderColor: '#fff', color: '#fff', bgcolor: 'transparent' } 
            }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
