// app/(tabs)/partner/index.tsx
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

const PALETTE = {
  primary: '#0A0F2C',
  white:   '#FFFFFF',
  cream:   '#F9FAFB',
  textDark:'#0B1220',
  border:  'rgba(11,18,32,0.18)',
};

type CardProps = {
  title: string;
  subtitle?: string;
  onPress: () => void;
};

function CardButton({ title, subtitle, onPress }: CardProps) {
  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.9} onPress={onPress}>
      <Text style={styles.cardTitle}>{title}</Text>
      {subtitle ? <Text style={styles.cardSubtitle}>{subtitle}</Text> : null}
    </TouchableOpacity>
  );
}

export default function PartnerHome() {
  const router = useRouter();
  const [allowed, setAllowed] = useState<null | boolean>(null);

  useEffect(() => {
    (async () => {
      const r = await AsyncStorage.getItem('userRole');
      // seul host / partner voient cette page
      if (r === 'host' || r === 'partner') {
        setAllowed(true);
      } else {
        setAllowed(false);
        // on renvoie le client à l’accueil
        router.replace('/(tabs)');
      }
    })();
  }, [router]);

  if (allowed === null) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: PALETTE.cream }}>
        <ActivityIndicator color={PALETTE.primary} />
      </View>
    );
  }

  if (!allowed) {
    // on ne flashe pas la page partenaire
    return null;
  }

  return (
    <View style={{ flex: 1, backgroundColor: PALETTE.cream }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        <Text style={styles.title}>Espace partenaire</Text>
        <Text style={styles.subtitle}>Gérez vos services et vos disponibilités</Text>

        <CardButton
          title="Créer / éditer mon offre"
          subtitle="Modifier les infos, prix, photos, etc."
          onPress={() => router.push('/(tabs)/partner/create')}
        />

        <CardButton
          title="Disponibilités"
          subtitle="Voir et ajuster les plages disponibles"
          onPress={() => router.push('/(tabs)/partner/availability')}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 22,
    fontWeight: '900',
    color: PALETTE.textDark,
    marginBottom: 4,
  },
  subtitle: {
    color: 'rgba(11,18,32,0.7)',
    marginBottom: 16,
    fontWeight: '700',
  },
  card: {
    backgroundColor: PALETTE.white,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: PALETTE.border,
    paddingVertical: 16,
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  cardTitle: {
    color: PALETTE.primary,
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 4,
  },
  cardSubtitle: {
    color: 'rgba(11,18,32,0.7)',
    fontSize: 13,
    fontWeight: '600',
  },
});
