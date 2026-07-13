import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Card, Chip, Icon, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PurpleHeader } from '@/components/purple-header';
import { ApiError, apiFetch } from '@/lib/api/client';
import { useResponsive } from '@/lib/theme/responsive';

const PRIMARY = '#7367F0';
const PRIMARY_TINT = '#EEEDFD';

type Scope = 'upcoming' | 'past' | 'all';

type Booking = {
  id: string;
  facility: {
    id: string | null;
    name: string | null;
    icon: string | null;
    deposit_amount: number;
  };
  start_at: string;
  end_at: string;
  status: 'pending' | 'confirmed' | 'cancelled' | 'rejected';
  notes: string | null;
  rejection_reason: string | null;
  unit: { unit_number: string | null };
};

const STATUS_META: Record<Booking['status'], { bg: string; fg: string; label: string }> = {
  pending:   { bg: '#fef3c7', fg: '#92400e', label: 'facility.status.pending' },
  confirmed: { bg: '#dcfce7', fg: '#15803d', label: 'facility.status.confirmed' },
  cancelled: { bg: '#f3f4f6', fg: '#6b7280', label: 'facility.status.cancelled' },
  rejected:  { bg: '#fee2e2', fg: '#b91c1c', label: 'facility.status.rejected' },
};

export default function MyBookingsScreen() {
  const insets = useSafeAreaInsets();
  const { isTablet, contentMaxWidth } = useResponsive();
  const { t } = useTranslation();
  const [scope, setScope] = useState<Scope>('upcoming');
  const [items, setItems] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (s: Scope) => {
    setLoading(true);
    try {
      const data = await apiFetch(`/api/v1/me/facility-bookings?scope=${s}`);
      setItems(data.bookings ?? []);
    } catch {
      setItems([]);
    }
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(scope); }, [scope, load]));

  async function handleRefresh() {
    setRefreshing(true);
    await load(scope);
    setRefreshing(false);
  }

  async function handleCancel(b: Booking) {
    Alert.alert(
      t('facility.cancelBookingTitle'),
      `${b.facility.name} · ${formatDateTime(b.start_at)}`,
      [
        { text: t('facility.keep'), style: 'cancel' },
        {
          text: t('facility.cancelBooking'),
          style: 'destructive',
          onPress: async () => {
            try {
              await apiFetch(`/api/v1/me/facility-bookings/${b.id}/cancel`, { method: 'POST' });
              await load(scope);
            } catch (err) {
              const msg = err instanceof ApiError
                ? (Object.values(err.body?.errors ?? {})[0] as string[] | undefined)?.[0] ?? t('facility.couldNotCancel')
                : t('facility.couldNotCancel');
              Alert.alert(t('facility.cancellationFailed'), msg);
            }
          },
        },
      ],
    );
  }

  return (
    <View style={styles.container}>
      <PurpleHeader title={t('facility.myBookings')} />
      <View style={styles.chipsRow}>
        {(['upcoming', 'past', 'all'] as Scope[]).map((s) => (
          <Chip
            key={s}
            selected={scope === s}
            onPress={() => setScope(s)}
            style={[styles.chip, scope === s && styles.chipActive]}
            textStyle={scope === s ? styles.chipTextActive : styles.chipText}
            compact>
            {t(`facility.scopes.${s}`)}
          </Chip>
        ))}
      </View>

      {loading && !refreshing ? (
        <View style={styles.center}><ActivityIndicator /></View>
      ) : items.length === 0 ? (
        <View style={styles.center}>
          <Icon source="calendar-blank" size={56} color="#9ca3af" />
          <Text variant="bodyMedium" style={{ marginTop: 12, opacity: 0.65 }}>
            {scope === 'upcoming' ? t('facility.noUpcomingBookings') : t('facility.noBookingsFound')}
          </Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(b) => b.id}
          contentContainerStyle={[
            styles.list,
            { paddingBottom: insets.bottom + 24 },
            isTablet && { alignSelf: 'center', width: '100%', maxWidth: contentMaxWidth },
          ]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
          renderItem={({ item }) => {
            const meta = STATUS_META[item.status];
            const canCancel = (item.status === 'pending' || item.status === 'confirmed')
              && new Date(item.start_at).getTime() > Date.now();
            return (
              <Card style={styles.card}>
                <Card.Content>
                  <View style={styles.titleRow}>
                    <Text variant="titleMedium" style={styles.title}>
                      {item.facility.name ?? '—'}
                    </Text>
                    <View style={[styles.pill, { backgroundColor: meta.bg }]}>
                      <Text style={[styles.pillText, { color: meta.fg }]}>{t(meta.label)}</Text>
                    </View>
                  </View>
                  <Text variant="bodySmall" style={styles.meta}>
                    {formatDateTime(item.start_at)} – {formatTime(item.end_at)}
                  </Text>
                  {item.notes ? (
                    <Text variant="bodySmall" style={styles.notes}>{item.notes}</Text>
                  ) : null}
                  {item.status === 'pending' && item.facility.deposit_amount > 0 ? (
                    <View style={styles.depositNotice}>
                      <Icon source="cash" size={16} color="#92400e" />
                      <Text variant="bodySmall" style={{ color: '#92400e', flex: 1 }}>
                        {t('facility.bringDepositShort', { amount: item.facility.deposit_amount.toFixed(2) })}
                      </Text>
                    </View>
                  ) : null}
                  {item.status === 'rejected' && item.rejection_reason ? (
                    <Text variant="bodySmall" style={[styles.notes, { color: '#b91c1c' }]}>
                      {t('facility.rejectedReason', { reason: item.rejection_reason })}
                    </Text>
                  ) : null}
                  {canCancel ? (
                    <Button
                      mode="outlined"
                      onPress={() => handleCancel(item)}
                      style={{ marginTop: 12 }}>
                      {t('facility.cancelBooking')}
                    </Button>
                  ) : null}
                </Card.Content>
              </Card>
            );
          }}
        />
      )}
    </View>
  );
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString([], {
    weekday: 'short', day: '2-digit', month: 'short',
    hour: '2-digit', minute: '2-digit',
  });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  chipsRow: { flexDirection: 'row', gap: 8, padding: 16, paddingBottom: 8 },
  chip: { backgroundColor: '#f3f4f6' },
  chipActive: { backgroundColor: PRIMARY_TINT },
  chipText: { color: '#1f2937' },
  chipTextActive: { color: PRIMARY, fontWeight: '600' },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  list: { padding: 16, paddingTop: 8 },

  card: { marginBottom: 10 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  title: { flex: 1, fontWeight: '600' },
  meta: { opacity: 0.7, marginTop: 4 },
  notes: { opacity: 0.65, marginTop: 6 },
  depositNotice: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#fffbeb', borderColor: '#fde68a', borderWidth: 1,
    borderRadius: 8, padding: 10, marginTop: 10,
  },

  pill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  pillText: { fontSize: 11, fontWeight: '700' },
});
