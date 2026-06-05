import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function WalkInLayout() {
  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
      </Stack>
    </>
  );
}
