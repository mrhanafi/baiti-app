import { useTranslation } from 'react-i18next';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { Avatar, Button, Card, List, Switch, Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useGuardSession } from '@/lib/guard/session';
import { useThemePref } from '@/lib/theme/provider';

const PRIMARY = '#7367F0';
const PRIMARY_TINT = '#EEEDFD';

export default function GuardProfileScreen() {
  const { shift, endShift, unpair } = useGuardSession();
  const { mode, setMode } = useThemePref();
  const { t } = useTranslation();
  const isDark = mode === 'dark';

  function handleEndShift() {
    Alert.alert(
      t('guard.profile.endShiftTitle'),
      t('guard.profile.endShiftBody', { name: shift?.staffName ?? t('guard.profile.currentGuard') }),
      [
        { text: t('guard.profile.stayOnShift'), style: 'cancel' },
        { text: t('guard.profile.endShift'), style: 'destructive', onPress: () => endShift() },
      ],
    );
  }

  function handleUnpair() {
    Alert.alert(
      t('guard.profile.unpairTitle'),
      t('guard.profile.unpairBody'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('guard.profile.unpair'), style: 'destructive', onPress: () => unpair() },
      ],
    );
  }

  const initial = (shift?.staffName?.[0] ?? '?').toUpperCase();
  const startedAt = shift ? new Date(shift.startedAt).toLocaleString() : '—';

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Card style={styles.card}>
          <Card.Content style={styles.row}>
            <Avatar.Text label={initial} size={64} style={{ backgroundColor: PRIMARY_TINT }} color={PRIMARY} />
            <View style={{ flex: 1 }}>
              <Text variant="titleMedium">{shift?.staffName ?? t('guard.profile.noOneOnShift')}</Text>
              <Text variant="bodySmall" style={styles.subtle}>{t('guard.profile.onDutySince', { time: startedAt })}</Text>
            </View>
          </Card.Content>
        </Card>

        <List.Section style={styles.list}>
          <List.Subheader>{t('guard.profile.appearance')}</List.Subheader>
          <List.Item
            title={t('guard.profile.darkMode')}
            left={(props) => <List.Icon {...props} icon="theme-light-dark" />}
            right={() => <Switch value={isDark} onValueChange={(v) => setMode(v ? 'dark' : 'light')} />}
          />
        </List.Section>

        <Button
          mode="contained"
          icon="account-switch-outline"
          onPress={handleEndShift}
          style={styles.action}
          contentStyle={styles.actionContent}>
          {t('guard.profile.endShift')}
        </Button>

        <Button
          mode="outlined"
          icon="link-off"
          onPress={handleUnpair}
          textColor="#ef4444"
          style={styles.action}
          contentStyle={styles.actionContent}>
          {t('guard.profile.unpairDevice')}
        </Button>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 24, paddingBottom: 40 },
  card: { marginBottom: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  subtle: { opacity: 0.6, marginTop: 2 },
  list: { marginHorizontal: -8, marginTop: 8 },
  action: { marginTop: 12 },
  actionContent: { paddingVertical: 6 },
});
