'use client';
import { useState } from 'react';
import { Box, Paper, IconButton, Typography, Tooltip, Menu, MenuItem } from '@mui/material';
import { DeleteOutline, Lock, MoreVert, ScreenShare, CameraAlt } from '@mui/icons-material';
import { useRouter } from 'next/navigation';

interface RoomCardProps {
  room: {
    id: string;
    name: string;
    syncCode: string;
    isPrivate?: boolean;
    createdBy?: string;
  };
  showDelete?: boolean;
  onDelete?: (e: React.MouseEvent, roomId: string) => void;
  copiedRoomId: string | null;
  setCopiedRoomId: (id: string | null) => void;
  showAllRooms?: boolean;
}

export function RoomCard({ room, showDelete, onDelete, copiedRoomId, setCopiedRoomId, showAllRooms }: RoomCardProps) {
  const router = useRouter();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(room.syncCode);
    setCopiedRoomId(room.id);
    setTimeout(() => setCopiedRoomId(null), 1000);
  };

  const handleMenuOpen = (e: React.MouseEvent<HTMLElement>) => {
    e.stopPropagation();
    setAnchorEl(e.currentTarget);
  };

  const handleMenuClose = (e: React.MouseEvent) => {
    e.stopPropagation();
    setAnchorEl(null);
  };

  const handleAction = (e: React.MouseEvent, action: 'screenshare' | 'streamchat') => {
    e.stopPropagation();
    setAnchorEl(null);
    router.push(`/room/${room.id}?action=${action}`);
  };

  return (
    <Paper
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
        ...(showAllRooms && { ml: '0 !important' })
      }}
    >
      {showDelete && onDelete && (
        <IconButton
          size="small"
          onClick={(e) => onDelete(e, room.id)}
          sx={{ position: 'absolute', top: 8, right: 8, color: 'text.secondary', '&:hover': { color: 'error.main', bgcolor: 'error.light' } }}
        >
          <DeleteOutline fontSize="small" />
        </IconButton>
      )}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, pr: 3, mb: 0.5 }}>
        <Typography variant="subtitle1" fontWeight={600} color="text.primary" noWrap sx={{ maxWidth: '180px' }}>
          {room.name}
        </Typography>
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
            onClick={handleCopy}
            sx={{
              display: 'inline-block',
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
  );
}
