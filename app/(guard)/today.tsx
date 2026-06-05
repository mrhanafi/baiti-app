import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Card, Icon, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { apiFetch } from '@/lib/api/client';

const PRIMARY = '#7367F0';
const PRIMARY_TINT = '#EEEDFD';

type Pass = {
  id: string;
  visitor_name: string;
  visitor_phone: string | null;
  purpose: string;
  vehicle_plate: string | null;
  valid_from: string;
  valid_until: string;
  status: 'active' | 'upcoming' | 'expired' | 'cancelled';
  visit_state: 'awaiting' | 'inside' | 'out' | 'upcoming' | 'expired' | 'cancelled';
  open_entry: { visit_tag: string; scanned_at: string } | null;
  unit: { unit_number: string | null; property_name: string | null };
  host: { name: string | null; phone: string | null };
};

const STATE_PILL: Record<string, { bg: string; fg: string; label: (p: Pass) => string }> = {
  awaiting: { bg: '#dcfce7', fg: '#15803d', label: () => 'Awaiting' },
  inside: {
    bg: '#dbeafe',
    fg: '#1d4ed8',
    label: (p) =>
      p.open_entry
        ? `Inside · ${new Date(p.open_entry.scanned_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · #${p.open_entry.visit_tag}`
        : 'Inside',
  },
  out: { bg: '#f3f4f6', fg: '#6b7280', label: () => 'Visit complete' },
  upcoming: { bg: '#EEEDFD', fg: '#7367F0', label: () => 'Upcoming' },
  expired: { bg: '#f3f4f6', fg: '#6b7280', label: () => 'Expired' },
  cancelled: { bg: '#fee2e2', fg: '#b91c1c', label: () => 'Cancelled' },
};

export default function GuardTodayScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [passes, setPasses] = useState<Pass[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch('/api/v1/guard/passes/today');
      setPasses(data.passes ?? []);
    } catch {
      setPasses([]);
    }
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function handleRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.title}>Today's passes</Text>
        <Text style={styles.subtitle}>{passes.length} valid right now</Text>
      </View>

      {loading && !refreshing ? (
        <View style={styles.center}><ActivityIndicator /></View>
      ) : passes.length === 0 ? (
        <View style={styles.center}>
          <Icon source="calendar-blank-outline" size={48} color="#9ca3af" />
          <Text variant="bodyMedium" style={{ marginTop: 12, opacity: 0.65 }}>
            No passes for today.
          </Text>
        </View>
      ) : (
        <FlatList
          data={passes}
          keyExtractor={(p) => p.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
          renderItem={({ item }) => {
            const pill = STATE_PILL[item.visit_state] ?? STATE_PILL.expired;
            return (
              <Card style={styles.card}
                onPress={() => router.push({ pathname: '/guard-pass/[id]', params: { id: item.id } })}>
                <Card.Content style={styles.cardContent}>
                  <View style={styles.iconWrap}>
                    <Icon source="account" size={28} color={PRIMARY} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text variant="titleMedium" style={{ fontWeight: '600' }}>{item.visitor_name}</Text>
                    <Text variant="bodySmall" style={styles.meta}>
                      {item.purpose.charAt(0).toUpperCase() + item.purpose.slice(1)}
                      {item.vehicle_plate ? ` · ${item.vehicle_plate}` : ''}
                    </Text>
                    <Text variant="bodySmall" style={styles.meta}>
                      Unit {item.unit.unit_number} · {item.unit.property_name}
                    </Text>
                    <Text variant="bodySmall" style={styles.meta}>
                      {formatRange(item.valid_from, item.valid_until)}
                    </Text>
                    <View style={[styles.statePill, { backgroundColor: pill.bg }]}>
                      <Text style={[styles.stateText, { color: pill.fg }]}>{pill.label(item)}</Text>
                    </View>
                  </View>
                  <Icon source="chevron-right" size={22} color="#9ca3af" />
                </Card.Content>
              </Card>
            );
          }}
        />
      )}
    </View>
  );
}

function formatRange(fromIso: string, untilIso: string): string {
  const from = new Date(fromIso);
  const until = new Date(untilIso);
  const sameDay = from.toDateString() === until.toDateString();
  const time: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit' };
  if (sameDay) {
    return `${from.toLocaleTimeString('en', time)} – ${until.toLocaleTimeString('en', time)}`;
  }
  return `${from.toLocaleDateString('en')} – ${until.toLocaleDateString('en')}`;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { backgroundColor: PRIMARY, paddingHorizontal: 16, paddingBottom: 16 },
  title: { color: '#fff', fontSize: 22, fontWeight: '600' },
  subtitle: { color: '#fff', opacity: 0.8, marginTop: 4 },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },

  list: { padding: 16 },
  card: { marginBottom: 10 },
  cardContent: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconWrap: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: PRIMARY_TINT,
    alignItems: 'center', justifyContent: 'center',
  },
  meta: { opacity: 0.65, marginTop: 2 },
  statePill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    marginTop: 6,
  },
  stateText: { fontSize: 11, fontWeight: '600' },
});
