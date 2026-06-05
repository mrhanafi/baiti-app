import { MD3DarkTheme, MD3LightTheme } from 'react-native-paper';

// Vuexy primary purple — keeps mobile and web visually aligned.
const BAITI_PRIMARY = '#7367F0';

export const paperLightTheme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: BAITI_PRIMARY,
  },
};

export const paperDarkTheme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    primary: BAITI_PRIMARY,
  },
};
