import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Card, FAB, Icon, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PurpleHeader } from '@/components/purple-header';
import { apiFetch } from '@/lib/api/client';
import { useResponsive } from '@/lib/theme/responsive';

const PRIMARY = '#7367F0';
const PRIMARY_TINT = '#EEEDFD';

export type Permit = {
  id: string;
  description: string;
  date_from: string;
  date_to: string;
  contractor_name: string;
  status: 'pending' | 'approved' | 'rejected' | 'active' | 'closed';
  deposit_amount: number | null;
  deposit_status: string | null;
  deposit_invoice_id: string | null;
  refund_amount: number | null;
  notes: string | null;
  unit_number: string | null;
  organization: { id: string | null; legal_name: string | null };
  created_at: string;
};

// `label` values are i18n keys — render with t(s.label).
export const PERMIT_STATUS: Record<string, { bg: string; fg: string; label: string }> = {
  pending: { bg: '#fef3c7', fg: '#92400e', label: 'status.pendingReview' },
  approved: { bg: '#dbeafe', fg: '#1d4ed8', label: 'status.payDeposit' },
  rejected: { bg: '#fee2e2', fg: '#b91c1c', label: 'status.rejected' },
  active: { bg: '#dcfce7', fg: '#15803d', label: 'status.active' },
  closed: { bg: '#f3f4f6', fg: '#6b7280', label: 'status.closed' },
};

export default function RenovationListScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { isTablet, contentMaxWidth } = useResponsive();
  const [permits, setPermits] = useState<Permit[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch('/api/v1/me/renovation-permits');
      setPermits(data.permits ?? []);
    } catch {
      setPermits([]);
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
      <PurpleHeader title={t('renovation.title')} />

      {loading && !refreshing ? (
        <View style={styles.center}><ActivityIndicator /></View>
      ) : permits.length === 0 ? (
        <View style={styles.center}>
          <Icon source="hammer" size={48} color="#9ca3af" />
          <Text variant="bodyMedium" style={{ marginTop: 12, opacity: 0.65, textAlign: 'center' }}>
            {t('renovation.emptyTitle')}
          </Text>
          <Text variant="bodySmall" style={{ marginTop: 4, opacity: 0.5, textAlign: 'center', paddingHorizontal: 32 }}>
            {t('renovation.emptyHint')}
          </Text>
        </View>
      ) : (
        <FlatList
          data={permits}
          keyExtractor={(p) => p.id}
          contentContainerStyle={[
            styles.list,
            isTablet && { alignSelf: 'center', width: '100%', maxWidth: contentMaxWidth },
          ]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
          renderItem={({ item }) => {
            const s = PERMIT_STATUS[item.status] ?? PERMIT_STATUS.pending;
            return (
              <Card
                style={styles.card}
                onPress={() => router.push({ pathname: '/renovation/[id]', params: { id: item.id } })}>
                <Card.Content>
                  <View style={styles.titleRow}>
                    <Text variant="titleMedium" style={styles.title} numberOfLines={1}>
                      {t('common.unit', { number: item.unit_number ?? '—' })}
                    </Text>
                    <View style={[styles.statusPill, { backgroundColor: s.bg }]}>
                      <Text style={[styles.statusText, { color: s.fg }]}>{t(s.label)}</Text>
                    </View>
                  </View>
                  <Text variant="bodySmall" style={styles.meta} numberOfLines={2}>
                    {item.description}
                  </Text>
                  <Text variant="bodySmall" style={styles.meta}>
                    {new Date(item.date_from).toLocaleDateString()} – {new Date(item.date_to).toLocaleDateString()}
                    {' · '}{item.contractor_name}
                  </Text>
                  {item.status === 'approved' && item.deposit_amount !== null ? (
                    <Text variant="bodySmall" style={styles.depositDue}>
                      {t('renovation.payDepositAtOffice', { amount: item.deposit_amount.toFixed(2) })}
                    </Text>
                  ) : null}
                </Card.Content>
              </Card>
            );
          }}
        />
      )}

      <FAB
        icon="plus"
        label={t('renovation.newRequest')}
        onPress={() => router.push('/renovation/new')}
        style={[styles.fab, { bottom: insets.bottom + 32 }]}
        color="#fff"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, paddingBottom: 120 },
  list: { padding: 16, paddingBottom: 160 },

  card: { marginBottom: 10 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  title: { flex: 1, fontWeight: '600' },
  meta: { opacity: 0.65, marginTop: 4 },
  depositDue: { color: '#1d4ed8', fontWeight: '600', marginTop: 6 },

  statusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  statusText: { fontSize: 11, fontWeight: '600' },

  fab: { position: 'absolute', right: 16, backgroundColor: PRIMARY },
});
