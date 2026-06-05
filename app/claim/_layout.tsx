import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function ClaimLayout() {
  // We render our own purple header inside each screen (see ClaimHeader)
  // so it respects the safe-area inset and matches the Home tab band.
  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="success" />
      </Stack>
    </>
  );
}
