import { Box, Typography, List, ListItem, ListItemButton, ListItemIcon, ListItemText, Button } from '@mui/material';
import { Smartphone, Dashboard, Settings, Add, SyncAlt } from '@mui/icons-material';
import { useAppSelector } from '@/shared/lib/redux';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export function Sidebar({ activeTab, setActiveTab }: SidebarProps) {
  return (
    <Box sx={{
      width: 260,
      bgcolor: 'var(--theme-bg)',
      borderRight: '1px solid var(--theme-border)',
      display: 'flex',
      flexDirection: 'column',
      p: 2.5,
      color: 'var(--text-primary)',
      height: '100vh',
      backdropFilter: 'blur(10px)'
    }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 6, px: 1 }}>
        <Box sx={{
          bgcolor: 'var(--theme-primary)',
          width: 36,
          height: 36,
          borderRadius: 1.5,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <SyncAlt sx={{ color: 'white' }} />
        </Box>
        <Box>
          <Typography variant="h6" fontWeight={700} sx={{ lineHeight: 1.2 }}>OnePaste</Typography>
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.65rem', letterSpacing: 0.5, textTransform: 'uppercase' }}>
            Enterprise Sync
          </Typography>
        </Box>
      </Box>

      <List sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        <ListItem disablePadding>
          <ListItemButton
            selected={activeTab === 'hub'}
            onClick={() => setActiveTab('hub')}
            sx={{
              borderRadius: 2.5,
              py: 1.2,
              '&.Mui-selected': {
                bgcolor: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
              },
              '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.05)' }
            }}
          >
            <ListItemIcon sx={{ minWidth: 38, color: activeTab === 'hub' ? 'white' : 'rgba(255,255,255,0.4)' }}>
              <Dashboard fontSize="small" />
            </ListItemIcon>
            <ListItemText
              primary="Dashboard"
              primaryTypographyProps={{ fontSize: '0.85rem', fontWeight: activeTab === 'hub' ? 600 : 400 }}
              sx={{ color: activeTab === 'hub' ? 'white' : 'rgba(255,255,255,0.6)' }}
            />
          </ListItemButton>
        </ListItem>

        <ListItem disablePadding>
          <ListItemButton
            selected={activeTab === 'devices'}
            onClick={() => setActiveTab('devices')}
            sx={{
              borderRadius: 2.5,
              py: 1.2,
              '&.Mui-selected': {
                bgcolor: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
              },
              '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.05)' }
            }}
          >
            <ListItemIcon sx={{ minWidth: 38, color: activeTab === 'devices' ? 'white' : 'rgba(255,255,255,0.4)' }}>
              <Smartphone fontSize="small" />
            </ListItemIcon>
            <ListItemText
              primary="Devices"
              primaryTypographyProps={{ fontSize: '0.85rem', fontWeight: activeTab === 'devices' ? 600 : 400 }}
              sx={{ color: activeTab === 'devices' ? 'white' : 'rgba(255,255,255,0.6)' }}
            />
          </ListItemButton>
        </ListItem>

        <ListItem disablePadding>
          <ListItemButton
            selected={activeTab === 'settings'}
            onClick={() => setActiveTab('settings')}
            sx={{
              borderRadius: 2.5,
              py: 1.2,
              '&.Mui-selected': {
                bgcolor: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
              },
              '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.05)' }
            }}
          >
            <ListItemIcon sx={{ minWidth: 38, color: activeTab === 'settings' ? 'white' : 'rgba(255,255,255,0.4)' }}>
              <Settings fontSize="small" />
            </ListItemIcon>
            <ListItemText
              primary="Settings"
              primaryTypographyProps={{ fontSize: '0.85rem', fontWeight: activeTab === 'settings' ? 600 : 400 }}
              sx={{ color: activeTab === 'settings' ? 'white' : 'rgba(255,255,255,0.6)' }}
            />
          </ListItemButton>
        </ListItem>
      </List>

      <Box sx={{ mt: 'auto', position: 'relative', px: 0.5 }}>
        <Button
          fullWidth
          variant="contained"
          onClick={() => setActiveTab('devices')}
          sx={{
            bgcolor: 'var(--theme-primary)',
            '&:hover': { bgcolor: 'var(--theme-primary)', opacity: 0.9, boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)' },
            textTransform: 'none',
            borderRadius: '12px',
            height: 52,
            fontWeight: 700,
            fontSize: '0.9rem',
            color: 'white',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.4)',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            gap: 1
          }}
        >
          <Add sx={{ fontSize: 20 }} />
          Add Device
        </Button>
      </Box>
    </Box>
  );
}
