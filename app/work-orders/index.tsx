import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Card, Icon, IconButton, Text } from 'react-native-paper';

import { PurpleHeader } from '@/components/purple-header';
import { TabletContainer } from '@/components/tablet-container';
import { apiFetch } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/session';
import { setLocale } from '@/lib/i18n';

const PRIMARY = '#7367F0';
const PRIMARY_TINT = '#EEEDFD';

export type WorkOrder = {
  id: string;
  title: string;
  location: string | null;
  category: string | null;
  unit_number: string | null;
  status: 'assigned' | 'in_progress' | 'on_hold' | 'completed' | 'closed';
  priority: 'critical' | 'high' | 'normal' | 'low';
  is_delayed: boolean;
  due_date: string | null;
  created_at: string;
  completed_at: string | null;
  organization: { id: string | null; legal_name: string | null };
};

// `label` values are i18n keys — render with t(s.label).
export const WO_STATUS: Record<string, { bg: string; fg: string; label: string }> = {
  assigned: { bg: '#e0e7ff', fg: '#4338ca', label: 'status.assigned' },
  in_progress: { bg: '#dbeafe', fg: '#1d4ed8', label: 'status.inProgress' },
  on_hold: { bg: '#fde8e8', fg: '#c81e1e', label: 'status.onHold' },
  completed: { bg: '#dcfce7', fg: '#15803d', label: 'status.completed' },
  closed: { bg: '#f3f4f6', fg: '#6b7280', label: 'status.closed' },
};

export const WO_PRIORITY: Record<string, { fg: string; label: string }> = {
  critical: { fg: '#b91c1c', label: 'status.critical' },
  high: { fg: '#c2410c', label: 'status.high' },
  normal: { fg: '#6b7280', label: 'status.normal' },
  low: { fg: '#9ca3af', label: 'status.low' },
};

type WoStats = { ongoing: number; completed_this_month: number; overdue: number };

