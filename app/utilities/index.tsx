import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Card, Icon, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PurpleHeader } from '@/components/purple-header';
import { TabletContainer } from '@/components/tablet-container';
import { apiFetch } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/session';

const PRIMARY = '#7367F0';
const PRIMARY_TINT = '#EEEDFD';
const SELECTED_UNIT_KEY = 'baiti.home.selected_unit_id';

type Charge = {
  id: number;
  name: string;
  description: string | null;
  amount: number;
  pricing_method: string;
};

type Response = {
  unit: { id: string; unit_number: string; property_name: string | null };
  charges: Charge[];
  total: number;
};

const PRICING_LABEL: Record<string, string> = {
  flat_all: 'Flat',
  flat_per_unit_type: 'Per unit type',
  per_sqft: 'Per sqft',
  per_unit_override: 'Custom for your unit',
  percentage_of: '% of another charge',
};

export default function UtilitiesScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const [data, setData] = useState<Response | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(SELECTED_UNIT_KEY).then((saved) => {
      const fallback = user?.units?.[0]?.id ?? null;
      if (saved && user?.units?.some((u) => u.id === saved)) {
        setSelectedUnitId(saved);
      } else {
        setSelectedUnitId(fallback);
      }
    });
  }, [user?.units]);

  const load = useCallback(async () => {
    if (!selectedUnitId) {
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await apiFetch(`/api/v1/me/units/${selectedUnitId}/utility-charges`);
      setData(res);
    } catch {
      setData(null);
    }
    setLoading(false);
  }, [selectedUnitId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function handleRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  const hasMultipleUnits = (user?.units?.length ?? 0) > 1;

  return (
    <View style={styles.container}>
      <PurpleHeader title="Utilities" />

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}>
        <TabletContainer>

          {data?.unit && (
            <Card style={styles.unitCard}>
              <Card.Content style={styles.unitCardContent}>
                <View style={styles.unitIconWrap}>
                  <Icon source="home-city-outline" size={28} color={PRIMARY} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text variant="bodySmall" style={styles.unitLabel}>Showing charges for</Text>
                  <Text variant="titleMedium" style={{ fontWeight: '600' }}>
                    Unit {data.unit.unit_number}
                  </Text>
                  {data.unit.property_name ? (
                    <Text variant="bodySmall" style={{ opacity: 0.65 }}>
                      {data.unit.property_name}
                    </Text>
                  ) : null}
                </View>
                {hasMultipleUnits ? (
                  <View style={styles.switchHint}>
                    <Text style={styles.switchHintText}>Switch unit on Home</Text>
                  </View>
                ) : null}
              </Card.Content>
            </Card>
          )}

          {loading && !refreshing ? (
            <View style={styles.center}><ActivityIndicator /></View>
          ) : !data || data.charges.length === 0 ? (
            <View style={styles.center}>
              <Icon source="lightning-bolt-outline" size={56} color="#9ca3af" />
              <Text variant="titleMedium" style={{ marginTop: 12, opacity: 0.8 }}>
                No utility charges yet
              </Text>
              <Text variant="bodySmall" style={styles.emptyHint}>
                Your JMB hasn't set up any utility charges for this unit.
                Water, internet and electricity charges will appear here once
                they activate them.
              </Text>
            </View>
          ) : (
            <>
              {data.charges.map((c) => (
                <Card key={c.id} style={styles.chargeCard}>
                  <Card.Content style={styles.chargeContent}>
                    <View style={styles.chargeIconWrap}>
                      <Icon source={iconForCharge(c.name)} size={24} color={PRIMARY} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text variant="titleMedium" style={{ fontWeight: '600' }}>{c.name}</Text>
                      {c.description ? (
                        <Text variant="bodySmall" style={{ opacity: 0.65, marginTop: 2 }}>
                          {c.description}
                        </Text>
                      ) : null}
                      <Text variant="bodySmall" style={styles.methodLabel}>
                        {PRICING_LABEL[c.pricing_method] ?? c.pricing_method}
                      </Text>
                    </View>
                    <Text variant="titleMedium" style={styles.amount}>
                      RM {c.amount.toFixed(2)}
                    </Text>
                  </Card.Content>
                </Card>
              ))}

              <Card style={styles.totalCard}>
                <Card.Content style={styles.totalContent}>
                  <View style={{ flex: 1, paddingRight: 12 }}>
                    <Text style={styles.totalLabel}>Total per month</Text>
                    <Text style={styles.totalSubtitle}>
                      These appear on your monthly maintenance invoice.
                    </Text>
                  </View>
                  <Text style={styles.totalAmount}>
                    RM {data.total.toFixed(2)}
                  </Text>
                </Card.Content>
              </Card>
            </>
          )}
        </TabletContainer>
      </ScrollView>
    </View>
  );
}

function iconForCharge(name: string): string {
  const n = name.toLowerCase();
  if (n.includes('water')) return 'water';
  if (n.includes('internet') || n.includes('wifi') || n.includes('fibre')) return 'wifi';
  if (n.includes('electric') || n.includes('power')) return 'lightning-bolt';
  if (n.includes('gas')) return 'fire';
  return 'currency-usd';
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  scroll: { padding: 16, gap: 12 },
  center: { alignItems: 'center', justifyContent: 'center', paddingVertical: 56 },

  unitCard: { marginBottom: 8, backgroundColor: PRIMARY_TINT },
  unitCardContent: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  unitIconWrap: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
  },
  unitLabel: { opacity: 0.65, marginBottom: 2 },
  switchHint: { paddingHorizontal: 8, paddingVertical: 4 },
  switchHintText: { fontSize: 11, color: PRIMARY, fontWeight: '500' },

  chargeCard: { marginBottom: 10 },
  chargeContent: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  chargeIconWrap: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: PRIMARY_TINT,
    alignItems: 'center', justifyContent: 'center',
  },
  methodLabel: { opacity: 0.5, marginTop: 4, fontSize: 11 },
  amount: { fontWeight: '700' },

  totalCard: { marginTop: 12, backgroundColor: PRIMARY },
  totalContent: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  totalLabel: { color: '#fff', fontSize: 14, fontWeight: '500', opacity: 0.9 },
  totalSubtitle: { color: '#fff', fontSize: 11, marginTop: 2, opacity: 0.7 },
  totalAmount: { color: '#fff', fontWeight: '700', fontSize: 22 },

  emptyHint: { marginTop: 8, opacity: 0.65, textAlign: 'center', paddingHorizontal: 24 },
});
