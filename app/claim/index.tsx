import { useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Card, HelperText, Icon, Text, TextInput } from 'react-native-paper';

import { ClaimHeader } from '@/components/claim-header';
import { ApiError, apiFetch } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/session';
import { formatMyIc } from '@/lib/format';

const PRIMARY = '#7367F0';
const PRIMARY_TINT = '#EEEDFD';

// 12 digits after stripping dashes — matches the backend rule.
function normalizeIc(raw: string): string {
  return raw.replace(/\D/g, '');
}

export default function ClaimIcScreen() {
  const router = useRouter();
  const { refreshUser } = useAuth();
  const [ic, setIc] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const normalized = normalizeIc(ic);
  const submitDisabled = loading || normalized.length !== 12;

  async function handleSubmit() {
    setLoading(true);
    setError(null);
    try {
      const result = await apiFetch('/api/v1/me/properties', {
        method: 'POST',
        body: JSON.stringify({ ic_number: normalized }),
      });
      await refreshUser();
      router.replace({
        pathname: '/claim/success',
        params: { units: JSON.stringify(result?.units ?? []) },
      });
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) {
        const msg = err.body?.errors?.ic_number?.[0] ?? 'IC could not be verified.';
        setError(msg);
      } else if (err instanceof ApiError) {
        setError(`Submission failed (${err.status}).`);
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
      <ClaimHeader title="Verify your home" />
      <ScrollView contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">
        <Card style={styles.heroCard}>
          <Card.Content style={styles.heroContent}>
            <View style={styles.heroIcon}>
              <Icon source="shield-check-outline" size={28} color={PRIMARY} />
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="titleMedium" style={styles.heroTitle}>
                Verify with your IC
              </Text>
              <Text variant="bodySmall" style={styles.heroBody}>
                We&apos;ll match your IC against your JMB&apos;s owner registry. If it matches,
                you&apos;re in immediately — no waiting for approval.
              </Text>
            </View>
          </Card.Content>
        </Card>

        <TextInput
          label="IC number"
          value={ic}
          onChangeText={(v) => setIc(formatMyIc(v))}
          keyboardType="number-pad"
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={14}
          placeholder="901231-14-5678"
          mode="outlined"
          style={styles.input}
          error={!!error}
        />
        <HelperText type="info" visible>
          Dashes are added automatically.
        </HelperText>

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
          Verify
        </Button>

        <Text variant="bodySmall" style={styles.disclaimer}>
          If your IC isn&apos;t found, ask your JMB to add you to their owner registry, then try
          again.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  inner: { padding: 16, paddingBottom: 40 },
  heroCard: { marginBottom: 20 },
  heroContent: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  heroIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: PRIMARY_TINT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: { fontWeight: '600' },
  heroBody: { opacity: 0.7, marginTop: 2, lineHeight: 18 },
  input: { marginBottom: 0 },
  error: { marginTop: 4 },
  button: { marginTop: 12 },
  buttonContent: { paddingVertical: 6 },
  disclaimer: { marginTop: 24, opacity: 0.6, textAlign: 'center', lineHeight: 18 },
});
