import * as FileSystem from 'expo-file-system/legacy';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useCallback, useEffect, useState } from 'react';
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
        Alert.alert('Sharing unavailable on this device.');
      } else {
        await Sharing.shareAsync(result.uri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Send visitor pass',
        });
      }
    } catch {
      Alert.alert('Could not download the PDF. Check your connection.');
    }
    setPdfLoading(false);
  }

  async function handleCancel() {
    if (!pass) return;
    Alert.alert(
      'Cancel this pass?',
      `${pass.visitor_name} won't be able to enter using this pass.`,
      [
        { text: 'Keep pass', style: 'cancel' },
        {
          text: 'Cancel pass',
          style: 'destructive',
          onPress: async () => {
            setCancelLoading(true);
            try {
              const data = await apiFetch(`/api/v1/me/visitor-passes/${id}/cancel`, { method: 'POST' });
              setPass(data.pass);
            } catch (err) {
              const msg = err instanceof ApiError ? err.message : 'Could not cancel.';
              Alert.alert('Cancel failed', msg);
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
        <PurpleHeader title="Visitor pass" />
        <View style={styles.center}><ActivityIndicator /></View>
      </View>
    );
  }
  if (!pass) {
    return (
      <View style={styles.container}>
        <PurpleHeader title="Visitor pass" />
        <View style={styles.center}>
          <Icon source="alert-circle-outline" size={48} color="#9ca3af" />
          <Text style={{ marginTop: 12, opacity: 0.7 }}>Pass not found.</Text>
          <Button onPress={() => router.back()} style={{ marginTop: 16 }}>Go back</Button>
        </View>
      </View>
    );
  }

  const canCancel = pass.status === 'active' || pass.status === 'upcoming';
  const showQr = pass.status === 'active' || pass.status === 'upcoming';

  return (
    <View style={styles.container}>
      <PurpleHeader title="Visitor pass" />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Card style={styles.card}>
          <Card.Content style={{ alignItems: 'center' }}>
            <View style={[styles.statusPill, { backgroundColor: STATUS_COLOR[pass.status].bg }]}>
              <Text style={[styles.statusText, { color: STATUS_COLOR[pass.status].fg }]}>
                {pass.status}
              </Text>
            </View>
            <Text variant="headlineSmall" style={styles.visitorName}>{pass.visitor_name}</Text>
            <Text variant="bodyMedium" style={styles.purposeLine}>
              {pass.purpose.charAt(0).toUpperCase() + pass.purpose.slice(1)}
              {pass.vehicle_plate ? `  ·  ${pass.vehicle_plate}` : ''}
            </Text>

            {showQr ? (
              <View style={styles.qrWrap}>
                <QRCode value={pass.qr_token} size={200} backgroundColor="#fff" />
                <Text variant="bodySmall" style={styles.qrHint}>
                  Show this at the guard post.
                </Text>
              </View>
            ) : (
              <View style={styles.qrPlaceholder}>
                <Icon source="qrcode-remove" size={48} color="#9ca3af" />
                <Text variant="bodySmall" style={{ opacity: 0.5, marginTop: 8 }}>
                  {pass.status === 'cancelled' ? 'Pass cancelled.' : 'Pass expired.'}
                </Text>
              </View>
            )}
          </Card.Content>
        </Card>

        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleSmall" style={styles.sectionTitle}>Pass details</Text>
            <Row label="Going to" value={`Unit ${pass.unit.unit_number}\n${pass.unit.property_name ?? ''}`} />
            <Row label="Valid from" value={new Date(pass.valid_from).toLocaleString()} />
            <Row label="Valid until" value={new Date(pass.valid_until).toLocaleString()} />
            {pass.visitor_phone ? <Row label="Phone" value={pass.visitor_phone} /> : null}
            {pass.visitor_ic ? <Row label="IC" value={pass.visitor_ic} /> : null}
            {pass.organization.legal_name ? <Row label="JMB" value={pass.organization.legal_name} /> : null}
          </Card.Content>
        </Card>

        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleSmall" style={styles.sectionTitle}>Visit history</Text>
            {pass.entries.length === 0 ? (
              <Text variant="bodySmall" style={{ opacity: 0.5 }}>
                No visits yet. The guard will scan this pass when your visitor arrives.
              </Text>
            ) : (
              pass.entries.map((e, i) => {
                const label = e.decision === 'denied'
                  ? 'Denied entry'
                  : e.kind === 'entry'
                    ? 'Entered'
                    : 'Exited';
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
                          {label}{e.visit_tag ? `  ·  tag ${e.visit_tag}` : ''}
                        </Text>
                        <Text variant="bodySmall" style={{ opacity: 0.65 }}>
                          {new Date(e.scanned_at).toLocaleString()}
                          {e.scanned_by ? ` · by ${e.scanned_by}` : ''}
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
            Share as PDF
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
            Cancel pass
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
