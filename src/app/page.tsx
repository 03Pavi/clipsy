"use client";
import { DashboardLayout } from '@/modules/dashboard/ui/dashboard-layout';
import { useAppSelector } from '@/shared/lib/redux';
import { Box, Button, Typography, CircularProgress, Divider } from '@mui/material';
import { signInWithPopup, signInAnonymously } from 'firebase/auth';
import { auth, googleProvider } from '@/shared/api/firebase';
import { InfoOutlined, ShieldOutlined } from '@mui/icons-material';

import { useState, useEffect } from 'react';

export default function Page() {
  const { isAuthenticated, isLoading, info } = useAppSelector(state => state.user);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error('Login failed:', error);
    }
  };

  const handleIncognito = async () => {
    try {
      await signInAnonymously(auth);
    } catch (error) {
      console.error('Incognito login failed:', error);
    }
  };

  if (!mounted || isLoading) {
    return (
      <Box sx={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'var(--theme-bg)' }}>
        <CircularProgress sx={{ color: "var(--theme-primary)" }} />
      </Box>
    );
  }

  if (!isAuthenticated) {
    return (
      <Box sx={{
        height: '100vh',
        width: '100vw',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'radial-gradient(circle at 20% 30%, rgba(0, 112, 255, 0.05) 0%, transparent 40%), radial-gradient(circle at 80% 70%, rgba(168, 85, 247, 0.05) 0%, transparent 40%), var(--theme-bg)',
        position: 'relative',
        overflow: 'hidden',
        fontFamily: '"Outfit", sans-serif'
      }}>
        {/* Glow Effects */}
        <Box sx={{
          position: 'absolute',
          top: '20%',
          left: '10%',
          width: '300px',
          height: '300px',
          background: 'rgba(0, 112, 255, 0.1)',
          filter: 'blur(100px)',
          borderRadius: '50%',
          zIndex: 0
        }} />

        <Box sx={{
          width: '100%',
          maxWidth: 480,
          bgcolor: 'rgba(11, 19, 38, 0.6)',
          backdropFilter: 'blur(20px)',
          borderRadius: 6,
          border: '1px solid rgba(255, 255, 255, 0.08)',
          p: 5,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.4)',
          zIndex: 1
        }}>
          {/* Logo */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 4 }}>
            <Box sx={{
              width: 48,
              height: 48,
              bgcolor: 'var(--theme-primary)',
              borderRadius: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 20px rgba(0, 112, 255, 0.5)'
            }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M4 12V10C4 6.68629 6.68629 4 10 4H14C17.3137 4 20 6.68629 20 10V14C20 17.3137 17.3137 20 14 20H10C6.68629 20 4 17.3137 4 14V13" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
                <path d="M12 8L16 12L12 16" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M7 12H16" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
            </Box>
            <Typography variant="h4" fontWeight={800} color="white" sx={{ letterSpacing: -1 }}>SyncFlow</Typography>
          </Box>

          <Typography variant="h4" fontWeight={700} color="white" sx={{ mb: 2 }}>Welcome to the Mesh</Typography>
          {/* Login Buttons */}
          <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 3 }}>
            <Button
              fullWidth
              variant="contained"
              onClick={handleLogin}
              startIcon={<Box component="img" src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" sx={{ width: 20 }} />}
              sx={{
                bgcolor: 'white',
                color: 'black',
                '&:hover': { bgcolor: '#f1f1f1', transform: 'translateY(-2px)' },
                textTransform: 'none',
                borderRadius: 2.5,
                py: 1.8,
                fontWeight: 700,
                fontSize: '1rem',
                transition: 'all 0.2s',
                boxShadow: '0 4px 14px rgba(255, 255, 255, 0.1)'
              }}
            >
              Sign in with Google
            </Button>

            <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
              <Divider sx={{ flex: 1, borderColor: 'rgba(255, 255, 255, 0.05)' }} />
              <Typography variant="caption" sx={{ px: 2, color: 'rgba(255, 255, 255, 0.2)', fontWeight: 700 }}>OR</Typography>
              <Divider sx={{ flex: 1, borderColor: 'rgba(255, 255, 255, 0.05)' }} />
            </Box>

            <Button
              fullWidth
              onClick={handleIncognito}
              sx={{
                bgcolor: 'transparent',
                color: 'rgba(255, 255, 255, 0.6)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.03)', borderColor: 'rgba(255, 255, 255, 0.2)' },
                textTransform: 'uppercase',
                borderRadius: 2.5,
                py: 2.5,
                fontWeight: 300,
                fontSize: '1.8rem',
                letterSpacing: 10,
                fontFamily: '"Fira Code", monospace',
                transition: 'all 0.2s'
              }}
            >
              INCOGNITO
            </Button>
          </Box>

          {/* Info Box */}
          <Box sx={{
            mt: 4,
            p: 2.5,
            bgcolor: 'rgba(0, 112, 255, 0.03)',
            borderRadius: 3,
            border: '1px solid rgba(0, 112, 255, 0.1)',
            display: 'flex',
            gap: 2,
            textAlign: 'left'
          }}>
            <InfoOutlined sx={{ color: '#0070ff', fontSize: 20, mt: 0.2 }} />
            <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.4)', lineHeight: 1.5 }}>
              Anonymous data is stored locally and will be lost if browser cache is cleared. High-security environments may require a verified account.
            </Typography>
          </Box>
        </Box>

        {/* Footer */}
        <Box sx={{
          position: 'absolute',
          bottom: 40,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 2,
          zIndex: 1
        }}>
          {/* <Box sx={{ display: 'flex', gap: 4 }}>
            {['Terms of Service', 'Privacy Policy', 'Security Overview'].map(item => (
              <Typography key={item} variant="caption" sx={{ color: 'white', fontWeight: 600, cursor: 'pointer', '&:hover': { opacity: 0.7 } }}>
                {item}
              </Typography>
            ))}
          </Box>
          <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>
            © 2024 SYNCFLOW ENTERPRISE. ALL RIGHTS RESERVED.
          </Typography> */}
        </Box>
      </Box>
    );
  }

  return <DashboardLayout />;
}