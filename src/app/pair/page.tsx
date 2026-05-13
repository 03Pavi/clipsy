'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Box, Typography, CircularProgress, Button, Card, CardContent } from '@mui/material';
import { SyncAlt, CheckCircleOutline, ErrorOutline, Smartphone, Laptop } from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';

function PairingContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<'pairing' | 'success' | 'error'>('pairing');
  const [errorMsg, setErrorMsg] = useState('');

  const pairingId = searchParams.get('pairingId');
  const userId = searchParams.get('userId');

  useEffect(() => {
    if (!pairingId || !userId) {
      setStatus('error');
      setErrorMsg('Invalid or expired pairing link.');
      return;
    }

    const performPairing = async () => {
      try {
        // 1. Detect Platform
        const ua = navigator.userAgent;
        const platform = /iPhone|iPad|iPod|Android/i.test(ua) ? 'mobile' : 'desktop';
        const deviceName = `${platform.charAt(0).toUpperCase() + platform.slice(1)} Device (${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`;

        // 2. Verify Handshake
        const vRes = await fetch('/api/auth/otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'verify', code: pairingId })
        });
        const vData = await vRes.json();

        if (vData.token) {
          // 3. SECURELY SIGN IN THE DEVICE
          const { signInWithCustomToken } = await import('firebase/auth');
          const { auth: clientAuth } = await import('@/shared/api/firebase');
          await signInWithCustomToken(clientAuth, vData.token);

          // 4. GENERATE PERSISTENT DEVICE IDENTITY
          // We must ensure this device has its unique ID before registration
          let dId = localStorage.getItem('clipsy_device_id');
          if (!dId) {
            const { v4: uuidv4 } = await import('uuid');
            dId = uuidv4();
            localStorage.setItem('clipsy_device_id', dId as string);
          }

          const realIdToken = await clientAuth.currentUser?.getIdToken();

          // 5. Register Device with full Hardware Profile
          const regRes = await fetch('/api/devices', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${realIdToken}`
            },
            body: JSON.stringify({
              deviceId: dId,
              name: deviceName || `Linked ${platform}`,
              platform: platform,
              os: navigator.userAgent.match(/\(([^)]+)\)/)?.[1] || 'Unknown',
              browser: navigator.userAgent.match(/(firefox|msie|chrome|safari|trident)/i)?.[0] || 'Browser',
              syncEnabled: true
            })
          });

          if (regRes.ok) {
            setStatus('success');
            setTimeout(() => router.push('/'), 2000);
          } else {
            const errJson = await regRes.json();
            throw new Error(errJson.error || 'Mesh registration failed.');
          }
        } else {
          throw new Error('Handshake verification failed.');
        }
      } catch (err: any) {
        setStatus('error');
        setErrorMsg(err.message || 'Handshake failed.');
      }
    };

    performPairing();
  }, [pairingId, userId, router]);

  return (
    <Box sx={{
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      bgcolor: '#050914',
      p: 3
    }}>
      <AnimatePresence mode="wait">
        {status === 'pairing' && (
          <motion.div
            key="pairing"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.1 }}
            style={{ textAlign: 'center' }}
          >
            <Box sx={{ position: 'relative', display: 'inline-flex', mb: 4 }}>
              <SyncAlt sx={{ fontSize: 60, color: "var(--theme-primary)", animation: 'spin 2s linear infinite' }} />
              <CircularProgress
                size={80}
                sx={{
                  color: "var(--theme-primary)",
                  position: 'absolute',
                  top: -10,
                  left: -10,
                  zIndex: 1,
                }}
              />
            </Box>
            <Typography variant="h5" fontWeight={700} color="white" gutterBottom>Establishing Secure Uplink</Typography>
            <Typography variant="body2" color="rgba(255,255,255,0.4)">Exchanging cryptographic keys with the SyncFlow Cloud...</Typography>
          </motion.div>
        )}

        {status === 'success' && (
          <motion.div
            key="success"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            style={{ textAlign: 'center' }}
          >
            <CheckCircleOutline sx={{ fontSize: 80, color: '#10b981', mb: 3 }} />
            <Typography variant="h5" fontWeight={700} color="white" gutterBottom>Handshake Successful</Typography>
            <Typography variant="body2" color="rgba(255,255,255,0.4)">This device is now a trusted node in your workspace.</Typography>
            <Typography variant="caption" sx={{ display: 'block', mt: 4, color: "var(--theme-primary)" }}>Redirecting to dashboard...</Typography>
          </motion.div>
        )}

        {status === 'error' && (
          <motion.div
            key="error"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            style={{ textAlign: 'center' }}
          >
            <ErrorOutline sx={{ fontSize: 80, color: '#ef4444', mb: 3 }} />
            <Typography variant="h5" fontWeight={700} color="white" gutterBottom>Uplink Failed</Typography>
            <Typography variant="body2" color="rgba(255,255,255,0.4)">{errorMsg}</Typography>
            <Button
              onClick={() => router.push('/')}
              variant="outlined"
              sx={{ mt: 4, color: 'white', borderColor: 'rgba(255,255,255,0.2)', borderRadius: 2 }}
            >
              Back to Dashboard
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      <style jsx global>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </Box>
  );
}

export default function PairPage() {
  return (
    <Suspense fallback={null}>
      <PairingContent />
    </Suspense>
  );
}
