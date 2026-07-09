import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { Button, HelperText, Text, TextInput } from 'react-native-paper';

import { ApiError } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/session';

const PRIMARY = '#7367F0';

export default function VerifyCodeScreen() {
  const { email } = useLocalSearchParams<{ email: string }>();
  const router = useRouter();
  const { verifyLoginCode, requestLoginCode, forgetRememberedIdentity } = useAuth();

  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(60);

  // Tick down the resend timer once a second
  useEffect(() => {
    if (resendIn <= 0) return;
    const id = setInterval(() => setResendIn((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [resendIn]);

  const masked = email ? maskEmail(email) : '';

  async function handleVerify() {
    if (!email || code.length !== 6) return;
    setVerifying(true);
    setError(null);
    try {
      const result = await verifyLoginCode(email, code);
      if (result.status === 'needs_registration') {
        // First-time email — collect name + phone on the next screen
        router.replace({
          pathname: '/(auth)/complete-profile' as never,
          params: {
            email: result.email,
            registrationToken: result.registrationToken,
            // JMB-invited owner? Prefill hints for the profile screen.
            inviteName: result.invite?.owner_name ?? '',
            invitePhone: result.invite?.owner_phone ?? '',
            inviteUnit: result.invite?.unit_number ?? '',
            inviteOrg: result.invite?.organization_name ?? '',
          },
        });
        return;
      }
      // status === 'logged_in' → root auth gate handles redirect to (tabs)
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 410) {
          setError(err.body?.message ?? 'Code expired. Request a new one.');
          setResendIn(0); // unlock the resend button so they can retry
        } else if (err.status === 422) {
          setError('Invalid code. Try again.');
        } else if (err.status === 429) {
          setError('Too many requests. Wait a moment.');
        } else {
          setError(`Verification failed (${err.status}).`);
        }
      } else {
        setError('Could not reach the server.');
      }
    }
    setVerifying(false);
  }

  async function handleResend() {
    if (!email || resendIn > 0) return;
    setResending(true);
    setError(null);
    try {
      await requestLoginCode(email);
      setResendIn(60);
      setCode('');
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) {
        setError(err.body?.message ?? 'Please wait before requesting another code.');
      } else {
        setError('Could not send a new code.');
      }
    }
    setResending(false);
  }

  async function handleUseDifferentAccount() {
    await forgetRememberedIdentity();
    router.replace('/(auth)/login');
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}>
      <View style={styles.inner}>
        <Text variant="headlineMedium" style={styles.title}>
          Enter your code
        </Text>
        <Text variant="bodyMedium" style={styles.subtitle}>
          We sent a 6-digit code to{'\n'}
          <Text style={styles.email}>{masked}</Text>
        </Text>

        <TextInput
          label="6-digit code"
          value={code}
          onChangeText={(t) => setCode(t.replace(/[^0-9]/g, '').slice(0, 6))}
          keyboardType="number-pad"
          maxLength={6}
          autoFocus
          autoComplete="one-time-code"
          textContentType="oneTimeCode"
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
          onPress={handleVerify}
          loading={verifying}
          disabled={verifying || code.length !== 6}
          style={styles.button}
          contentStyle={styles.buttonContent}>
          Continue
        </Button>

        <Button
          mode="text"
          onPress={handleResend}
          loading={resending}
          disabled={resending || resendIn > 0}
          style={styles.resendButton}
          textColor={PRIMARY}>
          {resendIn > 0 ? `Resend code in ${resendIn}s` : 'Resend code'}
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

/** Mask the middle of the local-part: ja***@gmail.com */
function maskEmail(full: string): string {
  const [local, domain] = full.split('@');
  if (!local || !domain) return full;
  if (local.length <= 2) return `${local[0] ?? ''}***@${domain}`;

  return `${local.slice(0, 2)}***@${domain}`;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  inner: { flex: 1, justifyContent: 'center', padding: 24 },
  title: { marginBottom: 4, fontWeight: '700' },
  subtitle: { opacity: 0.7, marginBottom: 24, lineHeight: 22 },
  email: { fontWeight: '600', color: PRIMARY },
  input: { marginBottom: 12 },
  error: { marginTop: 4 },
  button: { marginTop: 12 },
  buttonContent: { paddingVertical: 6 },
  resendButton: { marginTop: 8 },
  footer: { marginTop: 32, alignItems: 'center' },
});
