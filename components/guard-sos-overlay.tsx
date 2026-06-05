import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Icon, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { apiFetch } from '@/lib/api/client';
import { useGuardSession } from '@/lib/guard/session';

const POLL_MS = 5000;

type SosEvent = {
  id: string;
  category: 'medical' | 'fire' | 'security' | 'other';
  status: 'active' | 'responding';
};

/**
 * Overlay banner shown on every guard-tablet screen whenever an active SOS
 * exists for the device's organization. Polls every 5 seconds.
 */
export function GuardSosOverlay() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { paired, shift } = useGuardSession();
  const [events, setEvents] = useState<SosEvent[]>([]);

  const load = useCallback(async () => {
    if (!paired || !shift) {
      setEvents([]);
      return;
    }
    try {
      const data = await apiFetch('/api/v1/guard/sos');
      setEvents(data.events ?? []);
    } catch {
      // ignore — keep stale list
    }
  }, [paired, shift]);

  // Poll while there's an active shift.
  useEffect(() => {
    if (!paired || !shift) return;
    load();
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  }, [paired, shift, load]);

  // Refresh immediately when the user navigates back from the SOS queue.
  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (events.length === 0) return null;

  const activeCount = events.filter((e) => e.status === 'active').length;

  return (
    <Pressable
      onPress={() => router.push('/guard-sos')}
      style={[styles.banner, { paddingTop: insets.top + 10 }]}>
      <View style={styles.inner}>
        <View style={styles.iconWrap}>
          <Icon source="alarm-light" size={28} color="#fff" />
        </View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.title}>
            🚨 {events.length} ACTIVE SOS
            {activeCount > 0 && activeCount !== events.length ? ` (${activeCount} unack)` : ''}
          </Text>
          <Text style={styles.sub}>Tap to respond</Text>
        </View>
        <Icon source="chevron-right" size={24} color="#fff" />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    backgroundColor: '#dc2626',
    paddingHorizontal: 12, paddingBottom: 12,
    zIndex: 1000,
    elevation: 12,
    shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 6, shadowOffset: { width: 0, height: 3 },
  },
  inner: { flexDirection: 'row', alignItems: 'center' },
  iconWrap: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  title: { color: '#fff', fontWeight: '800', fontSize: 16 },
  sub: { color: '#fee2e2', fontSize: 12, marginTop: 2 },
});
