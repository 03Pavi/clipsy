'use client';
import { Box, Paper, Typography, TextField, Button, Tooltip } from '@mui/material';
import { AddCircleOutline } from '@mui/icons-material';

interface CreateRoomCardProps {
  roomName: string;
  setRoomName: (name: string) => void;
  handleCreateRoom: (name: string) => Promise<void> | void;
  isLoading: boolean;
  isDeleting: boolean;
  isAnonymous: boolean;
  roomsCount: number;
}

export function CreateRoomCard({
  roomName,
  setRoomName,
  handleCreateRoom,
  isLoading,
  isDeleting,
  isAnonymous,
  roomsCount
}: CreateRoomCardProps) {
  const isDisabled = isAnonymous && roomsCount >= 1;

  return (
    <Paper
      elevation={0}
      sx={{
        flex: 1,
        p: 4,
        borderRadius: 4,
        bgcolor: 'background.paper',
        border: '1px solid',
        borderColor: 'divider',
        boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
        <AddCircleOutline sx={{ color: 'secondary.main' }} />
        <Typography variant="h6" fontWeight={600} color="text.primary">Create New Mesh</Typography>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
        Start a new secure room to synchronize clipboard data across multiple devices.
      </Typography>

      <Box sx={{ mt: 'auto' }}>
        <TextField
          fullWidth
          placeholder="Room Name (Optional)"
          variant="outlined"
          value={roomName}
          inputProps={{ maxLength: 20 }}
          onChange={(e) => setRoomName(e.target.value)}
          disabled={isDisabled}
          sx={{ mb: 2 }}
        />

        <Tooltip title={isDisabled ? "Anonymous users can only create 1 active room." : ""}>
          <span>
            <Button
              fullWidth
              variant="outlined"
              onClick={() => handleCreateRoom(roomName || 'My Sync Room')}
              disabled={isLoading || isDeleting || isDisabled}
              sx={{
                py: 1.5,
                borderColor: 'divider',
                color: 'text.primary',
                fontWeight: 600,
                textTransform: 'none',
                borderRadius: 2,
                '&:hover': { borderColor: 'primary.main', bgcolor: 'action.hover' },
                '&.Mui-disabled': { borderColor: 'action.disabledBackground', color: 'text.disabled' }
              }}
            >
              Initialize Room
            </Button>
          </span>
        </Tooltip>
      </Box>
    </Paper>
  );
}
