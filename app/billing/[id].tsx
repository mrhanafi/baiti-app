import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Platform, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Card, Divider, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PurpleHeader } from '@/components/purple-header';
import { TabletContainer } from '@/components/tablet-container';
import { apiDownload, apiFetch } from '@/lib/api/client';

// Cache the user-chosen save folder URI so we only ask once.
// Android SAF only — iOS has its own save-to-Files flow inside the share sheet.
const ANDROID_SAVE_DIR_KEY = 'baiti.billing.android_save_dir_uri';

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
  const { t } = useTranslation();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [paying, setPaying] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [saving, setSaving] = useState(false);

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
        Alert.alert(t('bills.paymentErrorTitle'), t('bills.paymentErrorBody'));
      }
    } catch (e: any) {
      Alert.alert(t('bills.paymentErrorTitle'), e?.message ?? t('bills.couldNotStartPayment'));
    }
    setPaying(false);
  }

  async function handleShareReceipt() {
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
          dialogTitle: t('bills.receiptDialogTitle', { number: invoice.invoice_number }),
          UTI: 'com.adobe.pdf',
        });
      } else {
        Alert.alert(t('bills.receiptDownloaded'), t('bills.savedTo', { path: localUri }));
      }
    } catch (e: any) {
      Alert.alert(t('bills.downloadFailed'), e?.message ?? t('bills.couldNotDownload'));
    }
    setDownloading(false);
  }

  /**
   * Android-only: save the PDF directly to a folder the user picks once
   * (usually Downloads). We persist the chosen folder URI so subsequent
   * saves skip the picker. Uses Storage Access Framework — required on
   * Android 10+ for writing outside the app's sandbox.
   */
  async function handleSaveToDownloads() {
    if (!invoice || Platform.OS !== 'android') return;
    setSaving(true);
    try {
      const filename = `Receipt-${invoice.invoice_number}.pdf`;
      const cacheUri = await apiDownload(`/api/v1/me/invoices/${invoice.id}/receipt`, filename);

      // Reuse the previously chosen folder if still valid
      let dirUri = await AsyncStorage.getItem(ANDROID_SAVE_DIR_KEY);
      if (dirUri) {
        try {
          await FileSystem.StorageAccessFramework.readDirectoryAsync(dirUri);
        } catch {
          dirUri = null;   // permission revoked or folder gone — re-ask
          await AsyncStorage.removeItem(ANDROID_SAVE_DIR_KEY);
        }
      }
      if (!dirUri) {
        const permission = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
        if (!permission.granted) {
          Alert.alert(t('bills.saveCancelled'), t('bills.noFolderSelected'));
          return;
        }
        dirUri = permission.directoryUri;
        await AsyncStorage.setItem(ANDROID_SAVE_DIR_KEY, dirUri);
      }

      // Create the destination file inside the chosen folder
      const destUri = await FileSystem.StorageAccessFramework.createFileAsync(
        dirUri,
        filename,
        'application/pdf',
      );

      // Copy cache file contents into destination
      const content = await FileSystem.readAsStringAsync(cacheUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      await FileSystem.writeAsStringAsync(destUri, content, {
        encoding: FileSystem.EncodingType.Base64,
      });

      Alert.alert(t('bills.saved'), t('bills.savedToFolder', { filename }));
    } catch (e: any) {
      Alert.alert(t('bills.saveFailed'), e?.message ?? t('bills.couldNotSave'));
    }
    setSaving(false);
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <PurpleHeader title={t('bills.invoice')} />
        <View style={styles.center}><ActivityIndicator /></View>
      </View>
    );
  }
  if (!invoice) {
    return (
      <View style={styles.container}>
        <PurpleHeader title={t('bills.invoice')} />
        <View style={styles.center}>
          <Text>{t('bills.invoiceNotFound')}</Text>
        </View>
      </View>
    );
  }

  const isPayable = invoice.status === 'issued' || invoice.status === 'overdue';
  // `label` values are i18n keys — render with t(sc.label).
  const statusColors: Record<string, { bg: string; fg: string; label: string }> = {
    issued: { bg: '#fef3c7', fg: '#92400e', label: 'status.unpaid' },
    overdue: { bg: '#fee2e2', fg: '#b91c1c', label: 'status.overdue' },
    paid: { bg: '#d1fae5', fg: '#065f46', label: 'status.paid' },
    cancelled: { bg: '#f3f4f6', fg: '#6b7280', label: 'status.cancelled' },
    draft: { bg: '#f3f4f6', fg: '#6b7280', label: 'status.draft' },
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
              <Text style={[styles.pillText, { color: sc.fg }]}>{t(sc.label)}</Text>
            </View>
            {invoice.status === 'overdue' ? (
              <Text style={styles.overdueText}>
                {t('bills.daysOverdue', { count: invoice.days_overdue })}
              </Text>
            ) : invoice.status === 'paid' && invoice.paid_at ? (
              <Text style={styles.paidText}>{t('bills.paidOn', { date: new Date(invoice.paid_at).toLocaleDateString() })}</Text>
            ) : (
              <Text style={styles.dueText}>{t('bills.due', { date: new Date(invoice.due_date).toLocaleDateString() })}</Text>
            )}
          </View>

          {/* Line items */}
          <Card style={styles.card}>
            <Card.Content>
              <Text style={styles.sectionTitle}>{t('bills.breakdown')}</Text>
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
                <Text style={styles.totalLabel}>{t('bills.total')}</Text>
                <Text style={styles.totalAmount}>RM {invoice.total.toFixed(2)}</Text>
              </View>
            </Card.Content>
          </Card>

          {/* Details */}
          <Card style={styles.card}>
            <Card.Content>
              <Text style={styles.sectionTitle}>{t('bills.details')}</Text>
              <DetailRow label={t('bills.issuedBy')} value={invoice.jmb_name ?? '—'} />
              <DetailRow label={t('bills.unit')} value={invoice.unit_number ?? '—'} />
              <DetailRow label={t('bills.issueDate')} value={new Date(invoice.issue_date).toLocaleDateString()} />
              <DetailRow label={t('bills.dueDate')} value={new Date(invoice.due_date).toLocaleDateString()} />
            </Card.Content>
          </Card>

          {/* Payments */}
          {invoice.payments.length > 0 ? (
            <Card style={styles.card}>
              <Card.Content>
                <Text style={styles.sectionTitle}>{t('bills.paymentHistory')}</Text>
                {invoice.payments.map((p, i) => (
                  <View key={i} style={styles.paymentRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.payMethod}>{p.gateway === 'manual' ? t('bills.offlineBankTransfer') : p.gateway.toUpperCase()}</Text>
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
            {t('bills.payAmount', { amount: invoice.total.toFixed(2) })}
          </Button>
        </View>
      ) : invoice.status === 'paid' ? (
        <View style={[styles.payBar, { paddingBottom: insets.bottom + 12 }]}>
          {Platform.OS === 'android' ? (
            <Button
              mode="contained"
              icon="download"
              loading={saving}
              disabled={saving || downloading}
              onPress={handleSaveToDownloads}
              style={styles.payButton}
              contentStyle={{ paddingVertical: 6 }}>
              {t('bills.saveToDownloads')}
            </Button>
          ) : null}
          <Button
            mode={Platform.OS === 'android' ? 'outlined' : 'contained'}
            icon={Platform.OS === 'android' ? 'share-variant' : 'download'}
            loading={downloading}
            disabled={downloading || saving}
            onPress={handleShareReceipt}
            style={[styles.payButton, Platform.OS === 'android' && { marginTop: 8 }]}
            contentStyle={{ paddingVertical: 6 }}>
            {Platform.OS === 'android' ? t('bills.share') : t('bills.downloadReceipt')}
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
