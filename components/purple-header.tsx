import { useRouter } from 'expo-router';
import { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { IconButton, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const PRIMARY = '#7367F0';

/**
 * Vuexy-purple header band used across stacked screens (claim flow, visitor
 * flow, etc.). Pads for the status bar via useSafeAreaInsets so it never
 * overlaps the system icons. Optional `right` slot for an action button.
 */
export function PurpleHeader({ title, showBack = true, right }: { title: string; showBack?: boolean; right?: ReactNode }) {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
      {showBack ? (
        <IconButton
          icon="arrow-left"
          iconColor="#fff"
          size={24}
          onPress={() => router.back()}
          style={styles.back}
        />
      ) : null}
      <Text style={[styles.title, { flex: 1 }]}>{title}</Text>
      {right ?? null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: PRIMARY,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingBottom: 12,
  },
  back: { margin: 0 },
  title: { color: '#fff', fontSize: 18, fontWeight: '600', marginLeft: 4 },
});
