import { useState, useCallback, useEffect } from 'react';

export function useTheme({ view, resetToken }) {
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem('themeMode') === 'dark';
  });

  useEffect(() => {
    if (typeof document === 'undefined' || typeof window === 'undefined') return;
    const isAuthScreen = view === 'login' || Boolean(resetToken);
    const activeTheme = isAuthScreen ? 'light' : (isDarkMode ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', activeTheme);
    window.localStorage.setItem('themeMode', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode, view, resetToken]);

  const toggleThemeMode = useCallback(() => {
    setIsDarkMode((prev) => !prev);
  }, []);

  return { isDarkMode, toggleThemeMode };
}
