import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function EventLayout() {
  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="new" />
        <Stack.Screen name="[id]" />
      </Stack>
    </>
  );
}
