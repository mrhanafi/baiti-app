import DateTimePicker from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Card, HelperText, Icon, Text, TextInput } from 'react-native-paper';

import { PurpleHeader } from '@/components/purple-header';
import { ApiError, apiFetch } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/session';

const PRIMARY = '#7367F0';
const PRIMARY_TINT = '#EEEDFD';

const PURPOSES = [
  { value: 'family', label: 'Family' },
  { value: 'services', label: 'Services' },
  { value: 'contractor', label: 'Contractor' },
  { value: 'cleaner', label: 'Cleaner' },
  { value: 'delivery', label: 'Delivery' },
  { value: 'other', label: 'Other' },
];

export default function NewEventScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const homes = user?.units ?? [];
  const [unitId, setUnitId] = useState<string>(homes[0]?.id ?? '');

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
        setError(first?.[0] ?? 'Please fix the highlighted fields.');
      } else if (err instanceof ApiError) {
        setError(`Failed (${err.status}).`);
      } else {
        setError('Could not reach the server.');
      }
    }
    setLoading(false);
  }

  if (homes.length === 0) {
    return (
      <View style={styles.container}>
        <PurpleHeader title="New event" />
        <View style={styles.empty}>
          <Icon source="home-off-outline" size={48} color="#9ca3af" />
          <Text variant="bodyMedium" style={styles.emptyText}>
            Verify your home first to create events.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <PurpleHeader title="New event" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}>
        <ScrollView
          contentContainerStyle={styles.inner}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive">

          {/* Unit picker (only if multi-home) */}
          {homes.length > 1 ? (
            <View style={{ marginBottom: 16 }}>
              <Text variant="labelMedium" style={styles.label}>Which home?</Text>
              <View style={{ gap: 8 }}>
                {homes.map((h) => (
                  <Pressable
                    key={h.id}
                    onPress={() => setUnitId(h.id)}
                    style={[styles.homeChip, unitId === h.id && styles.homeChipActive]}>
                    <Text style={[styles.homeChipText, unitId === h.id && styles.homeChipTextActive]}>
                      {h.property_name} · {h.unit_number}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : (
            <Card style={styles.contextCard}>
              <Card.Content style={styles.contextContent}>
                <View style={styles.contextIcon}>
                  <Icon source="home-city" size={24} color={PRIMARY} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text variant="titleSmall" style={{ fontWeight: '600' }}>
                    {homes[0].property_name}
                  </Text>
                  <Text variant="bodySmall" style={{ opacity: 0.65 }}>Unit {homes[0].unit_number}</Text>
                </View>
              </Card.Content>
            </Card>
          )}

          <Text variant="titleSmall" style={styles.section}>Event</Text>
          <TextInput
            label="Title *"
            value={title}
            onChangeText={setTitle}
            mode="outlined"
            style={styles.input}
            placeholder="e.g. Hanafi's wedding, Open house"
          />

          <Text variant="titleSmall" style={styles.section}>Purpose</Text>
          <View style={styles.purposeGrid}>
            {PURPOSES.map((p) => (
              <Pressable
                key={p.value}
                onPress={() => setPurpose(p.value)}
                style={[styles.purposeChip, purpose === p.value && styles.purposeChipActive]}>
                <Text style={[styles.purposeText, purpose === p.value && styles.purposeTextActive]}>
                  {p.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text variant="titleSmall" style={styles.section}>When</Text>
          <View style={styles.customRow}>
            <Pressable style={styles.dateBtn} onPress={() => setShowFromPicker(true)}>
              <Text variant="labelSmall" style={styles.label}>From</Text>
              <Text>{validFrom.toLocaleDateString()}</Text>
            </Pressable>
            <Pressable style={styles.dateBtn} onPress={() => setShowUntilPicker(true)}>
              <Text variant="labelSmall" style={styles.label}>Until</Text>
              <Text>{validUntil.toLocaleDateString()}</Text>
            </Pressable>
          </View>

          {showFromPicker ? (
            <DateTimePicker
              value={validFrom}
              mode="date"
              onChange={(_, d) => {
                setShowFromPicker(false);
                if (d) {
                  const next = new Date(d);
                  next.setHours(0, 0, 0, 0);
                  setValidFrom(next);
                }
              }}
            />
          ) : null}
          {showUntilPicker ? (
            <DateTimePicker
              value={validUntil}
              mode="date"
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

          <Text variant="titleSmall" style={styles.section}>Optional</Text>
          <TextInput
            label="Max guests (leave blank for unlimited)"
            value={maxGuests}
            onChangeText={(t) => setMaxGuests(t.replace(/\D/g, ''))}
            mode="outlined"
            style={styles.input}
            keyboardType="number-pad"
          />
          <TextInput
            label="Notes for your guests"
            value={notes}
            onChangeText={setNotes}
            mode="outlined"
            style={styles.input}
            multiline
            numberOfLines={3}
            placeholder="e.g. Park at the visitor bay, take Lift A to floor 12"
          />

          {error ? <HelperText type="error" visible style={{ marginTop: 8 }}>{error}</HelperText> : null}

          <Button
            mode="contained"
            onPress={handleSubmit}
            loading={loading}
            disabled={submitDisabled}
            style={styles.submit}
            contentStyle={styles.submitContent}>
            Create event &amp; get invite link
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
  input: { marginBottom: 6 },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyText: { marginTop: 12, opacity: 0.7, textAlign: 'center' },

  contextCard: { marginBottom: 8 },
  contextContent: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  contextIcon: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: PRIMARY_TINT,
    alignItems: 'center', justifyContent: 'center',
  },

  homeChip: {
    paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8,
    backgroundColor: '#f3f4f6', borderWidth: 1, borderColor: 'transparent',
  },
  homeChipActive: { backgroundColor: PRIMARY_TINT, borderColor: PRIMARY },
  homeChipText: { color: '#1f2937' },
  homeChipTextActive: { color: PRIMARY, fontWeight: '600' },

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
