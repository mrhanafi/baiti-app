import { createContext, ReactNode, useContext, useEffect, useState } from 'react';

import { apiFetch } from '@/lib/api/client';
import { clearToken, getDeviceMode, getToken, setToken } from '@/lib/auth/storage';

export type Organization = {
  id: string;
  legal_name: string;
  slug: string;
};

export type Unit = {
  id: string;
  unit_number: string;
  block_name: string | null;
  property_name: string | null;
  organization_id: string | null;
  organization_name: string | null;
};

export type User = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  roles: string[];                         // ['owner'] | ['guard'] | ['jmb_admin'] etc.
  organizations: Organization[];           // active memberships
  pending_organizations: Organization[];   // claims awaiting JMB approval
  units: Unit[];
  unread_announcements_count: number;
};

export type RegisterPayload = {
  name: string;
  email: string;
  password: string;
  phone?: string;
};

type AuthContextValue = {
  user: User | null;
  loading: boolean; // true while we're checking the stored token on boot
  signIn: (identifier: string, password: string) => Promise<void>;
  signUp: (payload: RegisterPayload) => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // On app boot, see if we have a stored token. If yes, ask /me who we are.
  // If the token is invalid (401), clear it and stay signed out.
  //
  // Skip entirely when deviceMode is 'guard' — the stored token belongs to a
  // GuardDevice, not a User, and /me would fail. The GuardSessionProvider
  // owns the token lifecycle in that mode.
  useEffect(() => {
    async function loadUser() {
      const mode = await getDeviceMode();
      if (mode === 'guard') {
        setLoading(false);
        return;
      }
      const token = await getToken();
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const data = await apiFetch('/api/v1/me');
        setUser(data);
      } catch {
        // Token bad or backend unreachable — clear it so we land on login.
        await clearToken();
      }
      setLoading(false);
    }
    loadUser();
  }, []);

  async function signIn(identifier: string, password: string) {
    console.log('[auth] signIn start', { identifier });
    const loginData = await apiFetch('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        identifier,
        password,
        device_name: 'Expo Go',
      }),
    });
    await setToken(loginData.token);
    // Fetch the full user (with organizations + units) — login only returns
    // basic info; /me has the complete picture.
    const me = await apiFetch('/api/v1/me');
    console.log('[auth] signIn done — user set', { orgs: me?.organizations?.length, units: me?.units?.length });
    setUser(me);
  }

  async function signUp(payload: RegisterPayload) {
    console.log('[auth] signUp start', { email: payload.email });
    const data = await apiFetch('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        ...payload,
        device_name: 'Expo Go',
      }),
    });
    await setToken(data.token);
    // /me gives the full shape (with empty organizations + pending_organizations)
    const me = await apiFetch('/api/v1/me');
    console.log('[auth] signUp done — user set');
    setUser(me);
  }

  async function refreshUser() {
    console.log('[auth] refreshUser');
    const me = await apiFetch('/api/v1/me');
    setUser(me);
  }

  async function signOut() {
    console.log('[auth] signOut start');
    try {
      await apiFetch('/api/v1/auth/logout', { method: 'POST' });
    } catch (err) {
      console.log('[auth] signOut: api call failed (ignored)', err);
    }
    await clearToken();
    setUser(null);
    console.log('[auth] signOut done — user cleared');
  }

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside <AuthProvider>');
  }
  return ctx;
}
