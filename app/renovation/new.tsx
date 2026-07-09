import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Card, HelperText, Icon, Text, TextInput } from 'react-native-paper';

import { PurpleHeader } from '@/components/purple-header';
import { TabletContainer } from '@/components/tablet-container';
import { ApiError, apiFetch } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/session';

const PRIMARY = '#7367F0';
const PRIMARY_TINT = '#EEEDFD';
// Same key as Home tab — the resident's chosen "active home".
const SELECTED_UNIT_KEY = 'baiti.home.selected_unit_id';

export default function NewRenovationScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const homes = user?.units ?? [];
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

  const [description, setDescription] = useState('');
  const [dateFrom, setDateFrom] = useState<Date | null>(null);
  const [dateTo, setDateTo] = useState<Date | null>(null);
  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);
  const [contractor, setContractor] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const submitDisabled =
    loading || !description.trim() || !dateFrom || !dateTo || !contractor.trim();

  function toYmd(d: Date): string {
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${m}-${day}`;
  }

  async function handleSubmit() {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch('/api/v1/me/renovation-permits', {
        method: 'POST',
        body: JSON.stringify({
          unit_id: unitId,
          description: description.trim(),
          date_from: dateFrom ? toYmd(dateFrom) : '',
          date_to: dateTo ? toYmd(dateTo) : '',
          contractor_name: contractor.trim(),
        }),
      });
      router.replace({ pathname: '/renovation/[id]', params: { id: data.permit.id } });
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) {
        const first = Object.values(err.body?.errors ?? {})[0] as string[] | undefined;
        setError(first?.[0] ?? 'Please fix the highlighted fields.');
      } else {
        setError('Could not reach the server.');
      }
    }
    setLoading(false);
  }

  if (homes.length === 0) {
    return (
      <View style={styles.container}>
        <PurpleHeader title="New Renovation Request" />
        <View style={styles.empty}>
          <Icon source="home-off-outline" size={48} color="#9ca3af" />
          <Text variant="bodyMedium" style={styles.emptyText}>
            Verify your home first to request a renovation permit.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <PurpleHeader title="New Renovation Request" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}>
        <ScrollView contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">
         <TabletContainer>

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

          <Card style={styles.card}>
            <Card.Content>
              <TextInput
                label="What work will be done? *"
                value={description}
                onChangeText={setDescription}
                mode="outlined"
                style={styles.input}
                contentStyle={{ paddingTop: 12, paddingBottom: 12 }}
                multiline
                numberOfLines={4}
                placeholder="e.g. Kitchen cabinet replacement, new floor tiles in living room"
                maxLength={5000}
              />
              <Pressable onPress={() => setShowFromPicker(true)}>
                <TextInput
                  label="Start date *"
                  value={dateFrom ? dateFrom.toLocaleDateString() : ''}
                  mode="outlined"
                  style={styles.input}
                  placeholder="Pick a date"
                  editable={false}
                  pointerEvents="none"
                  right={<TextInput.Icon icon="calendar" onPress={() => setShowFromPicker(true)} />}
                />
              </Pressable>
              <Pressable onPress={() => setShowToPicker(true)}>
                <TextInput
                  label="End date *"
                  value={dateTo ? dateTo.toLocaleDateString() : ''}
                  mode="outlined"
                  style={styles.input}
                  placeholder="Pick a date"
                  editable={false}
                  pointerEvents="none"
                  right={<TextInput.Icon icon="calendar" onPress={() => setShowToPicker(true)} />}
                />
              </Pressable>

              {showFromPicker ? (
                <DateTimePicker
                  value={dateFrom ?? today}
                  mode="date"
                  minimumDate={today}
                  onChange={(_, d) => {
                    setShowFromPicker(false);
                    if (d) {
                      const next = new Date(d);
                      next.setHours(0, 0, 0, 0);
                      setDateFrom(next);
                      // End date can't sit before the new start date.
                      if (dateTo && dateTo < next) {
                        setDateTo(next);
                      }
                    }
                  }}
                />
              ) : null}
              {showToPicker ? (
                <DateTimePicker
                  value={dateTo ?? dateFrom ?? today}
                  mode="date"
                  minimumDate={dateFrom ?? today}
                  onChange={(_, d) => {
                    setShowToPicker(false);
                    if (d) {
                      const next = new Date(d);
                      next.setHours(0, 0, 0, 0);
                      setDateTo(next);
                    }
                  }}
                />
              ) : null}
              <TextInput
                label="Contractor company *"
                value={contractor}
                onChangeText={setContractor}
                mode="outlined"
                style={styles.input}
                placeholder="e.g. Wong Renovation Sdn Bhd"
                maxLength={255}
              />

              {error ? <HelperText type="error" visible>{error}</HelperText> : null}
            </Card.Content>
          </Card>

          <Button
            mode="contained"
            onPress={handleSubmit}
            loading={loading}
            disabled={submitDisabled}
            style={styles.submit}
            contentStyle={{ paddingVertical: 8 }}>
            Submit request
          </Button>

          <Text variant="bodySmall" style={styles.disclaimer}>
            Your JMB reviews the request and sets a refundable deposit (paid in
            cash at the office). Once active, you can create gate passes for
            your contractor.
          </Text>
         </TabletContainer>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  inner: { padding: 16, paddingBottom: 120 },
  card: { marginBottom: 8, backgroundColor: '#fff' },

  contextCard: { marginBottom: 8 },
  contextContent: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  contextIcon: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: PRIMARY_TINT,
    alignItems: 'center', justifyContent: 'center',
  },

  input: { marginBottom: 8 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyText: { marginTop: 12, opacity: 0.7, textAlign: 'center' },

  submit: { marginTop: 16 },
  disclaimer: { marginTop: 16, opacity: 0.55, textAlign: 'center', lineHeight: 18 },
});
