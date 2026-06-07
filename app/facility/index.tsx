import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Card, Icon, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PurpleHeader } from '@/components/purple-header';
import { TabletContainer } from '@/components/tablet-container';
import { apiFetch } from '@/lib/api/client';
import { useResponsive } from '@/lib/theme/responsive';

const PRIMARY = '#7367F0';
const PRIMARY_TINT = '#EEEDFD';

type Facility = {
  id: string;
  name: string;
  icon: string;
  icon_mdi: string;
  photo_url: string | null;
  description: string | null;
  type: 'open_access' | 'bookable';
  deposit_amount: number;
  requires_approval: boolean;
};

export default function FacilityListScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isTablet } = useResponsive();
  const [items, setItems] = useState<Facility[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch('/api/v1/facilities');
      setItems(data.facilities ?? []);
    } catch {
      setItems([]);
    }
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function handleRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  return (
    <View style={styles.container}>
      <PurpleHeader title="Facilities" />

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}>
        <TabletContainer>
          <View style={styles.actionsRow}>
            <Button
              mode="outlined"
              icon="calendar-check"
              onPress={() => router.push('/facility/bookings')}>
              My bookings
            </Button>
          </View>

          {loading && !refreshing ? (
            <View style={styles.center}><ActivityIndicator /></View>
          ) : items.length === 0 ? (
            <View style={styles.center}>
              <Icon source="pool" size={56} color="#9ca3af" />
              <Text variant="bodyMedium" style={{ marginTop: 12, opacity: 0.65, textAlign: 'center' }}>
                No facilities available yet.{'\n'}Ask your JMB to set them up.
              </Text>
            </View>
          ) : (
            <View style={[styles.grid, { gap: isTablet ? 16 : 12 }]}>
              {items.map((f) => (
                <Pressable
                  key={f.id}
                  onPress={() => router.push({ pathname: '/facility/[id]', params: { id: f.id } })}
                  style={[styles.tile, { width: isTablet ? '32%' : '48%' }]}>
                  <Card style={styles.card}>
                    {f.photo_url ? (
                      <Card.Cover source={{ uri: f.photo_url }} style={styles.cardImg} />
                    ) : (
                      <View style={styles.cardIconWrap}>
                        <Icon source={f.icon_mdi} size={56} color={PRIMARY} />
                      </View>
                    )}
                    <Card.Content style={styles.cardContent}>
                      <View style={styles.titleRow}>
                        <Icon source={f.icon_mdi} size={18} color={PRIMARY} />
                        <Text variant="titleSmall" style={styles.cardTitle} numberOfLines={1}>
                          {f.name}
                        </Text>
                      </View>
                      <View style={styles.metaRow}>
                        {f.type === 'bookable' ? (
                          <View style={[styles.pill, { backgroundColor: '#dbeafe' }]}>
                            <Text style={[styles.pillText, { color: '#1d4ed8' }]}>Bookable</Text>
                          </View>
                        ) : (
                          <View style={[styles.pill, { backgroundColor: '#f3f4f6' }]}>
                            <Text style={[styles.pillText, { color: '#6b7280' }]}>Open access</Text>
                          </View>
                        )}
                        {f.deposit_amount > 0 ? (
                          <View style={[styles.pill, { backgroundColor: '#fef3c7' }]}>
                            <Text style={[styles.pillText, { color: '#92400e' }]}>
                              Deposit RM {f.deposit_amount.toFixed(0)}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                    </Card.Content>
                  </Card>
                </Pressable>
              ))}
            </View>
          )}
        </TabletContainer>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  scroll: { padding: 16 },
  center: { padding: 32, alignItems: 'center' },

  actionsRow: { marginBottom: 16, alignItems: 'flex-end' },

  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  tile: { marginBottom: 12 },
  card: { overflow: 'hidden' },
  cardImg: { height: 100 },
  cardIconWrap: {
    height: 100,
    backgroundColor: PRIMARY_TINT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardContent: { paddingVertical: 10 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardTitle: { fontWeight: '600', flex: 1, minWidth: 0 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 6 },
  pill: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999 },
  pillText: { fontSize: 10, fontWeight: '700' },
});
