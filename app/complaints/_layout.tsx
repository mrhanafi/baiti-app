import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function ComplaintsLayout() {
  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="new" />
        <Stack.Screen name="[id]" />
        <Stack.Screen name="reply/[id]" />
      </Stack>
    </>
  );
}
