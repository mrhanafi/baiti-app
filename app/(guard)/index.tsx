import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Card, Icon, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { apiFetch } from '@/lib/api/client';
import { useGuardSession } from '@/lib/guard/session';

const PRIMARY = '#7367F0';
const PRIMARY_TINT = '#EEEDFD';

type Pass = {
  id: string;
  visitor_name: string;
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

export default function GuardHomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { shift } = useGuardSession();

  const [passes, setPasses] = useState<Pass[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
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

  const counted = passes.filter((p) => p.visit_state !== 'cancelled' && p.visit_state !== 'expired');
  const inside = passes.filter((p) => p.visit_state === 'inside');
  const done = passes.filter((p) => p.visit_state === 'out');
  const expected = passes
    .filter((p) => p.visit_state === 'upcoming' || p.visit_state === 'awaiting')
    .sort((a, b) => new Date(a.valid_from).getTime() - new Date(b.valid_from).getTime());

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}>

        {/* Shift / on-duty header */}
        <View style={styles.shiftHeader}>
          <View style={styles.shiftAvatar}>
            <Icon source="shield-account" size={28} color="#fff" />
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.shiftName}>{shift?.staffName ?? 'No one on duty'}</Text>
            <Text style={styles.shiftSub}>
              {shift ? `On duty · started ${formatTime(shift.startedAt)} · ${elapsed(shift.startedAt)}` : 'Tap profile to pick someone'}
            </Text>
          </View>
        </View>

        {/* Big actions */}
        <View style={styles.actionsRow}>
          <Pressable
            onPress={() => router.push('/guard-scan')}
            style={[styles.actionTile, styles.actionScan]}>
            <Icon source="qrcode-scan" size={36} color="#fff" />
            <Text style={styles.actionScanLabel}>Scan QR</Text>
          </Pressable>
          <Pressable
            onPress={() => router.push('/walk-in')}
            style={[styles.actionTile, styles.actionWalkIn]}>
            <Icon source="account-plus" size={36} color={PRIMARY} />
            <Text style={styles.actionWalkInLabel}>Walk-in</Text>
          </Pressable>
        </View>

        {/* At a glance counts */}
        {loading && !refreshing ? (
          <View style={styles.loading}><ActivityIndicator /></View>
        ) : (
          <>
            <View style={styles.statsRow}>
              <StatTile value={counted.length} label="Today" tint="#eef2ff" textColor="#4338ca" />
              <StatTile value={inside.length} label="Inside" tint="#dbeafe" textColor="#1d4ed8" />
              <StatTile value={done.length} label="Done" tint="#f3f4f6" textColor="#6b7280" />
            </View>

            {/* Currently inside */}
            <View style={styles.sectionRow}>
              <Text variant="titleMedium" style={styles.sectionTitle}>
                Currently inside ({inside.length})
              </Text>
              {inside.length > 0 ? (
                <Pressable onPress={() => router.push('/(guard)/today')}>
                  <Text style={styles.seeAll}>See all</Text>
                </Pressable>
              ) : null}
            </View>
            {inside.length === 0 ? (
              <Card style={styles.emptyCard}>
                <Card.Content>
                  <Text style={styles.emptyText}>No visitors inside right now.</Text>
                </Card.Content>
              </Card>
            ) : (
              inside.slice(0, 5).map((p) => (
                <Card
                  key={p.id}
                  style={styles.passCard}
                  onPress={() => router.push({ pathname: '/guard-pass/[id]', params: { id: p.id } })}>
                  <Card.Content style={styles.passContent}>
                    <View style={styles.tagBadge}>
                      <Text style={styles.tagBadgeText}>#{p.open_entry?.visit_tag ?? '—'}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.passName}>{p.visitor_name}</Text>
                      <Text style={styles.passSub}>
                        Unit {p.unit.unit_number ?? '—'}
                        {p.vehicle_plate ? ` · ${p.vehicle_plate}` : ''}
                        {p.open_entry ? ` · in @ ${formatTime(p.open_entry.scanned_at)}` : ''}
                      </Text>
                    </View>
                    <Icon source="chevron-right" size={20} color="#9ca3af" />
                  </Card.Content>
                </Card>
              ))
            )}

            {/* Next expected */}
            <View style={[styles.sectionRow, { marginTop: 8 }]}>
              <Text variant="titleMedium" style={styles.sectionTitle}>
                Next expected ({expected.length})
              </Text>
            </View>
            {expected.length === 0 ? (
              <Card style={styles.emptyCard}>
                <Card.Content>
                  <Text style={styles.emptyText}>No more expected today.</Text>
                </Card.Content>
              </Card>
            ) : (
              expected.slice(0, 5).map((p) => (
                <Card
                  key={p.id}
                  style={styles.passCard}
                  onPress={() => router.push({ pathname: '/guard-pass/[id]', params: { id: p.id } })}>
                  <Card.Content style={styles.passContent}>
                    <View style={styles.timeBadge}>
                      <Text style={styles.timeBadgeText}>{formatTime(p.valid_from)}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.passName}>{p.visitor_name}</Text>
                      <Text style={styles.passSub}>
                        Unit {p.unit.unit_number ?? '—'} · {p.purpose}
                        {p.vehicle_plate ? ` · ${p.vehicle_plate}` : ''}
                      </Text>
                    </View>
                    <Icon source="chevron-right" size={20} color="#9ca3af" />
                  </Card.Content>
                </Card>
              ))
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function StatTile({ value, label, tint, textColor }: { value: number; label: string; tint: string; textColor: string }) {
  return (
    <View style={[styles.statTile, { backgroundColor: tint }]}>
      <Text style={[styles.statValue, { color: textColor }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: textColor }]}>{label}</Text>
    </View>
  );
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function elapsed(startedAt: string): string {
  const ms = Date.now() - new Date(startedAt).getTime();
  const totalMin = Math.max(0, Math.floor(ms / 60000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m}m elapsed`;
  return `${h}h ${m}m elapsed`;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  scroll: { padding: 16 },
  loading: { padding: 32, alignItems: 'center' },

  shiftHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: PRIMARY,
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
  },
  shiftAvatar: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  shiftName: { color: '#fff', fontSize: 18, fontWeight: '700' },
  shiftSub: { color: 'rgba(255,255,255,0.85)', fontSize: 12, marginTop: 2 },

  actionsRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  actionTile: {
    flex: 1, height: 100, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  actionScan: { backgroundColor: PRIMARY },
  actionScanLabel: { color: '#fff', fontSize: 15, fontWeight: '700' },
  actionWalkIn: { backgroundColor: PRIMARY_TINT, borderWidth: 1, borderColor: PRIMARY },
  actionWalkInLabel: { color: PRIMARY, fontSize: 15, fontWeight: '700' },

  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  statTile: {
    flex: 1, borderRadius: 12,
    paddingVertical: 18, alignItems: 'center', justifyContent: 'center',
  },
  statValue: { fontSize: 28, fontWeight: '800' },
  statLabel: { fontSize: 12, fontWeight: '600', marginTop: 2 },

  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  sectionTitle: { fontWeight: '700' },
  seeAll: { color: PRIMARY, fontWeight: '600', fontSize: 13 },

  emptyCard: { marginBottom: 8, backgroundColor: '#f9fafb' },
  emptyText: { opacity: 0.55, textAlign: 'center', fontSize: 13 },

  passCard: { marginBottom: 8 },
  passContent: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  passName: { fontWeight: '700', fontSize: 15, color: '#1f2937' },
  passSub: { fontSize: 12, color: '#6b7280', marginTop: 2 },

  tagBadge: {
    width: 48, height: 48, borderRadius: 8,
    backgroundColor: '#dbeafe', alignItems: 'center', justifyContent: 'center',
  },
  tagBadgeText: { color: '#1d4ed8', fontWeight: '800', fontSize: 13 },

  timeBadge: {
    width: 56, height: 48, borderRadius: 8,
    backgroundColor: PRIMARY_TINT, alignItems: 'center', justifyContent: 'center',
  },
  timeBadgeText: { color: PRIMARY, fontWeight: '700', fontSize: 13 },
});
