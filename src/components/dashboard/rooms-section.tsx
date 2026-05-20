'use client';
import { Box, Typography, Stack, Paper } from '@mui/material';
import { RoomCard } from './room-card';

interface RoomsSectionProps {
  title: string;
  rooms: any[];
  showAllRooms: boolean;
  setShowAllRooms: (show: boolean) => void;
  showDelete?: boolean;
  onDelete?: (e: React.MouseEvent, roomId: string) => void;
  copiedRoomId: string | null;
  setCopiedRoomId: (id: string | null) => void;
}

export function RoomsSection({
  title,
  rooms,
  showAllRooms,
  setShowAllRooms,
  showDelete,
  onDelete,
  copiedRoomId,
  setCopiedRoomId
}: RoomsSectionProps) {
  if (rooms.length === 0) {
    const isCreated = title.toLowerCase().includes('created');
    return (
      <Paper
        elevation={0}
        sx={{
          p: 4,
          borderRadius: 4,
          bgcolor: 'background.paper',
          border: '1px dashed',
          borderColor: 'divider',
          textAlign: 'center',
          mb: 6
        }}
      >
        <Typography variant="subtitle2" fontWeight={600} color="text.secondary">
          {isCreated ? 'No created rooms yet' : 'No joined rooms yet'}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
          {isCreated 
            ? 'Initialize a new secure room using the card below to start synchronizing.' 
            : 'Enter a 6-character sync code in the connection card to link a device.'}
        </Typography>
      </Paper>
    );
  }

  const displayedRooms = showAllRooms ? rooms : rooms.slice(0, 3);

  return (
    <Box sx={{ mb: 6 }}>
      <Box sx={{ mb: 2 }}>
        <Typography variant="h6" fontWeight={600} color="text.primary">
          {title}
        </Typography>
      </Box>
      <Stack
        direction="row"
        spacing={2}
        sx={{
          overflowX: 'auto',
          pb: 1,
          flexWrap: showAllRooms ? 'wrap' : 'nowrap',
          gap: showAllRooms ? 2 : 0
        }}
      >
        {displayedRooms.map((room) => (
          <RoomCard
            key={room.id}
            room={room}
            showDelete={showDelete}
            onDelete={onDelete}
            copiedRoomId={copiedRoomId}
            setCopiedRoomId={setCopiedRoomId}
            showAllRooms={showAllRooms}
          />
        ))}

        {rooms.length > 3 && (
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
              {showAllRooms ? 'Show Less' : `+${rooms.length - 3} More`}
            </Typography>
          </Paper>
        )}
      </Stack>
    </Box>
  );
}
