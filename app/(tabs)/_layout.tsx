import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { HapticTab } from '@/components/haptic-tab';
import { SosButton } from '@/components/sos-button';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function TabLayout() {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();

  return (
    <View style={{ flex: 1 }}>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
          headerShown: false,
          tabBarButton: HapticTab,
        }}>
        <Tabs.Screen
          name="index"
          options={{
            title: t('tabs.home'),
            tabBarIcon: ({ color }) => <IconSymbol size={28} name="house.fill" color={color} />,
          }}
        />
        <Tabs.Screen
          name="visitors"
          options={{
            title: t('tabs.visitors'),
            tabBarIcon: ({ color }) => <IconSymbol size={28} name="person.2.fill" color={color} />,
          }}
        />
        <Tabs.Screen
          name="bills"
          options={{
            title: t('tabs.bills'),
            tabBarIcon: ({ color }) => <IconSymbol size={28} name="creditcard.fill" color={color} />,
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: t('tabs.profile'),
            tabBarIcon: ({ color }) => (
              <IconSymbol size={28} name="person.crop.circle" color={color} />
            ),
          }}
        />
      </Tabs>

      {/* Floating SOS button. Sits above the tab bar, visible on every tab screen. */}
      <SosButton />
    </View>
  );
}
