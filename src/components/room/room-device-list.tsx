import { Box, List, ListItem, ListItemIcon, ListItemText, Typography } from '@mui/material';
import { useDeviceStore } from '../../stores/device-store';
import { Computer, PhoneIphone, CheckCircle, RadioButtonUnchecked } from '@mui/icons-material';

export default function RoomDeviceList({ roomId }: { roomId: string }) {
  const { devices } = useDeviceStore();

  if (devices.length === 0) {
    return <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.9rem' }}>No devices connected.</Typography>;
  }

  return (
    <List sx={{ pt: 0 }}>
      {devices.map((device) => (
        <ListItem 
          key={device.id} 
          sx={{ 
            px: 2, 
            py: 1.5,
            mb: 1,
            borderRadius: 2,
            bgcolor: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.05)',
          }}
        >
          <ListItemIcon sx={{ minWidth: 40 }}>
            {device.deviceName.toLowerCase().includes('phone') ? <PhoneIphone sx={{ color: 'rgba(255,255,255,0.7)' }} /> : <Computer sx={{ color: 'rgba(255,255,255,0.7)' }} />}
          </ListItemIcon>
          <ListItemText 
            primary={device.deviceName}
            primaryTypographyProps={{ sx: { color: '#fff', fontSize: '0.95rem', fontWeight: 500 } }}
            secondary={device.online ? 'Online' : 'Offline'}
            secondaryTypographyProps={{ sx: { color: device.online ? '#00c6ff' : 'rgba(255,255,255,0.4)', fontSize: '0.8rem', mt: 0.5 } }}
          />
          {device.online ? <CheckCircle sx={{ color: '#00c6ff', fontSize: 18 }} /> : <RadioButtonUnchecked sx={{ color: 'rgba(255,255,255,0.2)', fontSize: 18 }} />}
        </ListItem>
      ))}
    </List>
  );
}
