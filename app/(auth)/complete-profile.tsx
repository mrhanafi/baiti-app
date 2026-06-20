import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { Button, HelperText, Text, TextInput } from 'react-native-paper';

import { ApiError } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/session';

const PRIMARY = '#7367F0';

/**
 * Step 2 of email registration. User arrived here from the code/verify screen
 * after the backend returned needs_registration. We collect name + phone, then
 * call /auth/complete-registration with the registration_token we received
 * from verifyCode. On success, user is created + logged in → root auth gate
 * redirects to (tabs) or claim flow.
 */
export default function CompleteProfileScreen() {
  const { email, registrationToken } = useLocalSearchParams<{
    email: string;
    registrationToken: string;
  }>();
  const { completeRegistration } = useAuth();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!email || !registrationToken || !name.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await completeRegistration({
        email,
        name: name.trim(),
        phone: phone.trim() || undefined,
        registrationToken,
      });
      // Root auth gate redirects to (tabs) — new users with no units will
      // bounce to claim flow from there.
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 422) {
          const msg = err.body?.errors?.email?.[0]
            ?? err.body?.errors?.registration_token?.[0]
            ?? 'Invalid details. Try again.';
          setError(msg);
        } else {
          setError(`Could not finish registration (${err.status}).`);
        }
      } else {
        setError('Could not reach the server.');
      }
    }
    setSubmitting(false);
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}>
      <View style={styles.inner}>
        <Text variant="headlineMedium" style={styles.title}>
          Almost done
        </Text>
        <Text variant="bodyMedium" style={styles.subtitle}>
          Tell us a bit about you. Your email{'\n'}
          <Text style={styles.email}>{email}</Text>
          {'\n'}is now verified.
        </Text>

        <TextInput
          label="Full name"
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
          autoComplete="name"
          textContentType="name"
          style={styles.input}
          mode="outlined"
        />
        <TextInput
          label="Phone number (optional)"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          autoComplete="tel"
          textContentType="telephoneNumber"
          placeholder="01X-XXXXXXX"
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
          onPress={handleSubmit}
          loading={submitting}
          disabled={submitting || !name.trim()}
          style={styles.button}
          contentStyle={styles.buttonContent}>
          Continue
        </Button>

        <Text variant="bodySmall" style={styles.legal}>
          By tapping Continue, you agree to Baiti&apos;s Terms of Service and Privacy Policy.
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  inner: { flex: 1, justifyContent: 'center', padding: 24 },
  title: { marginBottom: 4, fontWeight: '700' },
  subtitle: { opacity: 0.7, marginBottom: 24, lineHeight: 22 },
  email: { fontWeight: '600', color: PRIMARY },
  input: { marginBottom: 12 },
  error: { marginTop: 4 },
  button: { marginTop: 12 },
  buttonContent: { paddingVertical: 6 },
  legal: { marginTop: 24, textAlign: 'center', opacity: 0.55, paddingHorizontal: 8 },
});
