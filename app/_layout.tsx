import 'react-native-gesture-handler';
import 'react-native-reanimated';

// 👇 FIX WEB : important avant tout import react-native
if (typeof window !== "undefined") {
  // Prevent errors when native-only modules are imported on Web
  // especially for react-native-maps, gesture-handler, reanimated, etc.
  // No-op handlers to avoid crashes
  // @ts-ignore
  global.__reanimatedWorkletInit = () => {};
}

import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useFonts } from 'expo-font';

export default function RootLayout() {
  const colorScheme = useColorScheme();

  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });
  if (!loaded) return null;

  const isDark = colorScheme === 'dark';

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={isDark ? DarkTheme : DefaultTheme}>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="Payment" options={{ headerShown: false }} />

          {/* Page d’erreur expo-router */}
          <Stack.Screen name="+not-found" options={{ title: 'Introuvable' }} />
        </Stack>

        <StatusBar style={isDark ? 'light' : 'dark'} />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
