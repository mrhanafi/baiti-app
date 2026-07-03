import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Card, Chip, FAB, Icon, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PurpleHeader } from '@/components/purple-header';
import { apiFetch } from '@/lib/api/client';
import { useResponsive } from '@/lib/theme/responsive';

const PRIMARY = '#7367F0';
const PRIMARY_TINT = '#EEEDFD';

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

const STATUS_COLOR: Record<string, { bg: string; fg: string; label: string }> = {
  open: { bg: '#fef3c7', fg: '#92400e', label: 'Open' },
  in_progress: { bg: '#dbeafe', fg: '#1d4ed8', label: 'In progress' },
  escalated: { bg: '#EEEDFD', fg: '#7367F0', label: 'Escalated' },
  resolved: { bg: '#dcfce7', fg: '#15803d', label: 'Resolved' },
  closed: { bg: '#f3f4f6', fg: '#6b7280', label: 'Closed' },
};

export default function ComplaintListScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isTablet, contentMaxWidth } = useResponsive();
  const [filter, setFilter] = useState<Filter>('active');
  const [items, setItems] = useState<ReportSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (f: Filter) => {
    setLoading(true);
    try {
      const query = f === 'active' ? '?status=active' : '';
      const data = await apiFetch(`/api/v1/me/complaints${query}`);
      setItems(data.reports ?? []);
    } catch {
      setItems([]);
    }
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(filter); }, [filter, load]));

  async function handleRefresh() {
    setRefreshing(true);
    await load(filter);
    setRefreshing(false);
  }

  return (
    <View style={styles.container}>
      <PurpleHeader title="My Complaints" />
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

      {loading && !refreshing ? (
        <View style={styles.center}><ActivityIndicator /></View>
      ) : items.length === 0 ? (
        <View style={styles.center}>
          <Icon source="tools" size={48} color="#9ca3af" />
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
          contentContainerStyle={[
            styles.list,
            isTablet && { alignSelf: 'center', width: '100%', maxWidth: contentMaxWidth },
          ]}
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
      )}

      <FAB
        icon="plus"
        label="New complaint"
        onPress={() => router.push('/complaints/new')}
        style={[styles.fab, { bottom: insets.bottom + 32 }]}
        color="#fff"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
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

  statusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  statusText: { fontSize: 11, fontWeight: '600' },

  fab: { position: 'absolute', right: 16, backgroundColor: PRIMARY },
});
