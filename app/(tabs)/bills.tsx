import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Card, Icon, Text, useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PurpleHeader } from '@/components/purple-header';
import { TabletContainer } from '@/components/tablet-container';
import { apiFetch } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/session';

const PRIMARY = '#7367F0';
// Shared with Home tab + Utilities + visitor/new + maintenance/new.
const SELECTED_UNIT_KEY = 'baiti.home.selected_unit_id';

type Invoice = {
  id: string;
  invoice_number: string;
  period_label: string;
  total: number;
  status: 'draft' | 'issued' | 'paid' | 'overdue' | 'cancelled';
  issue_date: string;
  due_date: string;
  paid_at: string | null;
  days_overdue: number;
  unit_id: string | null;
  unit_number: string | null;
  jmb_name: string | null;
};

export default function BillsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const theme = useTheme();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Active home read from the shared AsyncStorage key. Bills defaults to
  // showing only this home's invoices — flip the toggle for the cross-home
  // aggregate view (multi-home owners only).
  const [activeUnitId, setActiveUnitId] = useState<string | null>(null);
  const [showAllHomes, setShowAllHomes] = useState(false);
  const homes = user?.units ?? [];
  const hasMultipleHomes = homes.length > 1;

  useEffect(() => {
    AsyncStorage.getItem(SELECTED_UNIT_KEY).then((saved) => {
      if (saved && homes.some((u) => u.id === saved)) {
        setActiveUnitId(saved);
      } else if (homes[0]?.id) {
        setActiveUnitId(homes[0].id);
      }
    });
  }, [homes]);

  const activeHome = useMemo(
    () => homes.find((h) => h.id === activeUnitId) ?? homes[0] ?? null,
    [homes, activeUnitId],
  );

  const load = useCallback(async () => {
    try {
      const data = await apiFetch('/api/v1/me/invoices');
      setInvoices(data.invoices ?? []);
    } catch {
      setInvoices([]);
    }
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function handleRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  const scopedInvoices = useMemo(() => {
    if (showAllHomes || !activeUnitId) return invoices;
    return invoices.filter((i) => i.unit_id === activeUnitId);
  }, [invoices, activeUnitId, showAllHomes]);

  const outstanding = scopedInvoices.filter((i) => i.status === 'issued' || i.status === 'overdue');
  const history = scopedInvoices.filter((i) => i.status === 'paid' || i.status === 'cancelled');
  const totalOutstanding = outstanding.reduce((sum, i) => sum + i.total, 0);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <PurpleHeader title="Bills" />

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}>
        <TabletContainer>
          {/* Active-home scope chip — shown only for multi-home owners.
              Tap to toggle between active-home only and the all-homes view. */}
          {hasMultipleHomes ? (
            <Pressable
              onPress={() => setShowAllHomes((v) => !v)}
              style={[
                styles.scopeChip,
                { backgroundColor: theme.colors.surface, borderColor: theme.colors.outlineVariant },
              ]}>
              <Icon source={showAllHomes ? 'home-group' : 'home-city'} size={16} color={PRIMARY} />
              <Text style={[styles.scopeChipText, { color: theme.colors.onSurface }]}>
                {showAllHomes
                  ? `All ${homes.length} homes`
                  : `Unit ${activeHome?.unit_number ?? '—'}${activeHome?.property_name ? ` · ${activeHome.property_name}` : ''}`}
              </Text>
              <Text style={styles.scopeChipAction}>
                {showAllHomes ? 'Show one' : 'Show all'}
              </Text>
            </Pressable>
          ) : null}

          {loading && !refreshing ? (
            <View style={styles.center}><ActivityIndicator /></View>
          ) : scopedInvoices.length === 0 ? (
            <View style={styles.center}>
              <Icon source="receipt-text-outline" size={56} color="#9ca3af" />
              <Text variant="bodyMedium" style={styles.emptyText}>
                {invoices.length === 0
                  ? `No invoices yet.\nWhen your JMB issues one, it'll show up here.`
                  : `No bills for this home yet.${hasMultipleHomes ? '\nTap the chip above to see all homes.' : ''}`}
              </Text>
            </View>
          ) : (
            <>
              {/* Outstanding summary */}
              {outstanding.length > 0 ? (
                <View style={styles.summaryCard}>
                  <Text style={styles.summaryLabel}>Outstanding</Text>
                  <Text style={styles.summaryAmount}>RM {totalOutstanding.toFixed(2)}</Text>
                  <Text style={styles.summaryMeta}>
                    {outstanding.length} unpaid invoice{outstanding.length === 1 ? '' : 's'}
                  </Text>
                </View>
              ) : null}

              {/* Outstanding list */}
              {outstanding.length > 0 ? (
                <View style={styles.section}>
                  <Text style={[styles.sectionTitle, { color: theme.colors.onSurfaceVariant }]}>Unpaid</Text>
                  {outstanding.map((inv) => (
                    <InvoiceCard key={inv.id} invoice={inv} onPress={() => router.push(`/billing/${inv.id}` as any)} />
                  ))}
                </View>
              ) : null}

              {/* History — always shown so residents know where paid bills land */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>History</Text>
                {history.length > 0 ? (
                  history.map((inv) => (
                    <InvoiceCard key={inv.id} invoice={inv} onPress={() => router.push(`/billing/${inv.id}` as any)} />
                  ))
                ) : (
                  <Card style={styles.historyEmptyCard}>
                    <Card.Content style={styles.historyEmptyContent}>
                      <Icon source="receipt-text-check-outline" size={36} color={theme.colors.onSurfaceVariant} />
                      <Text variant="bodySmall" style={[styles.historyEmptyText, { color: theme.colors.onSurfaceVariant }]}>
                        No paid bills yet.{'\n'}Once you settle a bill, it lands here.
                      </Text>
                    </Card.Content>
                  </Card>
                )}
              </View>
            </>
          )}
        </TabletContainer>
      </ScrollView>
    </View>
  );
}

