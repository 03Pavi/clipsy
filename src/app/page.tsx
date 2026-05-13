'use client';

import { DashboardLayout } from '@/modules/dashboard/ui/dashboard-layout';
import { useAppSelector } from '@/shared/lib/redux';
import { Box, Button, Typography, CircularProgress } from '@mui/material';
import { signInWithPopup } from 'firebase/auth';
import { auth, googleProvider } from '@/shared/api/firebase';
import { Google } from '@mui/icons-material';

import { useState, useEffect } from 'react';

export default function Page() {
  const { isAuthenticated, isLoading } = useAppSelector(state => state.user);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleLogin = async () => {
    try {
      await import('firebase/auth').then(({ signInWithPopup }) =>
        signInWithPopup(auth, googleProvider)
      );
    } catch (error) {
      console.error('Login failed:', error);
    }
  };

  if (!mounted || isLoading) {
    return (
      <Box sx={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: '#050914' }}>
        <CircularProgress sx={{ color: "var(--theme-primary)" }} />
      </Box>
    );
  }

  if (!isAuthenticated) {
    return (
      <Box sx={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: '#050914',
        gap: 4
      }}>
        <Box sx={{ textAlign: 'center' }}>
          <Typography variant="h3" fontWeight={700} color="white" gutterBottom>SyncFlow</Typography>
          <Typography variant="body1" color="rgba(255,255,255,0.5)">Seamless clipboard synchronization across all your devices.</Typography>
        </Box>

        <Button
          variant="contained"
          startIcon={<Google />}
          onClick={handleLogin}
          sx={{
            bgcolor: 'white',
            color: 'black',
            '&:hover': { bgcolor: '#f1f1f1' },
            textTransform: 'none',
            borderRadius: 2,
            px: 4, py: 1.5,
            fontWeight: 600
          }}
        >
          Sign in with Google
        </Button>
      </Box>
    );
  }

  return <DashboardLayout />;
}