import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Card, Icon, Text } from 'react-native-paper';

import { PurpleHeader } from '@/components/purple-header';
import { apiFetch } from '@/lib/api/client';
import { useResponsive } from '@/lib/theme/responsive';

const PRIMARY = '#7367F0';
const PRIMARY_TINT = '#EEEDFD';

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
  escalated: { bg: '#EEEDFD', fg: '#7367F0', label: 'Escalated' },
  resolved: { bg: '#dcfce7', fg: '#15803d', label: 'Resolved' },
  closed: { bg: '#f3f4f6', fg: '#6b7280', label: 'Closed' },
};

export default function CommunityFeedScreen() {
  const { isTablet, contentMaxWidth } = useResponsive();
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch('/api/v1/me/complaints/public');
      setItems(data.complaints ?? []);
    } catch {
      setItems([]);
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
      <PurpleHeader title="Community Feed" />

      {loading && !refreshing ? (
        <View style={styles.center}><ActivityIndicator /></View>
      ) : items.length === 0 ? (
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
          data={items}
          keyExtractor={(r) => r.id}
          contentContainerStyle={[
            styles.list,
            isTablet && { alignSelf: 'center', width: '100%', maxWidth: contentMaxWidth },
          ]}
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  list: { padding: 16, paddingBottom: 48 },

  card: { marginBottom: 10 },
  jmbRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  jmbBadge: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4,
    backgroundColor: PRIMARY_TINT, maxWidth: '65%',
  },
  jmbBadgeText: { color: PRIMARY, fontSize: 11, fontWeight: '700' },

  title: { fontWeight: '600' },
  body: { opacity: 0.75, marginTop: 4, lineHeight: 18 },
  meta: { opacity: 0.6, marginTop: 4 },

  statusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  statusText: { fontSize: 11, fontWeight: '600' },
});
