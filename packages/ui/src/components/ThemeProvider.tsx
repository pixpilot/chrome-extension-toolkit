import React, { createContext, useEffect, useMemo, useState } from 'react';
import '@internal/tailwind/globals.css';

type Theme = string;

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({
  children,
  defaultTheme = 'system',
}: {
  children: React.ReactNode;
  defaultTheme?: string;
}) {
  const [theme, setThemeState] = useState<Theme>(() => {
    const savedTheme = window.localStorage.getItem('theme');
    return savedTheme !== null ? savedTheme : defaultTheme;
  });

  // Helper: get system theme
  const getSystemTheme = () => {
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    return 'light';
  };

  // Set theme and persist
  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    window.localStorage.setItem('theme', newTheme);
  };

  // Apply theme to document
  useEffect(() => {
    const root = window.document.documentElement;
    let appliedTheme = theme;
    if (theme === 'system') {
      appliedTheme = getSystemTheme();
    }
    if (appliedTheme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  // Listen for system theme changes if "system" is selected
  useEffect(() => {
    if (theme !== 'system') return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    function handler() {
      const root = window.document.documentElement;
      if (media.matches) {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    }
    media.addEventListener('change', handler);
    // eslint-disable-next-line consistent-return
    return () => media.removeEventListener('change', handler);
  }, [theme]);

  return (
    <ThemeContext value={useMemo(() => ({ theme, setTheme }), [theme])}>
      {children}
    </ThemeContext>
  );
}
