import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Card, Icon, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PurpleHeader } from '@/components/purple-header';
import { TabletContainer } from '@/components/tablet-container';
import { apiFetch } from '@/lib/api/client';
import { PERMIT_STATUS, type Permit } from './index';

const PRIMARY = '#7367F0';
const PRIMARY_TINT = '#EEEDFD';

export default function RenovationDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [permit, setPermit] = useState<Permit | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch(`/api/v1/me/renovation-permits/${id}`);
      setPermit(data.permit);
    } catch {
      setPermit(null);
    }
    setLoading(false);
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (loading) {
    return (
      <View style={styles.container}>
        <PurpleHeader title={t('renovation.permitTitle')} />
        <View style={styles.center}><ActivityIndicator /></View>
      </View>
    );
  }
  if (!permit) {
    return (
      <View style={styles.container}>
        <PurpleHeader title={t('renovation.permitTitle')} />
        <View style={styles.center}>
          <Icon source="alert-circle-outline" size={48} color="#9ca3af" />
          <Text style={{ marginTop: 12, opacity: 0.7 }}>{t('renovation.notFound')}</Text>
          <Button onPress={() => router.back()} style={{ marginTop: 16 }}>{t('common.goBack')}</Button>
        </View>
      </View>
    );
  }

  const s = PERMIT_STATUS[permit.status] ?? PERMIT_STATUS.pending;

  return (
    <View style={styles.container}>
      <PurpleHeader title={t('renovation.permitTitle')} />
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}>
       <TabletContainer>

        <Card style={styles.card}>
          <Card.Content>
            <View style={styles.titleRow}>
              <Text variant="titleLarge" style={styles.title}>{t('common.unit', { number: permit.unit_number })}</Text>
              <View style={[styles.statusPill, { backgroundColor: s.bg }]}>
                <Text style={[styles.statusText, { color: s.fg }]}>{t(s.label)}</Text>
              </View>
            </View>
            <Text variant="bodySmall" style={styles.meta}>
              {permit.organization.legal_name}
            </Text>
            <Text variant="bodyMedium" style={styles.body}>{permit.description}</Text>
            <Text variant="bodySmall" style={styles.meta}>
              {new Date(permit.date_from).toLocaleDateString()} – {new Date(permit.date_to).toLocaleDateString()}
              {' · '}{permit.contractor_name}
            </Text>
          </Card.Content>
        </Card>

        {/* Status-specific guidance */}
        {permit.status === 'pending' ? (
          <View style={styles.notice}>
            <Icon source="clock-outline" size={18} color="#92400e" />
            <Text variant="bodySmall" style={[styles.noticeText, { color: '#92400e' }]}>
              {t('renovation.pendingNotice')}
            </Text>
          </View>
        ) : null}

        {permit.status === 'approved' && permit.deposit_amount !== null ? (
          <Card style={[styles.card, { backgroundColor: '#eff6ff' }]}>
            <Card.Content>
              <Text variant="titleSmall" style={{ fontWeight: '700', color: '#1d4ed8' }}>
                {t('renovation.depositRequired', { amount: permit.deposit_amount.toFixed(2) })}
              </Text>
              <Text variant="bodySmall" style={{ marginTop: 4, opacity: 0.75 }}>
                {t('renovation.depositInstructions')}
              </Text>
              {permit.notes ? (
                <Text variant="bodySmall" style={{ marginTop: 8, fontStyle: 'italic', opacity: 0.75 }}>
                  {t('renovation.jmbNotes', { notes: permit.notes })}
                </Text>
              ) : null}
            </Card.Content>
          </Card>
        ) : null}

        {permit.status === 'rejected' ? (
          <Card style={[styles.card, { backgroundColor: '#fef2f2' }]}>
            <Card.Content>
              <Text variant="titleSmall" style={{ fontWeight: '700', color: '#b91c1c' }}>
                {t('renovation.requestRejected')}
              </Text>
              {permit.notes ? (
                <Text variant="bodySmall" style={{ marginTop: 4, opacity: 0.75 }}>
                  {t('renovation.reason', { reason: permit.notes })}
                </Text>
              ) : null}
            </Card.Content>
          </Card>
        ) : null}

        {permit.status === 'active' ? (
          <Card style={[styles.card, { backgroundColor: PRIMARY_TINT }]}>
            <Card.Content>
              <Text variant="titleSmall" style={{ fontWeight: '700', color: PRIMARY }}>
                {t('renovation.activeDepositHeld', { amount: permit.deposit_amount?.toFixed(2) })}
              </Text>
              <Text variant="bodySmall" style={{ marginTop: 4, opacity: 0.75 }}>
                {t('renovation.activeHint')}
              </Text>
              <Button
                mode="contained"
                icon="qrcode"
                onPress={() => router.push('/visitor/new')}
                style={{ marginTop: 12 }}>
                {t('renovation.createContractorPass')}
              </Button>
            </Card.Content>
          </Card>
        ) : null}

        {permit.status === 'closed' ? (
          <Card style={styles.card}>
            <Card.Content>
              <Text variant="titleSmall" style={{ fontWeight: '700' }}>
                {t('renovation.permitClosed')}
              </Text>
              <Text variant="bodySmall" style={{ marginTop: 4, opacity: 0.75 }}>
                {permit.deposit_status === 'refunded'
                  ? t('renovation.depositRefunded', { amount: permit.deposit_amount?.toFixed(2) })
                  : permit.deposit_status === 'partially_refunded'
                    ? t('renovation.depositPartiallyRefunded', {
                        refund: permit.refund_amount?.toFixed(2),
                        amount: permit.deposit_amount?.toFixed(2),
                      })
                    : t('renovation.depositForfeited', { amount: permit.deposit_amount?.toFixed(2) })}
              </Text>
              {permit.notes && permit.deposit_status !== 'refunded' ? (
                <Text variant="bodySmall" style={{ marginTop: 8, fontStyle: 'italic', opacity: 0.75 }}>
                  {t('renovation.reason', { reason: permit.notes })}
                </Text>
              ) : null}
            </Card.Content>
          </Card>
        ) : null}
       </TabletContainer>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  scroll: { padding: 16 },

  card: { marginBottom: 12 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  title: { flex: 1, fontWeight: '700' },
  meta: { opacity: 0.65, marginTop: 4 },
  body: { lineHeight: 22, marginTop: 8, marginBottom: 4 },

  statusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  statusText: { fontSize: 11, fontWeight: '600' },

  notice: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#fef3c7', borderRadius: 10,
    paddingVertical: 12, paddingHorizontal: 14, marginBottom: 12,
  },
  noticeText: { flex: 1 },
});
