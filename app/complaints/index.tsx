import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Card, Chip, FAB, Icon, SegmentedButtons, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PurpleHeader } from '@/components/purple-header';
import { apiFetch } from '@/lib/api/client';
import { useResponsive } from '@/lib/theme/responsive';

const PRIMARY = '#7367F0';
const PRIMARY_TINT = '#EEEDFD';

type Tab = 'mine' | 'community';
type Filter = 'active' | 'all';

type ReportSummary = {
  id: string;
  title: string;
  location: string;
  category: string | null;
  visibility: 'public' | 'private';
  status: 'open' | 'in_progress' | 'escalated' | 'resolved' | 'closed';
  created_at: string;
  photo_count: number;
};

type FeedItem = {
  id: string;
  title: string;
  body: string;
  location: string;
  category: string | null;
  status: 'open' | 'in_progress' | 'escalated' | 'resolved' | 'closed';
  reporter_name: string | null;
  unit_number: string | null;
  organization: { id: string | null; legal_name: string | null };
  created_at: string;
};

const STATUS_COLOR: Record<string, { bg: string; fg: string; label: string }> = {
  open: { bg: '#fef3c7', fg: '#92400e', label: 'Open' },
  in_progress: { bg: '#dbeafe', fg: '#1d4ed8', label: 'In progress' },
  // Residents see 'escalated' as plain 'In progress' — the term is admin-side vocabulary.
  escalated: { bg: '#dbeafe', fg: '#1d4ed8', label: 'In progress' },
  resolved: { bg: '#dcfce7', fg: '#15803d', label: 'Resolved' },
  closed: { bg: '#f3f4f6', fg: '#6b7280', label: 'Closed' },
};

