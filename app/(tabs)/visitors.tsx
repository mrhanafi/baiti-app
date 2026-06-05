import { useFocusEffect, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Card, Chip, FAB, Icon, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { apiFetch } from '@/lib/api/client';

const PRIMARY = '#7367F0';
const PRIMARY_TINT = '#EEEDFD';

type Filter = 'today' | 'upcoming' | 'past';

type VisitorPassSummary = {
  id: string;
  visitor_name: string;
  visitor_phone: string | null;
  purpose: string;
  vehicle_plate: string | null;
  valid_from: string;
  valid_until: string;
  status: 'active' | 'upcoming' | 'expired' | 'cancelled';
  is_walk_in: boolean;
  unit: { unit_number: string | null; property_name: string | null };
};

type EventSummary = {
  id: string;
  title: string;
  purpose: string;
  valid_from: string;
  valid_until: string;
  status: 'live' | 'upcoming' | 'ended' | 'revoked';
  guest_count: number;
  max_guests: number | null;
  unit: { unit_number: string | null; property_name: string | null };
};

type ListItem =
  | { kind: 'event'; data: EventSummary }
  | { kind: 'pass'; data: VisitorPassSummary };

const STATUS_COLOR: Record<string, { bg: string; fg: string }> = {
  active: { bg: '#dcfce7', fg: '#15803d' },
  upcoming: { bg: PRIMARY_TINT, fg: PRIMARY },
  expired: { bg: '#f3f4f6', fg: '#6b7280' },
  cancelled: { bg: '#fee2e2', fg: '#b91c1c' },
};

export default function VisitorsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<Filter>('today');
  const [items, setItems] = useState<ListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fabOpen, setFabOpen] = useState(false);

  const load = useCallback(async (f: Filter) => {
    setLoading(true);
    try {
      const data = await apiFetch(`/api/v1/me/visitor-passes?filter=${f}`);
      const events: EventSummary[] = data.events ?? [];
      const passes: VisitorPassSummary[] = data.passes ?? [];
      // Events first (more prominent), then individual passes.
      const merged: ListItem[] = [
        ...events.map((e) => ({ kind: 'event' as const, data: e })),
        ...passes.map((p) => ({ kind: 'pass' as const, data: p })),
      ];
      setItems(merged);
    } catch {
      setItems([]);
    }
    setLoading(false);
  }, []);

  // Refresh whenever the tab is focused — covers "I cancelled a pass on the
  // detail screen, came back" without a manual pull.
  useFocusEffect(
    useCallback(() => {
      load(filter);
    }, [filter, load]),
  );

  async function handleRefresh() {
    setRefreshing(true);
    await load(filter);
    setRefreshing(false);
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* Purple header band */}
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <Text style={styles.title}>Visitors</Text>
        <View style={styles.chips}>
          {(['today', 'upcoming', 'past'] as Filter[]).map((f) => (
            <Chip
              key={f}
              selected={filter === f}
              onPress={() => setFilter(f)}
              style={[styles.chip, filter === f && styles.chipActive]}
              textStyle={filter === f ? styles.chipTextActive : styles.chipText}
              compact>
              {f === 'today' ? 'Today' : f === 'upcoming' ? 'Upcoming' : 'Past'}
            </Chip>
          ))}
        </View>
      </View>

      {loading && !refreshing ? (
        <View style={styles.center}>
          <ActivityIndicator />
        </View>
      ) : items.length === 0 ? (
        <View style={styles.center}>
          <Icon source="id-card" size={48} color="#9ca3af" />
          <Text variant="bodyMedium" style={styles.emptyText}>
            No {filter === 'today' ? "passes for today" : filter === 'upcoming' ? 'upcoming passes' : 'past passes'} yet.
          </Text>
          <Text variant="bodySmall" style={styles.emptyHint}>
            Tap + to create a visitor pass or event.
          </Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(it) => `${it.kind}:${it.data.id}`}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
          renderItem={({ item }) => {
            if (item.kind === 'event') {
              const e = item.data;
              return (
                <Card
                  style={styles.passCard}
                  onPress={() => router.push({ pathname: '/event/[id]', params: { id: e.id } })}>
                  <Card.Content style={styles.passContent}>
                    <View style={styles.eventIcon}>
                      <Icon source="party-popper" size={28} color={PRIMARY} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text variant="titleMedium" style={styles.passName}>{e.title}</Text>
                      <Text variant="bodySmall" style={styles.passMeta}>
                        {e.guest_count}{e.max_guests ? ` / ${e.max_guests}` : ''} registered
                      </Text>
                      <Text variant="bodySmall" style={styles.passMeta}>
                        {formatRange(e.valid_from, e.valid_until)}
                      </Text>
                    </View>
                    <View style={[styles.statusPill, { backgroundColor: STATUS_COLOR[e.status === 'live' ? 'active' : e.status === 'upcoming' ? 'upcoming' : e.status === 'revoked' ? 'cancelled' : 'expired']?.bg ?? '#f3f4f6' }]}>
                      <Text style={[styles.statusText, { color: STATUS_COLOR[e.status === 'live' ? 'active' : e.status === 'upcoming' ? 'upcoming' : e.status === 'revoked' ? 'cancelled' : 'expired']?.fg ?? '#6b7280' }]}>
                        {e.status}
                      </Text>
                    </View>
                  </Card.Content>
                </Card>
              );
            }

            const p = item.data;
            return (
              <Card
                style={styles.passCard}
                onPress={() => router.push({ pathname: '/visitor/[id]', params: { id: p.id } })}>
                <Card.Content style={styles.passContent}>
                  <View style={styles.passIcon}>
                    <Icon source="account" size={28} color={PRIMARY} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.nameRow}>
                      <Text variant="titleMedium" style={styles.passName}>
                        {p.visitor_name}
                      </Text>
                      {p.is_walk_in ? (
                        <View style={styles.walkInBadge}>
                          <Text style={styles.walkInBadgeText}>Walk-in</Text>
                        </View>
                      ) : null}
                    </View>
                    <Text variant="bodySmall" style={styles.passMeta}>
                      {prettyPurpose(p.purpose)}
                      {p.vehicle_plate ? ` · ${p.vehicle_plate}` : ''}
                    </Text>
                    <Text variant="bodySmall" style={styles.passMeta}>
                      {formatRange(p.valid_from, p.valid_until)}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.statusPill,
                      { backgroundColor: STATUS_COLOR[p.status]?.bg ?? '#f3f4f6' },
                    ]}>
                    <Text style={[styles.statusText, { color: STATUS_COLOR[p.status]?.fg ?? '#6b7280' }]}>
                      {p.status}
                    </Text>
                  </View>
                </Card.Content>
              </Card>
            );
          }}
        />
      )}

      <FAB.Group
        open={fabOpen}
        visible
        icon={fabOpen ? 'close' : 'plus'}
        actions={[
          {
            icon: 'account-plus',
            label: 'New visitor',
            onPress: () => router.push('/visitor/new'),
          },
          {
            icon: 'party-popper',
            label: 'New event (invite link)',
            onPress: () => router.push('/event/new'),
          },
        ]}
        onStateChange={({ open }) => setFabOpen(open)}
        fabStyle={{ backgroundColor: PRIMARY }}
        color="#fff"
        style={{ paddingBottom: insets.bottom + 80 }}
      />
    </View>
  );
}

