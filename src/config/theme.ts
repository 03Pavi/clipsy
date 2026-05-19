import { createTheme, ThemeOptions } from '@mui/material';

const baseOptions: ThemeOptions = {
  typography: {
    fontFamily: 'Inter, sans-serif',
  },
  shape: {
    borderRadius: 2,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
      },
    },
  },
};

export const darkTheme = createTheme({
  ...baseOptions,
  palette: {
    mode: 'dark',
    primary: {
      main: '#0070f3',
    },
    secondary: {
      main: '#00c6ff',
    },
    background: {
      default: '#0a0d14',
      paper: '#111622',
    },
    text: {
      primary: '#ffffff',
      secondary: 'rgba(255, 255, 255, 0.5)',
    },
    divider: 'rgba(255, 255, 255, 0.05)',
  },
});

export const lightTheme = createTheme({
  ...baseOptions,
  palette: {
    mode: 'light',
    primary: {
      main: '#0070f3',
    },
    secondary: {
      main: '#00c6ff',
    },
    background: {
      default: '#f8fafc',
      paper: '#ffffff',
    },
    text: {
      primary: '#0f172a',
      secondary: '#64748b',
    },
    divider: 'rgba(0, 0, 0, 0.08)',
  },
});
