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
          <Typography variant="h5" fontWeight="bold" sx={{ color: '#fff', wordBreak: 'break-all' }}>{room.name}</Typography>
        </Stack>
      </Box>
      <Box sx={{ textAlign: { xs: 'left', sm: 'right' }, pl: { xs: 6, sm: 0 } }}>
        <Typography variant="caption" sx={{ display: 'block', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '1px' }}>
          Sync Code
        </Typography>
        <Tooltip title="Copy Sync Code">
          <Typography 
            variant="h4" 
            onClick={() => navigator.clipboard.writeText(room.syncCode)}
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
    </Paper>
  );
}
