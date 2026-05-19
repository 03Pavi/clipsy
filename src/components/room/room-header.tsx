import { Box, Typography, Paper, IconButton, Stack, Tooltip } from '@mui/material';
import { Room } from '../../types/room.types';
import { ArrowBack } from '@mui/icons-material';
import { useRouter } from 'next/navigation';

export default function RoomHeader({ room }: { room: Room }) {
  const router = useRouter();
  return (
    <Paper
      elevation={0}
      sx={{
        p: 4,
        borderRadius: 4,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        bgcolor: '#111622',
        border: '1px solid rgba(255, 255, 255, 0.05)',
        boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
      }}
    >
      <Box>
        <Stack flexDirection={'row'} alignItems={'center'} gap={1}>
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
          <Typography variant="h5" fontWeight="bold" sx={{ color: '#fff' }}>{room.name}</Typography>
        </Stack>
      </Box>
      <Box textAlign="right">
        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '1px' }}>
          Sync Code
        </Typography>
        <Tooltip title="Copy Sync Code">
          <Typography 
            variant="h4" 
            onClick={() => navigator.clipboard.writeText(room.syncCode)}
            sx={{ 
              letterSpacing: 6, 
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
    </Paper>
  );
}
