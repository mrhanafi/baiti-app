import AsyncStorage from '@react-native-async-storage/async-storage';

// User-selected theme mode. Persists across app launches.
// We default to 'light' — dark mode is opt-in via the Profile tab toggle.

export type ThemeMode = 'light' | 'dark';

const STORAGE_KEY = 'baiti.theme.mode';

export async function loadThemeMode(): Promise<ThemeMode> {
  const stored = await AsyncStorage.getItem(STORAGE_KEY);
  return stored === 'dark' ? 'dark' : 'light';
}

export async function saveThemeMode(mode: ThemeMode): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, mode);
}
