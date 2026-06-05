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

export type DeviceMode = 'owner' | 'guard';

export type CachedShift = {
  id: string;
  staffId: string;
  staffName: string;
  startedAt: string;  // ISO
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
