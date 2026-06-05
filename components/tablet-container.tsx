import { ReactNode } from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';

import { useResponsive } from '@/lib/theme/responsive';

type Props = {
  children: ReactNode;
  /** Override the cap (default uses useResponsive().contentMaxWidth). */
  maxWidth?: number;
  /** Extra style on the centered inner view (e.g., backgroundColor). */
  style?: StyleProp<ViewStyle>;
};

/**
 * Wraps page content so on tablets it stays at a comfortable reading width
 * (centered, not stretched edge-to-edge). On phones it's a no-op pass-through.
 *
 * Wrap the children of a ScrollView's contentContainerStyle area, or the
 * children of a FlatList's ListHeaderComponent / ListFooterComponent.
 * For full lists themselves, prefer setting `columnWrapperStyle` width caps,
 * or use this wrapper as the FlatList parent and pass an inner FlatList.
 */
export function TabletContainer({ children, maxWidth, style }: Props) {
  const { isTablet, contentMaxWidth } = useResponsive();
  const cap = maxWidth ?? contentMaxWidth;

  if (!isTablet) {
    return <View style={style}>{children}</View>;
  }

  return (
    <View style={{ alignItems: 'center', width: '100%' }}>
      <View style={[{ width: '100%', maxWidth: cap }, style]}>{children}</View>
    </View>
  );
}
