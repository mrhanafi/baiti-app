import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Card, Icon, IconButton, Text, useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TabletContainer } from '@/components/tablet-container';
import { UnitSwitcherModal } from '@/components/unit-switcher-modal';
import { apiFetch } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/session';

const SELECTED_UNIT_KEY = 'baiti.home.selected_unit_id';

type TodayPass = {
  id: string;
  visitor_name: string;
  purpose: string;
  vehicle_plate: string | null;
  valid_from: string;
  valid_until: string;
  visit_state: 'awaiting' | 'inside' | 'out' | 'upcoming' | 'expired' | 'cancelled';
  is_walk_in: boolean;
  open_entry: { visit_tag: string; scanned_at: string } | null;
};

// Vuexy purple — used for the header band + accent tints.
const PRIMARY = '#7367F0';
// Subtle purple wash for the property-card icon background.
const PRIMARY_TINT = '#EEEDFD';

type AnnouncementPreview = {
  id: string;
  title: string;
  body: string;
  pinned: boolean;
  published_at: string;
  organization?: { id: string | null; legal_name: string | null } | null;
};

type ServiceItem = {
  label: string;
  icon: string;
  href?: string;  // tap target — undefined means "coming soon" alert
  module?: string;  // optional module key — tile hidden when the JMB has it disabled
};

const SERVICES: ServiceItem[] = [
  { label: 'Complaints', icon: 'comment-alert', href: '/complaints', module: 'community' },
  { label: 'Maintenance', icon: 'tools', href: '/building-maintenance', module: 'maintenance' },
  { label: 'Facility', icon: 'pool', href: '/facility', module: 'facility' },
  { label: 'Utilities', icon: 'lightning-bolt', href: '/utilities' },
  { label: 'Announcements', icon: 'bullhorn', href: '/announcements', module: 'community' },
];

