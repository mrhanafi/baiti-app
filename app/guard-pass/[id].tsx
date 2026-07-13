import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import {
  ActivityIndicator,
  Button,
  Card,
  Dialog,
  Icon,
  Portal,
  Text,
  TextInput,
} from 'react-native-paper';

import { PurpleHeader } from '@/components/purple-header';
import { ApiError, apiFetch } from '@/lib/api/client';

const PRIMARY = '#7367F0';
const PRIMARY_TINT = '#EEEDFD';

type VisitState = 'awaiting' | 'inside' | 'out' | 'upcoming' | 'expired' | 'cancelled';

type Pass = {
  id: string;
  visitor_name: string;
  visitor_phone: string | null;
  visitor_ic: string | null;
  purpose: string;
  vehicle_plate: string | null;
  valid_from: string;
  valid_until: string;
  status: 'active' | 'upcoming' | 'expired' | 'cancelled';
  visit_state: VisitState;
  open_entry: { visit_tag: string; scanned_at: string } | null;
  unit: { unit_number: string | null; property_name: string | null };
  host: { name: string | null; phone: string | null };
  renovation: { permit_no: number | null; contractor_name: string | null } | null;
};

const STATE_COLOR: Record<string, { bg: string; fg: string; label: string }> = {
  awaiting:  { bg: '#dcfce7', fg: '#15803d', label: 'guard.states.readyForEntry' },
  inside:    { bg: '#dbeafe', fg: '#1d4ed8', label: 'guard.states.inside' },
  out:       { bg: '#f3f4f6', fg: '#6b7280', label: 'guard.states.outComplete' },
  upcoming:  { bg: PRIMARY_TINT, fg: PRIMARY, label: 'guard.states.notYetValid' },
  expired:   { bg: '#f3f4f6', fg: '#6b7280', label: 'guard.states.expired' },
  cancelled: { bg: '#fee2e2', fg: '#b91c1c', label: 'guard.states.cancelledByHost' },
};

