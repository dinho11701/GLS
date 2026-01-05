// app/(tabs)/_layout.tsx
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, View, DeviceEventEmitter } from 'react-native';
import { Tabs } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from '@expo/vector-icons/Ionicons';

const PALETTE = { primary: '#0A0F2C' };

type Role = 'host' | 'customer';

export default function TabsLayout() {
  const [role, setRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);

  const readRole = useCallback(async () => {
    try {
      const r = await AsyncStorage.getItem('userRole');
      const next: Role = (r === 'host' || r === 'partner') ? 'host' : 'customer';
      setRole(next);
      console.log('[TabsLayout] userRole =', r, '→ role =', next);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // lecture initiale
    readRole();

    // login / logout / changement de rôle
    const sub = DeviceEventEmitter.addListener('auth:changed', () => {
      console.log('[TabsLayout] auth:changed → reload role');
      setLoading(true);
      readRole();
    });

    return () => {
      sub.remove();
    };
  }, [readRole]);

  if (loading || !role) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={PALETTE.primary} />
      </View>
    );
  }

  // 👇 Options dynamiques pour l’onglet partenaire (on n’y touche plus)
  const partnerTabOptions =
    role === 'host'
      ? {
          title: 'Partenaire',
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <Ionicons name="briefcase" color={color} size={size} />
          ),
        }
      : {
          // Client : l’onglet existe mais est totalement caché
          tabBarButton: () => null,
        };

  // 👇 Options dynamiques pour AccueilScreen (Carte)
  const accueilTabOptions =
    role === 'customer'
      ? {
          title: 'Carte',
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <Ionicons name="map" color={color} size={size} />
          ),
        }
      : {
          // Host : onglet complètement caché
          href: null,
        };

  return (
    <Tabs screenOptions={{ headerShown: false }}>
      {/* Commun : Accueil + Messages */}
      <Tabs.Screen
        name="HomeScreen"
        options={{
          title: 'Accueil',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home" color={color} size={size} />
          ),
        }}
      />

      <Tabs.Screen
        name="Message"
        options={{
          title: 'Messages',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="chatbubbles" color={color} size={size} />
          ),
        }}
      />

      {/* 🗺️ AccueilScreen : visible seulement pour le client */}
      <Tabs.Screen
        name="AccueilScreen"
        options={accueilTabOptions}
      />

      {/* 👤 CLIENT : onglets supplémentaires */}
      {role === 'customer' && (
        <>
          <Tabs.Screen
            name="SearchScreen"
            options={{
              title: 'Chercher',
              tabBarIcon: ({ color, size }) => (
                <Ionicons name="search" color={color} size={size} />
              ),
            }}
          />

          <Tabs.Screen
            name="BookingsScreen"
            options={{
              title: 'Réservations',
              tabBarIcon: ({ color, size }) => (
                <Ionicons name="calendar" color={color} size={size} />
              ),
            }}
          />
        </>
      )}

      {/* 🧰 PARTENAIRE */}
      <Tabs.Screen
        name="partner"
        options={partnerTabOptions}
      />

      {role === 'host' && (
        <>
          <Tabs.Screen
            name="partner/create/ReviewScreen"
            options={{ href: null }}
          />
          <Tabs.Screen
            name="partner/create/InfosBaseScreen"
            options={{ href: null }}
          />
          <Tabs.Screen
            name="partner/create/PriceScreen"
            options={{ href: null }}
          />
          <Tabs.Screen
            name="partner/create/PictureScreen"
            options={{ href: null }}
          />
          <Tabs.Screen
            name="partner/create/AvailabilityScreen"
            options={{ href: null }}
          />
        </>
      )}

      {/* Écrans techniques sans tab */}
      <Tabs.Screen
        name="DashboardScreen"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="InfoScreen"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="Inscription"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="ProfilScreen"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="explore"
        options={{ href: null }}
      />
    </Tabs>
  );
}
