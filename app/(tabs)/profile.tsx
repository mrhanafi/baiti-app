import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Avatar, Button, Card, Icon, List, Switch, Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/lib/auth/session';
import { LANGUAGES, setLocale, type LocaleCode } from '@/lib/i18n';
import { useThemePref } from '@/lib/theme/provider';

const PRIMARY = '#7367F0';
const PRIMARY_TINT = '#EEEDFD';

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const { mode, setMode } = useThemePref();
  const router = useRouter();
  const { t, i18n } = useTranslation();
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

        <Text variant="titleSmall" style={styles.sectionHeader}>{t('profile.myHomes')}</Text>
        {homes.length === 0 ? (
          <Card style={styles.card}>
            <Card.Content>
              <Text variant="bodySmall" style={styles.subtle}>
                {t('profile.noHomes')}
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
                    {t('common.unit', { number: home.unit_number })}
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
          {t('profile.addHome')}
        </Button>

        <List.Section style={styles.list}>
          <List.Subheader>{t('profile.requests')}</List.Subheader>
          <List.Item
            title={t('profile.renovationPermits')}
            description={t('profile.renovationPermitsDesc')}
            left={(props) => <List.Icon {...props} icon="hammer" />}
            right={(props) => <List.Icon {...props} icon="chevron-right" />}
            onPress={() => router.push('/renovation')}
          />
        </List.Section>

        <List.Section style={styles.list}>
          <List.Subheader>{t('profile.appearance')}</List.Subheader>
          <List.Item
            title={t('profile.darkMode')}
            left={(props) => <List.Icon {...props} icon="theme-light-dark" />}
            right={() => <Switch value={isDark} onValueChange={handleThemeToggle} />}
          />
        </List.Section>

        <List.Section style={styles.list}>
          <List.Subheader>{t('profile.language')}</List.Subheader>
          {LANGUAGES.map((lang) => (
            <List.Item
              key={lang.code}
              title={lang.label}
              left={(props) => <List.Icon {...props} icon="translate" />}
              right={(props) =>
                i18n.language === lang.code ? <List.Icon {...props} icon="check" color={PRIMARY} /> : null
              }
              onPress={() => void setLocale(lang.code as LocaleCode)}
            />
          ))}
        </List.Section>

        <Button
          mode="outlined"
          icon="logout"
          onPress={signOut}
          style={styles.logout}
          textColor="#E53935">
          {t('profile.signOut')}
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
