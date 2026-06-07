import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

/**
 * Configure how foreground notifications appear when the app is in use.
 * Without this, foreground pushes are silently swallowed on iOS.
 */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/**
 * Asks for permission and returns an Expo push token. Returns null (does NOT
 * throw) for any non-fatal "can't get a token" reason so callers can keep
 * going — push is best-effort, login should never fail because of it.
 */
export async function getExpoPushToken(): Promise<string | null> {
  // Set the Android notification channel before anything else. This must be
  // done up-front for Android 8+ — without a channel, no push will show.
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#7367F0',
    });

    // Dedicated SOS channel — bypasses Do Not Disturb on Android.
    await Notifications.setNotificationChannelAsync('sos', {
      name: 'SOS alerts',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 500, 250, 500, 250, 500],
      lightColor: '#dc2626',
      sound: 'default',
      bypassDnd: true,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });
  }

  // Push only works on physical devices, not simulators.
  if (!Device.isDevice) {
    return null;
  }

  const existing = await Notifications.getPermissionsAsync();
  let status = existing.status;
  if (status !== 'granted') {
    const requested = await Notifications.requestPermissionsAsync();
    status = requested.status;
  }
  if (status !== 'granted') {
    return null;
  }

  const projectId =
    Constants?.expoConfig?.extra?.eas?.projectId ??
    Constants?.easConfig?.projectId;
  if (!projectId) {
    // Missing EAS project ID — running from a misconfigured build.
    return null;
  }

  try {
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    // Dev-only log so you can copy the token and paste it into
    // https://expo.dev/notifications for a manual test push.
    console.log('[push] Expo push token:', data);
    return data;
  } catch {
    return null;
  }
}
