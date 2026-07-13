import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { Icon } from 'react-native-paper';

import { GuardSosOverlay } from '@/components/guard-sos-overlay';
import { HapticTab } from '@/components/haptic-tab';

const PRIMARY = '#7367F0';

export default function GuardTabLayout() {
  const { t } = useTranslation();
  return (
    <View style={{ flex: 1 }}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarButton: HapticTab,
          tabBarActiveTintColor: PRIMARY,
        }}>
        <Tabs.Screen
          name="index"
          options={{
            title: t('guard.tabs.home'),
            tabBarIcon: ({ color }) => <Icon source="view-dashboard" size={26} color={color} />,
          }}
        />
        <Tabs.Screen
          name="today"
          options={{
            title: t('guard.tabs.today'),
            tabBarIcon: ({ color }) => <Icon source="calendar-today" size={26} color={color} />,
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: t('guard.tabs.profile'),
            tabBarIcon: ({ color }) => <Icon source="account-circle" size={26} color={color} />,
          }}
        />
      </Tabs>

      <GuardSosOverlay />
    </View>
  );
}
