// app/(tabs)/partner/create/index.tsx
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

const PALETTE = {
  primary:   '#0A0F2C',
  white:     '#FFFFFF',
  cream:     '#F9FAFB',
  textDark:  '#0B1220',
  border:    'rgba(11,18,32,0.18)',
};

type ItemProps = {
  title: string;
  to: string;   // <- juste une string
};

function Item({ title, to }: ItemProps) {
  const router = useRouter();
  return (
    <TouchableOpacity style={styles.item} onPress={() => router.push(to)}>
      <Text style={styles.itemText}>{title}</Text>
    </TouchableOpacity>
  );
}

export default function PartnerCreateHome() {
  const router = useRouter();
  const [allowed, setAllowed] = useState<null | boolean>(null);

  useEffect(() => {
    (async () => {
      const r = await AsyncStorage.getItem('userRole');
      if (r === 'host' || r === 'partner') {
        setAllowed(true);
      } else {
        setAllowed(false);
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
  if (!allowed) return null;

  return (
    <View style={{ flex: 1, backgroundColor: PALETTE.cream }}>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Text style={styles.title}>Espace partenaire</Text>
        <Text style={styles.subtitle}>Créer / éditer votre offre</Text>

        <View style={styles.card}>
          <Item
            title="Infos de base"
            to="/(tabs)/partner/create/InfosBaseScreen?from=review"
          />
          <Item
            title="Tarification"
            to="/(tabs)/partner/create/PriceScreen?from=review"
          />
          <Item
            title="Photos"
            to="/(tabs)/partner/create/PictureScreen?from=review"
          />
          <Item
            title="Disponibilités"
            to="/(tabs)/partner/create/AvailabilityScreen?from=review"
          />
          <Item
            title="Récapitulatif"
            to="/(tabs)/partner/create/ReviewScreen"
          />
        </View>
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
    marginBottom: 12,
    fontWeight: '700',
  },
  card: {
    backgroundColor: PALETTE.white,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: PALETTE.border,
    padding: 8,
  },
  item: {
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: PALETTE.border,
  },
  itemText: {
    color: PALETTE.primary,
    fontWeight: '800',
  },
});
