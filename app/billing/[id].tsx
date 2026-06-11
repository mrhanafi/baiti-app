import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useState } from 'react';
import { Alert, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Card, Divider, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PurpleHeader } from '@/components/purple-header';
import { TabletContainer } from '@/components/tablet-container';
import { apiDownload, apiFetch } from '@/lib/api/client';

type LineItem = { name: string; description: string | null; amount: number };
type Payment = { gateway: string; amount: number; status: string; paid_at: string | null };

type Invoice = {
  id: string;
  invoice_number: string;
  period_label: string;
  total: number;
  subtotal: number;
  status: 'draft' | 'issued' | 'paid' | 'overdue' | 'cancelled';
  issue_date: string;
  due_date: string;
  paid_at: string | null;
  days_overdue: number;
  unit_number: string | null;
  jmb_name: string | null;
  line_items: LineItem[];
  payments: Payment[];
};

export default function InvoiceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [paying, setPaying] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch(`/api/v1/me/invoices/${id}`);
      setInvoice(data.invoice ?? null);
    } catch {
      setInvoice(null);
    }
    setLoading(false);
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function handleRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  async function handlePay() {
    if (!invoice) return;
    setPaying(true);
    try {
      const data = await apiFetch(`/api/v1/me/invoices/${invoice.id}/pay`, {
        method: 'POST',
      });
      if (data?.checkout_url) {
        await WebBrowser.openBrowserAsync(data.checkout_url, {
          presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
        });
        // Refetch when user returns — webhook may have updated status
        await load();
      } else {
        Alert.alert('Payment error', 'Could not start payment. Try again.');
      }
    } catch (e: any) {
      Alert.alert('Payment error', e?.message ?? 'Could not start payment.');
    }
    setPaying(false);
  }

  async function handleDownloadReceipt() {
    if (!invoice) return;
    setDownloading(true);
    try {
      const localUri = await apiDownload(
        `/api/v1/me/invoices/${invoice.id}/receipt`,
        `Receipt-${invoice.invoice_number}.pdf`,
      );
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(localUri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Receipt — '.concat(invoice.invoice_number),
          UTI: 'com.adobe.pdf',
        });
      } else {
        Alert.alert('Receipt downloaded', `Saved to: ${localUri}`);
      }
    } catch (e: any) {
      Alert.alert('Download failed', e?.message ?? 'Could not download receipt.');
    }
    setDownloading(false);
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <PurpleHeader title="Invoice" />
        <View style={styles.center}><ActivityIndicator /></View>
      </View>
    );
  }
  if (!invoice) {
    return (
      <View style={styles.container}>
        <PurpleHeader title="Invoice" />
        <View style={styles.center}>
          <Text>Invoice not found.</Text>
        </View>
      </View>
    );
  }

  const isPayable = invoice.status === 'issued' || invoice.status === 'overdue';
  const statusColors: Record<string, { bg: string; fg: string; label: string }> = {
    issued: { bg: '#fef3c7', fg: '#92400e', label: 'Unpaid' },
    overdue: { bg: '#fee2e2', fg: '#b91c1c', label: 'Overdue' },
    paid: { bg: '#d1fae5', fg: '#065f46', label: 'Paid' },
    cancelled: { bg: '#f3f4f6', fg: '#6b7280', label: 'Cancelled' },
    draft: { bg: '#f3f4f6', fg: '#6b7280', label: 'Draft' },
  };
  const sc = statusColors[invoice.status];

  return (
    <View style={styles.container}>
      <PurpleHeader title={invoice.invoice_number} />

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 120 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}>
        <TabletContainer>
          {/* Amount header */}
          <View style={styles.amountCard}>
            <Text style={styles.amountLabel}>{invoice.period_label}</Text>
            <Text style={styles.amountValue}>RM {invoice.total.toFixed(2)}</Text>
            <View style={[styles.pill, { backgroundColor: sc.bg }]}>
              <Text style={[styles.pillText, { color: sc.fg }]}>{sc.label}</Text>
            </View>
            {invoice.status === 'overdue' ? (
              <Text style={styles.overdueText}>
                ⚠ {invoice.days_overdue} day{invoice.days_overdue === 1 ? '' : 's'} overdue
              </Text>
            ) : invoice.status === 'paid' && invoice.paid_at ? (
              <Text style={styles.paidText}>Paid on {new Date(invoice.paid_at).toLocaleDateString()}</Text>
            ) : (
              <Text style={styles.dueText}>Due {new Date(invoice.due_date).toLocaleDateString()}</Text>
            )}
          </View>

          {/* Line items */}
          <Card style={styles.card}>
            <Card.Content>
              <Text style={styles.sectionTitle}>Breakdown</Text>
              {invoice.line_items.map((li, i) => (
                <View key={i}>
                  <View style={styles.lineItem}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.lineName}>{li.name}</Text>
                      {li.description ? (
                        <Text style={styles.lineDesc}>{li.description}</Text>
                      ) : null}
                    </View>
                    <Text style={styles.lineAmount}>RM {li.amount.toFixed(2)}</Text>
                  </View>
                  {i < invoice.line_items.length - 1 ? <Divider style={styles.divider} /> : null}
                </View>
              ))}
              <Divider style={[styles.divider, { marginVertical: 12 }]} />
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Total</Text>
                <Text style={styles.totalAmount}>RM {invoice.total.toFixed(2)}</Text>
              </View>
            </Card.Content>
          </Card>

          {/* Details */}
          <Card style={styles.card}>
            <Card.Content>
              <Text style={styles.sectionTitle}>Details</Text>
              <DetailRow label="Issued by" value={invoice.jmb_name ?? '—'} />
              <DetailRow label="Unit" value={invoice.unit_number ?? '—'} />
              <DetailRow label="Issue date" value={new Date(invoice.issue_date).toLocaleDateString()} />
              <DetailRow label="Due date" value={new Date(invoice.due_date).toLocaleDateString()} />
            </Card.Content>
          </Card>

          {/* Payments */}
          {invoice.payments.length > 0 ? (
            <Card style={styles.card}>
              <Card.Content>
                <Text style={styles.sectionTitle}>Payment history</Text>
                {invoice.payments.map((p, i) => (
                  <View key={i} style={styles.paymentRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.payMethod}>{p.gateway === 'manual' ? 'Offline / Bank transfer' : p.gateway.toUpperCase()}</Text>
                      {p.paid_at ? (
                        <Text style={styles.payDate}>{new Date(p.paid_at).toLocaleString()}</Text>
                      ) : null}
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.payAmount}>RM {p.amount.toFixed(2)}</Text>
                      <Text style={[styles.payStatus, { color: p.status === 'confirmed' || p.status === 'manual' ? '#065f46' : p.status === 'failed' ? '#b91c1c' : '#92400e' }]}>
                        {p.status}
                      </Text>
                    </View>
                  </View>
                ))}
              </Card.Content>
            </Card>
          ) : null}
        </TabletContainer>
      </ScrollView>

      {/* Sticky Pay button (unpaid) OR Download Receipt button (paid) */}
      {isPayable ? (
        <View style={[styles.payBar, { paddingBottom: insets.bottom + 12 }]}>
          <Button
            mode="contained"
            icon="credit-card"
            loading={paying}
            disabled={paying}
            onPress={handlePay}
            style={styles.payButton}
            contentStyle={{ paddingVertical: 6 }}>
            Pay RM {invoice.total.toFixed(2)}
          </Button>
        </View>
      ) : invoice.status === 'paid' ? (
        <View style={[styles.payBar, { paddingBottom: insets.bottom + 12 }]}>
          <Button
            mode="contained"
            icon="download"
            loading={downloading}
            disabled={downloading}
            onPress={handleDownloadReceipt}
            style={styles.payButton}
            contentStyle={{ paddingVertical: 6 }}>
            Download receipt
          </Button>
        </View>
      ) : null}
    </View>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const PRIMARY = '#7367F0';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f7fa' },
  scroll: { padding: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 64 },

  amountCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    marginBottom: 16,
    alignItems: 'center',
  },
  amountLabel: { fontSize: 13, color: '#6b7280', textTransform: 'uppercase', fontWeight: '600', letterSpacing: 0.5 },
  amountValue: { fontSize: 36, fontWeight: '800', color: '#111827', marginTop: 4, letterSpacing: -0.5 },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, marginTop: 8 },
  pillText: { fontSize: 11, fontWeight: '700' },
  overdueText: { fontSize: 12, color: '#b91c1c', fontWeight: '600', marginTop: 6 },
  paidText: { fontSize: 12, color: '#065f46', marginTop: 6 },
  dueText: { fontSize: 12, color: '#6b7280', marginTop: 6 },

  card: { marginBottom: 12, backgroundColor: '#fff' },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 },

  lineItem: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 8 },
  lineName: { fontSize: 14, color: '#111827', fontWeight: '500' },
  lineDesc: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  lineAmount: { fontSize: 14, color: '#111827', fontWeight: '600' },
  divider: { backgroundColor: '#f3f4f6' },

  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 4 },
  totalLabel: { fontSize: 14, fontWeight: '700', color: '#111827' },
  totalAmount: { fontSize: 18, fontWeight: '800', color: PRIMARY },

  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  detailLabel: { fontSize: 13, color: '#6b7280' },
  detailValue: { fontSize: 13, color: '#111827', fontWeight: '500' },

  paymentRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  payMethod: { fontSize: 13, fontWeight: '600', color: '#111827' },
  payDate: { fontSize: 11, color: '#6b7280', marginTop: 2 },
  payAmount: { fontSize: 14, fontWeight: '600', color: '#111827' },
  payStatus: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', marginTop: 2 },

  payBar: {
    position: 'absolute',
    left: 0, right: 0, bottom: 0,
    backgroundColor: '#fff',
    paddingTop: 12, paddingHorizontal: 16,
    borderTopWidth: 1, borderTopColor: '#e5e7eb',
  },
  payButton: { borderRadius: 12 },
});
