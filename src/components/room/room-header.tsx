import { Box, Typography, Paper, IconButton, Stack, Tooltip, Switch, FormControlLabel, Button, Menu, MenuItem } from '@mui/material';
import { useState } from 'react';
import { Room } from '../../types/room.types';
import { ArrowBack, VideoCall, MoreVert, ScreenShare, CameraAlt, Visibility } from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../config/firebase-client';
import { useAuth } from '../../hooks/use-auth';

export default function RoomHeader({ room, onVideoCallClick }: { room: Room, onVideoCallClick?: () => void }) {
  const router = useRouter();
  const [tooltipTitle, setTooltipTitle] = useState('Copy Sync Code');
  const { user } = useAuth();
  const isOwner = room.createdBy === user?.uid;
  const isSomeoneElseBroadcasting = room.activeScreenShare?.active && room.activeScreenShare.sharerId !== user?.uid;
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const handleMenuOpen = (e: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(e.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleAction = (e: React.MouseEvent, action: 'screenshare' | 'streamchat') => {
    setAnchorEl(null);
    router.push(`/room/${room.id}?action=${action}`);
  };

  const handleTogglePrivacy = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const roomRef = doc(db, 'rooms', room.id);
      await updateDoc(roomRef, {
        isPrivate: e.target.checked
      });
      
      // Update joinedRooms log for this owner as well so it stays synced
      if (user) {
        await updateDoc(doc(db, 'users', user.uid, 'joinedRooms', room.id), {
          isPrivate: e.target.checked
        });
      }
    } catch (err) {
      console.error('Failed to update room privacy:', err);
    }
  };

  return (
    <>
      <style>{`
        @keyframes pulse {
          0% { opacity: 0.4; }
          50% { opacity: 1; }
          100% { opacity: 0.4; }
        }
      `}</style>
      <Paper
      elevation={0}
      sx={{
        p: { xs: 2, sm: 4 },
        borderRadius: 4,
        display: 'flex',
        flexDirection: { xs: 'column', sm: 'row' },
        justifyContent: 'space-between',
        alignItems: { xs: 'flex-start', sm: 'center' },
        gap: { xs: 2, sm: 0 },
        bgcolor: '#111622',
        border: '1px solid rgba(255, 255, 255, 0.05)',
        boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
      }}
    >
      <Box sx={{ width: { xs: '100%', sm: 'auto' } }}>
        <Stack flexDirection={'row'} alignItems={'center'} gap={1} sx={{ flexWrap: 'wrap' }}>
          <IconButton
            onClick={() => router.push('/dashboard')}
            sx={{
              bgcolor: 'background.paper',
              border: '1px solid',
              borderColor: 'divider',
              '&:hover': { bgcolor: 'action.hover' }
            }}
          >
            <ArrowBack />
          </IconButton>
          <Box>
            <Typography variant="h5" fontWeight="bold" sx={{ color: '#fff', wordBreak: 'break-all' }}>{room.name}</Typography>
            {isOwner ? (
              <FormControlLabel
                control={
                  <Switch
                    checked={room.isPrivate || false}
                    onChange={handleTogglePrivacy}
                    color="primary"
                    size="small"
                  />
                }
                label={room.isPrivate ? "Private Room" : "Public Room"}
                componentsProps={{ typography: { sx: { fontSize: '0.8rem', color: room.isPrivate ? 'secondary.main' : 'rgba(255,255,255,0.4)', fontWeight: 600 } } }}
                sx={{ mt: 0.5, ml: 0 }}
              />
            ) : (
              <Typography variant="caption" sx={{ color: room.isPrivate ? 'secondary.main' : 'rgba(255,255,255,0.4)', fontWeight: 600, display: 'block', mt: 0.5 }}>
                {room.isPrivate ? "🔒 Private Room" : "🔓 Public Room"}
              </Typography>
            )}
          </Box>
        </Stack>
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 3, pl: { xs: 6, sm: 0 } }}>
        <Box sx={{ textAlign: { xs: 'left', sm: 'right' } }}>
          <Typography variant="caption" sx={{ display: 'block', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '1px' }}>
            Sync Code
          </Typography>
          <Tooltip title={tooltipTitle}>
            <Typography 
              variant="h4" 
              onClick={() => {
                navigator.clipboard.writeText(room.syncCode);
                setTooltipTitle('Copied!');
                setTimeout(() => setTooltipTitle('Copy Sync Code'), 1000);
              }}
              sx={{ 
                letterSpacing: { xs: 4, sm: 6 }, 
                fontFamily: 'monospace', 
                color: '#00c6ff', 
                fontWeight: 'bold',
                cursor: 'pointer',
                transition: 'all 0.2s',
                '&:hover': { color: '#0070f3', transform: 'scale(1.02)' }
              }}
            >
              {room.syncCode}
            </Typography>
          </Tooltip>
        </Box>

        {isSomeoneElseBroadcasting && (
          <Tooltip title={`Watch ${room.activeScreenShare?.sharerName}'s Live Stream`}>
            <IconButton
              onClick={() => router.push(`/room/${room.id}?action=watch`)}
              sx={{
                color: '#00c6ff',
                bgcolor: 'rgba(0, 198, 255, 0.1)',
                border: '1px solid rgba(0, 198, 255, 0.2)',
                animation: 'pulse 1.8s infinite',
                mr: 1,
                '&:hover': {
                  bgcolor: 'rgba(0, 198, 255, 0.2)',
                  borderColor: '#00c6ff'
                }
              }}
            >
              <Visibility />
            </IconButton>
          </Tooltip>
        )}

        <IconButton
          size="small"
          onClick={handleMenuOpen}
          sx={{
            color: 'text.secondary',
            '&:hover': { color: 'primary.main', bgcolor: 'action.hover' }
          }}
        >
          <MoreVert fontSize="small" />
        </IconButton>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
        onClick={(e) => e.stopPropagation()}
        PaperProps={{
          sx: {
            bgcolor: 'background.paper',
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 2,
            minWidth: 160,
            boxShadow: '0 4px 20px rgba(0,0,0,0.3)'
          }
        }}
      >
        <MenuItem onClick={(e) => handleAction(e, 'screenshare')} sx={{ gap: 1.5, py: 1 }}>
          <ScreenShare fontSize="small" sx={{ color: '#0070f3' }} />
          <Typography variant="body2" fontWeight={500}>Start Screen Share</Typography>
        </MenuItem>
        <MenuItem onClick={(e) => handleAction(e, 'streamchat')} sx={{ gap: 1.5, py: 1 }}>
          <CameraAlt fontSize="small" sx={{ color: '#22c55e' }} />
          <Typography variant="body2" fontWeight={500}>Stream Chat</Typography>
        </MenuItem>
      </Menu>
{/* 
        {onVideoCallClick && !room.isTemporary && (
          <IconButton
            onClick={onVideoCallClick}
            sx={{
              py: 1.2,
              px: 2.5,
              borderRadius: 3,
              fontWeight: 600,
              textTransform: 'none',
              background: 'linear-gradient(135deg, #0070f3, #00c6ff)',
              boxShadow: '0 4px 14px rgba(0, 112, 243, 0.4)',
              transition: 'all 0.2s',
              '&:hover': {
                transform: 'translateY(-1px)',
                boxShadow: '0 6px 20px rgba(0, 112, 243, 0.5)',
              }
            }}
          ><VideoCall />
          </IconButton>
        )} */}
      </Box>
    </Paper>
    </>
  );
}
