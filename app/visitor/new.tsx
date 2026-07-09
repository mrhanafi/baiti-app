import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Card, HelperText, Icon, SegmentedButtons, Text, TextInput } from 'react-native-paper';

import { PurpleHeader } from '@/components/purple-header';
import { ApiError, apiFetch } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/session';
import { formatMyIc, normaliseMyPhone } from '@/lib/format';

const PRIMARY = '#7367F0';
const PRIMARY_TINT = '#EEEDFD';
// Same key as Home tab + Utilities screen — the resident's chosen "active home".
const SELECTED_UNIT_KEY = 'baiti.home.selected_unit_id';

const PURPOSES = [
  { value: 'cleaner', label: 'Cleaner' },
  { value: 'delivery', label: 'Delivery' },
  { value: 'family', label: 'Family' },
  { value: 'contractor', label: 'Contractor' },
  { value: 'services', label: 'Services' },
  { value: 'other', label: 'Other' },
];

const PRESETS = [
  { key: 'today4h', label: 'Next 4 hrs' },
  { key: 'tomorrow', label: 'Tomorrow (all day)' },
  { key: 'custom', label: 'Custom range' },
];

export default function NewVisitorScreen() {
  const router = useRouter();
  const { user } = useAuth();

  // Bound home for this pass — read-only. Sourced from the Home tab's
  // active-home AsyncStorage key. To file for a different home, the user
  // switches on the Home tab and comes back.
  const [unitId, setUnitId] = useState<string>(user?.units?.[0]?.id ?? '');

  useEffect(() => {
    AsyncStorage.getItem(SELECTED_UNIT_KEY).then((saved) => {
      if (saved && user?.units?.some((u) => u.id === saved)) {
        setUnitId(saved);
      } else if (user?.units?.[0]?.id) {
        setUnitId(user.units[0].id);
      }
    });
  }, [user?.units]);

  const [visitorName, setVisitorName] = useState('');
  const [visitorPhone, setVisitorPhone] = useState('');
  const [visitorIc, setVisitorIc] = useState('');
  const [purpose, setPurpose] = useState('family');
  const [vehiclePlate, setVehiclePlate] = useState('');

  const [preset, setPreset] = useState<'today4h' | 'tomorrow' | 'custom'>('today4h');
  const [validFrom, setValidFrom] = useState<Date>(() => new Date());
  const [validUntil, setValidUntil] = useState<Date>(() => {
    const d = new Date();
    d.setHours(d.getHours() + 4);
    return d;
  });
  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showUntilPicker, setShowUntilPicker] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  // Active renovation permit on the bound unit → offer tagging the pass as
  // a renovation contractor (guards see it at the gate).
  const [activePermit, setActivePermit] = useState<{ id: string; contractor_name: string; unit_number: string | null } | null>(null);
  const [tagRenovation, setTagRenovation] = useState(false);

  useEffect(() => {
    apiFetch('/api/v1/me/renovation-permits')
      .then((data) => {
        const boundUnitNumber = user?.units?.find((u) => u.id === unitId)?.unit_number;
        const permit = (data.permits ?? []).find(
          (p: { status: string; unit_number: string | null }) =>
            p.status === 'active' && p.unit_number === boundUnitNumber,
        );
        setActivePermit(permit ?? null);
        if (!permit) setTagRenovation(false);
      })
      .catch(() => setActivePermit(null));
  }, [unitId, user?.units]);

  const homes = user?.units ?? [];
  const boundHome = useMemo(
    () => homes.find((h) => h.id === unitId) ?? homes[0] ?? null,
    [homes, unitId],
  );

  // Compute effective from/until based on the selected preset. Custom uses
  // the user-picked dates directly.
  const effectiveFrom = useMemo(() => {
    if (preset === 'today4h') {
      return new Date();
    }
    if (preset === 'tomorrow') {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      d.setHours(0, 0, 0, 0);
      return d;
    }
    return validFrom;
  }, [preset, validFrom]);

  const effectiveUntil = useMemo(() => {
    if (preset === 'today4h') {
      const d = new Date();
      d.setHours(d.getHours() + 4);
      return d;
    }
    if (preset === 'tomorrow') {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      d.setHours(23, 59, 59, 999);
      return d;
    }
    return validUntil;
  }, [preset, validUntil]);

  const submitDisabled = loading || !unitId || !visitorName.trim();

  async function handleSubmit() {
    setLoading(true);
    setError(null);
    setFieldErrors({});
    try {
      await apiFetch('/api/v1/me/visitor-passes', {
        method: 'POST',
        body: JSON.stringify({
          unit_id: unitId,
          visitor_name: visitorName.trim(),
          visitor_phone: normaliseMyPhone(visitorPhone) ?? undefined,
          visitor_ic: visitorIc.replace(/\D/g, '') || undefined,
          purpose,
          vehicle_plate: vehiclePlate.trim() || undefined,
          valid_from: effectiveFrom.toISOString(),
          valid_until: effectiveUntil.toISOString(),
          renovation_permit_id: tagRenovation && activePermit ? activePermit.id : undefined,
        }),
      });
      // Land on Visitors tab — focus-effect there reloads from the API.
      router.replace('/(tabs)/visitors');
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) {
        setFieldErrors(err.body?.errors ?? {});
        setError('Please fix the highlighted fields.');
      } else if (err instanceof ApiError) {
        setError(`Failed (${err.status}).`);
      } else {
        setError('Could not reach the server.');
      }
    }
    setLoading(false);
  }

  function fieldError(name: string): string | null {
    return fieldErrors[name]?.[0] ?? null;
  }

  if (homes.length === 0) {
    // No home registered yet — can't create passes.
    return (
      <View style={styles.container}>
        <PurpleHeader title="New visitor" />
        <View style={styles.empty}>
          <Icon source="home-off-outline" size={48} color="#9ca3af" />
          <Text variant="bodyMedium" style={styles.emptyText}>
            Verify your home with your IC before creating visitor passes.
          </Text>
          <Button mode="contained" onPress={() => router.replace('/claim')} style={{ marginTop: 16 }}>
            Verify with IC
          </Button>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <PurpleHeader title="New visitor" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
        keyboardVerticalOffset={0}>
      <ScrollView
        contentContainerStyle={styles.inner}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        showsVerticalScrollIndicator>
        {/* Bound home for this pass — read-only. To file for a different
            home, switch on the Home tab and come back. */}
        {boundHome ? (
          <Card style={styles.contextCard}>
            <Card.Content style={styles.contextContent}>
              <View style={styles.contextIcon}>
                <Icon source="home-city" size={24} color={PRIMARY} />
              </View>
              <View style={{ flex: 1 }}>
                <Text variant="titleSmall" style={{ fontWeight: '600' }}>
                  {boundHome.property_name ?? 'Your home'}
                </Text>
                <Text variant="bodySmall" style={{ opacity: 0.65, marginTop: 2 }}>
                  Unit {boundHome.unit_number}
                </Text>
              </View>
            </Card.Content>
          </Card>
        ) : null}

        <Card style={styles.formCard}>
          <Card.Content>
            <Text variant="titleSmall" style={styles.sectionFirst}>Visitor</Text>

            <TextInput
              label="Visitor name *"
              value={visitorName}
              onChangeText={setVisitorName}
              mode="outlined"
              style={styles.input}
              error={!!fieldError('visitor_name')}
            />
            {fieldError('visitor_name') ? <HelperText type="error" visible>{fieldError('visitor_name')}</HelperText> : null}

            <TextInput
              label="Phone"
              value={visitorPhone}
              onChangeText={(v) => setVisitorPhone(v.replace(/\D/g, ''))}
              keyboardType="phone-pad"
              mode="outlined"
              style={styles.input}
              placeholder="121234567"
              left={<TextInput.Affix text="+60" />}
            />

            <TextInput
              label="IC (optional)"
              value={visitorIc}
              onChangeText={(v) => setVisitorIc(formatMyIc(v))}
              keyboardType="number-pad"
              maxLength={14}
              mode="outlined"
              style={styles.input}
              placeholder="901231-14-5678"
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

            {activePermit ? (
              <Pressable
                onPress={() => setTagRenovation(!tagRenovation)}
                style={[styles.renoBox, tagRenovation && styles.renoBoxActive]}>
                <Icon source={tagRenovation ? 'checkbox-marked' : 'checkbox-blank-outline'} size={22} color={PRIMARY} />
                <View style={{ flex: 1 }}>
                  <Text variant="bodyMedium" style={{ fontWeight: '600' }}>
                    Renovation contractor
                  </Text>
                  <Text variant="bodySmall" style={{ opacity: 0.65 }}>
                    Links this pass to your active permit ({activePermit.contractor_name}) —
                    the guard sees it at the gate.
                  </Text>
                </View>
              </Pressable>
            ) : null}

            <Text variant="titleSmall" style={styles.section}>Vehicle</Text>
            <TextInput
              label="Plate number (optional)"
              value={vehiclePlate}
              onChangeText={(t) => setVehiclePlate(t.toUpperCase())}
              autoCapitalize="characters"
              mode="outlined"
              style={styles.input}
              placeholder="PJW1234"
            />

            <Text variant="titleSmall" style={styles.section}>When</Text>
            <SegmentedButtons
              value={preset}
              onValueChange={(v) => setPreset(v as typeof preset)}
              buttons={PRESETS.map((p) => ({ value: p.key, label: p.label }))}
              style={{ marginBottom: 12 }}
            />

            {preset === 'custom' ? (
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
            ) : (
              <Text variant="bodySmall" style={styles.windowSummary}>
                {effectiveFrom.toLocaleString()} → {effectiveUntil.toLocaleString()}
              </Text>
            )}
          </Card.Content>
        </Card>

        {/* mode="datetime" only works on iOS — Android crashes. Stick to
            date-only and default the time-of-day (start-of-day for "from",
            end-of-day for "until"). For finer time control, owners can use
            the "Next 4 hrs" / "Tomorrow" presets above. */}
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

        {error ? <HelperText type="error" visible style={{ marginTop: 8 }}>{error}</HelperText> : null}

        <Button
          mode="contained"
          onPress={handleSubmit}
          loading={loading}
          disabled={submitDisabled}
          style={styles.submit}
          contentStyle={styles.submitContent}>
          Create pass
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
  formCard: { marginTop: 8, marginBottom: 8 },
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
  renoBox: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginTop: 12, padding: 12, borderRadius: 10,
    borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#fafafa',
  },
  renoBoxActive: { borderColor: PRIMARY, backgroundColor: PRIMARY_TINT },
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
  windowSummary: { opacity: 0.65 },

  submit: { marginTop: 24 },
  submitContent: { paddingVertical: 8 },
});
