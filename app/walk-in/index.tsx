import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import {
  ActivityIndicator,
  Button,
  Card,
  HelperText,
  Icon,
  Text,
  TextInput,
} from 'react-native-paper';

import { PurpleHeader } from '@/components/purple-header';
import { ApiError, apiFetch } from '@/lib/api/client';
import { normaliseMyPhone } from '@/lib/format';

const PRIMARY = '#7367F0';
const PRIMARY_TINT = '#EEEDFD';

const PURPOSES = [
  { value: 'delivery', label: 'Delivery' },
  { value: 'family', label: 'Family' },
  { value: 'contractor', label: 'Contractor' },
  { value: 'services', label: 'Services' },
  { value: 'cleaner', label: 'Cleaner' },
  { value: 'other', label: 'Other' },
];

type UnitResult = {
  id: string;
  unit_number: string;
  block_name: string | null;
  property_name: string | null;
  owner_name: string | null;
  has_owner: boolean;
};

export default function WalkInScreen() {
  const router = useRouter();

  const [name, setName] = useState('');
  const [ic, setIc] = useState('');
  const [phone, setPhone] = useState('');
  const [plate, setPlate] = useState('');
  const [purpose, setPurpose] = useState('family');

  const [unitQuery, setUnitQuery] = useState('');
  const [unitResults, setUnitResults] = useState<UnitResult[]>([]);
  const [unitSearching, setUnitSearching] = useState(false);
  const [unit, setUnit] = useState<UnitResult | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Debounced unit search
  useEffect(() => {
    const q = unitQuery.trim();
    if (q.length < 1 || unit) {
      setUnitResults([]);
      return;
    }
    const handle = setTimeout(async () => {
      setUnitSearching(true);
      try {
        const data = await apiFetch(`/api/v1/guard/walk-in/units/search?q=${encodeURIComponent(q)}`);
        setUnitResults(data.units ?? []);
      } catch {
        setUnitResults([]);
      }
      setUnitSearching(false);
    }, 300);
    return () => clearTimeout(handle);
  }, [unitQuery, unit]);

  const submitDisabled = loading || !name.trim() || !ic.trim() || !unit;

  async function handleSubmit() {
    if (!unit) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch('/api/v1/guard/walk-in', {
        method: 'POST',
        body: JSON.stringify({
          unit_id: unit.id,
          visitor_name: name.trim(),
          visitor_ic: ic.trim(),
          visitor_phone: normaliseMyPhone(phone) ?? undefined,
          vehicle_plate: plate.trim() || undefined,
          purpose,
        }),
      });
      Alert.alert(
        'Walk-in logged',
        `${data.pass.visitor_name} can enter unit ${data.pass.unit.unit_number}.`,
        [{ text: 'OK', onPress: () => router.back() }],
      );
    } catch (err) {
      const msg = err instanceof ApiError
        ? (err.body?.errors?.unit_id?.[0] ?? err.body?.errors?.shift?.[0] ?? err.message)
        : 'Could not log walk-in.';
      setError(msg);
    }
    setLoading(false);
  }

  function handlePickUnit(u: UnitResult) {
    if (!u.has_owner) {
      Alert.alert(
        'Unit not registered',
        'This unit has no registered owner. Direct the visitor to the JMB office.',
      );
      return;
    }
    setUnit(u);
    setUnitQuery('');
    setUnitResults([]);
  }

  return (
    <View style={styles.container}>
      <PurpleHeader title="Walk-in visitor" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
        keyboardVerticalOffset={0}>
        <ScrollView
          contentContainerStyle={styles.inner}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive">

          <Text variant="titleSmall" style={styles.section}>Visiting which unit?</Text>
          {unit ? (
            <Card style={styles.unitCard}>
              <Card.Content style={styles.unitCardContent}>
                <View style={styles.unitIcon}>
                  <Icon source="home-city" size={24} color={PRIMARY} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text variant="titleSmall" style={{ fontWeight: '600' }}>
                    Unit {unit.unit_number}
                    {unit.block_name ? ` · ${unit.block_name}` : ''}
                  </Text>
                  <Text variant="bodySmall" style={{ opacity: 0.65 }}>
                    {unit.property_name}{unit.owner_name ? ` · Owner: ${unit.owner_name}` : ''}
                  </Text>
                </View>
                <Pressable onPress={() => setUnit(null)}>
                  <Icon source="close-circle" size={22} color="#9ca3af" />
                </Pressable>
              </Card.Content>
            </Card>
          ) : (
            <>
              <TextInput
                value={unitQuery}
                onChangeText={setUnitQuery}
                mode="outlined"
                placeholder="Search by unit number (e.g. B-05-01)"
                left={<TextInput.Icon icon="magnify" />}
                autoCapitalize="characters"
                style={styles.input}
              />
              {unitSearching ? <HelperText type="info" visible>Searching…</HelperText> : null}
              {unitResults.length > 0 ? (
                <View style={{ marginTop: 4 }}>
                  {unitResults.map((u) => (
                    <Card key={u.id} style={styles.unitResult} onPress={() => handlePickUnit(u)}>
                      <Card.Content style={styles.unitResultContent}>
                        <View style={styles.unitIcon}>
                          <Icon source="home-city" size={20} color={PRIMARY} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text variant="bodyMedium" style={{ fontWeight: '600' }}>
                            {u.unit_number}{u.block_name ? ` · ${u.block_name}` : ''}
                          </Text>
                          <Text variant="bodySmall" style={{ opacity: 0.65 }}>
                            {u.owner_name ?? 'No owner registered'}
                          </Text>
                        </View>
                      </Card.Content>
                    </Card>
                  ))}
                </View>
              ) : null}
            </>
          )}

          <Text variant="titleSmall" style={styles.section}>Visitor</Text>
          <TextInput
            label="Full name *"
            value={name}
            onChangeText={setName}
            mode="outlined"
            style={styles.input}
          />
          <TextInput
            label="IC or driving licence number *"
            value={ic}
            onChangeText={setIc}
            mode="outlined"
            style={styles.input}
            keyboardType="default"
            autoCapitalize="characters"
          />
          <TextInput
            label="Phone (optional)"
            value={phone}
            onChangeText={(v) => setPhone(v.replace(/\D/g, ''))}
            mode="outlined"
            keyboardType="phone-pad"
            style={styles.input}
            placeholder="121234567"
            left={<TextInput.Affix text="+60" />}
          />
          <TextInput
            label="Vehicle plate (optional)"
            value={plate}
            onChangeText={(t) => setPlate(t.toUpperCase())}
            mode="outlined"
            autoCapitalize="characters"
            style={styles.input}
            placeholder="PJW1234"
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

          {error ? <HelperText type="error" visible style={{ marginTop: 8 }}>{error}</HelperText> : null}

          <Button
            mode="contained"
            onPress={handleSubmit}
            loading={loading}
            disabled={submitDisabled}
            style={styles.submit}
            contentStyle={styles.submitContent}>
            Log walk-in &amp; let visitor in
          </Button>

          <Text variant="bodySmall" style={styles.disclaimer}>
            Walk-ins are valid for 8 hours from now. The host gets an email notification when you submit this form.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  inner: { padding: 16, paddingBottom: 120 },
  section: { marginTop: 16, marginBottom: 8, fontWeight: '600' },
  input: { marginBottom: 6 },

  unitCard: { marginBottom: 8 },
  unitCardContent: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  unitIcon: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: PRIMARY_TINT,
    alignItems: 'center', justifyContent: 'center',
  },
  unitResult: { marginBottom: 6 },
  unitResultContent: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 },

  purposeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  purposeChip: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999,
    backgroundColor: '#f3f4f6', borderWidth: 1, borderColor: 'transparent',
  },
  purposeChipActive: { backgroundColor: PRIMARY_TINT, borderColor: PRIMARY },
  purposeText: { color: '#1f2937' },
  purposeTextActive: { color: PRIMARY, fontWeight: '600' },

  submit: { marginTop: 24 },
  submitContent: { paddingVertical: 8 },
  disclaimer: { marginTop: 16, opacity: 0.55, textAlign: 'center', lineHeight: 18 },
});