export default function WorkOrderListScreen() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { t, i18n } = useTranslation();
  const [stats, setStats] = useState<WoStats | null>(null);
  const [ongoing, setOngoing] = useState<WorkOrder[]>([]);
  const [done, setDone] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Staff-only accounts get a logout button here (they have no Profile tab).
  const isStaffOnly = (user?.roles ?? []).includes('staff') && !(user?.roles ?? []).includes('owner');

  const load = useCallback(async () => {
    try {
      const data = await apiFetch('/api/v1/me/work-orders');
      setStats(data.stats ?? null);
      setOngoing(data.ongoing ?? []);
      setDone(data.done ?? []);
    } catch {
      setStats(null);
      setOngoing([]);
      setDone([]);
    }
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function handleRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  function renderCard(wo: WorkOrder) {
    const s = WO_STATUS[wo.status] ?? WO_STATUS.assigned;
    const p = WO_PRIORITY[wo.priority] ?? WO_PRIORITY.normal;
    return (
      <Card
        key={wo.id}
        style={styles.card}
        onPress={() => router.push({ pathname: '/work-orders/[id]', params: { id: wo.id } })}>
        <Card.Content>
          <View style={styles.jmbRow}>
            <View style={styles.jmbBadge}>
              <Text style={styles.jmbBadgeText}>{wo.organization.legal_name ?? '—'}</Text>
            </View>
            <View style={[styles.statusPill, { backgroundColor: s.bg }]}>
              <Text style={[styles.statusText, { color: s.fg }]}>{t(s.label)}</Text>
            </View>
          </View>
          <Text variant="titleMedium" style={styles.title}>{wo.title}</Text>
          <Text variant="bodySmall" style={styles.meta}>
            {wo.location ?? '—'}
            {wo.unit_number ? ` · ${t('common.unit', { number: wo.unit_number })}` : ''}
            {wo.category ? ` · ${wo.category}` : ''}
          </Text>
          <View style={styles.bottomRow}>
            <Text variant="bodySmall" style={[styles.priority, { color: p.fg }]}>{t(p.label)}</Text>
            {wo.due_date ? (
              <Text variant="bodySmall" style={[styles.meta, wo.is_delayed && styles.overdue]}>
                {t('workOrders.due', { date: new Date(wo.due_date).toLocaleDateString() })}
                {wo.is_delayed ? ` · ${t('workOrders.overdueTag')}` : ''}
              </Text>
            ) : null}
          </View>
        </Card.Content>
      </Card>
    );
  }

  return (
    <View style={styles.container}>
      <PurpleHeader
        title={t('workOrders.title')}
        showBack={!isStaffOnly}
        right={isStaffOnly ? (
          <View style={{ flexDirection: 'row' }}>
            <IconButton
              icon="translate"
              iconColor="#fff"
              size={22}
              onPress={() => {
                const next = i18n.language === 'en' ? 'ms' : 'en';
                void setLocale(next);
              }}
            />
            <IconButton icon="logout" iconColor="#fff" size={22} onPress={() => signOut()} />
          </View>
        ) : undefined}
      />

      {loading && !refreshing ? (
        <View style={styles.center}><ActivityIndicator /></View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}>
         <TabletContainer>

          {stats ? (
            <View style={styles.statsRow}>
              <View style={styles.statBox}>
                <Text variant="headlineSmall" style={styles.statValue}>{stats.ongoing}</Text>
                <Text variant="bodySmall" style={styles.statLabel}>{t('workOrders.ongoing')}</Text>
              </View>
              <View style={styles.statBox}>
                <Text variant="headlineSmall" style={[styles.statValue, { color: '#15803d' }]}>
                  {stats.completed_this_month}
                </Text>
                <Text variant="bodySmall" style={styles.statLabel}>{t('workOrders.doneThisMonth')}</Text>
              </View>
              <View style={styles.statBox}>
                <Text variant="headlineSmall" style={[styles.statValue, stats.overdue > 0 && { color: '#b91c1c' }]}>
                  {stats.overdue}
                </Text>
                <Text variant="bodySmall" style={styles.statLabel}>{t('workOrders.overdue')}</Text>
              </View>
            </View>
          ) : null}

          <Text variant="titleSmall" style={styles.sectionTitle}>{t('workOrders.ongoing')}</Text>
          {ongoing.length === 0 ? (
            <View style={styles.emptyBlock}>
              <Icon source="clipboard-check-outline" size={36} color="#9ca3af" />
              <Text variant="bodySmall" style={styles.emptyText}>
                {t('workOrders.emptyOngoing')}
              </Text>
            </View>
          ) : (
            ongoing.map(renderCard)
          )}

          <Text variant="titleSmall" style={[styles.sectionTitle, { marginTop: 20 }]}>
            {t('workOrders.doneLast30Days')}
          </Text>
          {done.length === 0 ? (
            <View style={styles.emptyBlock}>
              <Icon source="check-circle-outline" size={36} color="#9ca3af" />
              <Text variant="bodySmall" style={styles.emptyText}>{t('workOrders.emptyDone')}</Text>
            </View>
          ) : (
            done.map(renderCard)
          )}
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

  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  statBox: {
    flex: 1, alignItems: 'center', paddingVertical: 12,
    backgroundColor: '#fff', borderRadius: 12,
    borderWidth: 1, borderColor: '#eee',
  },
  statValue: { fontWeight: '700', color: PRIMARY },
  statLabel: { opacity: 0.6, marginTop: 2 },

  card: { marginBottom: 10 },
  jmbRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  jmbBadge: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4,
    backgroundColor: PRIMARY_TINT, maxWidth: '60%',
  },
  jmbBadgeText: { color: PRIMARY, fontSize: 11, fontWeight: '700' },

  title: { fontWeight: '600' },
  meta: { opacity: 0.65, marginTop: 4 },
  bottomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  priority: { fontWeight: '700', fontSize: 11 },
  overdue: { color: '#b91c1c', fontWeight: '700', opacity: 1 },

  statusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  statusText: { fontSize: 11, fontWeight: '600' },

  emptyBlock: { alignItems: 'center', paddingVertical: 24, gap: 8 },
  emptyText: { opacity: 0.6, textAlign: 'center' },
});