export default function HomeScreen() {
  const { user, refreshUser } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const firstName = user?.name?.split(' ')[0] ?? 'there';

  // Selected unit — persists across launches. Falls back to first unit if
  // nothing saved or if the saved id no longer matches (e.g. user moved out).
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const [switcherOpen, setSwitcherOpen] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(SELECTED_UNIT_KEY).then((saved) => {
      if (saved && user?.units?.some((u) => u.id === saved)) {
        setSelectedUnitId(saved);
      }
    });
  }, [user?.units]);

  const primaryUnit = user?.units?.find((u) => u.id === selectedUnitId) ?? user?.units?.[0];
  const primaryProperty = primaryUnit?.property_name ?? 'No property linked';

  const hasActiveOrg = (user?.organizations?.length ?? 0) > 0;
  const pendingOrg = user?.pending_organizations?.[0];

  // Filter tiles by the active home's JMB modules. When the org can't be
  // resolved or the payload has no module list, show everything.
  const activeOrg = user?.organizations?.find((o) => o.id === primaryUnit?.organization_id);
  const services = SERVICES.filter((s) => {
    if (!s.module) return true;
    if (!activeOrg?.enabled_modules) return true;
    return activeOrg.enabled_modules.includes(s.module);
  });

  const [checking, setChecking] = useState(false);
  const [todayPasses, setTodayPasses] = useState<TodayPass[]>([]);
  const [announcements, setAnnouncements] = useState<AnnouncementPreview[]>([]);
  const unreadCount = user?.unread_announcements_count ?? 0;

  // Refresh "Today's visitors" + latest announcements whenever the Home tab
  // is focused, so anything created elsewhere shows up here automatically.
  useFocusEffect(
    useCallback(() => {
      if (!hasActiveOrg) return;
      let cancelled = false;
      (async () => {
        try {
          const data = await apiFetch('/api/v1/me/visitor-passes?filter=today');
          if (!cancelled) setTodayPasses(data.passes ?? []);
        } catch {
          if (!cancelled) setTodayPasses([]);
        }
        try {
          const data = await apiFetch('/api/v1/announcements?limit=2');
          if (!cancelled) setAnnouncements(data.announcements ?? []);
        } catch {
          if (!cancelled) setAnnouncements([]);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [hasActiveOrg]),
  );

  async function handleCheckStatus() {
    setChecking(true);
    try {
      await refreshUser();
    } catch {
      Alert.alert('Could not check status', 'Check your connection and try again.');
    }
    setChecking(false);
  }

  function handleServicePress(service: ServiceItem) {
    if (service.href) {
      router.push(service.href as never);
    } else {
      Alert.alert(service.label, `${service.label} module is not built yet. Coming soon.`);
    }
  }

  function handlePropertyPress() {
    if ((user?.units?.length ?? 0) <= 1) {
      return;   // only one unit — no point opening the switcher
    }
    setSwitcherOpen(true);
  }

  async function handleUnitSelected(unitId: string) {
    setSelectedUnitId(unitId);
    await AsyncStorage.setItem(SELECTED_UNIT_KEY, unitId);
  }

  // Onboarding state: user has signed up but has no active and no pending org.
  // Show a focused "register your property" empty state instead of the dashboard.
  if (!hasActiveOrg && !pendingOrg) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <StatusBar style="light" />
        <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
          <Text style={styles.greeting}>Hi, {firstName} 👋</Text>
        </View>
        <View style={styles.emptyStateContainer}>
          <View style={styles.emptyIcon}>
            <Icon source="shield-check-outline" size={48} color={PRIMARY} />
          </View>
          <Text variant="titleLarge" style={styles.emptyTitle}>
            Verify your home
          </Text>
          <Text variant="bodyMedium" style={styles.emptyBody}>
            Enter your IC and we&apos;ll match it with your JMB&apos;s owner registry. If it
            matches, you&apos;re in instantly.
          </Text>
          <Button
            mode="contained"
            onPress={() => router.push('/claim')}
            style={styles.emptyCta}
            contentStyle={styles.buttonContent}>
            Verify with IC
          </Button>
        </View>
      </View>
    );
  }

  // Pending approval state: claim submitted, waiting on JMB admin.
  if (!hasActiveOrg && pendingOrg) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <StatusBar style="light" />
        <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
          <Text style={styles.greeting}>Hi, {firstName} 👋</Text>
        </View>
        <View style={styles.emptyStateContainer}>
          <View style={styles.pendingIcon}>
            <Icon source="clock-outline" size={48} color="#f59e0b" />
          </View>
          <Text variant="titleLarge" style={styles.emptyTitle}>
            Waiting for approval
          </Text>
          <Text variant="bodyMedium" style={styles.emptyBody}>
            Your registration with{' '}
            <Text style={styles.emphasis}>{pendingOrg.legal_name}</Text> is pending. Your JMB admin
            will approve it shortly. You&apos;ll get an email when it&apos;s done.
          </Text>
          <Button
            mode="contained"
            onPress={handleCheckStatus}
            loading={checking}
            disabled={checking}
            style={styles.emptyCta}
            contentStyle={styles.buttonContent}>
            Check status
          </Button>
          <Button
            mode="text"
            onPress={() => router.push('/claim')}
            style={styles.emptySecondary}>
            Try a different IC
          </Button>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* White status bar icons on the purple header band */}
      <StatusBar style="light" />

      {/* Purple header — extends behind the status bar via paddingTop. */}
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <View style={styles.headerTop}>
          <Text style={styles.greeting}>Hi, {firstName} 👋</Text>
          <IconButton icon="bell-outline" iconColor="#fff" size={24} onPress={() => {}} />
        </View>

        {/* Property selection pill — tap to switch when user has multiple homes */}
        <Pressable
          onPress={handlePropertyPress}
          style={[styles.propertyCard, { backgroundColor: theme.colors.surface }]}>
          <View style={styles.propertyIcon}>
            <Icon source="home-city" size={24} color={PRIMARY} />
          </View>
          <View style={styles.propertyText}>
            <Text variant="titleSmall" style={styles.propertyName}>
              {primaryProperty}
            </Text>
            {primaryUnit ? (
              <Text variant="bodySmall" style={styles.propertyUnit}>
                Unit {primaryUnit.unit_number}
                {primaryUnit.block_name ? ` · ${primaryUnit.block_name}` : ''}
              </Text>
            ) : null}
          </View>
          <Icon source="chevron-down" size={24} color="#9ca3af" />
        </Pressable>
      </View>

      {/* Scrollable content below the header */}
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
       <TabletContainer>
        <View style={styles.sectionRow}>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            Today&apos;s visitors
          </Text>
          {todayPasses.length > 0 ? (
            <Pressable onPress={() => router.push('/(tabs)/visitors')}>
              <Text variant="bodySmall" style={styles.seeAll}>See all</Text>
            </Pressable>
          ) : null}
        </View>
        {todayPasses.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Card.Content>
              <Text style={styles.emptyText}>No visitors today.</Text>
            </Card.Content>
          </Card>
        ) : (
          todayPasses.slice(0, 3).map((p) => (
            <Card
              key={p.id}
              style={styles.visitorCard}
              onPress={() => router.push({ pathname: '/visitor/[id]', params: { id: p.id } })}>
              <Card.Content style={styles.visitorContent}>
                <View style={styles.visitorIcon}>
                  <Icon source="account" size={24} color={PRIMARY} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.nameRow}>
                    <Text variant="titleSmall" style={styles.visitorName}>{p.visitor_name}</Text>
                    {p.is_walk_in ? (
                      <View style={styles.walkInBadge}>
                        <Text style={styles.walkInBadgeText}>Walk-in</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text variant="bodySmall" style={styles.visitorMeta}>
                    {p.purpose.charAt(0).toUpperCase() + p.purpose.slice(1)}
                    {p.vehicle_plate ? ` · ${p.vehicle_plate}` : ''}
                  </Text>
                </View>
                {p.visit_state === 'inside' ? (
                  <View style={styles.insidePill}>
                    <Text style={styles.insidePillText}>Inside</Text>
                  </View>
                ) : null}
              </Card.Content>
            </Card>
          ))
        )}

        <View style={styles.sectionRow}>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            Latest announcements{unreadCount > 0 ? ` (${unreadCount} new)` : ''}
          </Text>
          {announcements.length > 0 ? (
            <Pressable onPress={() => router.push('/announcements')}>
              <Text variant="bodySmall" style={styles.seeAll}>See all</Text>
            </Pressable>
          ) : null}
        </View>
        {announcements.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Card.Content>
              <Text style={styles.emptyText}>No announcements yet.</Text>
            </Card.Content>
          </Card>
        ) : (
          announcements.map((a) => (
            <Card
              key={a.id}
              style={styles.announcementCard}
              onPress={() => router.push({ pathname: '/announcements/[id]', params: { id: a.id } })}>
              <Card.Content>
                <View style={styles.titleRow}>
                  {a.pinned ? (
                    <View style={styles.pinPill}>
                      <Text style={styles.pinText}>📌</Text>
                    </View>
                  ) : null}
                  <Text variant="titleSmall" style={styles.announcementTitle}>{a.title}</Text>
                </View>
                <Text variant="bodySmall" style={styles.announcementBody} numberOfLines={2}>
                  {a.body}
                </Text>
                <View style={styles.announcementMetaRow}>
                  {a.organization?.legal_name ? (
                    <View
                      style={[
                        styles.jmbBadge,
                        { backgroundColor: theme.colors.surfaceVariant },
                      ]}>
                      <Icon source="city-variant-outline" size={11} color={theme.colors.onSurfaceVariant} />
                      <Text
                        style={[styles.jmbBadgeText, { color: theme.colors.onSurfaceVariant }]}
                        numberOfLines={1}>
                        {a.organization.legal_name}
                      </Text>
                    </View>
                  ) : null}
                  <Text variant="bodySmall" style={styles.announcementMeta}>
                    {new Date(a.published_at).toLocaleString()}
                  </Text>
                </View>
              </Card.Content>
            </Card>
          ))
        )}

        <Text variant="titleMedium" style={styles.sectionTitle}>
          Services
        </Text>
        <View style={styles.servicesGrid}>
          {services.map((service) => (
            <Card
              key={service.label}
              style={styles.serviceCard}
              onPress={() => handleServicePress(service)}>
              <Card.Content style={styles.serviceContent}>
                <View style={styles.serviceIconWrap}>
                  <Icon source={service.icon} size={28} color={PRIMARY} />
                </View>
                <Text variant="bodyMedium" style={styles.serviceLabel}>
                  {service.label}
                </Text>
              </Card.Content>
            </Card>
          ))}
        </View>

        {/* Padding so the last service row clears the SOS FAB + tab bar */}
        <View style={styles.bottomSpacer} />
       </TabletContainer>
      </ScrollView>

      <UnitSwitcherModal
        visible={switcherOpen}
        units={user?.units ?? []}
        selectedUnitId={primaryUnit?.id ?? null}
        onDismiss={() => setSwitcherOpen(false)}
        onSelect={handleUnitSelected}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  // Purple header band
  header: {
    backgroundColor: PRIMARY,
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  greeting: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '600',
  },

  // Property pill sitting inside the purple header. Surface colour comes
  // from theme (theme.colors.surface) so it adapts to dark mode.
  propertyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 12,
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  propertyIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: PRIMARY_TINT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  propertyText: { flex: 1 },
  propertyName: { fontWeight: '600' },
  propertyUnit: { opacity: 0.6, marginTop: 2 },

  // Content area
  content: { padding: 16 },
  sectionTitle: { marginTop: 8, marginBottom: 8 },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  seeAll: { color: PRIMARY, fontWeight: '600' },
  emptyCard: { marginBottom: 4 },

  visitorCard: { marginBottom: 8 },
  visitorContent: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  visitorIcon: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: PRIMARY_TINT,
    alignItems: 'center', justifyContent: 'center',
  },
  visitorName: { fontWeight: '600' },
  visitorMeta: { opacity: 0.65, marginTop: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  walkInBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, backgroundColor: '#fef3c7' },
  walkInBadgeText: { color: '#92400e', fontSize: 10, fontWeight: '700' },
  insidePill: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: '#dbeafe',
  },
  insidePillText: { color: '#1d4ed8', fontSize: 11, fontWeight: '700' },
  emptyText: { opacity: 0.5, textAlign: 'center' },

  // Latest announcements section
  announcementCard: { marginBottom: 8 },
  announcementMetaRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginTop: 8, flexWrap: 'wrap',
  },
  jmbBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 999,
    maxWidth: '70%',
  },
  jmbBadgeText: { fontSize: 11, fontWeight: '500' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  pinPill: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999, backgroundColor: PRIMARY_TINT },
  pinText: { fontSize: 11, fontWeight: '700', color: PRIMARY },
  announcementTitle: { fontWeight: '600', flex: 1, minWidth: 0 },
  announcementBody: { opacity: 0.65, marginTop: 4 },
  announcementMeta: { opacity: 0.45, marginTop: 6 },

  // Services 2×2 grid
  servicesGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  serviceCard: { width: '48%', marginBottom: 12 },
  serviceContent: { alignItems: 'center', paddingVertical: 16 },
  serviceIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: PRIMARY_TINT,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  serviceLabel: { fontWeight: '500' },

  bottomSpacer: { height: 140 },

  // Empty / pending state shared layout
  emptyStateContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: PRIMARY_TINT,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  pendingIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#FFF5E5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: { marginBottom: 8, textAlign: 'center', fontWeight: '600' },
  emptyBody: { textAlign: 'center', opacity: 0.7, marginBottom: 24, lineHeight: 22 },
  emphasis: { fontWeight: '600', opacity: 1 },
  emptyCta: { width: '100%' },
  emptySecondary: { marginTop: 8 },
  buttonContent: { paddingVertical: 6 },
});