export default function ComplaintListScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isTablet, contentMaxWidth } = useResponsive();
  const [tab, setTab] = useState<Tab>('mine');
  const [filter, setFilter] = useState<Filter>('active');
  const [items, setItems] = useState<ReportSummary[]>([]);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (t: Tab, f: Filter) => {
    setLoading(true);
    try {
      if (t === 'mine') {
        const query = f === 'active' ? '?status=active' : '';
        const data = await apiFetch(`/api/v1/me/complaints${query}`);
        setItems(data.reports ?? []);
      } else {
        const data = await apiFetch('/api/v1/me/complaints/public');
        setFeed(data.complaints ?? []);
      }
    } catch {
      if (t === 'mine') setItems([]);
      else setFeed([]);
    }
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(tab, filter); }, [tab, filter, load]));

  async function handleRefresh() {
    setRefreshing(true);
    await load(tab, filter);
    setRefreshing(false);
  }

  const listWidth = isTablet
    ? { alignSelf: 'center' as const, width: '100%' as const, maxWidth: contentMaxWidth }
    : null;

  return (
    <View style={styles.container}>
      <PurpleHeader title="Complaints" />

      <View style={styles.tabsWrap}>
        <SegmentedButtons
          value={tab}
          onValueChange={(v) => setTab(v as Tab)}
          buttons={[
            { value: 'mine', label: 'My complaints', icon: 'account' },
            { value: 'community', label: 'Community', icon: 'account-group' },
          ]}
        />
      </View>

      {tab === 'mine' ? (
        <View style={styles.chipsRow}>
          {(['active', 'all'] as Filter[]).map((f) => (
            <Chip
              key={f}
              selected={filter === f}
              onPress={() => setFilter(f)}
              style={[styles.chip, filter === f && styles.chipActive]}
              textStyle={filter === f ? styles.chipTextActive : styles.chipText}
              compact>
              {f === 'active' ? 'Active' : 'All'}
            </Chip>
          ))}
        </View>
      ) : null}

      {loading && !refreshing ? (
        <View style={styles.center}><ActivityIndicator /></View>
      ) : tab === 'mine' ? (
        items.length === 0 ? (
          <View style={styles.center}>
            <Icon source="comment-alert-outline" size={48} color="#9ca3af" />
            <Text variant="bodyMedium" style={{ marginTop: 12, opacity: 0.65, textAlign: 'center' }}>
              {filter === 'active' ? 'No active complaints.' : 'No complaints yet.'}
            </Text>
            <Text variant="bodySmall" style={{ marginTop: 4, opacity: 0.5 }}>
              Tap + to file a new complaint.
            </Text>
          </View>
        ) : (
          <FlatList
            data={items}
            keyExtractor={(r) => r.id}
            contentContainerStyle={[styles.list, listWidth]}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
            renderItem={({ item }) => {
              const s = STATUS_COLOR[item.status];
              return (
                <Card
                  style={styles.card}
                  onPress={() => router.push({ pathname: '/complaints/[id]', params: { id: item.id } })}>
                  <Card.Content>
                    <View style={styles.titleRow}>
                      <Text variant="titleMedium" style={styles.title}>{item.title}</Text>
                      <View style={[styles.statusPill, { backgroundColor: s.bg }]}>
                        <Text style={[styles.statusText, { color: s.fg }]}>{s.label}</Text>
                      </View>
                    </View>
                    <Text variant="bodySmall" style={styles.meta}>
                      {item.location}{item.category ? ` · ${item.category}` : ''}
                    </Text>
                    <Text variant="bodySmall" style={styles.meta}>
                      Filed {new Date(item.created_at).toLocaleDateString()} ·{' '}
                      {item.photo_count > 0 ? `${item.photo_count} photo${item.photo_count === 1 ? '' : 's'}` : 'no photos'}
                    </Text>
                  </Card.Content>
                </Card>
              );
            }}
          />
        )
      ) : feed.length === 0 ? (
        <View style={styles.center}>
          <Icon source="account-group-outline" size={48} color="#9ca3af" />
          <Text variant="bodyMedium" style={{ marginTop: 12, opacity: 0.65, textAlign: 'center' }}>
            No public complaints yet.
          </Text>
          <Text variant="bodySmall" style={{ marginTop: 4, opacity: 0.5, textAlign: 'center' }}>
            Complaints your neighbours mark as public show up here.
          </Text>
        </View>
      ) : (
        <FlatList
          data={feed}
          keyExtractor={(r) => r.id}
          contentContainerStyle={[styles.list, listWidth]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
          renderItem={({ item }) => {
            const s = STATUS_COLOR[item.status] ?? STATUS_COLOR.open;
            return (
              <Card style={styles.card}>
                <Card.Content>
                  <View style={styles.jmbRow}>
                    <View style={styles.jmbBadge}>
                      <Text style={styles.jmbBadgeText}>
                        {item.organization.legal_name ?? 'JMB'}
                      </Text>
                    </View>
                    <View style={[styles.statusPill, { backgroundColor: s.bg }]}>
                      <Text style={[styles.statusText, { color: s.fg }]}>{s.label}</Text>
                    </View>
                  </View>
                  <Text variant="titleMedium" style={styles.title}>{item.title}</Text>
                  {item.body ? (
                    <Text variant="bodySmall" style={styles.body} numberOfLines={3}>
                      {item.body}
                    </Text>
                  ) : null}
                  <Text variant="bodySmall" style={styles.meta}>
                    {item.location}{item.category ? ` · ${item.category}` : ''}
                  </Text>
                  <Text variant="bodySmall" style={styles.meta}>
                    {item.reporter_name ?? 'A resident'}
                    {item.unit_number ? ` · Unit ${item.unit_number}` : ''} ·{' '}
                    {new Date(item.created_at).toLocaleDateString()}
                  </Text>
                </Card.Content>
              </Card>
            );
          }}
        />
      )}

      {tab === 'mine' ? (
        <FAB
          icon="plus"
          label="New complaint"
          onPress={() => router.push('/complaints/new')}
          style={[styles.fab, { bottom: insets.bottom + 32 }]}
          color="#fff"
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  tabsWrap: { paddingHorizontal: 16, paddingTop: 16 },
  chipsRow: { flexDirection: 'row', gap: 8, padding: 16, paddingBottom: 8 },
  chip: { backgroundColor: '#f3f4f6' },
  chipActive: { backgroundColor: PRIMARY_TINT },
  chipText: { color: '#1f2937' },
  chipTextActive: { color: PRIMARY, fontWeight: '600' },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, paddingBottom: 120 },
  list: { padding: 16, paddingTop: 8, paddingBottom: 160 },

  card: { marginBottom: 10 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  title: { flex: 1, fontWeight: '600' },
  meta: { opacity: 0.65, marginTop: 4 },
  body: { opacity: 0.75, marginTop: 4, lineHeight: 18 },

  jmbRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  jmbBadge: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4,
    backgroundColor: PRIMARY_TINT, maxWidth: '65%',
  },
  jmbBadgeText: { color: PRIMARY, fontSize: 11, fontWeight: '700' },

  statusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  statusText: { fontSize: 11, fontWeight: '600' },

  fab: { position: 'absolute', right: 16, backgroundColor: PRIMARY },
});