function InvoiceCard({ invoice, onPress }: { invoice: Invoice; onPress: () => void }) {
  const theme = useTheme();
  const statusColors: Record<string, { bg: string; fg: string; label: string }> = {
    issued: { bg: '#fef3c7', fg: '#92400e', label: 'Unpaid' },
    overdue: { bg: '#fee2e2', fg: '#b91c1c', label: 'Overdue' },
    paid: { bg: '#d1fae5', fg: '#065f46', label: 'Paid' },
    cancelled: { bg: '#f3f4f6', fg: '#6b7280', label: 'Cancelled' },
    draft: { bg: '#f3f4f6', fg: '#6b7280', label: 'Draft' },
  };
  const sc = statusColors[invoice.status] ?? statusColors.draft;

  return (
    <Pressable onPress={onPress}>
      <Card style={styles.invoiceCard}>
        <Card.Content style={styles.invoiceContent}>
          <View style={styles.invoiceTop}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.invoicePeriod, { color: theme.colors.onSurfaceVariant }]}>{invoice.period_label}</Text>
              <Text style={[styles.invoiceNumber, { color: theme.colors.onSurface }]}>{invoice.invoice_number}</Text>
              {invoice.unit_number ? (
                <Text style={[styles.invoiceUnit, { color: theme.colors.onSurfaceVariant }]}>Unit {invoice.unit_number}</Text>
              ) : null}
            </View>
            <View style={styles.invoiceRight}>
              <Text style={[styles.invoiceAmount, { color: theme.colors.onSurface }]}>RM {invoice.total.toFixed(2)}</Text>
              <View style={[styles.pill, { backgroundColor: sc.bg }]}>
                <Text style={[styles.pillText, { color: sc.fg }]}>{sc.label}</Text>
              </View>
            </View>
          </View>
          <View style={styles.invoiceMeta}>
            {invoice.status === 'overdue' ? (
              <Text style={styles.overdueText}>
                ⚠ {invoice.days_overdue} day{invoice.days_overdue === 1 ? '' : 's'} overdue
              </Text>
            ) : invoice.status === 'paid' ? (
              <Text style={styles.paidText}>Paid {invoice.paid_at ? new Date(invoice.paid_at).toLocaleDateString() : ''}</Text>
            ) : (
              <Text style={[styles.dueText, { color: theme.colors.onSurfaceVariant }]}>Due {new Date(invoice.due_date).toLocaleDateString()}</Text>
            )}
          </View>
        </Card.Content>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // backgroundColor comes from theme.colors.background at render time
  container: { flex: 1 },
  scroll: { padding: 16 },
  center: { padding: 64, alignItems: 'center' },
  emptyText: { marginTop: 12, opacity: 0.65, textAlign: 'center' },

  summaryCard: {
    backgroundColor: PRIMARY,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    alignItems: 'center',
  },
  summaryLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 13, marginBottom: 4 },
  summaryAmount: { color: '#fff', fontSize: 32, fontWeight: '800', letterSpacing: -0.5 },
  summaryMeta: { color: 'rgba(255,255,255,0.85)', fontSize: 12, marginTop: 4 },

  section: { marginBottom: 24 },
  sectionTitle: {
    fontSize: 13, fontWeight: '700', textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8, marginLeft: 4,
  },

  // Card surface comes from Paper's theme by default — no hardcoded background.
  invoiceCard: { marginBottom: 8 },
  invoiceContent: { paddingVertical: 12 },
  invoiceTop: { flexDirection: 'row', alignItems: 'flex-start' },
  invoicePeriod: { fontSize: 11, textTransform: 'uppercase', fontWeight: '600', letterSpacing: 0.5 },
  invoiceNumber: { fontSize: 14, fontWeight: '600', marginTop: 2 },
  invoiceUnit: { fontSize: 12, marginTop: 2 },
  invoiceRight: { alignItems: 'flex-end', gap: 4 },
  invoiceAmount: { fontSize: 16, fontWeight: '700' },
  pill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  pillText: { fontSize: 10, fontWeight: '700' },

  // Top divider on each invoice card's meta row — uses 1px opaque-ish border;
  // an inline borderTopColor (theme.colors.outlineVariant) is set in JSX where it matters.
  invoiceMeta: { marginTop: 8, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(120,120,128,0.2)' },
  overdueText: { fontSize: 12, color: '#b91c1c', fontWeight: '600' },
  paidText: { fontSize: 12, color: '#065f46' },
  dueText: { fontSize: 12 },

  // Card surface from Paper theme. Inline override applies in JSX if needed.
  historyEmptyCard: {},
  historyEmptyContent: { alignItems: 'center', paddingVertical: 24 },
  historyEmptyText: { marginTop: 8, textAlign: 'center' },

  scopeChip: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 12, paddingVertical: 10,
    borderRadius: 999,
    marginBottom: 12,
    borderWidth: 1,
  },
  scopeChipText: { flex: 1, fontSize: 13, fontWeight: '500' },
  scopeChipAction: { color: PRIMARY, fontSize: 12, fontWeight: '600' },
});
