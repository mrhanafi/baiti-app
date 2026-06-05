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
  const isDark = mode === 'dark';

  function handleEndShift() {
    Alert.alert(
      'End shift?',
      `${shift?.staffName ?? 'Current guard'} will be signed out. The next guard will need to tap their name.`,
      [
        { text: 'Stay on shift', style: 'cancel' },
        { text: 'End shift', style: 'destructive', onPress: () => endShift() },
      ],
    );
  }

  function handleUnpair() {
    Alert.alert(
      'Unpair this device?',
      'This removes the device link with your JMB. You will need a new pairing code to use this tablet again.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Unpair', style: 'destructive', onPress: () => unpair() },
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
              <Text variant="titleMedium">{shift?.staffName ?? 'No one on shift'}</Text>
              <Text variant="bodySmall" style={styles.subtle}>On duty since {startedAt}</Text>
            </View>
          </Card.Content>
        </Card>

        <List.Section style={styles.list}>
          <List.Subheader>Appearance</List.Subheader>
          <List.Item
            title="Dark mode"
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
          End shift
        </Button>

        <Button
          mode="outlined"
          icon="link-off"
          onPress={handleUnpair}
          textColor="#ef4444"
          style={styles.action}
          contentStyle={styles.actionContent}>
          Unpair this device
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
