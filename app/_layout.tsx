import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ReactNode, useEffect } from 'react';
import { PaperProvider } from 'react-native-paper';
import 'react-native-reanimated';

import { AuthProvider, useAuth } from '@/lib/auth/session';
import { GuardSessionProvider, useGuardSession } from '@/lib/guard/session';
import { PushListeners } from '@/lib/push/listeners';
import { paperDarkTheme, paperLightTheme } from '@/lib/theme/paper-theme';
import { ThemePrefProvider, useThemePref } from '@/lib/theme/provider';

const queryClient = new QueryClient();

/**
 * Decides which top-level group the user belongs in. Two modes:
 *
 *  - "owner" mode (default install): standard auth + (tabs). Guard-tablet
 *    pairing lives behind a footer link on the login screen, so we always
 *    allow /pair through.
 *  - "guard" mode (set after a successful pairing on this device): the user
 *    section is invisible. Each app launch shows the shift picker; once a
 *    shift is active, the guard tabs take over.
 */
function AuthGate({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const { paired, shift, loading: guardLoading } = useGuardSession();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (authLoading || guardLoading) return;

    const firstSeg = segments[0];
    const onPair = firstSeg === 'pair';
    const onShiftPicker = firstSeg === 'shift-picker';
    const inAuthGroup = firstSeg === '(auth)';
    const inTabsGroup = firstSeg === '(tabs)';
    const inGuardGroup = firstSeg === '(guard)';
    const inClaimGroup = firstSeg === 'claim';
    const inVisitorGroup = firstSeg === 'visitor';
    const inEventGroup = firstSeg === 'event';
    const inAnnouncementsGroup = firstSeg === 'announcements';
    const inMaintenanceGroup = firstSeg === 'maintenance';
    const inFacilityGroup = firstSeg === 'facility';
    const inBillingGroup = firstSeg === 'billing';
    const inGuardPassGroup = firstSeg === 'guard-pass';
    const inGuardSosGroup = firstSeg === 'guard-sos';
    const inGuardScanGroup = firstSeg === 'guard-scan';
    const inWalkInGroup = firstSeg === 'walk-in';

    // Pair screen is reachable from anywhere — owner login footer link, and
    // also as the recovery destination if a device gets revoked mid-shift.
    // Once pairing succeeds we MUST move off /pair, otherwise the form just
    // sits there with no feedback and the next submit hits a consumed code.
    if (onPair) {
      if (paired) {
        router.replace(shift ? '/(guard)' : '/shift-picker');
      }
      return;
    }

    if (paired) {
      // GUARD MODE
      if (!shift) {
        if (!onShiftPicker) {
          router.replace('/shift-picker');
        }
        return;
      }
      const inAllowedGuardRoute = inGuardGroup || inGuardPassGroup || inGuardSosGroup || inGuardScanGroup || inWalkInGroup;
      if (!inAllowedGuardRoute) {
        router.replace('/(guard)');
      }
      return;
    }

    // OWNER MODE
    if (!user) {
      if (!inAuthGroup) {
        router.replace('/(auth)/login');
      }
      return;
    }
    const inAllowedOwnerRoute = inTabsGroup || inClaimGroup || inVisitorGroup || inEventGroup || inAnnouncementsGroup || inMaintenanceGroup || inFacilityGroup || inBillingGroup;
    if (!inAllowedOwnerRoute) {
      router.replace('/(tabs)');
    }
  }, [user, authLoading, guardLoading, paired, shift, segments, router]);

  return <>{children}</>;
}

function ThemedShell({ children }: { children: ReactNode }) {
  const { mode } = useThemePref();
  const isDark = mode === 'dark';

  return (
    <PaperProvider theme={isDark ? paperDarkTheme : paperLightTheme}>
      <ThemeProvider value={isDark ? DarkTheme : DefaultTheme}>
        {children}
        <StatusBar style={isDark ? 'light' : 'dark'} />
      </ThemeProvider>
    </PaperProvider>
  );
}

export default function RootLayout() {
  return (
    <ThemePrefProvider>
      <ThemedShell>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <GuardSessionProvider>
              <PushListeners>
              <AuthGate>
                <Stack screenOptions={{ headerShown: false }}>
                  <Stack.Screen name="(auth)" />
                  <Stack.Screen name="(tabs)" />
                  <Stack.Screen name="(guard)" />
                  <Stack.Screen name="claim" />
                  <Stack.Screen name="visitor" />
                  <Stack.Screen name="guard-pass" />
                  <Stack.Screen name="guard-sos" />
                  <Stack.Screen name="guard-scan" />
                  <Stack.Screen name="pair" />
                  <Stack.Screen name="shift-picker" />
                  <Stack.Screen name="walk-in" />
                  <Stack.Screen name="event" />
                  <Stack.Screen name="announcements" />
                  <Stack.Screen name="maintenance" />
                  <Stack.Screen name="facility" />
                  <Stack.Screen name="billing" />
                </Stack>
              </AuthGate>
              </PushListeners>
            </GuardSessionProvider>
          </AuthProvider>
        </QueryClientProvider>
      </ThemedShell>
    </ThemePrefProvider>
  );
}
