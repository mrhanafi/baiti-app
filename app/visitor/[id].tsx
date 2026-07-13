import * as FileSystem from 'expo-file-system/legacy';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Card, Divider, Icon, Text } from 'react-native-paper';
import QRCode from 'react-native-qrcode-svg';

import { PurpleHeader } from '@/components/purple-header';
import { ApiError, apiFetch } from '@/lib/api/client';
import { getToken } from '@/lib/auth/storage';

const PRIMARY = '#7367F0';
const PRIMARY_TINT = '#EEEDFD';
const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8123';

type Entry = {
  id: string;
  scanned_at: string;
  kind: 'entry' | 'exit';
  visit_tag: string | null;
  decision: 'approved' | 'denied';
  denial_reason: string | null;
  scanned_by: string | null;
};

type Pass = {
  id: string;
  visitor_name: string;
  visitor_phone: string | null;
  visitor_ic: string | null;
  purpose: string;
  vehicle_plate: string | null;
  valid_from: string;
  valid_until: string;
  qr_token: string;
  status: 'active' | 'upcoming' | 'expired' | 'cancelled';
  visit_state: 'awaiting' | 'inside' | 'out' | 'upcoming' | 'expired' | 'cancelled';
  cancelled_at: string | null;
  open_entry: { visit_tag: string; scanned_at: string } | null;
  unit: { unit_number: string | null; property_name: string | null };
  organization: { legal_name: string | null };
  entries: Entry[];
};

const STATUS_COLOR: Record<string, { bg: string; fg: string }> = {
  active: { bg: '#dcfce7', fg: '#15803d' },
  upcoming: { bg: PRIMARY_TINT, fg: PRIMARY },
  expired: { bg: '#f3f4f6', fg: '#6b7280' },
  cancelled: { bg: '#fee2e2', fg: '#b91c1c' },
};

