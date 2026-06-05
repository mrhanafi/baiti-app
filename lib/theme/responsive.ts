import { useWindowDimensions } from 'react-native';
import {
  heightPercentageToDP as hp,
  widthPercentageToDP as wp,
} from 'react-native-responsive-screen';

/**
 * Two responsiveness layers — pick the right one for the job:
 *
 *  1. Percentage / scale helpers (`wp`, `hp`, `scale`, `moderateScale`)
 *     → use for values that should grow proportionally with screen size
 *       (paddings, icon sizes, text sizes inside a component).
 *
 *  2. `useResponsive()` hook → use for LAYOUT DECISIONS
 *       (column counts, whether to cap content width, portrait vs landscape).
 *
 * Rule of thumb: if the answer is "how big?", percentage. If the answer is
 * "which layout?", the hook.
 */

// ============================================================
// Percentage helpers — re-exported from react-native-responsive-screen
// ============================================================

export { wp, hp };

// ============================================================
// Size-matters style scaling
// ============================================================

const GUIDELINE_BASE_WIDTH = 375;   // iPhone 11/12/13 standard portrait width
const GUIDELINE_BASE_HEIGHT = 812;

/** Scale a size linearly with screen width. */
export function scale(size: number): number {
  return wp((size / GUIDELINE_BASE_WIDTH) * 100);
}

/** Scale a size linearly with screen height. */
export function verticalScale(size: number): number {
  return hp((size / GUIDELINE_BASE_HEIGHT) * 100);
}

/**
 * Scale a size, but only partially — feels more natural for text and small
 * UI elements that would otherwise grow too large on tablets.
 *
 * factor=0.5 is a sensible default — half-scaled.
 */
export function moderateScale(size: number, factor: number = 0.5): number {
  return size + (scale(size) - size) * factor;
}

// ============================================================
// Breakpoints + responsive hook
// ============================================================

export const BREAKPOINTS = {
  tablet: 600,        // anything >= 600pt width is treated as tablet-class
  large: 1024,        // big iPad / desktop web
} as const;

export type ResponsiveInfo = {
  width: number;
  height: number;
  isTablet: boolean;
  isLarge: boolean;
  isLandscape: boolean;
  /** Recommended max content width for centered single-column layouts. */
  contentMaxWidth: number;
  /** Suggested columns for grid layouts (visitors, services tiles, etc.). */
  gridColumns: 2 | 3 | 4;
};

/**
 * Layout-decision hook. Subscribes to dimension changes so values update on
 * device rotation (once landscape is unlocked in app.json).
 */
export function useResponsive(): ResponsiveInfo {
  const { width, height } = useWindowDimensions();
  const isTablet = width >= BREAKPOINTS.tablet;
  const isLarge = width >= BREAKPOINTS.large;
  const isLandscape = width > height;

  return {
    width,
    height,
    isTablet,
    isLarge,
    isLandscape,
    contentMaxWidth: isLarge ? 900 : isTablet ? 720 : width,
    gridColumns: isLarge ? 4 : isTablet ? 3 : 2,
  };
}
