'use client';
import { Box, Paper, Typography, TextField, Button } from '@mui/material';
import { Key, ArrowForward } from '@mui/icons-material';

interface JoinRoomCardProps {
  syncCode: string;
  setSyncCode: (code: string) => void;
  handleJoinRoom: (code: string) => Promise<void> | void;
  isLoading: boolean;
  isDeleting: boolean;
}

export function JoinRoomCard({
  syncCode,
  setSyncCode,
  handleJoinRoom,
  isLoading,
  isDeleting
}: JoinRoomCardProps) {
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
        <Key sx={{ color: 'primary.main' }} />
        <Typography variant="h6" fontWeight={600} color="text.primary">Connect Device</Typography>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
        Enter a 6-character sync code from an active mesh room to link this device.
      </Typography>

      <Box sx={{ mt: 'auto' }}>
        <TextField
          fullWidth
          placeholder="Enter Sync Code"
          variant="outlined"
          value={syncCode}
          onChange={(e) => setSyncCode(e.target.value.toUpperCase())}
          inputProps={{ maxLength: 6, style: { letterSpacing: '4px', textAlign: 'center', fontFamily: 'monospace', fontSize: '1.2rem' } }}
          sx={{ mb: 2 }}
        />
        <Button
          fullWidth
          variant="contained"
          onClick={() => handleJoinRoom(syncCode)}
          disabled={syncCode.length !== 6 || isLoading || isDeleting}
          endIcon={<ArrowForward />}
          sx={{
            py: 1.5,
            bgcolor: 'primary.main',
            color: 'primary.contrastText',
            fontWeight: 600,
            textTransform: 'none',
            borderRadius: 2,
            '&:hover': { bgcolor: 'primary.dark' },
            '&.Mui-disabled': { bgcolor: 'action.disabledBackground', color: 'text.disabled' }
          }}
        >
          Join Mesh Room
        </Button>
      </Box>
    </Paper>
  );
}
