import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
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
  const { email, registrationToken, inviteName, invitePhone, inviteUnit, inviteOrg } = useLocalSearchParams<{
    email: string;
    registrationToken: string;
    inviteName?: string;
    invitePhone?: string;
    inviteUnit?: string;
    inviteOrg?: string;
  }>();
  const { completeRegistration } = useAuth();
  const { t } = useTranslation();

  const invited = !!inviteOrg;

  // JMB-invited owners get the registry name/phone prefilled — editable,
  // because the invited person may not be the registered owner (a family
  // member managing the unit).
  const [name, setName] = useState(inviteName ?? '');
  const [phone, setPhone] = useState(invitePhone ?? '');
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
            ?? t('auth.errors.invalidDetails');
          setError(msg);
        } else {
          setError(t('auth.errors.registrationFailed', { status: err.status }));
        }
      } else {
        setError(t('auth.errors.serverUnreachable'));
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
          {invited ? t('auth.welcomeInvited') : t('auth.almostDone')}
        </Text>
        {invited ? (
          <Text variant="bodyMedium" style={styles.subtitle}>
            <Text style={styles.email}>{inviteOrg}</Text>{' '}
            {inviteUnit
              ? t('auth.invitedHasUnit', { unit: inviteUnit })
              : t('auth.invitedHasHome')}
          </Text>
        ) : (
          <Text variant="bodyMedium" style={styles.subtitle}>
            {t('auth.tellUsAboutYou')}{'\n'}
            <Text style={styles.email}>{email}</Text>
            {'\n'}{t('auth.isNowVerified')}
          </Text>
        )}

        <TextInput
          label={t('auth.fullName')}
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
          autoComplete="name"
          textContentType="name"
          style={styles.input}
          mode="outlined"
        />
        <TextInput
          label={t('auth.phoneOptional')}
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          autoComplete="tel"
          textContentType="telephoneNumber"
          placeholder={t('auth.phonePlaceholder')}
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
          {t('auth.continue')}
        </Button>

        <Text variant="bodySmall" style={styles.legal}>
          {t('auth.legalNotice')}
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
