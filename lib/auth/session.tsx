import * as Device from 'expo-device';
import { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';

import { apiFetch } from '@/lib/api/client';
import {
  clearRememberedIdentity,
  clearToken,
  getDeviceMode,
  getToken,
  setRememberedIdentity,
  setToken,
} from '@/lib/auth/storage';
import { syncLocaleAfterAuth } from '@/lib/i18n';
import { getExpoPushToken } from '@/lib/push/register';

export type Organization = {
  id: string;
  legal_name: string;
  slug: string;
  // Optional modules enabled for this JMB — Home tiles are filtered on this.
  // Missing (older cached payload) means "show everything".
  enabled_modules?: string[];
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

// verifyLoginCode now branches based on whether user exists. Returned shape
// tells the caller (the verify screen) what to do next.
export type InviteHint = {
  owner_name: string | null;
  owner_phone: string | null;
  unit_number: string | null;
  organization_name: string | null;
};

export type VerifyCodeResult =
  | { status: 'logged_in' }
  | { status: 'needs_registration'; email: string; registrationToken: string; invite: InviteHint | null };

type AuthContextValue = {
  user: User | null;
  loading: boolean; // true while we're checking the stored token on boot
  signIn: (identifier: string, password: string) => Promise<void>;
  signUp: (payload: RegisterPayload) => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
  // Passwordless re-login + first-time registration via 6-digit email code
  requestLoginCode: (email: string) => Promise<{ expires_at: string }>;
  verifyLoginCode: (email: string, code: string) => Promise<VerifyCodeResult>;
  completeRegistration: (params: {
    email: string;
    name: string;
    phone?: string;
    registrationToken: string;
  }) => Promise<void>;
  // Sign in with Google — idToken from @react-native-google-signin native SDK.
  // Always uses require_code:true; backend fires a 6-digit code instead of
  // returning a token directly. Caller then navigates to /code/verify.
  signInWithGoogle: (idToken: string, avatarUrl?: string | null) => Promise<{ email: string }>;
  // Forget the "Continue as <name>" hint when the user picks a different account
  forgetRememberedIdentity: () => Promise<void>;
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
        // Refresh push token on app boot — Expo can rotate it.
        void registerPushToken('/api/v1/me/push-token');
    syncLocaleAfterAuth();
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
    await rememberFromUser(me, null);
    // Best-effort push token registration. Won't block login if it fails.
    void registerPushToken('/api/v1/me/push-token');
    syncLocaleAfterAuth();
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
    await rememberFromUser(me, null);
    void registerPushToken('/api/v1/me/push-token');
    syncLocaleAfterAuth();
  }

  async function requestLoginCode(email: string): Promise<{ expires_at: string }> {
    console.log('[auth] requestLoginCode', { email });
    return apiFetch('/api/v1/auth/code/request', {
      method: 'POST',
      body: JSON.stringify({ email, device_name: 'Expo Go' }),
    });
  }

  async function verifyLoginCode(email: string, code: string): Promise<VerifyCodeResult> {
    console.log('[auth] verifyLoginCode', { email });
    const data = await apiFetch('/api/v1/auth/code/verify', {
      method: 'POST',
      body: JSON.stringify({ email, code, device_name: 'Expo Go' }),
    });

    if (data?.status === 'needs_registration') {
      // First-time email: caller should navigate to complete-profile screen.
      // No token to set yet.
      return {
        status: 'needs_registration',
        email: data.email,
        registrationToken: data.registration_token,
        invite: data.invite ?? null,
      };
    }

    // Existing user — finish the login
    await setToken(data.token);
    const me = await apiFetch('/api/v1/me');
    setUser(me);
    await rememberFromUser(me, null);
    void registerPushToken('/api/v1/me/push-token');
    syncLocaleAfterAuth();
    return { status: 'logged_in' };
  }

  async function completeRegistration(params: {
    email: string;
    name: string;
    phone?: string;
    registrationToken: string;
  }) {
    console.log('[auth] completeRegistration', { email: params.email });
    const data = await apiFetch('/api/v1/auth/complete-registration', {
      method: 'POST',
      body: JSON.stringify({
        email: params.email,
        name: params.name,
        phone: params.phone ?? null,
        registration_token: params.registrationToken,
        device_name: 'Expo Go',
      }),
    });
    await setToken(data.token);
    const me = await apiFetch('/api/v1/me');
    setUser(me);
    await rememberFromUser(me, null);
    void registerPushToken('/api/v1/me/push-token');
    syncLocaleAfterAuth();
  }

  async function signInWithGoogle(idToken: string, avatarUrl: string | null = null): Promise<{ email: string }> {
    console.log('[auth] signInWithGoogle start (require_code mode)');
    // Server creates/links the user but does NOT return a Sanctum token;
    // instead it fires a 6-digit code to the user's email. Mobile then runs
    // the standard /auth/code/verify flow to finish the login. This makes
    // email-code our second auth factor on top of "Google says you own this
    // email account on this device".
    //
    // Remember the avatar for "Welcome back" card if/when login completes.
    const data = await apiFetch('/api/v1/auth/google', {
      method: 'POST',
      body: JSON.stringify({
        id_token: idToken,
        device_name: 'Expo Go',
        require_code: true,
      }),
    });

    // Stash the avatar for later — login.tsx will persist the full identity
    // hint after the user completes code verify + we have the user record.
    if (avatarUrl) {
      // We don't have a user object yet, so set a temporary hint with just
      // email + name=email (will be overwritten when verify succeeds).
      await setRememberedIdentity({
        email: data.email,
        name: data.email,   // placeholder until /me succeeds
        avatarUrl,
      });
    }

    return { email: data.email };
  }

  async function forgetRememberedIdentity() {
    await clearRememberedIdentity();
  }

  // Helper: persist the "welcome back" hint after any successful login.
  async function rememberFromUser(me: User, avatarUrl: string | null) {
    if (!me?.email || !me?.name) return;
    await setRememberedIdentity({
      email: me.email,
      name: me.name,
      avatarUrl,
    });
  }

  // Fetch an Expo push token and POST it to the given endpoint. Silent on
  // failure — push is best-effort, never block the user. Sends device info
  // so the backend can show "iPhone 15 · last seen 2d ago" per device.
  async function registerPushToken(endpoint: string) {
    try {
      const token = await getExpoPushToken();
      if (!token) return;
      await apiFetch(endpoint, {
        method: 'POST',
        body: JSON.stringify({
          token,
          device_name: Device.deviceName ?? Device.modelName ?? null,
          platform: Platform.OS,
        }),
      });
    } catch {
      // ignore
    }
  }

  // On logout, remove THIS device's token so it stops receiving pushes for
  // this account. Other devices stay registered.
  async function deregisterPushToken() {
    try {
      const token = await getExpoPushToken();
      if (!token) return;
      await apiFetch('/api/v1/me/push-token', {
        method: 'DELETE',
        body: JSON.stringify({ token }),
      });
    } catch {
      // ignore — best effort
    }
  }

  async function refreshUser() {
    console.log('[auth] refreshUser');
    const me = await apiFetch('/api/v1/me');
    setUser(me);
  }

  async function signOut() {
    console.log('[auth] signOut start');
    // Deregister this device's push token BEFORE the auth token is cleared —
    // the DELETE call needs to be authenticated.
    await deregisterPushToken();
    try {
      await apiFetch('/api/v1/auth/logout', { method: 'POST' });
    } catch (err) {
      console.log('[auth] signOut: api call failed (ignored)', err);
    }
    await clearToken();
    // NOTE: deliberately NOT calling clearRememberedIdentity() here — the
    // welcome-back hint is what powers "Continue as <name>" on the next
    // visit. Use forgetRememberedIdentity() for the "Use a different
    // account" link.
    setUser(null);
    console.log('[auth] signOut done — user cleared');
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        signIn,
        signUp,
        signOut,
        refreshUser,
        requestLoginCode,
        verifyLoginCode,
        completeRegistration,
        signInWithGoogle,
        forgetRememberedIdentity,
      }}>
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
