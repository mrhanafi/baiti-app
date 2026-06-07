import { Stack } from 'expo-router';

export default function FacilityLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="bookings" />
      <Stack.Screen name="[id]" />
    </Stack>
  );
}
