import "react-native-gesture-handler";
import "react-native-reanimated";

if (typeof window !== "undefined") {
  // @ts-ignore
  global.__reanimatedWorkletInit = () => {};
}

import "../globals.css";

import { GestureHandlerRootView } from "react-native-gesture-handler";
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { Stack, usePathname } from "expo-router";
import { StatusBar } from "expo-status-bar";
import {
  Platform,
  TouchableOpacity,
  Text,
  StyleSheet,
  View,
} from "react-native";
import { useColorScheme } from "@/hooks/useColorScheme";
import { useFonts } from "expo-font";
import { useEffect, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";

import SupportModal from "@/components/support/SupportModal";

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const pathname = usePathname();

  const [showSupport, setShowSupport] = useState(false);

  const [loaded] = useFonts({
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
    Ionicons: require("@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Ionicons.ttf"),
  });

  /* ⭐ FIX SCROLL WEB ⭐ */
  useEffect(() => {
    if (Platform.OS === "web") {
      document.body.style.overflow = "auto";
      document.documentElement.style.overflow = "auto";

      const root = document.getElementById("root");
      if (root) {
        root.style.overflow = "visible";
        root.style.height = "auto";
      }
    }
  }, []);

  if (!loaded) return null;

  // ❌ On cache le bouton support sur login
  const normalizedPath = pathname?.toLowerCase() ?? "";

  const hideSupport =
  normalizedPath === "/" ||              // index.tsx
  normalizedPath.startsWith("/inscription");

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={isDark ? DarkTheme : DefaultTheme}>
        {Platform.OS === "web" ? (
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="HomeScreen" />
            <Stack.Screen name="Message" />
            <Stack.Screen name="ProfilScreen" />
            <Stack.Screen name="Inscription" />
            <Stack.Screen name="+not-found" />
          </Stack>
        ) : (
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" />
	    <Stack.Screen name="payment" />
            <Stack.Screen name="Inscription" />
            <Stack.Screen name="+not-found" />
          </Stack>
        )}

        {/* 🔥 BOUTON SUPPORT GLOBAL */}
        {!hideSupport && (
          <SafeAreaView style={styles.supportWrapper}>
            <TouchableOpacity
              onPress={() => setShowSupport(true)}
              style={styles.supportButton}
              activeOpacity={0.8}
            >
              <Text style={styles.supportText}>?</Text>
            </TouchableOpacity>
          </SafeAreaView>
        )}

        {/* 🔥 MODAL SUPPORT */}
        <SupportModal
          visible={showSupport}
          onClose={() => setShowSupport(false)}
        />

        <StatusBar style={isDark ? "light" : "dark"} />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  supportWrapper: {
    position: "absolute",
    bottom: 30,
    right: 20,
  },
  supportButton: {
    backgroundColor: "#FF6B6B",
    width: 58,
    height: 58,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
    elevation: 8,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 4 },
  },
  supportText: {
    color: "white",
    fontSize: 26,
    fontWeight: "bold",
  },
});