import { Box, CircularProgress, Container } from '@mui/material';

export default function DashboardLoading() {
  return (
    <Container maxWidth="md">
      <Box sx={{ mt: 8, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress sx={{ color: "GrayText" }} />
      </Box>
    </Container>
  );
}