export default function VisitorPassDetailScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [pass, setPass] = useState<Pass | null>(null);
  const [loading, setLoading] = useState(true);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch(`/api/v1/me/visitor-passes/${id}`);
      setPass(data.pass);
    } catch {
      setPass(null);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSharePdf() {
    if (!pass) return;
    setPdfLoading(true);
    try {
      const token = await getToken();
      const target = `${FileSystem.cacheDirectory}visitor-pass-${pass.id}.pdf`;
      const result = await FileSystem.downloadAsync(
        `${BASE_URL}/api/v1/me/visitor-passes/${pass.id}/pdf`,
        target,
        { headers: token ? { Authorization: `Bearer ${token}` } : {} },
      );
      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert(t('visitor.detail.sharingUnavailable'));
      } else {
        await Sharing.shareAsync(result.uri, {
          mimeType: 'application/pdf',
          dialogTitle: t('visitor.detail.shareDialogTitle'),
        });
      }
    } catch {
      Alert.alert(t('visitor.detail.pdfError'));
    }
    setPdfLoading(false);
  }

  async function handleCancel() {
    if (!pass) return;
    Alert.alert(
      t('visitor.detail.cancelTitle'),
      t('visitor.detail.cancelMessage', { name: pass.visitor_name }),
      [
        { text: t('visitor.detail.keepPass'), style: 'cancel' },
        {
          text: t('visitor.detail.cancelPass'),
          style: 'destructive',
          onPress: async () => {
            setCancelLoading(true);
            try {
              const data = await apiFetch(`/api/v1/me/visitor-passes/${id}/cancel`, { method: 'POST' });
              setPass(data.pass);
            } catch (err) {
              const msg = err instanceof ApiError ? err.message : t('visitor.detail.couldNotCancel');
              Alert.alert(t('visitor.detail.cancelFailed'), msg);
            }
            setCancelLoading(false);
          },
        },
      ],
    );
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <PurpleHeader title={t('visitor.detail.title')} />
        <View style={styles.center}><ActivityIndicator /></View>
      </View>
    );
  }
  if (!pass) {
    return (
      <View style={styles.container}>
        <PurpleHeader title={t('visitor.detail.title')} />
        <View style={styles.center}>
          <Icon source="alert-circle-outline" size={48} color="#9ca3af" />
          <Text style={{ marginTop: 12, opacity: 0.7 }}>{t('visitor.detail.notFound')}</Text>
          <Button onPress={() => router.back()} style={{ marginTop: 16 }}>{t('common.goBack')}</Button>
        </View>
      </View>
    );
  }

  const canCancel = pass.status === 'active' || pass.status === 'upcoming';
  const showQr = pass.status === 'active' || pass.status === 'upcoming';

  return (
    <View style={styles.container}>
      <PurpleHeader title={t('visitor.detail.title')} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Card style={styles.card}>
          <Card.Content style={{ alignItems: 'center' }}>
            <View style={[styles.statusPill, { backgroundColor: STATUS_COLOR[pass.status].bg }]}>
              <Text style={[styles.statusText, { color: STATUS_COLOR[pass.status].fg }]}>
                {t(`visitor.status.${pass.status}`, { defaultValue: pass.status })}
              </Text>
            </View>
            <Text variant="headlineSmall" style={styles.visitorName}>{pass.visitor_name}</Text>
            <Text variant="bodyMedium" style={styles.purposeLine}>
              {t(`visitor.purposes.${pass.purpose}`, {
                defaultValue: pass.purpose.charAt(0).toUpperCase() + pass.purpose.slice(1),
              })}
              {pass.vehicle_plate ? `  ·  ${pass.vehicle_plate}` : ''}
            </Text>

            {showQr ? (
              <View style={styles.qrWrap}>
                <QRCode value={pass.qr_token} size={200} backgroundColor="#fff" />
                <Text variant="bodySmall" style={styles.qrHint}>
                  {t('visitor.detail.qrHint')}
                </Text>
              </View>
            ) : (
              <View style={styles.qrPlaceholder}>
                <Icon source="qrcode-remove" size={48} color="#9ca3af" />
                <Text variant="bodySmall" style={{ opacity: 0.5, marginTop: 8 }}>
                  {pass.status === 'cancelled'
                    ? t('visitor.detail.passCancelled')
                    : t('visitor.detail.passExpired')}
                </Text>
              </View>
            )}
          </Card.Content>
        </Card>

        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleSmall" style={styles.sectionTitle}>{t('visitor.detail.passDetails')}</Text>
            <Row
              label={t('visitor.detail.goingTo')}
              value={`${t('common.unit', { number: pass.unit.unit_number })}\n${pass.unit.property_name ?? ''}`}
            />
            <Row label={t('visitor.detail.validFrom')} value={new Date(pass.valid_from).toLocaleString()} />
            <Row label={t('visitor.detail.validUntil')} value={new Date(pass.valid_until).toLocaleString()} />
            {pass.visitor_phone ? <Row label={t('visitor.detail.phone')} value={pass.visitor_phone} /> : null}
            {pass.visitor_ic ? <Row label={t('visitor.detail.ic')} value={pass.visitor_ic} /> : null}
            {pass.organization.legal_name ? <Row label={t('visitor.detail.jmb')} value={pass.organization.legal_name} /> : null}
          </Card.Content>
        </Card>

        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleSmall" style={styles.sectionTitle}>{t('visitor.detail.visitHistory')}</Text>
            {pass.entries.length === 0 ? (
              <Text variant="bodySmall" style={{ opacity: 0.5 }}>
                {t('visitor.detail.noVisits')}
              </Text>
            ) : (
              pass.entries.map((e, i) => {
                const label = e.decision === 'denied'
                  ? t('visitor.detail.deniedEntry')
                  : e.kind === 'entry'
                    ? t('visitor.detail.entered')
                    : t('visitor.detail.exited');
                const icon = e.decision === 'denied'
                  ? 'close-circle'
                  : e.kind === 'entry'
                    ? 'login'
                    : 'logout';
                const color = e.decision === 'denied'
                  ? '#ef4444'
                  : e.kind === 'entry'
                    ? '#22c55e'
                    : '#1d4ed8';
                return (
                  <View key={e.id}>
                    {i > 0 ? <Divider style={{ marginVertical: 8 }} /> : null}
                    <View style={styles.entryRow}>
                      <Icon source={icon} size={22} color={color} />
                      <View style={{ flex: 1, marginLeft: 8 }}>
                        <Text variant="bodyMedium" style={{ fontWeight: '600' }}>
                          {label}{e.visit_tag ? `  ·  ${t('visitor.detail.visitTag', { tag: e.visit_tag })}` : ''}
                        </Text>
                        <Text variant="bodySmall" style={{ opacity: 0.65 }}>
                          {new Date(e.scanned_at).toLocaleString()}
                          {e.scanned_by ? ` · ${t('visitor.detail.scannedBy', { name: e.scanned_by })}` : ''}
                        </Text>
                        {e.denial_reason ? (
                          <Text variant="bodySmall" style={{ color: '#b91c1c', marginTop: 2 }}>
                            {e.denial_reason}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                  </View>
                );
              })
            )}
          </Card.Content>
        </Card>

        {showQr ? (
          <Button
            mode="contained"
            icon="share-variant"
            onPress={handleSharePdf}
            loading={pdfLoading}
            disabled={pdfLoading}
            style={styles.action}
            contentStyle={styles.actionContent}>
            {t('visitor.detail.shareAsPdf')}
          </Button>
        ) : null}

        {canCancel ? (
          <Button
            mode="outlined"
            icon="cancel"
            onPress={handleCancel}
            loading={cancelLoading}
            disabled={cancelLoading}
            textColor="#b91c1c"
            style={styles.action}>
            {t('visitor.detail.cancelPass')}
          </Button>
        ) : null}
      </ScrollView>
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text variant="bodySmall" style={styles.rowLabel}>{label}</Text>
      <Text variant="bodyMedium" style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },

  card: { marginBottom: 16 },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, marginTop: 4 },
  statusText: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  visitorName: { fontWeight: '700', marginTop: 8, textAlign: 'center' },
  purposeLine: { opacity: 0.65, marginTop: 4, textAlign: 'center' },

  qrWrap: { marginTop: 20, alignItems: 'center' },
  qrHint: { marginTop: 12, opacity: 0.55, textAlign: 'center' },
  qrPlaceholder: { marginTop: 20, alignItems: 'center' },

  sectionTitle: { fontWeight: '600', marginBottom: 12 },
  row: { flexDirection: 'row', paddingVertical: 6, gap: 12 },
  rowLabel: { width: 90, opacity: 0.55 },
  rowValue: { flex: 1, fontWeight: '500' },

  entryRow: { flexDirection: 'row', alignItems: 'flex-start' },

  action: { marginTop: 4, marginBottom: 8 },
  actionContent: { paddingVertical: 6 },
});
