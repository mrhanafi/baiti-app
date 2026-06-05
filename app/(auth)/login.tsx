import { Link } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { Button, HelperText, Text, TextInput } from 'react-native-paper';

import { ApiError } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/session';

export default function LoginScreen() {
  const { signIn } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setLoading(true);
    setError(null);
    try {
      await signIn(identifier.trim(), password);
      // Root layout's auth gate handles the redirect to (tabs).
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
          mode="contained"
          onPress={handleSubmit}
          loading={loading}
          disabled={loading || !identifier || !password}
          style={styles.button}
          contentStyle={styles.buttonContent}>
          Sign in
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
  container: { flex: 1 },
  inner: { flex: 1, justifyContent: 'center', padding: 24 },
  title: { marginBottom: 4 },
  subtitle: { opacity: 0.6, marginBottom: 24 },
  input: { marginBottom: 12 },
  error: { marginTop: 4 },
  button: { marginTop: 12 },
  buttonContent: { paddingVertical: 6 },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 20 },
  link: { color: '#7367F0', fontWeight: '600' },
  guardFooter: { flexDirection: 'row', justifyContent: 'center', marginTop: 36, gap: 6 },
  guardFooterLabel: { opacity: 0.55 },
  guardFooterLink: { color: '#7367F0', fontWeight: '500' },
});
