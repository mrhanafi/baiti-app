import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { Button, HelperText, Icon, Text, TextInput } from 'react-native-paper';

import { PurpleHeader } from '@/components/purple-header';
import { ApiError } from '@/lib/api/client';
import { useGuardSession } from '@/lib/guard/session';

const PRIMARY_TINT = '#EEEDFD';
const PRIMARY = '#7367F0';

export default function PairScreen() {
  const { pair } = useGuardSession();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Strip non-digits so paste from a clipboard with spaces "123 456" works.
  function handleChange(text: string) {
    setCode(text.replace(/\D/g, '').slice(0, 6));
  }

  async function handleSubmit() {
    setLoading(true);
    setError(null);
    try {
      await pair(code);
      // Gate redirects to /shift-picker on successful pair.
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) {
        setError(err.body?.errors?.code?.[0] ?? 'Invalid code.');
      } else if (err instanceof ApiError) {
        setError(`Pairing failed (${err.status}).`);
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
      <PurpleHeader title="Pair Guard Device" />
      <View style={styles.inner}>
        <View style={styles.iconWrap}>
          <Icon source="cellphone" size={48} color={PRIMARY} />
        </View>
        <Text variant="titleLarge" style={styles.title}>
          Enter pairing code
        </Text>
        <Text variant="bodyMedium" style={styles.subtitle}>
          Your JMB admin will share a 6-digit code from their console. The code
          expires in 5 minutes.
        </Text>

        {/* No placeholder — letter-spacing + textAlign center keeps the caret
            centered in the empty field, which the placeholder would otherwise
            push to the right edge. */}
        <TextInput
          value={code}
          onChangeText={handleChange}
          keyboardType="number-pad"
          maxLength={6}
          mode="outlined"
          style={styles.input}
          contentStyle={styles.inputContent}
          autoFocus
          error={!!error}
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
          disabled={loading || code.length !== 6}
          style={styles.button}
          contentStyle={styles.buttonContent}>
          Pair this device
        </Button>

        <Text variant="bodySmall" style={styles.disclaimer}>
          Once paired, this tablet stays linked to the JMB until your admin revokes it
          from the console. You won't need to enter a code again.
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  inner: { padding: 24, alignItems: 'center' },

  iconWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: PRIMARY_TINT,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  title: { fontWeight: '700', marginBottom: 6, textAlign: 'center' },
  subtitle: { opacity: 0.65, marginBottom: 24, textAlign: 'center', lineHeight: 20, paddingHorizontal: 16 },

  input: { width: '100%' },
  inputContent: {
    textAlign: 'center',
    fontSize: 28,
    letterSpacing: 8,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  error: { width: '100%', marginTop: 4 },

  button: { marginTop: 16, width: '100%' },
  buttonContent: { paddingVertical: 8 },

  disclaimer: { marginTop: 24, opacity: 0.55, textAlign: 'center', lineHeight: 18, paddingHorizontal: 8 },
});
