// app/(tabs)/Message/_layout.tsx
import { Stack } from 'expo-router';

export default function MessageLayout() {
  return (
    <Stack initialRouteName="index" screenOptions={{ headerShown:false, animation:'default', gestureEnabled:true }}>
      <Stack.Screen name="index" options={{ title:'Messages' }} />
      <Stack.Screen name="New" options={{ title:'Nouveau message' }} />
      <Stack.Screen name="[id]" options={{ title:'Conversation' }} />
    </Stack>
  );
}
