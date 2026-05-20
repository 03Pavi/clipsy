'use client';
import { useState } from 'react';
import { Box, AppBar, Toolbar, Typography, IconButton, Avatar, Tooltip, Popover, Divider, Button } from '@mui/material';
import { ArrowCircleRight, LightMode, DarkMode, AddCircleOutline, Logout } from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import { User } from '../../types/auth.types';

interface DashboardHeaderProps {
  user: User;
  mode: 'dark' | 'light';
  toggleTheme: () => void;
  handleLogout: () => Promise<void>;
}

export function DashboardHeader({ user, mode, toggleTheme, handleLogout }: DashboardHeaderProps) {
  const router = useRouter();
  const [profileAnchorEl, setProfileAnchorEl] = useState<null | HTMLElement>(null);

  const handleProfileClick = (event: React.MouseEvent<HTMLElement>) => {
    setProfileAnchorEl(event.currentTarget);
  };

  const handleProfileClose = () => {
    setProfileAnchorEl(null);
  };

  return (
    <AppBar position="static" elevation={0} sx={{ bgcolor: 'transparent', borderBottom: '1px solid', borderColor: 'divider' }}>
      <Toolbar sx={{ justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 32,
              height: 32,
              borderRadius: 1.5,
              background: 'linear-gradient(135deg, #0070f3, #00c6ff)',
            }}
          >
            <ArrowCircleRight sx={{ color: '#fff', fontSize: 20 }} />
          </Box>
          <Typography variant="h6" fontWeight={700} sx={{ letterSpacing: '-0.5px' }}>
            onePaste
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Tooltip title="Toggle Theme">
            <IconButton onClick={toggleTheme} sx={{ color: 'text.secondary', '&:hover': { color: 'text.primary', bgcolor: 'action.hover' } }}>
              {mode === 'dark' ? <LightMode fontSize="small" /> : <DarkMode fontSize="small" />}
            </IconButton>
          </Tooltip>
          <Tooltip title="Profile Menu">
            <IconButton onClick={handleProfileClick} sx={{ p: 0 }}>
              <Avatar src={user.photoURL || ''} alt={user.displayName || 'Anonymous'} sx={{ width: 32, height: 32, bgcolor: 'action.selected', border: '1px solid', borderColor: 'divider' }}>
                {(user.displayName || 'A')[0].toUpperCase()}
              </Avatar>
            </IconButton>
          </Tooltip>
          <Popover
            open={Boolean(profileAnchorEl)}
            anchorEl={profileAnchorEl}
            onClose={handleProfileClose}
            anchorOrigin={{
              vertical: 'bottom',
              horizontal: 'right',
            }}
            transformOrigin={{
              vertical: 'top',
              horizontal: 'right',
            }}
            PaperProps={{
              sx: {
                bgcolor: 'background.paper',
                color: 'text.primary',
                border: '1px solid',
                borderColor: 'divider',
                mt: 1.5,
                p: 2,
                minWidth: 240,
                borderRadius: 3,
                boxShadow: '0 8px 32px rgba(0,0,0,0.4)'
              }
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
              <Avatar src={user.photoURL || ''} sx={{ width: 48, height: 48 }} />
              <Box>
                <Typography variant="body1" fontWeight={600}>{user.displayName || 'Anonymous'}</Typography>
                <Typography variant="caption" color="text.secondary">{user.email || 'Anonymous Session'}</Typography>
              </Box>
            </Box>
            <Divider sx={{ borderColor: 'divider', my: 1.5 }} />
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              <Button
                fullWidth
                startIcon={<AddCircleOutline fontSize="small" />}
                onClick={() => {
                  handleProfileClose();
                  router.push('/rooms/list');
                }}
                sx={{ color: 'text.primary', justifyContent: 'flex-start', textTransform: 'none', fontWeight: 600 }}
              >
                My Rooms
              </Button>
              <Button
                fullWidth
                startIcon={<Logout fontSize="small" />}
                onClick={() => {
                  handleProfileClose();
                  handleLogout().catch(console.error);
                }}
                sx={{ color: '#ef4444', justifyContent: 'flex-start', textTransform: 'none', fontWeight: 600 }}
              >
                Sign Out
              </Button>
            </Box>
          </Popover>
        </Box>
      </Toolbar>
    </AppBar>
  );
}
