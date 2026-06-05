import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  Alert,
  FlatList,
  Linking,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { ActivityIndicator, Icon, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ApiError, apiFetch } from '@/lib/api/client';
import { useResponsive } from '@/lib/theme/responsive';

type SosEvent = {
  id: string;
  category: 'medical' | 'fire' | 'security' | 'other';
  status: 'active' | 'responding' | 'resolved' | 'cancelled';
  triggered_at: string;
  acknowledged_at: string | null;
  acknowledger_name: string | null;
  resident: { id: string | null; name: string | null; phone: string | null };
  unit: { unit_number: string | null };
};

const CATEGORY_LABEL: Record<SosEvent['category'], string> = {
  medical: 'Medical', fire: 'Fire', security: 'Security', other: 'Other',
};

const CATEGORY_ICON: Record<SosEvent['category'], string> = {
  medical: 'medical-bag', fire: 'fire', security: 'shield-alert', other: 'alert',
};

export default function GuardSosScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isTablet, isLandscape, contentMaxWidth } = useResponsive();
  const [events, setEvents] = useState<SosEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [resolveTarget, setResolveTarget] = useState<SosEvent | null>(null);
  const [resolveNotes, setResolveNotes] = useState('');

  const load = useCallback(async () => {
    try {
      const data = await apiFetch('/api/v1/guard/sos');
      setEvents(data.events ?? []);
    } catch {
      setEvents([]);
    }
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function handleRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  async function handleAcknowledge(event: SosEvent) {
    setBusyId(event.id);
    try {
      const data = await apiFetch(`/api/v1/guard/sos/${event.id}/acknowledge`, {
        method: 'POST',
      });
      setEvents((prev) => prev.map((e) => e.id === data.event.id ? data.event : e));
    } catch (err) {
      const msg = err instanceof ApiError
        ? (Object.values(err.body?.errors ?? {})[0] as string[] | undefined)?.[0] ?? `Failed (${err.status}).`
        : 'Could not acknowledge.';
      Alert.alert('Acknowledge failed', msg);
    }
    setBusyId(null);
  }

  function openResolveModal(event: SosEvent) {
    setResolveTarget(event);
    setResolveNotes('');
  }

  async function handleResolve() {
    if (!resolveTarget || !resolveNotes.trim()) return;
    setBusyId(resolveTarget.id);
    try {
      await apiFetch(`/api/v1/guard/sos/${resolveTarget.id}/resolve`, {
        method: 'POST',
        body: JSON.stringify({ notes: resolveNotes.trim() }),
      });
      // Resolved events disappear from the active queue.
      setEvents((prev) => prev.filter((e) => e.id !== resolveTarget.id));
      setResolveTarget(null);
      setResolveNotes('');
    } catch (err) {
      const msg = err instanceof ApiError
        ? (Object.values(err.body?.errors ?? {})[0] as string[] | undefined)?.[0] ?? `Failed (${err.status}).`
        : 'Could not resolve.';
      Alert.alert('Resolve failed', msg);
    }
    setBusyId(null);
  }

  if (loading && !refreshing) {
    return (
      <View style={styles.container}>
        <Header onBack={() => router.back()} count={0} />
        <View style={styles.center}><ActivityIndicator /></View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header onBack={() => router.back()} count={events.length} />

      {events.length === 0 ? (
        <View style={styles.center}>
          <Icon source="check-circle-outline" size={64} color="#9ca3af" />
          <Text variant="bodyMedium" style={{ marginTop: 16, opacity: 0.7 }}>
            No active SOS calls.
          </Text>
        </View>
      ) : (
        <FlatList
          data={events}
          keyExtractor={(e) => e.id}
          key={isTablet && isLandscape ? 'grid' : 'list'}
          numColumns={isTablet && isLandscape ? 2 : 1}
          columnWrapperStyle={isTablet && isLandscape ? { gap: 10 } : undefined}
          contentContainerStyle={[
            { padding: 12, paddingBottom: insets.bottom + 24 },
            isTablet && { alignSelf: 'center', width: '100%', maxWidth: contentMaxWidth },
          ]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
          renderItem={({ item }) => (
            <View style={isTablet && isLandscape ? { flex: 1 } : undefined}>
              <SosCard
                event={item}
                busy={busyId === item.id}
                onAcknowledge={() => handleAcknowledge(item)}
                onResolve={() => openResolveModal(item)}
              />
            </View>
          )}
        />
      )}

      <ResolveModal
        visible={!!resolveTarget}
        notes={resolveNotes}
        onChangeNotes={setResolveNotes}
        onCancel={() => { setResolveTarget(null); setResolveNotes(''); }}
        onSubmit={handleResolve}
        busy={!!resolveTarget && busyId === resolveTarget.id}
      />
    </View>
  );
}

function Header({ onBack, count }: { onBack: () => void; count: number }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[headerStyles.bar, { paddingTop: insets.top + 12 }]}>
      <Pressable onPress={onBack} style={headerStyles.backBtn}>
        <Icon source="arrow-left" size={24} color="#fff" />
      </Pressable>
      <Text style={headerStyles.title}>
        {count > 0 ? `🚨 ${count} ACTIVE SOS` : 'SOS — All Clear'}
      </Text>
      <View style={{ width: 32 }} />
    </View>
  );
}

function SosCard({
  event,
  busy,
  onAcknowledge,
  onResolve,
}: {
  event: SosEvent;
  busy: boolean;
  onAcknowledge: () => void;
  onResolve: () => void;
}) {
  const triggered = new Date(event.triggered_at);
  const minsAgo = Math.max(0, Math.floor((Date.now() - triggered.getTime()) / 60000));

  function callResident() {
    if (event.resident.phone) {
      Linking.openURL(`tel:${event.resident.phone}`);
    }
  }

  return (
    <View style={[cardStyles.card, event.status === 'responding' && cardStyles.cardResponding]}>
      <View style={cardStyles.headerRow}>
        <View style={cardStyles.catBadge}>
          <Icon source={CATEGORY_ICON[event.category]} size={20} color="#dc2626" />
          <Text style={cardStyles.catText}>{CATEGORY_LABEL[event.category]}</Text>
        </View>
        <Text style={cardStyles.timeText}>
          {minsAgo === 0 ? 'just now' : `${minsAgo}m ago`}
        </Text>
      </View>

      <Text style={cardStyles.residentName}>{event.resident.name ?? 'Unknown'}</Text>
      <Text style={cardStyles.unitText}>
        Unit {event.unit.unit_number ?? '—'}
        {event.resident.phone ? ` · ${event.resident.phone}` : ''}
      </Text>

      {event.status === 'responding' ? (
        <View style={cardStyles.respondingPill}>
          <Icon source="account-arrow-right" size={14} color="#1d4ed8" />
          <Text style={cardStyles.respondingText}>
            Responding by {event.acknowledger_name ?? '—'}
          </Text>
        </View>
      ) : null}

      <View style={cardStyles.actions}>
        {event.resident.phone ? (
          <Pressable onPress={callResident} style={[cardStyles.btn, cardStyles.btnCall]}>
            <Icon source="phone" size={18} color="#15803d" />
            <Text style={cardStyles.btnCallText}>Call</Text>
          </Pressable>
        ) : null}

        {event.status === 'active' ? (
          <Pressable
            onPress={onAcknowledge}
            disabled={busy}
            style={[cardStyles.btn, cardStyles.btnAck, busy && { opacity: 0.6 }]}>
            <Icon source="check" size={18} color="#fff" />
            <Text style={cardStyles.btnAckText}>Acknowledge & respond</Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={onResolve}
            disabled={busy}
            style={[cardStyles.btn, cardStyles.btnResolve, busy && { opacity: 0.6 }]}>
            <Icon source="check-all" size={18} color="#fff" />
            <Text style={cardStyles.btnResolveText}>Mark resolved</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

function ResolveModal({
  visible,
  notes,
  onChangeNotes,
  onCancel,
  onSubmit,
  busy,
}: {
  visible: boolean;
  notes: string;
  onChangeNotes: (v: string) => void;
  onCancel: () => void;
  onSubmit: () => void;
  busy: boolean;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel} statusBarTranslucent>
      <View style={modalStyles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} />
        <View style={modalStyles.card}>
          <Text variant="titleMedium" style={modalStyles.title}>Resolve SOS</Text>
          <Text variant="bodySmall" style={modalStyles.hint}>
            What happened? This goes into the incident log.
          </Text>
          <TextInput
            value={notes}
            onChangeText={onChangeNotes}
            multiline
            placeholder="e.g. Escorted to clinic / False alarm"
            placeholderTextColor="#9ca3af"
            maxLength={5000}
            style={modalStyles.input}
          />
          <View style={modalStyles.buttons}>
            <Pressable onPress={onCancel} style={[modalStyles.btn, modalStyles.btnCancel]}>
              <Text style={modalStyles.btnCancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={onSubmit}
              disabled={busy || !notes.trim()}
              style={[
                modalStyles.btn,
                modalStyles.btnSubmit,
                (busy || !notes.trim()) && { opacity: 0.5 },
              ]}>
              <Text style={modalStyles.btnSubmitText}>{busy ? 'Saving...' : 'Resolve'}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
});

const headerStyles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#dc2626',
    paddingHorizontal: 12, paddingBottom: 14,
  },
  backBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, color: '#fff', fontWeight: '800', fontSize: 16, textAlign: 'center' },
});

const cardStyles = StyleSheet.create({
  card: {
    backgroundColor: '#fef2f2',
    borderWidth: 1, borderColor: '#fecaca',
    borderRadius: 12,
    padding: 14, marginBottom: 10,
  },
  cardResponding: { backgroundColor: '#eff6ff', borderColor: '#bfdbfe' },

  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  catBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#fee2e2',
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 999,
  },
  catText: { color: '#dc2626', fontWeight: '700', fontSize: 12 },
  timeText: { color: '#6b7280', fontSize: 12 },

  residentName: { color: '#1f2937', fontWeight: '700', fontSize: 17, marginTop: 10 },
  unitText: { color: '#4b5563', fontSize: 13, marginTop: 2 },

  respondingPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: 8,
    paddingHorizontal: 10, paddingVertical: 4,
    backgroundColor: '#dbeafe', borderRadius: 999,
    alignSelf: 'flex-start',
  },
  respondingText: { color: '#1d4ed8', fontWeight: '600', fontSize: 12 },

  actions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  btn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 12, borderRadius: 10,
  },
  btnCall: { backgroundColor: '#dcfce7', borderWidth: 1, borderColor: '#bbf7d0', flex: 0, paddingHorizontal: 16 },
  btnCallText: { color: '#15803d', fontWeight: '700' },
  btnAck: { backgroundColor: '#dc2626' },
  btnAckText: { color: '#fff', fontWeight: '700' },
  btnResolve: { backgroundColor: '#15803d' },
  btnResolveText: { color: '#fff', fontWeight: '700' },
});

const modalStyles = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center', justifyContent: 'center',
    padding: 20,
  },
  card: { width: '100%', backgroundColor: '#fff', borderRadius: 16, padding: 20 },
  title: { fontWeight: '700', marginBottom: 4 },
  hint: { opacity: 0.65, marginBottom: 12 },
  input: {
    borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10,
    minHeight: 90, textAlignVertical: 'top',
    fontSize: 15, color: '#1f2937',
  },
  buttons: { flexDirection: 'row', gap: 8, marginTop: 16 },
  btn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  btnCancel: { backgroundColor: '#f3f4f6' },
  btnCancelText: { color: '#374151', fontWeight: '600' },
  btnSubmit: { backgroundColor: '#15803d' },
  btnSubmitText: { color: '#fff', fontWeight: '700' },
});
