'use client';
import { Box, Paper, Typography, Button } from '@mui/material';
import { Lock } from '@mui/icons-material';

interface KnockingOverlayProps {
  requestStatus: 'idle' | 'pending' | 'rejected';
  setRequestStatus: (status: 'idle' | 'pending' | 'rejected') => void;
}

export function KnockingOverlay({ requestStatus, setRequestStatus }: KnockingOverlayProps) {
  if (requestStatus !== 'pending') return null;

  return (
    <Box
      sx={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        bgcolor: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(10px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: 3
      }}
    >
      <Paper
        elevation={0}
        sx={{
          p: 5,
          borderRadius: 4,
          bgcolor: 'background.paper',
          border: '1px solid rgba(255,255,255,0.08)',
          maxWidth: 440,
          textAlign: 'center',
          boxShadow: '0 24px 48px rgba(0,0,0,0.5)'
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 64,
            height: 64,
            borderRadius: '50%',
            bgcolor: 'rgba(0, 112, 243, 0.1)',
            color: 'primary.main',
            mx: 'auto',
            mb: 3,
            animation: 'pulse 1.8s infinite'
          }}
        >
          <Lock sx={{ fontSize: 32 }} />
        </Box>
        <Typography variant="h5" fontWeight={700} sx={{ mb: 1, color: 'text.primary' }}>
          Knocking at the Door...
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 4 }}>
          This mesh room is <b>Private</b>. A join request has been sent to the room owner. Please wait for approval.
        </Typography>
        
        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2 }}>
          <Button
            variant="outlined"
            onClick={() => {
              setRequestStatus('idle');
            }}
            sx={{
              px: 4,
              py: 1,
              borderRadius: 2,
              textTransform: 'none',
              borderColor: 'divider',
              color: 'text.secondary'
            }}
          >
            Cancel Request
          </Button>
        </Box>
      </Paper>
    </Box>
  );
}
