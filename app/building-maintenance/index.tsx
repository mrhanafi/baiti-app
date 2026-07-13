import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Card, Icon, Text } from 'react-native-paper';

import { PurpleHeader } from '@/components/purple-header';
import { TabletContainer } from '@/components/tablet-container';
import { apiFetch } from '@/lib/api/client';

const PRIMARY = '#7367F0';

export type BoardTask = {
  id: string;
  title: string;
  location: string | null;
  category: string | null;
  status: 'open' | 'assigned' | 'in_progress' | 'on_hold' | 'completed' | 'closed';
  priority: 'critical' | 'high' | 'normal' | 'low';
  is_delayed: boolean;
  started_at: string;
  completed_at: string | null;
  organization: { id: string | null; legal_name: string | null };
};

// `label` values are i18n keys — render with t(s.label).
export const TASK_STATUS: Record<string, { bg: string; fg: string; label: string }> = {
  open: { bg: '#fef3c7', fg: '#92400e', label: 'status.open' },
  assigned: { bg: '#e0e7ff', fg: '#4338ca', label: 'status.assigned' },
  in_progress: { bg: '#dbeafe', fg: '#1d4ed8', label: 'status.inProgress' },
  on_hold: { bg: '#fde8e8', fg: '#c81e1e', label: 'status.onHold' },
  completed: { bg: '#dcfce7', fg: '#15803d', label: 'status.completed' },
  closed: { bg: '#f3f4f6', fg: '#6b7280', label: 'status.closed' },
};

export default function MaintenanceBoardScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const [ongoing, setOngoing] = useState<BoardTask[]>([]);
  const [completed, setCompleted] = useState<BoardTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch('/api/v1/me/maintenance-board');
      setOngoing(data.ongoing ?? []);
      setCompleted(data.completed ?? []);
    } catch {
      setOngoing([]);
      setCompleted([]);
    }
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function handleRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  function renderCard(task: BoardTask) {
    const s = TASK_STATUS[task.status] ?? TASK_STATUS.open;
    return (
      <Card
        key={task.id}
        style={styles.card}
        onPress={() => router.push({ pathname: '/building-maintenance/[id]', params: { id: task.id } })}>
        <Card.Content>
          <View style={styles.titleRow}>
            <Text variant="titleMedium" style={styles.title}>{task.title}</Text>
            <View style={[styles.statusPill, { backgroundColor: s.bg }]}>
              <Text style={[styles.statusText, { color: s.fg }]}>{t(s.label)}</Text>
            </View>
          </View>
          <Text variant="bodySmall" style={styles.meta}>
            {task.location ?? '—'}{task.category ? ` · ${task.category}` : ''}
          </Text>
          <View style={styles.bottomRow}>
            <Text variant="bodySmall" style={styles.meta}>
              {task.completed_at
                ? t('board.completedDate', { date: new Date(task.completed_at).toLocaleDateString() })
                : t('board.startedDate', { date: new Date(task.started_at).toLocaleDateString() })}
            </Text>
            {task.is_delayed ? (
              <View style={styles.delayedBadge}>
                <Text style={styles.delayedText}>{t('board.delayed')}</Text>
              </View>
            ) : null}
          </View>
        </Card.Content>
      </Card>
    );
  }

  return (
    <View style={styles.container}>
      <PurpleHeader title={t('board.title')} />

      {loading && !refreshing ? (
        <View style={styles.center}><ActivityIndicator /></View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}>
         <TabletContainer>

          <Text variant="titleSmall" style={styles.sectionTitle}>{t('board.ongoingWork')}</Text>
          {ongoing.length === 0 ? (
            <View style={styles.emptyBlock}>
              <Icon source="tools" size={36} color="#9ca3af" />
              <Text variant="bodySmall" style={styles.emptyText}>
                {t('board.noOngoing')}
              </Text>
            </View>
          ) : (
            ongoing.map(renderCard)
          )}

          <Text variant="titleSmall" style={[styles.sectionTitle, { marginTop: 20 }]}>
            {t('board.recentlyCompleted')}
          </Text>
          {completed.length === 0 ? (
            <View style={styles.emptyBlock}>
              <Icon source="check-circle-outline" size={36} color="#9ca3af" />
              <Text variant="bodySmall" style={styles.emptyText}>
                {t('board.noneCompleted')}
              </Text>
            </View>
          ) : (
            completed.map(renderCard)
          )}

          <Text variant="bodySmall" style={styles.disclaimer}>
            {t('board.disclaimer')}
          </Text>
         </TabletContainer>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  scroll: { padding: 16, paddingBottom: 48 },

  sectionTitle: { fontWeight: '700', marginBottom: 8, textTransform: 'uppercase', fontSize: 12, opacity: 0.6 },

  card: { marginBottom: 10 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  title: { flex: 1, fontWeight: '600' },
  meta: { opacity: 0.65, marginTop: 4 },
  bottomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },

  statusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  statusText: { fontSize: 11, fontWeight: '600' },

  delayedBadge: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999,
    backgroundColor: '#fee2e2', marginTop: 4,
  },
  delayedText: { color: '#b91c1c', fontSize: 11, fontWeight: '700' },

  emptyBlock: { alignItems: 'center', paddingVertical: 24, gap: 8 },
  emptyText: { opacity: 0.6, textAlign: 'center' },

  disclaimer: { marginTop: 24, opacity: 0.5, textAlign: 'center' },
});
