import { Platform } from 'react-native';
import type { EdgeInsets } from 'react-native-safe-area-context';

/**
 * Native bottom tab bar height. Same constant the SOS FAB uses — keep these
 * two helpers as the only definitions so every floating button anchors
 * consistently across phone + tablet.
 */
export const TAB_BAR_HEIGHT = Platform.OS === 'ios' ? 49 : 56;

/**
 * Diameter of a default Paper FAB (the same size the SOS + visitor FABs use).
 * Exported so other floating elements can stack relative to a FAB without
 * eyeballing 56px in multiple files.
 */
export const FAB_SIZE = 56;

/**
 * Vertical anchor (in pixels from the screen bottom) for the SOS FAB.
 * Anything that needs to stack above SOS should add FAB_SIZE + a small gap.
 */
export function sosFabBottom(insets: EdgeInsets): number {
  return TAB_BAR_HEIGHT + insets.bottom + 16;
}
