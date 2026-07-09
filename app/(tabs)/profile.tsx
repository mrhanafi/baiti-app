import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Avatar, Button, Card, Icon, List, Switch, Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/lib/auth/session';
import { useThemePref } from '@/lib/theme/provider';

const PRIMARY = '#7367F0';
const PRIMARY_TINT = '#EEEDFD';

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const { mode, setMode } = useThemePref();
  const router = useRouter();
  const isDark = mode === 'dark';

  const initial = (user?.name?.[0] ?? '?').toUpperCase();
  const homes = user?.units ?? [];

  function handleThemeToggle(value: boolean) {
    setMode(value ? 'dark' : 'light');
  }

  return (
    // edges={['top']} adds padding to clear the status bar / notch.
    // Bottom is handled by the tab bar so we don't add it here.
    <SafeAreaView edges={['top']} style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Card style={styles.card}>
          <Card.Content style={styles.cardContent}>
            <Avatar.Text label={initial} size={64} />
            <View style={styles.userText}>
              <Text variant="titleMedium">{user?.name ?? '—'}</Text>
              <Text variant="bodySmall" style={styles.subtle}>{user?.email ?? ''}</Text>
              {user?.phone ? (
                <Text variant="bodySmall" style={styles.subtle}>{user.phone}</Text>
              ) : null}
            </View>
          </Card.Content>
        </Card>

        <Text variant="titleSmall" style={styles.sectionHeader}>My homes</Text>
        {homes.length === 0 ? (
          <Card style={styles.card}>
            <Card.Content>
              <Text variant="bodySmall" style={styles.subtle}>
                No homes yet. Verify with your IC to link your first unit.
              </Text>
            </Card.Content>
          </Card>
        ) : (
          homes.map((home) => (
            <Card key={home.id} style={styles.card}>
              <Card.Content style={styles.homeContent}>
                <View style={styles.homeIcon}>
                  <Icon source="home-city" size={24} color={PRIMARY} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text variant="titleSmall" style={styles.homeName}>
                    {home.property_name ?? 'Property'}
                  </Text>
                  <Text variant="bodySmall" style={styles.subtle}>
                    Unit {home.unit_number}
                    {home.block_name ? ` · ${home.block_name}` : ''}
                  </Text>
                  {home.organization_name ? (
                    <Text variant="bodySmall" style={styles.subtle}>
                      {home.organization_name}
                    </Text>
                  ) : null}
                </View>
              </Card.Content>
            </Card>
          ))
        )}

        <Button
          mode="outlined"
          icon="plus"
          onPress={() => router.push('/claim')}
          style={styles.addHome}>
          Add a home
        </Button>

        <List.Section style={styles.list}>
          <List.Subheader>Requests</List.Subheader>
          <List.Item
            title="Renovation permits"
            description="Ask your JMB before renovating"
            left={(props) => <List.Icon {...props} icon="hammer" />}
            right={(props) => <List.Icon {...props} icon="chevron-right" />}
            onPress={() => router.push('/renovation')}
          />
        </List.Section>

        <List.Section style={styles.list}>
          <List.Subheader>Appearance</List.Subheader>
          <List.Item
            title="Dark mode"
            left={(props) => <List.Icon {...props} icon="theme-light-dark" />}
            right={() => <Switch value={isDark} onValueChange={handleThemeToggle} />}
          />
        </List.Section>

        <Button
          mode="outlined"
          icon="logout"
          onPress={signOut}
          style={styles.logout}
          textColor="#E53935">
          Sign out
        </Button>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 24, paddingBottom: 40 },
  card: { marginBottom: 12 },
  cardContent: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  userText: { flex: 1 },
  subtle: { opacity: 0.6, marginTop: 2 },
  sectionHeader: { fontWeight: '600', marginBottom: 8, marginTop: 8 },
  homeContent: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  homeIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: PRIMARY_TINT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  homeName: { fontWeight: '600' },
  addHome: { marginTop: 4, marginBottom: 8 },
  list: { marginHorizontal: -8, marginTop: 8 },
  logout: { marginTop: 16 },
});