function prettyPurpose(p: string): string {
  return p.charAt(0).toUpperCase() + p.slice(1);
}

function formatRange(fromIso: string, untilIso: string): string {
  const from = new Date(fromIso);
  const until = new Date(untilIso);
  const sameDay = from.toDateString() === until.toDateString();
  const dateOpts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
  const timeOpts: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit' };
  if (sameDay) {
    return `${from.toLocaleDateString('en', dateOpts)} · ${from.toLocaleTimeString('en', timeOpts)} – ${until.toLocaleTimeString('en', timeOpts)}`;
  }
  return `${from.toLocaleDateString('en', dateOpts)} – ${until.toLocaleDateString('en', dateOpts)}`;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    backgroundColor: PRIMARY,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  title: { color: '#fff', fontSize: 22, fontWeight: '600', marginBottom: 12 },
  chips: { flexDirection: 'row', gap: 8 },
  chip: { backgroundColor: 'rgba(255,255,255,0.18)' },
  chipActive: { backgroundColor: '#fff' },
  chipText: { color: '#fff' },
  chipTextActive: { color: PRIMARY, fontWeight: '600' },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyText: { marginTop: 12, opacity: 0.7, textAlign: 'center' },
  emptyHint: { marginTop: 4, opacity: 0.5, textAlign: 'center' },

  list: { padding: 16, paddingBottom: 160 },
  passCard: { marginBottom: 12 },
  passContent: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  passIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: PRIMARY_TINT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#fef3c7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  passName: { fontWeight: '600' },
  passMeta: { opacity: 0.65, marginTop: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  walkInBadge: {
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, backgroundColor: '#fef3c7',
  },
  walkInBadgeText: { color: '#92400e', fontSize: 10, fontWeight: '700' },

  statusPill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  statusText: { fontSize: 11, fontWeight: '600', textTransform: 'capitalize' },
});
