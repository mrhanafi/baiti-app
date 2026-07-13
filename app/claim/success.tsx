import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Card, Icon, Text } from 'react-native-paper';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/lib/auth/session';

const PRIMARY = '#7367F0';
const SUCCESS = '#22c55e';
const SUCCESS_TINT = '#dcfce7';

type ClaimedUnit = {
  unit_number: string;
  property_name: string;
  organization_name: string;
};

export default function ClaimSuccessScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { t } = useTranslation();
  const firstName = user?.name?.split(' ')[0];

  const params = useLocalSearchParams<{ units?: string }>();
  let units: ClaimedUnit[] = [];
  try {
    units = params.units ? JSON.parse(String(params.units)) : [];
  } catch {
    units = [];
  }

  // Icon entrance: spring scale + a small wobble for delight.
  const scale = useSharedValue(0);
  const rotation = useSharedValue(0);
  useEffect(() => {
    scale.value = withSpring(1, { damping: 8, stiffness: 120 });
    rotation.value = withDelay(
      300,
      withSequence(
        withTiming(-10, { duration: 120 }),
        withTiming(10, { duration: 120 }),
        withTiming(0, { duration: 120 }),
      ),
    );
  }, [rotation, scale]);

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, { rotate: `${rotation.value}deg` }],
  }));

  return (
    <View style={[styles.container, { paddingTop: insets.top + 24 }]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Animated.View style={[styles.iconWrap, iconStyle]}>
          <Icon source="check-bold" size={64} color={SUCCESS} />
        </Animated.View>

        <Text variant="headlineMedium" style={styles.title}>
          {firstName ? t('claim.welcomeHome', { name: firstName }) : t('claim.welcomeHomeNoName')}
        </Text>
        <Text variant="bodyMedium" style={styles.subtitle}>
          {units.length === 1
            ? t('claim.verifiedOneHome')
            : t('claim.verifiedManyHomes', { count: units.length })}
        </Text>

        {units.length > 0 ? (
          <View style={styles.unitsList}>
            {units.map((u, i) => (
              <Card key={`${u.organization_name}-${u.unit_number}-${i}`} style={styles.unitCard}>
                <Card.Content style={styles.unitContent}>
                  <View style={styles.unitIcon}>
                    <Icon source="home-city" size={28} color={PRIMARY} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text variant="titleMedium" style={styles.unitName}>
                      {u.property_name}
                    </Text>
                    <Text variant="bodySmall" style={styles.unitMeta}>
                      {t('common.unit', { number: u.unit_number })}
                    </Text>
                    <Text variant="bodySmall" style={styles.unitMeta}>
                      {t('claim.managedBy', { org: u.organization_name })}
                    </Text>
                  </View>
                </Card.Content>
              </Card>
            ))}
          </View>
        ) : null}

        <Button
          mode="contained"
          onPress={() => router.replace('/(tabs)')}
          style={styles.cta}
          contentStyle={styles.ctaContent}>
          {t('claim.takeMeHome')}
        </Button>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  scroll: {
    padding: 24,
    paddingBottom: 40,
    alignItems: 'center',
  },
  iconWrap: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: SUCCESS_TINT,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    marginTop: 8,
  },
  title: { fontWeight: '700', textAlign: 'center', marginBottom: 8 },
  subtitle: {
    textAlign: 'center',
    opacity: 0.7,
    marginBottom: 32,
    lineHeight: 22,
    paddingHorizontal: 8,
  },
  unitsList: { width: '100%', marginBottom: 24 },
  unitCard: { marginBottom: 12 },
  unitContent: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  unitIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#EEEDFD',
    alignItems: 'center',
    justifyContent: 'center',
  },
  unitName: { fontWeight: '600' },
  unitMeta: { opacity: 0.7, marginTop: 2 },
  cta: { width: '100%', marginTop: 8 },
  ctaContent: { paddingVertical: 8 },
});
