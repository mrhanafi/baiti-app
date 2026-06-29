import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Easing,
  Modal,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { FAB, Icon, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ApiError, apiFetch } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/session';
import { sosFabBottom } from '@/lib/layout';

const HOLD_MS = 3000;
const POLL_MS = 10000;

type SosCategory = 'medical' | 'fire' | 'security' | 'other';
type SosStatus = 'active' | 'responding' | 'resolved' | 'cancelled';

type SosEvent = {
  id: string;
  category: SosCategory;
  status: SosStatus;
  triggered_at: string;
  acknowledged_at: string | null;
  resolved_at: string | null;
  acknowledger_name: string | null;
  response_notes: string | null;
  cancel_reason: string | null;
  unit: { unit_number: string | null };
};

const CATEGORIES: { value: SosCategory; label: string; icon: string }[] = [
  { value: 'medical',  label: 'Medical',  icon: 'medical-bag' },
  { value: 'fire',     label: 'Fire',     icon: 'fire' },
  { value: 'security', label: 'Security', icon: 'shield-alert' },
  { value: 'other',    label: 'Other',    icon: 'alert' },
];

export function SosButton() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const bottomOffset = sosFabBottom(insets);

  const [modalOpen, setModalOpen] = useState(false);
  const [activeEvent, setActiveEvent] = useState<SosEvent | null>(null);
  const hasActiveOrg = (user?.organizations?.length ?? 0) > 0;

  // Hydrate from server on mount + whenever auth state changes so a still-active
  // SOS survives an app relaunch.
  useEffect(() => {
    if (!user || !hasActiveOrg) {
      setActiveEvent(null);
      return;
    }
    (async () => {
      try {
        const data = await apiFetch('/api/v1/me/sos/active');
        if (data?.event) setActiveEvent(data.event);
      } catch {
        // ignore — banner stays hidden
      }
    })();
  }, [user, hasActiveOrg]);

  // While an event is active or being responded to, poll for updates so the
  // banner reflects guard acknowledgment / resolution without manual refresh.
  useEffect(() => {
    if (!activeEvent || (activeEvent.status !== 'active' && activeEvent.status !== 'responding')) {
      return;
    }
    const t = setInterval(async () => {
      try {
        const data = await apiFetch(`/api/v1/me/sos/${activeEvent.id}`);
        if (data?.event) setActiveEvent(data.event);
      } catch {
        // ignore
      }
    }, POLL_MS);
    return () => clearInterval(t);
  }, [activeEvent]);

  function handleFabPress() {
    if (!hasActiveOrg) {
      Alert.alert('SOS unavailable', 'Verify your home first to use the SOS feature.');
      return;
    }
    setModalOpen(true);
  }

  async function handleTrigger(category: SosCategory) {
    try {
      const data = await apiFetch('/api/v1/me/sos', {
        method: 'POST',
        body: JSON.stringify({ category }),
      });
      setActiveEvent(data.event);
      setModalOpen(false);
    } catch (err) {
      const msg = err instanceof ApiError
        ? (Object.values(err.body?.errors ?? {})[0] as string[] | undefined)?.[0] ?? `Failed (${err.status}).`
        : 'Could not send SOS. Check your connection.';
      Alert.alert('SOS not sent', msg);
    }
  }

  async function handleCancel() {
    if (!activeEvent) return;
    Alert.alert(
      'Cancel SOS?',
      'Only do this if you triggered it by mistake.',
      [
        { text: 'Keep SOS', style: 'cancel' },
        {
          text: 'Cancel SOS',
          style: 'destructive',
          onPress: async () => {
            try {
              const data = await apiFetch(`/api/v1/me/sos/${activeEvent.id}/cancel`, {
                method: 'POST',
                body: JSON.stringify({ reason: 'Cancelled by resident' }),
              });
              setActiveEvent(data.event);
            } catch {
              Alert.alert('Could not cancel', 'Check your connection.');
            }
          },
        },
      ],
    );
  }

  const showBanner = activeEvent && (
    activeEvent.status === 'active' ||
    activeEvent.status === 'responding' ||
    activeEvent.status === 'resolved'
  );

  return (
    <>
      {/* Active-SOS banner — pinned to top of viewport, above all tabs */}
      {showBanner ? (
        <View style={[styles.banner, { paddingTop: insets.top + 8 }]}>
          <View style={styles.bannerRow}>
            <Icon source={activeEvent!.status === 'resolved' ? 'check-circle' : 'alarm-light'} size={20} color="#fff" />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={styles.bannerTitle}>{bannerTitle(activeEvent!)}</Text>
              <Text style={styles.bannerSub}>{bannerSub(activeEvent!)}</Text>
            </View>
            {activeEvent!.status === 'active' ? (
              <Pressable onPress={handleCancel} style={styles.bannerBtn}>
                <Text style={styles.bannerBtnText}>Cancel</Text>
              </Pressable>
            ) : activeEvent!.status === 'resolved' ? (
              <Pressable onPress={() => setActiveEvent(null)} style={styles.bannerBtn}>
                <Text style={styles.bannerBtnText}>Dismiss</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      ) : null}

      {/* Floating SOS FAB — hidden while an active SOS exists */}
      {!activeEvent || activeEvent.status === 'cancelled' || activeEvent.status === 'resolved' ? (
        <FAB
          icon="alarm-light"
          onPress={handleFabPress}
          style={[styles.fab, { bottom: bottomOffset }]}
          color="#fff"
          customSize={56}
          mode="elevated"
        />
      ) : null}

      <SosTriggerModal
        visible={modalOpen}
        onClose={() => setModalOpen(false)}
        onTrigger={handleTrigger}
      />
    </>
  );
}

function bannerTitle(e: SosEvent): string {
  if (e.status === 'active') return 'SOS sent. Guards have been notified.';
  if (e.status === 'responding') return `${e.acknowledger_name ?? 'A guard'} is on the way.`;
  if (e.status === 'resolved') return 'SOS resolved.';
  return '';
}

function bannerSub(e: SosEvent): string {
  if (e.status === 'active') return 'Stay where you are.';
  if (e.status === 'responding') return 'Help is coming. Stay calm.';
  if (e.status === 'resolved') return e.response_notes ?? 'Resolved by guard.';
  return '';
}

// ============================================================
// Hold-to-confirm modal
// ============================================================

function SosTriggerModal({
  visible,
  onClose,
  onTrigger,
}: {
  visible: boolean;
  onClose: () => void;
  onTrigger: (category: SosCategory) => Promise<void>;
}) {
  const insets = useSafeAreaInsets();
  const [pressedCategory, setPressedCategory] = useState<SosCategory | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const progress = useRef(new Animated.Value(0)).current;
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset state whenever the modal opens.
  useEffect(() => {
    if (!visible) {
      setPressedCategory(null);
      setSubmitting(false);
      progress.setValue(0);
    }
  }, [visible, progress]);

  const startHold = useCallback((category: SosCategory) => {
    setPressedCategory(category);
    Animated.timing(progress, {
      toValue: 1,
      duration: HOLD_MS,
      easing: Easing.linear,
      useNativeDriver: false,
    }).start();
    holdTimer.current = setTimeout(async () => {
      setSubmitting(true);
      await onTrigger(category);
      setSubmitting(false);
    }, HOLD_MS);
  }, [onTrigger, progress]);

  const cancelHold = useCallback(() => {
    if (holdTimer.current) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
    setPressedCategory(null);
    progress.stopAnimation();
    progress.setValue(0);
  }, [progress]);

  useEffect(() => () => {
    if (holdTimer.current) clearTimeout(holdTimer.current);
  }, []);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={modalStyles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => !pressedCategory && onClose()} />
        <View style={[modalStyles.card, { paddingBottom: insets.bottom + 20 }]}>
          <View style={modalStyles.handle} />
          <Text variant="titleLarge" style={modalStyles.title}>Emergency type?</Text>
          <Text variant="bodySmall" style={modalStyles.hint}>
            Press and hold for 3 seconds to send.
          </Text>

          <View style={modalStyles.grid}>
            {CATEGORIES.map((c) => {
              const isActive = pressedCategory === c.value;
              const width = progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });
              return (
                <Pressable
                  key={c.value}
                  disabled={submitting || (!!pressedCategory && pressedCategory !== c.value)}
                  onPressIn={() => startHold(c.value)}
                  onPressOut={cancelHold}
                  style={[modalStyles.tile, isActive && modalStyles.tileActive]}>
                  {isActive ? (
                    <Animated.View style={[modalStyles.fill, { width }]} />
                  ) : null}
                  <View style={modalStyles.tileContent}>
                    <Icon source={c.icon} size={32} color={isActive ? '#fff' : '#dc2626'} />
                    <Text style={[modalStyles.tileLabel, isActive && { color: '#fff' }]}>
                      {c.label}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>

          <Pressable onPress={onClose} disabled={submitting} style={modalStyles.cancelBtn}>
            <Text style={modalStyles.cancelText}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 16,
    backgroundColor: '#E53935',
    borderRadius: 28,
  },

  banner: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    backgroundColor: '#dc2626',
    paddingHorizontal: 12,
    paddingBottom: 10,
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    zIndex: 1000,
  },
  bannerRow: { flexDirection: 'row', alignItems: 'center' },
  bannerTitle: { color: '#fff', fontWeight: '700', fontSize: 14 },
  bannerSub: { color: '#fee2e2', fontSize: 12, marginTop: 2 },
  bannerBtn: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
  },
  bannerBtnText: { color: '#fff', fontWeight: '700', fontSize: 12 },
});

const modalStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  card: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  handle: {
    alignSelf: 'center',
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: '#d1d5db',
    marginBottom: 16,
  },
  title: { fontWeight: '700', textAlign: 'center' },
  hint: { textAlign: 'center', opacity: 0.65, marginTop: 6, marginBottom: 20 },

  grid: {
    flexDirection: 'row', flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 10,
  },
  tile: {
    width: '48%',
    height: 96,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#fecaca',
    backgroundColor: '#fef2f2',
    overflow: 'hidden',
    position: 'relative',
  },
  tileActive: { borderColor: '#dc2626' },
  tileContent: {
    flex: 1,
    alignItems: 'center', justifyContent: 'center',
    gap: 6,
  },
  tileLabel: { fontWeight: '700', color: '#dc2626', fontSize: 14 },
  fill: {
    position: 'absolute',
    left: 0, top: 0, bottom: 0,
    backgroundColor: '#dc2626',
  },

  cancelBtn: {
    marginTop: 20,
    paddingVertical: 14, borderRadius: 12,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
  },
  cancelText: { color: '#374151', fontWeight: '600' },
});
