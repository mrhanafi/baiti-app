import {
  GoogleSignin,
  isErrorWithCode,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Avatar, Button, Divider, HelperText, Text, TextInput } from 'react-native-paper';

import { ApiError } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/session';
import { getRememberedIdentity, RememberedIdentity } from '@/lib/auth/storage';

const PRIMARY = '#7367F0';

// One-time configuration for the native Google Sign-In SDK.
//   webClientId — audience for the ID token; backend Socialite verifies against this
//   iosClientId — required on iOS (no SHA-1 mechanism; Android auto-discovers via Play Services)
const WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
const IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
if (WEB_CLIENT_ID) {
  GoogleSignin.configure({
    webClientId: WEB_CLIENT_ID,
    iosClientId: IOS_CLIENT_ID || undefined,
    offlineAccess: false,
  });
}

export default function LoginScreen() {
  const router = useRouter();
  const { signInWithGoogle, requestLoginCode, forgetRememberedIdentity } = useAuth();

  const [remembered, setRemembered] = useState<RememberedIdentity | null>(null);
  const [hintLoaded, setHintLoaded] = useState(false);

  // Email entry (for "Sign in with email" path)
  const [emailMode, setEmailMode] = useState(false);
  const [email, setEmail] = useState('');
  const [sendingCode, setSendingCode] = useState(false);

  const [reloggingIn, setReloggingIn] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const googleConfigured = Boolean(WEB_CLIENT_ID);

  useEffect(() => {
    getRememberedIdentity().then((hint) => {
      setRemembered(hint);
      setHintLoaded(true);
    });
  }, []);

  async function handleGoogle() {
    if (!googleConfigured) {
      setError('Google sign-in not configured on this build.');
      return;
    }
    setGoogleBusy(true);
    setError(null);
    try {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      // Force account picker (don't silent-reuse cached Google session)
      try {
        await GoogleSignin.signOut();
      } catch {
        // ignore — there might be no cached session
      }
      const result = await GoogleSignin.signIn();
      const idToken =
        (result as any)?.data?.idToken ?? (result as any)?.idToken ?? null;
      const avatar =
        (result as any)?.data?.user?.photo ?? (result as any)?.user?.photo ?? null;
      if (!idToken) {
        setError('Google sign-in did not return a token.');
        setGoogleBusy(false);
        return;
      }
      // require_code mode: backend sends 6-digit code to the Google email
      // instead of returning a token. Caller (us) navigates to verify.
      const { email: verifiedEmail } = await signInWithGoogle(idToken, avatar);
      router.push({
        pathname: '/(auth)/code/verify' as never,
        params: { email: verifiedEmail },
      });
    } catch (err: any) {
      if (isErrorWithCode(err)) {
        switch (err.code) {
          case statusCodes.SIGN_IN_CANCELLED:
            break;
          case statusCodes.IN_PROGRESS:
            setError('A sign-in is already in progress.');
            break;
          case statusCodes.PLAY_SERVICES_NOT_AVAILABLE:
            setError('Google Play Services is missing. Update from Play Store.');
            break;
          default:
            setError(`Google sign-in failed (${err.code}).`);
        }
      } else if (err instanceof ApiError && err.status === 409) {
        setError(err.body?.message ?? 'This email is registered with a password.');
      } else if (err instanceof ApiError && err.status === 401) {
        setError('Google sign-in was rejected by the server.');
      } else {
        setError('Google sign-in failed.');
      }
    }
    setGoogleBusy(false);
  }

  async function handleSendCode() {
    if (!email.trim()) return;
    setSendingCode(true);
    setError(null);
    try {
      await requestLoginCode(email.trim());
      router.push({
        pathname: '/(auth)/code/verify' as never,
        params: { email: email.trim() },
      });
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) {
        setError(err.body?.message ?? 'Too many requests. Wait a moment.');
      } else if (err instanceof ApiError && err.status === 422) {
        setError('Please enter a valid email.');
      } else {
        setError('Could not send a code. Try again.');
      }
    }
    setSendingCode(false);
  }

  async function handleContinueAs() {
    if (!remembered) return;
    setReloggingIn(true);
    setError(null);
    try {
      await requestLoginCode(remembered.email);
      router.push({
        pathname: '/(auth)/code/verify' as never,
        params: { email: remembered.email },
      });
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) {
        setError(err.body?.message ?? 'Please wait before requesting another code.');
      } else {
        setError('Could not send a code. Try again.');
      }
    }
    setReloggingIn(false);
  }

  async function handleUseDifferentAccount() {
    await forgetRememberedIdentity();
    setRemembered(null);
    setEmailMode(false);
    setEmail('');
  }

  if (!hintLoaded) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator />
      </View>
    );
  }

  // STATE A — remembered identity exists ("Welcome back, Hanafi")
  if (remembered) {
    const firstName = remembered.name.split(' ')[0];
    const initials = remembered.name
      .split(' ')
      .map((p) => p[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase();

    return (
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.container}>
        <View style={styles.inner}>
          <Text variant="headlineLarge" style={styles.title}>
            Welcome back
          </Text>
          <Text variant="bodyMedium" style={styles.subtitle}>
            Sign in to continue
          </Text>

          <Pressable onPress={handleContinueAs} disabled={reloggingIn} style={styles.identityCard}>
            {remembered.avatarUrl ? (
              <Avatar.Image source={{ uri: remembered.avatarUrl }} size={48} />
            ) : (
              <Avatar.Text label={initials || '?'} size={48} style={{ backgroundColor: PRIMARY }} />
            )}
            <View style={styles.identityText}>
              <Text style={styles.identityName} numberOfLines={1}>
                {remembered.name}
              </Text>
              <Text style={styles.identityEmail} numberOfLines={1}>
                {remembered.email}
              </Text>
            </View>
          </Pressable>

          {error ? (
            <HelperText type="error" visible style={styles.error}>
              {error}
            </HelperText>
          ) : null}

          <Button
            mode="contained"
            onPress={handleContinueAs}
            loading={reloggingIn}
            disabled={reloggingIn}
            style={styles.button}
            contentStyle={styles.buttonContent}>
            Continue as {firstName}
          </Button>

          <View style={styles.footer}>
            <Button mode="text" onPress={handleUseDifferentAccount} textColor="#6b7280">
              Use a different account
            </Button>
          </View>
        </View>
      </KeyboardAvoidingView>
    );
  }

  // STATE B — fresh / different account
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}>
      <View style={styles.inner}>
        <Text variant="headlineLarge" style={styles.title}>
          Welcome to Baiti
        </Text>
        <Text variant="bodyMedium" style={styles.subtitle}>
          Sign in or sign up — same flow either way.
        </Text>

        {googleConfigured ? (
          <Button
            mode="contained"
            icon="google"
            onPress={handleGoogle}
            loading={googleBusy}
            disabled={googleBusy || sendingCode}
            style={styles.button}
            contentStyle={styles.buttonContent}>
            Continue with Google
          </Button>
        ) : null}

        {googleConfigured && !emailMode ? (
          <View style={styles.dividerRow}>
            <Divider style={styles.dividerLine} />
            <Text style={styles.dividerLabel}>or</Text>
            <Divider style={styles.dividerLine} />
          </View>
        ) : null}

        {emailMode ? (
          <>
            <TextInput
              label="Email address"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              keyboardType="email-address"
              autoFocus
              style={styles.input}
              mode="outlined"
            />

            {error ? (
              <HelperText type="error" visible style={styles.error}>
                {error}
              </HelperText>
            ) : null}

            <Button
              mode="contained"
              onPress={handleSendCode}
              loading={sendingCode}
              disabled={sendingCode || !email.trim()}
              style={styles.button}
              contentStyle={styles.buttonContent}>
              Send 6-digit code
            </Button>

            <Button mode="text" onPress={() => { setEmailMode(false); setError(null); }} textColor="#6b7280">
              Back
            </Button>
          </>
        ) : (
          <>
            {error ? (
              <HelperText type="error" visible style={styles.error}>
                {error}
              </HelperText>
            ) : null}
            <Button
              mode={googleConfigured ? 'outlined' : 'contained'}
              icon="email-outline"
              onPress={() => { setEmailMode(true); setError(null); }}
              style={styles.button}
              contentStyle={styles.buttonContent}>
              Sign in with email
            </Button>
          </>
        )}

        <Text variant="bodySmall" style={styles.legal}>
          New here? Just continue — we&apos;ll set up your account during the first sign-in.
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  inner: { flex: 1, justifyContent: 'center', padding: 24 },
  center: { alignItems: 'center', justifyContent: 'center' },
  title: { marginBottom: 4 },
  subtitle: { opacity: 0.6, marginBottom: 24 },
  input: { marginBottom: 12 },
  error: { marginTop: 4, marginBottom: 8 },
  button: { marginTop: 12 },
  buttonContent: { paddingVertical: 6 },

  dividerRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 16 },
  dividerLine: { flex: 1, backgroundColor: '#e5e7eb' },
  dividerLabel: { paddingHorizontal: 12, color: '#9ca3af', fontSize: 12 },

  identityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 16,
    gap: 14,
    marginTop: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  identityText: { flex: 1, minWidth: 0 },
  identityName: { fontSize: 16, fontWeight: '600', color: '#111827' },
  identityEmail: { fontSize: 13, color: '#6b7280', marginTop: 2 },

  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 20, alignItems: 'center' },

  legal: { marginTop: 28, textAlign: 'center', opacity: 0.55, paddingHorizontal: 16 },
});