export default function GuardPassDetail() {
  const router = useRouter();
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [pass, setPass] = useState<Pass | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);

  const [tagOpen, setTagOpen] = useState(false);
  const [tag, setTag] = useState('');

  const [denyOpen, setDenyOpen] = useState(false);
  const [denyReason, setDenyReason] = useState('');

  const load = useCallback(async () => {
    try {
      const data = await apiFetch(`/api/v1/guard/passes/${id}`);
      setPass(data.pass);
    } catch {
      setPass(null);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function handleApprove() {
    if (!tag.trim()) return;
    setActing(true);
    try {
      const data = await apiFetch(`/api/v1/guard/passes/${id}/approve`, {
        method: 'POST',
        body: JSON.stringify({ visit_tag: tag.trim() }),
      });
      setTagOpen(false);
      setTag('');
      setPass(data.pass);
      Alert.alert(t('guard.pass.entryApproved'), t('guard.pass.entryApprovedBody', { name: pass?.visitor_name, tag: data.entry.visit_tag }), [
        { text: t('guard.ok'), onPress: () => router.back() },
      ]);
    } catch (err) {
      const msg = err instanceof ApiError ? (err.body?.errors?.pass?.[0] ?? err.body?.errors?.visit_tag?.[0] ?? err.message) : t('guard.pass.couldNotApprove');
      Alert.alert(t('guard.pass.approveFailed'), msg);
    }
    setActing(false);
  }

  async function handleExit() {
    setActing(true);
    try {
      const data = await apiFetch(`/api/v1/guard/passes/${id}/exit`, { method: 'POST' });
      setPass(data.pass);
      Alert.alert(t('guard.pass.exitRecorded'), t('guard.pass.exitRecordedBody', { name: pass?.visitor_name }), [
        { text: t('guard.ok'), onPress: () => router.back() },
      ]);
    } catch (err) {
      const msg = err instanceof ApiError ? (err.body?.errors?.pass?.[0] ?? err.message) : t('guard.pass.couldNotMarkExit');
      Alert.alert(t('guard.pass.exitFailed'), msg);
    }
    setActing(false);
  }

  async function handleDeny() {
    if (!denyReason.trim()) return;
    setActing(true);
    try {
      await apiFetch(`/api/v1/guard/passes/${id}/deny`, {
        method: 'POST',
        body: JSON.stringify({ reason: denyReason.trim() }),
      });
      setDenyOpen(false);
      Alert.alert(t('guard.pass.entryDenied'), t('guard.pass.hostNotified'), [
        { text: t('guard.ok'), onPress: () => router.back() },
      ]);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : t('guard.pass.couldNotDeny');
      Alert.alert(t('guard.pass.denyFailed'), msg);
    }
    setActing(false);
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <PurpleHeader title={t('guard.pass.title')} />
        <View style={styles.center}><ActivityIndicator /></View>
      </View>
    );
  }
  if (!pass) {
    return (
      <View style={styles.container}>
        <PurpleHeader title={t('guard.pass.title')} />
        <View style={styles.center}>
          <Icon source="alert-circle-outline" size={48} color="#9ca3af" />
          <Text style={{ marginTop: 12, opacity: 0.7 }}>{t('guard.pass.notFound')}</Text>
          <Button onPress={() => router.back()} style={{ marginTop: 16 }}>{t('common.goBack')}</Button>
        </View>
      </View>
    );
  }

  const isActive = pass.status === 'active';
  const state = pass.visit_state;
  const stateMeta = STATE_COLOR[state] ?? STATE_COLOR.expired;
  const insideSince = pass.open_entry ? new Date(pass.open_entry.scanned_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null;

  return (
    <View style={styles.container}>
      <PurpleHeader title={t('guard.pass.verifyVisitor')} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Card style={styles.card}>
          <Card.Content style={{ alignItems: 'center' }}>
            <View style={[styles.statusPill, { backgroundColor: stateMeta.bg }]}>
              <Text style={[styles.statusText, { color: stateMeta.fg }]}>{t(stateMeta.label)}</Text>
            </View>
            <Text variant="headlineSmall" style={styles.visitorName}>{pass.visitor_name}</Text>
            <Text variant="bodyMedium" style={styles.subline}>
              {t(`guard.purposes.${pass.purpose}`, { defaultValue: pass.purpose.charAt(0).toUpperCase() + pass.purpose.slice(1) })}
              {pass.vehicle_plate ? `  ·  ${pass.vehicle_plate}` : ''}
            </Text>

            {pass.renovation ? (
              <View style={styles.renoBanner}>
                <Icon source="hammer" size={18} color="#92400e" />
                <Text style={styles.renoBannerText}>
                  {t('guard.pass.renovationBanner', { permitNo: pass.renovation.permit_no })}
                  {pass.renovation.contractor_name ? ` (${pass.renovation.contractor_name})` : ''}
                </Text>
              </View>
            ) : null}

            {state === 'inside' && pass.open_entry ? (
              <View style={styles.insideBanner}>
                <Icon source="account-check" size={20} color="#1d4ed8" />
                <Text style={styles.insideBannerText}>
                  {t('guard.pass.insideSince', { time: insideSince })} <Text style={styles.tag}>{pass.open_entry.visit_tag}</Text>
                </Text>
              </View>
            ) : null}
          </Card.Content>
        </Card>

        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleSmall" style={styles.sectionTitle}>{t('guard.pass.passDetails')}</Text>
            <Row label={t('guard.pass.unit')} value={`${pass.unit.unit_number}\n${pass.unit.property_name ?? ''}`} />
            <Row label={t('guard.pass.host')} value={`${pass.host.name ?? '—'}${pass.host.phone ? `\n${pass.host.phone}` : ''}`} />
            {pass.visitor_phone ? <Row label={t('guard.pass.phone')} value={pass.visitor_phone} /> : null}
            {pass.visitor_ic ? <Row label={t('guard.pass.ic')} value={pass.visitor_ic} /> : null}
            <Row label={t('guard.pass.validFrom')} value={new Date(pass.valid_from).toLocaleString()} />
            <Row label={t('guard.pass.validUntil')} value={new Date(pass.valid_until).toLocaleString()} />
          </Card.Content>
        </Card>

        {isActive && state === 'inside' ? (
          <Button
            mode="contained"
            icon="logout"
            onPress={handleExit}
            loading={acting}
            disabled={acting}
            style={[styles.action, { backgroundColor: '#1d4ed8' }]}
            contentStyle={styles.actionContent}>
            {t('guard.pass.markExit')}
          </Button>
        ) : isActive ? (
          <>
            <Button
              mode="contained"
              icon="check-bold"
              onPress={() => setTagOpen(true)}
              disabled={acting}
              style={[styles.action, { backgroundColor: '#22c55e' }]}
              contentStyle={styles.actionContent}>
              {state === 'out' ? t('guard.pass.approveReentry') : t('guard.pass.approveEntry')}
            </Button>
            <Button
              mode="outlined"
              icon="close-thick"
              onPress={() => setDenyOpen(true)}
              disabled={acting}
              textColor="#ef4444"
              style={styles.action}
              contentStyle={styles.actionContent}>
              {t('guard.pass.deny')}
            </Button>
          </>
        ) : (
          <Card style={[styles.card, { backgroundColor: '#fef3c7' }]}>
            <Card.Content>
              <Text variant="bodyMedium" style={{ color: '#92400e' }}>
                {pass.status === 'cancelled'
                  ? t('guard.pass.cancelledByHostNotice')
                  : pass.status === 'expired'
                    ? t('guard.pass.expiredNotice')
                    : t('guard.pass.notYetValidNotice')}
              </Text>
            </Card.Content>
          </Card>
        )}
      </ScrollView>

      {/* Approve entry — tag input dialog */}
      <Portal>
        <Dialog visible={tagOpen} onDismiss={() => !acting && setTagOpen(false)}>
          <Dialog.Title>{t('guard.pass.visitorTag')}</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium" style={{ marginBottom: 8 }}>
              {t('guard.pass.tagHint', { name: pass.visitor_name })}
            </Text>
            <TextInput
              value={tag}
              onChangeText={setTag}
              mode="outlined"
              placeholder={t('guard.pass.tagPlaceholder')}
              autoCapitalize="characters"
              autoFocus
              maxLength={20}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setTagOpen(false)} disabled={acting}>{t('common.cancel')}</Button>
            <Button onPress={handleApprove} loading={acting} disabled={acting || !tag.trim()}>
              {t('guard.pass.approveEntry')}
            </Button>
          </Dialog.Actions>
        </Dialog>

        {/* Deny — reason dialog */}
        <Dialog visible={denyOpen} onDismiss={() => !acting && setDenyOpen(false)}>
          <Dialog.Title>{t('guard.pass.denyEntry')}</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium" style={{ marginBottom: 8 }}>
              {t('guard.pass.denyReasonHint')}
            </Text>
            <TextInput
              value={denyReason}
              onChangeText={setDenyReason}
              mode="outlined"
              placeholder={t('guard.pass.denyPlaceholder')}
              multiline
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setDenyOpen(false)} disabled={acting}>{t('common.cancel')}</Button>
            <Button onPress={handleDeny} loading={acting} disabled={acting || !denyReason.trim()} textColor="#ef4444">
              {t('guard.pass.denyEntry')}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
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

  card: { marginBottom: 12 },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  statusText: { fontSize: 11, fontWeight: '700' },
  visitorName: { fontWeight: '700', marginTop: 8, textAlign: 'center' },
  subline: { opacity: 0.65, marginTop: 4, textAlign: 'center' },

  renoBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#fef3c7', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 8, marginTop: 10,
  },
  renoBannerText: { color: '#92400e', fontWeight: '600', fontSize: 13, flex: 1 },

  insideBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: '#dbeafe',
  },
  insideBannerText: { color: '#1e3a8a', fontSize: 13 },
  tag: { fontWeight: '700' },

  sectionTitle: { fontWeight: '600', marginBottom: 12 },
  row: { flexDirection: 'row', paddingVertical: 6, gap: 12 },
  rowLabel: { width: 90, opacity: 0.55 },
  rowValue: { flex: 1, fontWeight: '500' },

  action: { marginTop: 8 },
  actionContent: { paddingVertical: 6 },
});
