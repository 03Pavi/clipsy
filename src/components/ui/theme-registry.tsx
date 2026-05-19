'use client';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { createContext, useState, useMemo, useEffect, useContext } from 'react';
import { lightTheme, darkTheme } from '../../config/theme';

interface ThemeContextType {
  toggleTheme: () => void;
  mode: 'light' | 'dark';
}

export const ThemeContext = createContext<ThemeContextType>({
  toggleTheme: () => {},
  mode: 'dark',
});

export const useThemeToggle = () => useContext(ThemeContext);

export default function ThemeRegistry({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<'light' | 'dark'>('dark');

  useEffect(() => {
    const savedTheme = localStorage.getItem('clipsy_theme') as 'light' | 'dark';
    if (savedTheme) {
      setMode(savedTheme);
    }
  }, []);

  const toggleTheme = () => {
    setMode((prevMode) => {
      const newMode = prevMode === 'light' ? 'dark' : 'light';
      localStorage.setItem('clipsy_theme', newMode);
      return newMode;
    });
  };

  const theme = useMemo(() => (mode === 'light' ? lightTheme : darkTheme), [mode]);

  return (
    <ThemeContext.Provider value={{ toggleTheme, mode }}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </ThemeContext.Provider>
  );
}
