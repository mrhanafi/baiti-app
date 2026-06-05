import { useEffect, useState } from 'react';
import { Alert, FlatList, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Card, Icon, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ApiError, apiFetch } from '@/lib/api/client';
import { useGuardSession } from '@/lib/guard/session';

const PRIMARY = '#7367F0';
const PRIMARY_TINT = '#EEEDFD';

type Staff = { id: string; name: string };

export default function ShiftPickerScreen() {
  const insets = useSafeAreaInsets();
  const { startShift } = useGuardSession();
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const data = await apiFetch('/api/v1/guard/shift/staff');
        setStaff(data.staff ?? []);
      } catch (err) {
        if (!(err instanceof ApiError)) {
          Alert.alert('Could not load staff', 'Check your connection.');
        }
      }
      setLoading(false);
    }
    load();
  }, []);

  async function handlePick(s: Staff) {
    setStarting(s.id);
    try {
      await startShift(s.id, s.name);
      // Gate redirects to /(guard) when shift becomes active.
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Could not start shift.';
      Alert.alert('Failed', msg);
    }
    setStarting(null);
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 24 }]}>
        <Text style={styles.title}>Who's on shift?</Text>
        <Text style={styles.subtitle}>Tap your name to start your shift.</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator />
        </View>
      ) : staff.length === 0 ? (
        <View style={styles.center}>
          <Icon source="account-off-outline" size={48} color="#9ca3af" />
          <Text variant="bodyMedium" style={{ marginTop: 12, opacity: 0.65, textAlign: 'center', paddingHorizontal: 32 }}>
            No guard staff registered yet. Ask your JMB admin to add your name in the Guards section.
          </Text>
        </View>
      ) : (
        <FlatList
          data={staff}
          keyExtractor={(s) => s.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <Card
              style={[styles.card, starting === item.id && styles.cardActive]}
              onPress={() => handlePick(item)}
              disabled={!!starting}>
              <Card.Content style={styles.cardContent}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{item.name.charAt(0).toUpperCase()}</Text>
                </View>
                <Text variant="titleMedium" style={styles.name}>
                  {item.name}
                </Text>
                {starting === item.id ? <ActivityIndicator /> : null}
              </Card.Content>
            </Card>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { backgroundColor: PRIMARY, paddingHorizontal: 16, paddingBottom: 24 },
  title: { color: '#fff', fontSize: 26, fontWeight: '700' },
  subtitle: { color: '#fff', opacity: 0.85, marginTop: 4 },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },

  list: { padding: 16 },
  card: { marginBottom: 10 },
  cardActive: { opacity: 0.7 },
  cardContent: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 8 },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: PRIMARY_TINT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: PRIMARY, fontSize: 20, fontWeight: '700' },
  name: { flex: 1, fontWeight: '600' },
});
