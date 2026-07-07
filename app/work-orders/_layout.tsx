import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function WorkOrdersLayout() {
  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="[id]" />
      </Stack>
    </>
  );
}
