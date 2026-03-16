// app/(tabs)/_layout.native.tsx

import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, View, DeviceEventEmitter } from "react-native";
import { Tabs } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Ionicons from "@expo/vector-icons/Ionicons";

type Role = "host" | "customer";

const PALETTE = {
  primary: "#0A0F2C",
  accent: "#FF6B6B",
  inactive: "#8E8E93",
};

export default function TabsLayoutMobile() {
  const [role, setRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);

  const readRole = useCallback(async () => {
    const r = await AsyncStorage.getItem("userRole");
    const next: Role =
      r === "host" || r === "partner" ? "host" : "customer";
    setRole(next);
    setLoading(false);
  }, []);

  useEffect(() => {
    readRole();
    const sub = DeviceEventEmitter.addListener("auth:changed", () => {
      setLoading(true);
      readRole();
    });
    return () => sub.remove();
  }, [readRole]);

  if (loading || !role) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator color={PALETTE.accent} />
      </View>
    );
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: PALETTE.accent,
        tabBarInactiveTintColor: PALETTE.inactive,
        tabBarStyle: {
          backgroundColor: PALETTE.primary,
          height: 70,
          paddingBottom: 10,
        },
      }}
    >
      <Tabs.Screen
        name="HomeScreen"
        options={{
          title: "Accueil",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home" size={size} color={color} />
          ),
        }}
      />

      {/* CUSTOMER MAP */}
      <Tabs.Screen
        name="MapCustomer"
        options={{
          title: "Carte",
          href: role === "customer" ? undefined : null,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="map" size={size} color={color} />
          ),
        }}
      />

      {/* HOST MAP DIRECT */}
      <Tabs.Screen
        name="HostMap"
        options={{
          title: "Zone",
          href: role === "host" ? undefined : null,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="location" size={size} color={color} />
          ),
        }}
      />

      {/* CUSTOMER RESERVATIONS */}
      <Tabs.Screen
        name="reservations"
        options={{
          title: "Réservations",
          href: role === "customer" ? undefined : null,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="calendar" size={size} color={color} />
          ),
        }}
      />

      {/* DASHBOARD */}
      <Tabs.Screen
        name="partner"
        options={{
          title: "Dashboard",
          href: role === "host" ? undefined : null,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="briefcase" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: "Profil",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}