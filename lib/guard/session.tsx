import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';

import { apiFetch } from '@/lib/api/client';
import { getExpoPushToken } from '@/lib/push/register';
import {
  CachedShift,
  clearCachedShift,
  clearDeviceMode,
  clearToken,
  getCachedShift,
  getDeviceMode,
  getLastForegroundAt,
  getToken,
  setCachedShift,
  setDeviceMode,
  setLastForegroundAt,
  setToken,
} from '@/lib/auth/storage';

// When the app comes back from background after this many minutes of being
// hidden, force a server check — the cached shift may have auto-ended.
const FOREGROUND_RECHECK_MINUTES = 120; // 2 hours

type ServerShift = {
  id: string;
  staff_id: string | null;
  staff_name: string | null;
  started_at: string;
};

type GuardSessionValue = {
  /** True while we're checking storage on boot. */
  loading: boolean;
  /** True if the device has a paired token. */
  paired: boolean;
  /** Active shift on this device, if any. */
  shift: CachedShift | null;
  /** Exchange a 6-digit pairing code for a device token. */
  pair: (code: string) => Promise<void>;
  /** Re-fetch /shift/current — used on app foreground or after pick. */
  refreshShift: () => Promise<void>;
  /** Start a shift for the given staff ULID. */
  startShift: (staffId: string, staffName: string) => Promise<void>;
  /** End the current shift on this device. */
  endShift: () => Promise<void>;
  /** Local sign-out: clears device token + mode (after JMB admin revokes). */
  unpair: () => Promise<void>;
};

const GuardSessionContext = createContext<GuardSessionValue | null>(null);

export function GuardSessionProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [paired, setPaired] = useState(false);
  const [shift, setShift] = useState<CachedShift | null>(null);
  const pairedRef = useRef(false);
  pairedRef.current = paired;

  // On boot, see if this device is paired + has a cached shift. Then ask the
  // server if the cached shift is still valid (in case it timed out).
  useEffect(() => {
    async function boot() {
      const mode = await getDeviceMode();
      if (mode !== 'guard') {
        setLoading(false);
        return;
      }
      const token = await getToken();
      if (!token) {
        // Mode was guard but token was cleared — back to fresh state.
        await clearDeviceMode();
        setLoading(false);
        return;
      }
      setPaired(true);
      const cached = await getCachedShift();
      setShift(cached);
      // Refresh from server in the background.
      try {
        const data = await apiFetch('/api/v1/guard/shift/current');
        await applyServerShift(data?.shift);
      } catch {
        // 401? Means the device was revoked. Reset to fresh.
        await unpair();
      }
      setLoading(false);
    }
    boot();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyServerShift = useCallback(async (s: ServerShift | null) => {
    if (s && s.staff_id) {
      const cached: CachedShift = {
        id: s.id,
        staffId: s.staff_id,
        staffName: s.staff_name ?? '',
        startedAt: s.started_at,
      };
      await setCachedShift(cached);
      setShift(cached);
    } else {
      await clearCachedShift();
      setShift(null);
    }
  }, []);

  async function pair(code: string) {
    const data = await apiFetch('/api/v1/guard/devices/pair', {
      method: 'POST',
      body: JSON.stringify({ code }),
    });
    await setToken(data.token);
    await setDeviceMode('guard');
    await clearCachedShift();
    setPaired(true);
    setShift(null);
    // Best-effort push token registration. Doesn't block pairing if denied.
    void registerGuardPushToken();
  }

  async function registerGuardPushToken() {
    try {
      const token = await getExpoPushToken();
      if (!token) return;
      await apiFetch('/api/v1/guard/devices/push-token', {
        method: 'POST',
        body: JSON.stringify({ token }),
      });
    } catch {
      // ignore
    }
  }

  const refreshShift = useCallback(async () => {
    try {
      const data = await apiFetch('/api/v1/guard/shift/current');
      await applyServerShift(data?.shift);
    } catch {
      // ignore — re-prompt path will catch on next user action
    }
  }, [applyServerShift]);

  async function startShift(staffId: string, _staffName: string) {
    const data = await apiFetch('/api/v1/guard/shift/start', {
      method: 'POST',
      body: JSON.stringify({ staff_id: staffId }),
    });
    // Hydrate from server response so the shift id + started_at match the row.
    await applyServerShift({
      id: data.shift.id,
      staff_id: staffId,
      staff_name: data.shift.staff_name,
      started_at: data.shift.started_at,
    });
  }

  async function endShift() {
    try {
      await apiFetch('/api/v1/guard/shift/end', { method: 'POST' });
    } catch {
      // ignore — clear local state regardless
    }
    await clearCachedShift();
    setShift(null);
  }

  async function unpair() {
    // Tell the server first so the device row gets marked revoked and its
    // tokens get killed. If this fails (offline, 401 already-revoked, etc.)
    // we still clear local state — better to let the user out than trap them
    // on this tablet.
    try {
      await apiFetch('/api/v1/guard/devices/self-revoke', { method: 'POST' });
    } catch {
      // ignore
    }
    await clearToken();
    await clearDeviceMode();
    await clearCachedShift();
    setPaired(false);
    setShift(null);
  }

  // Foreground re-check: when the tablet wakes after >FOREGROUND_RECHECK_MINUTES
  // hidden, re-fetch shift from the server. If it auto-ended (12h timeout),
  // the gate will redirect to the picker.
  useEffect(() => {
    async function onChange(status: AppStateStatus) {
      if (status !== 'active') {
        await setLastForegroundAt(Date.now());
        return;
      }
      if (!pairedRef.current) return;
      const last = await getLastForegroundAt();
      if (!last) {
        await setLastForegroundAt(Date.now());
        return;
      }
      const minutesAway = (Date.now() - last) / 60_000;
      await setLastForegroundAt(Date.now());
      if (minutesAway >= FOREGROUND_RECHECK_MINUTES) {
        await refreshShift();
      }
      // Re-register push token on every foreground — Expo can rotate it.
      void registerGuardPushToken();
    }
    const sub = AppState.addEventListener('change', onChange);
    return () => sub.remove();
  }, [refreshShift]);

  return (
    <GuardSessionContext.Provider
      value={{ loading, paired, shift, pair, refreshShift, startShift, endShift, unpair }}>
      {children}
    </GuardSessionContext.Provider>
  );
}

export function useGuardSession(): GuardSessionValue {
  const ctx = useContext(GuardSessionContext);
  if (!ctx) throw new Error('useGuardSession must be used inside <GuardSessionProvider>');
  return ctx;
}
