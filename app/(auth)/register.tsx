import { Link } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { Button, HelperText, Text, TextInput } from 'react-native-paper';

import { ApiError } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/session';
import { normaliseMyPhone } from '@/lib/format';

type FieldErrors = Record<string, string[]>;

export default function RegisterScreen() {
  const { signUp } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const passwordMismatch = confirm.length > 0 && password !== confirm;
  const submitDisabled =
    loading ||
    !name.trim() ||
    !email.trim() ||
    password.length < 8 ||
    confirm.length === 0 ||
    passwordMismatch;

  async function handleSubmit() {
    setLoading(true);
    setError(null);
    setFieldErrors({});
    try {
      await signUp({
        name: name.trim(),
        email: email.trim(),
        password,
        phone: normaliseMyPhone(phone) ?? undefined,
      });
      // Gate redirects signed-in users to (tabs). Home will show the
      // "register your property" empty state since there's no org yet.
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) {
        setFieldErrors(err.body?.errors ?? {});
        setError('Please fix the highlighted fields.');
      } else if (err instanceof ApiError) {
        setError(`Registration failed (${err.status}).`);
      } else {
        setError('Could not reach the server. Check your connection.');
      }
    }
    setLoading(false);
  }

  function fieldError(name: string): string | null {
    return fieldErrors[name]?.[0] ?? null;
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}>
      <ScrollView contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">
        <Text variant="headlineLarge" style={styles.title}>
          Create your account
        </Text>
        <Text variant="bodyMedium" style={styles.subtitle}>
          You can register your property after sign-up.
        </Text>

        <TextInput
          label="Full name"
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
          style={styles.input}
          mode="outlined"
          error={!!fieldError('name')}
        />
        {fieldError('name') ? (
          <HelperText type="error" visible>
            {fieldError('name')}
          </HelperText>
        ) : null}

        <TextInput
          label="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          style={styles.input}
          mode="outlined"
          error={!!fieldError('email')}
        />
        {fieldError('email') ? (
          <HelperText type="error" visible>
            {fieldError('email')}
          </HelperText>
        ) : null}

        <TextInput
          label="Phone (optional)"
          value={phone}
          onChangeText={(v) => setPhone(v.replace(/\D/g, ''))}
          keyboardType="phone-pad"
          style={styles.input}
          mode="outlined"
          placeholder="121234567"
          left={<TextInput.Affix text="+60" />}
          error={!!fieldError('phone')}
        />
        {fieldError('phone') ? (
          <HelperText type="error" visible>
            {fieldError('phone')}
          </HelperText>
        ) : null}

        <TextInput
          label="Password (min 8 chars)"
          value={password}
          onChangeText={setPassword}
          secureTextEntry={!showPassword}
          autoCapitalize="none"
          style={styles.input}
          mode="outlined"
          error={!!fieldError('password')}
          right={
            <TextInput.Icon
              icon={showPassword ? 'eye-off' : 'eye'}
              onPress={() => setShowPassword((v) => !v)}
            />
          }
        />
        {fieldError('password') ? (
          <HelperText type="error" visible>
            {fieldError('password')}
          </HelperText>
        ) : null}

        <TextInput
          label="Confirm password"
          value={confirm}
          onChangeText={setConfirm}
          secureTextEntry={!showPassword}
          autoCapitalize="none"
          style={styles.input}
          mode="outlined"
          error={passwordMismatch}
        />
        {passwordMismatch ? (
          <HelperText type="error" visible>
            Passwords don&apos;t match.
          </HelperText>
        ) : null}

        {error ? (
          <HelperText type="error" visible style={styles.error}>
            {error}
          </HelperText>
        ) : null}

        <Button
          mode="contained"
          onPress={handleSubmit}
          loading={loading}
          disabled={submitDisabled}
          style={styles.button}
          contentStyle={styles.buttonContent}>
          Create account
        </Button>

        <View style={styles.footer}>
          <Text variant="bodyMedium">Already have an account? </Text>
          <Link href="/(auth)/login" replace>
            <Text variant="bodyMedium" style={styles.link}>
              Sign in
            </Text>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  inner: { padding: 24, paddingTop: 60, paddingBottom: 40 },
  title: { marginBottom: 4 },
  subtitle: { opacity: 0.6, marginBottom: 24 },
  input: { marginBottom: 4 },
  error: { marginTop: 4 },
  button: { marginTop: 16 },
  buttonContent: { paddingVertical: 6 },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 20 },
  link: { color: '#7367F0', fontWeight: '600' },
});
