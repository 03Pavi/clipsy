'use client';
import { useState } from 'react';
import { GoogleAuthProvider, signInWithPopup, signInAnonymously } from 'firebase/auth';
import { auth } from '../../../config/firebase-client';
import { Box, Button, Typography, Alert, Divider } from '@mui/material';
import { useRouter } from 'next/navigation';
import { InfoOutlined, ArrowCircleRight } from '@mui/icons-material';

export default function LoginPage() {
  const [error, setError] = useState('');
  const router = useRouter();

  const handleGoogleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleIncognitoLogin = async () => {
    try {
      await signInAnonymously(auth);
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        backgroundColor: '#0a0d14',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#ffffff',
        fontFamily: 'Inter, sans-serif'
      }}
    >
      <Box
        sx={{
          width: '100%',
          maxWidth: 420,
          p: 5,
          borderRadius: 4,
          backgroundColor: '#111622',
          border: '1px solid rgba(255, 255, 255, 0.05)',
          boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 40,
              height: 40,
              borderRadius: 2,
              background: 'linear-gradient(135deg, #0070f3, #00c6ff)',
              boxShadow: '0 4px 14px rgba(0, 112, 243, 0.4)',
            }}
          >
            <ArrowCircleRight sx={{ color: '#fff', fontSize: 24 }} />
          </Box>
          <Typography variant="h5" fontWeight={700} sx={{ letterSpacing: '-0.5px' }}>
            OnePaste
          </Typography>
        </Box>

        <Typography variant="h4" fontWeight={700} sx={{ mb: 4, textAlign: 'center' }}>
          Welcome to the Mesh
        </Typography>

        {error && <Alert severity="error" sx={{ mb: 3, width: '100%', bgcolor: 'rgba(211,47,47,0.1)', color: '#ffb4ab' }}>{error}</Alert>}

        <Button
          fullWidth
          variant="contained"
          onClick={handleGoogleLogin}
          sx={{
            py: 1.8,
            backgroundColor: '#ffffff',
            color: '#000000',
            fontWeight: 600,
            borderRadius: 2,
            textTransform: 'none',
            fontSize: '1rem',
            '&:hover': {
              backgroundColor: '#f0f0f0',
            },
            display: 'flex',
            alignItems: 'center',
            gap: 1.5
          }}
        >
          <img src="https://www.google.com/favicon.ico" alt="Google" style={{ width: 20, height: 20 }} />
          Sign in with Google
        </Button>

        <Box sx={{ width: '100%', my: 3, position: 'relative' }}>
          <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)' }} />
          <Typography
            variant="caption"
            sx={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              backgroundColor: '#111622',
              px: 2,
              color: 'rgba(255,255,255,0.4)',
              fontWeight: 600,
            }}
          >
            OR
          </Typography>
        </Box>

        <Button
          fullWidth
          onClick={handleIncognitoLogin}
          sx={{
            py: 2,
            backgroundColor: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.05)',
            borderRadius: 2,
            color: 'rgba(255,255,255,0.7)',
            fontFamily: 'monospace',
            fontSize: '1.2rem',
            letterSpacing: '0.5rem',
            transition: 'all 0.2s',
            '&:hover': {
              backgroundColor: 'rgba(255,255,255,0.05)',
              borderColor: 'rgba(255,255,255,0.1)',
            }
          }}
        >
          INCOGNITO
        </Button>

        <Box
          sx={{
            mt: 4,
            p: 2.5,
            borderRadius: 2,
            backgroundColor: 'rgba(0, 112, 243, 0.05)',
            border: '1px solid rgba(0, 112, 243, 0.1)',
            display: 'flex',
            gap: 2,
            alignItems: 'flex-start'
          }}
        >
          <InfoOutlined sx={{ color: '#0070f3', fontSize: 20, mt: 0.2 }} />
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.5)', lineHeight: 1.5, textAlign: 'left' }}>
            Anonymous data is stored locally and will be lost if browser cache is cleared. High-security environments may require a verified account.
          </Typography>
        </Box>

      </Box>
    </Box>
  );
}
