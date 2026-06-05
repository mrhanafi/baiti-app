import { createContext, ReactNode, useContext, useEffect, useState } from 'react';

import { loadThemeMode, saveThemeMode, ThemeMode } from '@/lib/theme/preference';

type ThemePrefContextValue = {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
};

const ThemePrefContext = createContext<ThemePrefContextValue | null>(null);

export function ThemePrefProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>('light');

  // Load saved preference on mount. Until it loads, we render with the default
  // (light) — switching once it arrives is fine; it's just a one-frame swap.
  useEffect(() => {
    loadThemeMode().then(setModeState);
  }, []);

  function setMode(next: ThemeMode) {
    setModeState(next);
    saveThemeMode(next);
  }

  return (
    <ThemePrefContext.Provider value={{ mode, setMode }}>
      {children}
    </ThemePrefContext.Provider>
  );
}

export function useThemePref(): ThemePrefContextValue {
  const ctx = useContext(ThemePrefContext);
  if (!ctx) {
    throw new Error('useThemePref must be used inside <ThemePrefProvider>');
  }
  return ctx;
}
