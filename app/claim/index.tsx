import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
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
        const msg = err.body?.errors?.ic_number?.[0] ?? t('claim.errors.icNotVerified');
        setError(msg);
      } else if (err instanceof ApiError) {
        setError(t('claim.errors.submissionFailed', { status: err.status }));
      } else {
        setError(t('claim.errors.serverUnreachable'));
      }
    }
    setLoading(false);
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}>
      <ClaimHeader title={t('claim.headerTitle')} />
      <ScrollView contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">
        <Card style={styles.heroCard}>
          <Card.Content style={styles.heroContent}>
            <View style={styles.heroIcon}>
              <Icon source="shield-check-outline" size={28} color={PRIMARY} />
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="titleMedium" style={styles.heroTitle}>
                {t('claim.heroTitle')}
              </Text>
              <Text variant="bodySmall" style={styles.heroBody}>
                {t('claim.heroBody')}
              </Text>
            </View>
          </Card.Content>
        </Card>

        <TextInput
          label={t('claim.icLabel')}
          value={ic}
          onChangeText={(v) => setIc(formatMyIc(v))}
          keyboardType="number-pad"
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={14}
          placeholder={t('claim.icPlaceholder')}
          mode="outlined"
          style={styles.input}
          error={!!error}
        />
        <HelperText type="info" visible>
          {t('claim.dashesAuto')}
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
          {t('claim.verify')}
        </Button>

        <Text variant="bodySmall" style={styles.disclaimer}>
          {t('claim.icNotFoundHint')}
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
