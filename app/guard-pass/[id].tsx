import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
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
};

const STATE_COLOR: Record<string, { bg: string; fg: string; label: string }> = {
  awaiting:  { bg: '#dcfce7', fg: '#15803d', label: 'Ready for entry' },
  inside:    { bg: '#dbeafe', fg: '#1d4ed8', label: 'Inside' },
  out:       { bg: '#f3f4f6', fg: '#6b7280', label: 'Out (visit complete)' },
  upcoming:  { bg: PRIMARY_TINT, fg: PRIMARY, label: 'Not yet valid' },
  expired:   { bg: '#f3f4f6', fg: '#6b7280', label: 'Expired' },
  cancelled: { bg: '#fee2e2', fg: '#b91c1c', label: 'Cancelled by host' },
};

export default function GuardPassDetail() {
  const router = useRouter();
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
      Alert.alert('Entry approved', `${pass?.visitor_name} can enter. Tag ${data.entry.visit_tag} recorded.`, [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (err) {
      const msg = err instanceof ApiError ? (err.body?.errors?.pass?.[0] ?? err.body?.errors?.visit_tag?.[0] ?? err.message) : 'Could not approve.';
      Alert.alert('Approve failed', msg);
    }
    setActing(false);
  }

  async function handleExit() {
    setActing(true);
    try {
      const data = await apiFetch(`/api/v1/guard/passes/${id}/exit`, { method: 'POST' });
      setPass(data.pass);
      Alert.alert('Exit recorded', `${pass?.visitor_name} has left.`, [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (err) {
      const msg = err instanceof ApiError ? (err.body?.errors?.pass?.[0] ?? err.message) : 'Could not mark exit.';
      Alert.alert('Exit failed', msg);
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
      Alert.alert('Entry denied', 'The host has been notified.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Could not deny.';
      Alert.alert('Deny failed', msg);
    }
    setActing(false);
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

  const isActive = pass.status === 'active';
  const state = pass.visit_state;
  const stateMeta = STATE_COLOR[state] ?? STATE_COLOR.expired;
  const insideSince = pass.open_entry ? new Date(pass.open_entry.scanned_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null;

  return (
    <View style={styles.container}>
      <PurpleHeader title="Verify visitor" />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Card style={styles.card}>
          <Card.Content style={{ alignItems: 'center' }}>
            <View style={[styles.statusPill, { backgroundColor: stateMeta.bg }]}>
              <Text style={[styles.statusText, { color: stateMeta.fg }]}>{stateMeta.label}</Text>
            </View>
            <Text variant="headlineSmall" style={styles.visitorName}>{pass.visitor_name}</Text>
            <Text variant="bodyMedium" style={styles.subline}>
              {pass.purpose.charAt(0).toUpperCase() + pass.purpose.slice(1)}
              {pass.vehicle_plate ? `  ·  ${pass.vehicle_plate}` : ''}
            </Text>

            {state === 'inside' && pass.open_entry ? (
              <View style={styles.insideBanner}>
                <Icon source="account-check" size={20} color="#1d4ed8" />
                <Text style={styles.insideBannerText}>
                  Inside since {insideSince} · tag <Text style={styles.tag}>{pass.open_entry.visit_tag}</Text>
                </Text>
              </View>
            ) : null}
          </Card.Content>
        </Card>

        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleSmall" style={styles.sectionTitle}>Pass details</Text>
            <Row label="Unit" value={`${pass.unit.unit_number}\n${pass.unit.property_name ?? ''}`} />
            <Row label="Host" value={`${pass.host.name ?? '—'}${pass.host.phone ? `\n${pass.host.phone}` : ''}`} />
            {pass.visitor_phone ? <Row label="Phone" value={pass.visitor_phone} /> : null}
            {pass.visitor_ic ? <Row label="IC" value={pass.visitor_ic} /> : null}
            <Row label="Valid from" value={new Date(pass.valid_from).toLocaleString()} />
            <Row label="Valid until" value={new Date(pass.valid_until).toLocaleString()} />
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
            Mark exit
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
              {state === 'out' ? 'Approve re-entry' : 'Approve entry'}
            </Button>
            <Button
              mode="outlined"
              icon="close-thick"
              onPress={() => setDenyOpen(true)}
              disabled={acting}
              textColor="#ef4444"
              style={styles.action}
              contentStyle={styles.actionContent}>
              Deny
            </Button>
          </>
        ) : (
          <Card style={[styles.card, { backgroundColor: '#fef3c7' }]}>
            <Card.Content>
              <Text variant="bodyMedium" style={{ color: '#92400e' }}>
                {pass.status === 'cancelled'
                  ? 'This pass was cancelled by the host.'
                  : pass.status === 'expired'
                    ? 'This pass has expired.'
                    : 'This pass is not yet valid.'}
              </Text>
            </Card.Content>
          </Card>
        )}
      </ScrollView>

      {/* Approve entry — tag input dialog */}
      <Portal>
        <Dialog visible={tagOpen} onDismiss={() => !acting && setTagOpen(false)}>
          <Dialog.Title>Visitor tag</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium" style={{ marginBottom: 8 }}>
              Type the number from the physical visitor card you're giving to {pass.visitor_name}.
            </Text>
            <TextInput
              value={tag}
              onChangeText={setTag}
              mode="outlined"
              placeholder="e.g. 042"
              autoCapitalize="characters"
              autoFocus
              maxLength={20}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setTagOpen(false)} disabled={acting}>Cancel</Button>
            <Button onPress={handleApprove} loading={acting} disabled={acting || !tag.trim()}>
              Approve entry
            </Button>
          </Dialog.Actions>
        </Dialog>

        {/* Deny — reason dialog */}
        <Dialog visible={denyOpen} onDismiss={() => !acting && setDenyOpen(false)}>
          <Dialog.Title>Deny entry</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium" style={{ marginBottom: 8 }}>
              Reason (visible to the host):
            </Text>
            <TextInput
              value={denyReason}
              onChangeText={setDenyReason}
              mode="outlined"
              placeholder="e.g. Wrong plate, visitor refused ID check"
              multiline
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setDenyOpen(false)} disabled={acting}>Cancel</Button>
            <Button onPress={handleDeny} loading={acting} disabled={acting || !denyReason.trim()} textColor="#ef4444">
              Deny entry
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
