import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

// Sanctum token persisted in the device's secure keystore (Keychain on iOS,
// Keystore on Android). Cleared on logout or 401. Used for BOTH owner users
// and guard devices — Sanctum is polymorphic so the same `Authorization`
// header works for either entity type.
const TOKEN_KEY = 'baiti.auth.token';

// "owner" (default) or "guard". Persisted across launches. Flipped to "guard"
// when a tablet successfully pairs; flipped back to "owner" if the device is
// unpaired (or token gets a 401, indicating the JMB admin revoked it).
const DEVICE_MODE_KEY = 'baiti.device.mode';

// The local cache of the active shift (staff_id + when we last refreshed it).
// Lets us avoid asking the API on every screen mount.
const SHIFT_KEY = 'baiti.guard.shift';

// When the app was last in the foreground. Used to decide whether to
// re-prompt for shift identity when the user opens the app after idle.
const LAST_FOREGROUND_KEY = 'baiti.app.lastForeground';

// Remembered identity hint for "Continue as <name>" re-login. Lives in plain
// AsyncStorage (not SecureStore) because it's not sensitive — just name +
// email + avatar so we can render the welcome-back card. Survives logout,
// only cleared by "Use a different account" or app uninstall.
const REMEMBERED_EMAIL_KEY = 'baiti.auth.remembered.email';
const REMEMBERED_NAME_KEY = 'baiti.auth.remembered.name';
const REMEMBERED_AVATAR_KEY = 'baiti.auth.remembered.avatar';

export type DeviceMode = 'owner' | 'guard';

export type CachedShift = {
  id: string;
  staffId: string;
  staffName: string;
  startedAt: string;  // ISO
};

export type RememberedIdentity = {
  email: string;
  name: string;
  avatarUrl: string | null;
};

export async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function setToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function clearToken(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

export async function getDeviceMode(): Promise<DeviceMode> {
  const raw = await SecureStore.getItemAsync(DEVICE_MODE_KEY);
  return raw === 'guard' ? 'guard' : 'owner';
}

export async function setDeviceMode(mode: DeviceMode): Promise<void> {
  await SecureStore.setItemAsync(DEVICE_MODE_KEY, mode);
}

export async function clearDeviceMode(): Promise<void> {
  await SecureStore.deleteItemAsync(DEVICE_MODE_KEY);
}

export async function getCachedShift(): Promise<CachedShift | null> {
  const raw = await SecureStore.getItemAsync(SHIFT_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as CachedShift;
  } catch {
    return null;
  }
}

export async function setCachedShift(shift: CachedShift): Promise<void> {
  await SecureStore.setItemAsync(SHIFT_KEY, JSON.stringify(shift));
}

export async function clearCachedShift(): Promise<void> {
  await SecureStore.deleteItemAsync(SHIFT_KEY);
}

export async function getLastForegroundAt(): Promise<number | null> {
  const raw = await SecureStore.getItemAsync(LAST_FOREGROUND_KEY);
  return raw ? Number(raw) : null;
}

export async function setLastForegroundAt(timestamp: number): Promise<void> {
  await SecureStore.setItemAsync(LAST_FOREGROUND_KEY, String(timestamp));
}

export async function getRememberedIdentity(): Promise<RememberedIdentity | null> {
  const [email, name, avatarUrl] = await Promise.all([
    AsyncStorage.getItem(REMEMBERED_EMAIL_KEY),
    AsyncStorage.getItem(REMEMBERED_NAME_KEY),
    AsyncStorage.getItem(REMEMBERED_AVATAR_KEY),
  ]);
  if (!email || !name) return null;

  return { email, name, avatarUrl: avatarUrl || null };
}

export async function setRememberedIdentity(id: RememberedIdentity): Promise<void> {
  await AsyncStorage.setItem(REMEMBERED_EMAIL_KEY, id.email);
  await AsyncStorage.setItem(REMEMBERED_NAME_KEY, id.name);
  if (id.avatarUrl) {
    await AsyncStorage.setItem(REMEMBERED_AVATAR_KEY, id.avatarUrl);
  } else {
    await AsyncStorage.removeItem(REMEMBERED_AVATAR_KEY);
  }
}

export async function clearRememberedIdentity(): Promise<void> {
  await AsyncStorage.removeItem(REMEMBERED_EMAIL_KEY);
  await AsyncStorage.removeItem(REMEMBERED_NAME_KEY);
  await AsyncStorage.removeItem(REMEMBERED_AVATAR_KEY);
}
