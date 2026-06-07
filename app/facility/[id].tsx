import DateTimePicker from '@react-native-community/datetimepicker';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { ActivityIndicator, Button, Card, HelperText, Icon, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PurpleHeader } from '@/components/purple-header';
import { TabletContainer } from '@/components/tablet-container';
import { ApiError, apiFetch } from '@/lib/api/client';

const PRIMARY = '#7367F0';
const PRIMARY_TINT = '#EEEDFD';

type Facility = {
  id: string;
  name: string;
  icon: string;
  icon_mdi: string;
  photo_url: string | null;
  description: string | null;
  type: 'open_access' | 'bookable';
  capacity: number;
  slot_duration_minutes: number;
  operating_hours: Record<string, [string, string] | undefined> | null;
  booking_window_days: number;
  max_bookings_per_resident_per_week: number;
  cancellation_window_hours: number;
  deposit_amount: number;
  requires_approval: boolean;
  closed_until: string | null;
  closed_reason: string | null;
  currently_closed: boolean;
};

type Slot = {
  start: string;
  end: string;
  taken: number;
  available: boolean;
};

export default function FacilityDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [facility, setFacility] = useState<Facility | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date>(addDays(new Date(), 0));
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch(`/api/v1/facilities/${id}`);
      setFacility(data.facility);
    } catch {
      setFacility(null);
    }
    setLoading(false);
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Re-fetch slots whenever the date changes
  useEffect(() => {
    if (!facility || facility.type !== 'bookable') return;
    const dateStr = isoDate(selectedDate);
    setSlotsLoading(true);
    setSelectedSlot(null);
    apiFetch(`/api/v1/facilities/${id}/availability?date=${dateStr}`)
      .then((data) => setSlots(data.slots ?? []))
      .catch(() => setSlots([]))
      .finally(() => setSlotsLoading(false));
  }, [facility, selectedDate, id]);

  async function handleBook() {
    if (!facility || !selectedSlot) return;
    setSubmitting(true);
    setError(null);
    try {
      const data = await apiFetch('/api/v1/me/facility-bookings', {
        method: 'POST',
        body: JSON.stringify({
          facility_id: facility.id,
          start_at: selectedSlot.start,
          end_at: selectedSlot.end,
          notes: notes.trim() || undefined,
        }),
      });
      const status = data.booking.status;
      Alert.alert(
        status === 'pending' ? 'Booking submitted' : 'Booking confirmed',
        status === 'pending'
          ? `Please bring RM ${facility.deposit_amount.toFixed(2)} cash to JMB office to confirm.`
          : 'See you there!',
        [{ text: 'OK', onPress: () => router.push('/facility/bookings') }],
      );
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) {
        const first = Object.values(err.body?.errors ?? {})[0] as string[] | undefined;
        setError(first?.[0] ?? 'Could not book this slot.');
      } else {
        setError('Could not reach the server.');
      }
    }
    setSubmitting(false);
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <PurpleHeader title="Facility" />
        <View style={styles.center}><ActivityIndicator /></View>
      </View>
    );
  }
  if (!facility) {
    return (
      <View style={styles.container}>
        <PurpleHeader title="Facility" />
        <View style={styles.center}>
          <Icon source="alert-circle-outline" size={48} color="#9ca3af" />
          <Text style={{ marginTop: 12, opacity: 0.7 }}>Facility not found.</Text>
          <Button onPress={() => router.back()} style={{ marginTop: 16 }}>Go back</Button>
        </View>
      </View>
    );
  }

  const maxDate = addDays(new Date(), facility.booking_window_days);

  return (
    <View style={styles.container}>
      <PurpleHeader title={facility.name} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.container}>
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}
          keyboardShouldPersistTaps="handled">
          <TabletContainer>

            {/* Hero */}
            {facility.photo_url ? (
              <Image source={{ uri: facility.photo_url }} style={styles.hero} />
            ) : (
              <View style={styles.heroIcon}>
                <Icon source={facility.icon_mdi} size={80} color={PRIMARY} />
              </View>
            )}

            <Card style={styles.card}>
              <Card.Content>
                <Text variant="titleLarge" style={styles.title}>{facility.name}</Text>
                {facility.description ? (
                  <Text variant="bodyMedium" style={styles.desc}>{facility.description}</Text>
                ) : null}
                <OperatingHours hours={facility.operating_hours} />
              </Card.Content>
            </Card>

            {/* Maintenance closure banner */}
            {facility.currently_closed ? (
              <View style={styles.maintenanceBanner}>
                <Icon source="wrench" size={20} color="#fff" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.maintenanceTitle}>Closed for maintenance</Text>
                  <Text style={styles.maintenanceBody}>
                    {facility.closed_reason ? facility.closed_reason : 'Under maintenance.'}
                    {facility.closed_until ? ` Reopens ${new Date(facility.closed_until).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}.` : ''}
                  </Text>
                </View>
              </View>
            ) : facility.type === 'open_access' ? (
              <Card style={[styles.card, { backgroundColor: '#f3f4f6' }]}>
                <Card.Content>
                  <Text variant="bodySmall" style={{ textAlign: 'center', opacity: 0.75 }}>
                    No booking needed — just drop by during operating hours.
                  </Text>
                </Card.Content>
              </Card>
            ) : (
              <>
                {/* Deposit notice */}
                {facility.deposit_amount > 0 ? (
                  <Card style={[styles.card, { backgroundColor: '#fffbeb', borderColor: '#fde68a', borderWidth: 1 }]}>
                    <Card.Content style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Icon source="cash" size={20} color="#92400e" />
                      <Text variant="bodySmall" style={{ color: '#92400e', flex: 1 }}>
                        Deposit RM {facility.deposit_amount.toFixed(2)} cash at JMB office. Booking pending until paid.
                      </Text>
                    </Card.Content>
                  </Card>
                ) : null}

                {/* Date picker */}
                <Text variant="titleSmall" style={styles.section}>Pick a date</Text>
                <Pressable
                  style={styles.datePicker}
                  onPress={() => setShowDatePicker(true)}>
                  <Icon source="calendar" size={20} color={PRIMARY} />
                  <Text style={styles.datePickerText}>
                    {selectedDate.toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'short', year: 'numeric' })}
                  </Text>
                  <Icon source="chevron-down" size={20} color="#9ca3af" />
                </Pressable>
                {showDatePicker ? (
                  <DateTimePicker
                    value={selectedDate}
                    mode="date"
                    minimumDate={new Date()}
                    maximumDate={maxDate}
                    onChange={(_, date) => {
                      setShowDatePicker(Platform.OS === 'ios');
                      if (date) setSelectedDate(date);
                    }}
                  />
                ) : null}

                {/* Slot grid */}
                <Text variant="titleSmall" style={styles.section}>Available slots</Text>
                {slotsLoading ? (
                  <ActivityIndicator style={{ marginTop: 12 }} />
                ) : slots.length === 0 ? (
                  <Text variant="bodySmall" style={styles.emptySlots}>
                    Closed on this day, or no slots available.
                  </Text>
                ) : (
                  <View style={styles.slotsGrid}>
                    {slots.map((s) => {
                      const isSelected = selectedSlot?.start === s.start;
                      return (
                        <Pressable
                          key={s.start}
                          disabled={!s.available}
                          onPress={() => setSelectedSlot(s)}
                          style={[
                            styles.slot,
                            !s.available && styles.slotTaken,
                            isSelected && styles.slotSelected,
                          ]}>
                          <Text style={[
                            styles.slotText,
                            !s.available && styles.slotTextTaken,
                            isSelected && styles.slotTextSelected,
                          ]}>
                            {formatTime(s.start)}
                          </Text>
                          {!s.available && s.taken > 0 ? (
                            <Text style={styles.slotSubText}>Full</Text>
                          ) : facility.capacity > 1 ? (
                            <Text style={[styles.slotSubText, isSelected && { color: '#fff' }]}>
                              {s.taken}/{facility.capacity}
                            </Text>
                          ) : null}
                        </Pressable>
                      );
                    })}
                  </View>
                )}

                {/* Notes + Book */}
                {selectedSlot ? (
                  <Card style={[styles.card, { marginTop: 16 }]}>
                    <Card.Content>
                      <Text variant="titleSmall" style={styles.section}>Notes (optional)</Text>
                      <TextInput
                        value={notes}
                        onChangeText={setNotes}
                        multiline
                        placeholder="e.g. small birthday party"
                        placeholderTextColor="#9ca3af"
                        maxLength={1000}
                        style={styles.notesInput}
                      />
                      {error ? <HelperText type="error" visible>{error}</HelperText> : null}
                      <Button
                        mode="contained"
                        icon="check"
                        onPress={handleBook}
                        loading={submitting}
                        disabled={submitting}
                        style={{ marginTop: 12 }}
                        contentStyle={{ paddingVertical: 6 }}>
                        {facility.requires_approval ? 'Submit booking' : 'Confirm booking'}
                      </Button>
                    </Card.Content>
                  </Card>
                ) : null}
              </>
            )}
          </TabletContainer>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function OperatingHours({ hours }: { hours: Record<string, [string, string] | undefined> | null }) {
  if (!hours) return null;
  const days = [
    ['mon', 'Mon'], ['tue', 'Tue'], ['wed', 'Wed'], ['thu', 'Thu'],
    ['fri', 'Fri'], ['sat', 'Sat'], ['sun', 'Sun'],
  ] as const;
  return (
    <View style={styles.hoursTable}>
      <Text variant="titleSmall" style={{ fontWeight: '600', marginBottom: 6 }}>Operating hours</Text>
      {days.map(([k, label]) => {
        const h = hours[k];
        return (
          <View key={k} style={styles.hoursRow}>
            <Text style={styles.hoursDay}>{label}</Text>
            <Text style={styles.hoursTime}>
              {h && h.length === 2 ? `${h[0]} – ${h[1]}` : 'Closed'}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function addDays(d: Date, days: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + days);
  return r;
}

function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  scroll: { padding: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },

  hero: { width: '100%', height: 180, borderRadius: 12, marginBottom: 12 },
  heroIcon: {
    width: '100%', height: 180, borderRadius: 12, marginBottom: 12,
    alignItems: 'center', justifyContent: 'center', backgroundColor: PRIMARY_TINT,
  },

  card: { marginBottom: 12 },
  title: { fontWeight: '700' },
  desc: { opacity: 0.75, marginTop: 6, lineHeight: 20 },

  hoursTable: { marginTop: 16 },
  hoursRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  hoursDay: { fontWeight: '600', color: '#374151' },
  hoursTime: { color: '#6b7280' },

  section: { fontWeight: '600', marginTop: 8, marginBottom: 8 },

  datePicker: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 14, paddingHorizontal: 14,
    backgroundColor: '#f9fafb', borderRadius: 10,
    borderWidth: 1, borderColor: '#e5e7eb',
  },
  datePickerText: { flex: 1, fontWeight: '600', color: '#1f2937' },

  emptySlots: { opacity: 0.55, textAlign: 'center', padding: 16 },

  slotsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  slot: {
    minWidth: 78, paddingVertical: 10, paddingHorizontal: 14,
    borderRadius: 10, borderWidth: 1, borderColor: '#e5e7eb',
    backgroundColor: '#fff', alignItems: 'center',
  },
  slotTaken: { opacity: 0.4, backgroundColor: '#f3f4f6' },
  slotSelected: { backgroundColor: PRIMARY, borderColor: PRIMARY },
  slotText: { fontWeight: '600', color: '#1f2937' },
  slotTextTaken: { color: '#9ca3af' },
  slotTextSelected: { color: '#fff' },
  slotSubText: { fontSize: 10, opacity: 0.6, marginTop: 2 },

  notesInput: {
    borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, minHeight: 80,
    textAlignVertical: 'top', fontSize: 15, color: '#1f2937',
  },

  maintenanceBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#dc2626', borderRadius: 12,
    padding: 14, marginBottom: 12,
  },
  maintenanceTitle: { color: '#fff', fontWeight: '700', fontSize: 15 },
  maintenanceBody: { color: '#fee2e2', fontSize: 13, marginTop: 2 },
});
