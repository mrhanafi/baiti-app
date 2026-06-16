import * as Google from 'expo-auth-session/providers/google';
import { Link, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Avatar, Button, Divider, HelperText, Text, TextInput } from 'react-native-paper';

import { ApiError } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/session';
import { getRememberedIdentity, RememberedIdentity } from '@/lib/auth/storage';

const PRIMARY = '#7367F0';

export default function LoginScreen() {
  const router = useRouter();
  const { signIn, signInWithGoogle, requestLoginCode, forgetRememberedIdentity } = useAuth();

  const [remembered, setRemembered] = useState<RememberedIdentity | null>(null);
  const [hintLoaded, setHintLoaded] = useState(false);

  // Standard password form state
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Re-login (Continue as <name>) state
  const [reloggingIn, setReloggingIn] = useState(false);

  // Google sign-in state — provider configured when env vars are set
  const [googleBusy, setGoogleBusy] = useState(false);
  const [, , promptAsync] = Google.useIdTokenAuthRequest({
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  });
  const googleConfigured = Boolean(process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID);

  // Load remembered identity once on mount
  useEffect(() => {
    getRememberedIdentity().then((hint) => {
      setRemembered(hint);
      setHintLoaded(true);
    });
  }, []);

  async function handlePasswordSubmit() {
    setLoading(true);
    setError(null);
    try {
      await signIn(identifier.trim(), password);
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) {
        setError('Invalid credentials.');
      } else if (err instanceof ApiError) {
        setError(`Login failed (${err.status}).`);
      } else {
        setError('Could not reach the server. Check your connection.');
      }
    }
    setLoading(false);
  }

  async function handleGoogle() {
    if (!googleConfigured) {
      setError('Google sign-in not configured on this build.');
      return;
    }
    setGoogleBusy(true);
    setError(null);
    try {
      const result = await promptAsync();
      if (result?.type !== 'success' || !result.params.id_token) {
        // User cancelled the picker — silent
        setGoogleBusy(false);
        return;
      }
      await signInWithGoogle(result.params.id_token, null);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError(err.body?.message ?? 'This email is registered with a password.');
      } else if (err instanceof ApiError && err.status === 401) {
        setError('Google sign-in was rejected.');
      } else {
        setError('Google sign-in failed.');
      }
    }
    setGoogleBusy(false);
  }

  async function handleContinueAs() {
    if (!remembered) return;
    setReloggingIn(true);
    setError(null);
    try {
      await requestLoginCode(remembered.email);
      router.push({ pathname: '/(auth)/code/verify' as never, params: { email: remembered.email } });
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
  }

  // Don't flash the wrong state — wait for the AsyncStorage read
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

  // STATE B — fresh / different account (full login options)
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}>
      <View style={styles.inner}>
        <Text variant="headlineLarge" style={styles.title}>
          Welcome to Baiti
        </Text>
        <Text variant="bodyMedium" style={styles.subtitle}>
          Sign in to manage your home
        </Text>

        {googleConfigured ? (
          <Button
            mode="contained"
            icon="google"
            onPress={handleGoogle}
            loading={googleBusy}
            disabled={googleBusy || loading}
            style={styles.button}
            contentStyle={styles.buttonContent}>
            Continue with Google
          </Button>
        ) : null}

        {googleConfigured ? (
          <View style={styles.dividerRow}>
            <Divider style={styles.dividerLine} />
            <Text style={styles.dividerLabel}>or</Text>
            <Divider style={styles.dividerLine} />
          </View>
        ) : null}

        <TextInput
          label="Phone or email"
          value={identifier}
          onChangeText={setIdentifier}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          style={styles.input}
          mode="outlined"
        />
        <TextInput
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry={!showPassword}
          autoCapitalize="none"
          style={styles.input}
          mode="outlined"
          right={
            <TextInput.Icon
              icon={showPassword ? 'eye-off' : 'eye'}
              onPress={() => setShowPassword((v) => !v)}
            />
          }
        />

        {error ? (
          <HelperText type="error" visible style={styles.error}>
            {error}
          </HelperText>
        ) : null}

        <Button
          mode={googleConfigured ? 'outlined' : 'contained'}
          onPress={handlePasswordSubmit}
          loading={loading}
          disabled={loading || googleBusy || !identifier || !password}
          style={styles.button}
          contentStyle={styles.buttonContent}>
          Sign in with password
        </Button>

        <View style={styles.footer}>
          <Text variant="bodyMedium">Don&apos;t have an account? </Text>
          <Link href="/(auth)/register" replace>
            <Text variant="bodyMedium" style={styles.link}>
              Create one
            </Text>
          </Link>
        </View>

        <View style={styles.guardFooter}>
          <Text variant="bodySmall" style={styles.guardFooterLabel}>
            Setting up a guard tablet?
          </Text>
          <Link href="/pair">
            <Text variant="bodySmall" style={styles.guardFooterLink}>
              Pair this device
            </Text>
          </Link>
        </View>
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
  error: { marginTop: 4 },
  button: { marginTop: 12 },
  buttonContent: { paddingVertical: 6 },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 20, alignItems: 'center' },
  link: { color: PRIMARY, fontWeight: '600' },

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

  guardFooter: { flexDirection: 'row', justifyContent: 'center', marginTop: 36, gap: 6 },
  guardFooterLabel: { opacity: 0.55 },
  guardFooterLink: { color: PRIMARY, fontWeight: '500' },
});
