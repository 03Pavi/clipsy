'use client';
import { Box, CircularProgress, Container, Typography } from '@mui/material';
import { useRouter } from 'next/navigation';
import { useAuth } from '../hooks/use-auth';
import { useEffect } from 'react';

export default function Home() {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading) {
      if (user) {
        router.push('/dashboard');
      } else {
        router.push('/login');
      }
    }
  }, [user, isLoading, router]);

  return (
    <Container maxWidth="sm">
      <Box sx={{ mt: 10, textAlign: 'center' }}>
        <Typography variant="h3" gutterBottom color="text.primary">OnePaste</Typography>
        <Typography variant="subtitle1" color="text.primary">Welcome to the Cloud Clipboard</Typography>
        <Box sx={{ mt: 6 }}>
          <CircularProgress sx={{ color: "GrayText"}} />
        </Box>
      </Box>
    </Container>
  );
}