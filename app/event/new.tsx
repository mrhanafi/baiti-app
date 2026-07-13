import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Card, HelperText, Icon, Text, TextInput } from 'react-native-paper';

import { PurpleHeader } from '@/components/purple-header';
import { ApiError, apiFetch } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/session';

const PRIMARY = '#7367F0';
const PRIMARY_TINT = '#EEEDFD';
// Same key as Home tab + Utilities + Bills + visitor/new + maintenance/new.
const SELECTED_UNIT_KEY = 'baiti.home.selected_unit_id';

const PURPOSES = [
  { value: 'family', labelKey: 'event.purposes.family' },
  { value: 'services', labelKey: 'event.purposes.services' },
  { value: 'contractor', labelKey: 'event.purposes.contractor' },
  { value: 'cleaner', labelKey: 'event.purposes.cleaner' },
  { value: 'delivery', labelKey: 'event.purposes.delivery' },
  { value: 'other', labelKey: 'event.purposes.other' },
];

export default function NewEventScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useTranslation();

  const homes = user?.units ?? [];
  // Bound home for this event — read-only. Sourced from the Home tab's
  // active-home AsyncStorage key. To create an event for a different home,
  // switch on the Home tab and come back.
  const [unitId, setUnitId] = useState<string>(homes[0]?.id ?? '');

  useEffect(() => {
    AsyncStorage.getItem(SELECTED_UNIT_KEY).then((saved) => {
      if (saved && homes.some((u) => u.id === saved)) {
        setUnitId(saved);
      } else if (homes[0]?.id) {
        setUnitId(homes[0].id);
      }
    });
  }, [homes]);

  const boundHome = useMemo(
    () => homes.find((h) => h.id === unitId) ?? homes[0] ?? null,
    [homes, unitId],
  );

  const [title, setTitle] = useState('');
  const [purpose, setPurpose] = useState('family');
  const [maxGuests, setMaxGuests] = useState('');
  const [notes, setNotes] = useState('');

  const [validFrom, setValidFrom] = useState<Date>(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [validUntil, setValidUntil] = useState<Date>(() => {
    const d = new Date();
    d.setHours(23, 59, 59, 999);
    return d;
  });
  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showUntilPicker, setShowUntilPicker] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submitDisabled = useMemo(
    () => loading || !title.trim() || !unitId,
    [loading, title, unitId],
  );

  async function handleSubmit() {
    setLoading(true);
    setError(null);
    try {
      const result = await apiFetch('/api/v1/me/visitor-events', {
        method: 'POST',
        body: JSON.stringify({
          unit_id: unitId,
          title: title.trim(),
          purpose,
          valid_from: validFrom.toISOString(),
          valid_until: validUntil.toISOString(),
          max_guests: maxGuests ? Number(maxGuests) : undefined,
          notes: notes.trim() || undefined,
        }),
      });
      router.replace({
        pathname: '/event/[id]',
        params: { id: result.event.id, justCreated: '1' },
      });
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) {
        const first = Object.values(err.body?.errors ?? {})[0] as string[] | undefined;
        setError(first?.[0] ?? t('event.new.errors.fixHighlighted'));
      } else if (err instanceof ApiError) {
        setError(t('event.new.errors.failedStatus', { status: err.status }));
      } else {
        setError(t('event.new.errors.network'));
      }
    }
    setLoading(false);
  }

  if (homes.length === 0) {
    return (
      <View style={styles.container}>
        <PurpleHeader title={t('event.new.title')} />
        <View style={styles.empty}>
          <Icon source="home-off-outline" size={48} color="#9ca3af" />
          <Text variant="bodyMedium" style={styles.emptyText}>
            {t('event.new.verifyFirst')}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <PurpleHeader title={t('event.new.title')} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}>
        <ScrollView
          contentContainerStyle={styles.inner}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive">

          {/* Bound home — read-only. To create for a different home, switch
              on the Home tab and come back. */}
          {boundHome ? (
            <Card style={styles.contextCard}>
              <Card.Content style={styles.contextContent}>
                <View style={styles.contextIcon}>
                  <Icon source="home-city" size={24} color={PRIMARY} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text variant="titleSmall" style={{ fontWeight: '600' }}>
                    {boundHome.property_name ?? t('event.new.yourHome')}
                  </Text>
                  <Text variant="bodySmall" style={{ opacity: 0.65, marginTop: 2 }}>
                    {t('common.unit', { number: boundHome.unit_number })}
                  </Text>
                </View>
              </Card.Content>
            </Card>
          ) : null}

          <Card style={styles.formCard}>
            <Card.Content>
              <Text variant="titleSmall" style={styles.sectionFirst}>{t('event.new.sectionEvent')}</Text>
              <TextInput
                label={t('event.new.titleLabel')}
                value={title}
                onChangeText={setTitle}
                mode="outlined"
                style={styles.input}
                placeholder={t('event.new.titlePlaceholder')}
              />

              <Text variant="titleSmall" style={styles.section}>{t('event.new.sectionPurpose')}</Text>
              <View style={styles.purposeGrid}>
                {PURPOSES.map((p) => (
                  <Pressable
                    key={p.value}
                    onPress={() => setPurpose(p.value)}
                    style={[styles.purposeChip, purpose === p.value && styles.purposeChipActive]}>
                    <Text style={[styles.purposeText, purpose === p.value && styles.purposeTextActive]}>
                      {t(p.labelKey)}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Text variant="titleSmall" style={styles.section}>{t('event.new.sectionWhen')}</Text>
              <View style={styles.customRow}>
                <Pressable style={styles.dateBtn} onPress={() => setShowFromPicker(true)}>
                  <Text variant="labelSmall" style={styles.label}>{t('event.new.from')}</Text>
                  <Text>{validFrom.toLocaleDateString()}</Text>
                </Pressable>
                <Pressable style={styles.dateBtn} onPress={() => setShowUntilPicker(true)}>
                  <Text variant="labelSmall" style={styles.label}>{t('event.new.until')}</Text>
                  <Text>{validUntil.toLocaleDateString()}</Text>
                </Pressable>
              </View>

              {showFromPicker ? (
                <DateTimePicker
                  value={validFrom}
                  mode="date"
                  minimumDate={new Date()}
                  onChange={(_, d) => {
                    setShowFromPicker(false);
                    if (d) {
                      const next = new Date(d);
                      next.setHours(0, 0, 0, 0);
                      setValidFrom(next);
                      // Until can't sit before the new from — follow it forward.
                      if (validUntil < next) {
                        const until = new Date(next);
                        until.setHours(23, 59, 59, 999);
                        setValidUntil(until);
                      }
                    }
                  }}
                />
              ) : null}
              {showUntilPicker ? (
                <DateTimePicker
                  value={validUntil}
                  mode="date"
                  minimumDate={validFrom}
                  onChange={(_, d) => {
                    setShowUntilPicker(false);
                    if (d) {
                      const next = new Date(d);
                      next.setHours(23, 59, 59, 999);
                      setValidUntil(next);
                    }
                  }}
                />
              ) : null}

              <Text variant="titleSmall" style={styles.section}>{t('event.new.sectionOptional')}</Text>
              <TextInput
                label={t('event.new.maxGuests')}
                value={maxGuests}
                onChangeText={(v) => setMaxGuests(v.replace(/\D/g, ''))}
                mode="outlined"
                style={styles.input}
                keyboardType="number-pad"
              />
              <TextInput
                label={t('event.new.notesLabel')}
                value={notes}
                onChangeText={setNotes}
                mode="outlined"
                style={styles.input}
                multiline
                numberOfLines={3}
                placeholder={t('event.new.notesPlaceholder')}
              />

              {error ? <HelperText type="error" visible style={{ marginTop: 8 }}>{error}</HelperText> : null}
            </Card.Content>
          </Card>

          <Button
            mode="contained"
            onPress={handleSubmit}
            loading={loading}
            disabled={submitDisabled}
            style={styles.submit}
            contentStyle={styles.submitContent}>
            {t('event.new.submit')}
          </Button>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  inner: { padding: 16, paddingBottom: 120 },
  label: { opacity: 0.65, marginBottom: 6 },
  section: { marginTop: 16, marginBottom: 8, fontWeight: '600' },
  // First section heading inside the form card — no top margin since the card padding handles it
  sectionFirst: { marginBottom: 8, fontWeight: '600' },
  formCard: { marginTop: 8, marginBottom: 8, backgroundColor: '#fff' },
  input: { marginBottom: 6 },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyText: { marginTop: 12, opacity: 0.7, textAlign: 'center' },

  contextCard: { marginBottom: 8 },
  contextContent: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  contextIcon: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: PRIMARY_TINT,
    alignItems: 'center', justifyContent: 'center',
  },

  purposeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  purposeChip: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999,
    backgroundColor: '#f3f4f6', borderWidth: 1, borderColor: 'transparent',
  },
  purposeChipActive: { backgroundColor: PRIMARY_TINT, borderColor: PRIMARY },
  purposeText: { color: '#1f2937' },
  purposeTextActive: { color: PRIMARY, fontWeight: '600' },

  customRow: { flexDirection: 'row', gap: 8 },
  dateBtn: {
    flex: 1, padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#e5e7eb',
  },

  submit: { marginTop: 24 },
  submitContent: { paddingVertical: 8 },
});
