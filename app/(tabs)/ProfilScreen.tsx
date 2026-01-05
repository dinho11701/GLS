// app/(tabs)/ProfileScreen.tsx
import React, { useEffect, useState, useCallback } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';

const PALETTE = {
  primary: '#0A0F2C',
  white: '#FFFFFF',
  cream: '#F9FAFB',
  textDark: '#0B1220',
  placeholder: 'rgba(255,255,255,0.65)',
  coral: '#FF6B6B',
  gold: '#FFD700',
};

const RAW_API_BASE =
  process.env.EXPO_PUBLIC_API_BASE ?? 'http://127.0.0.1:5055/api/v1';
const API_BASE = RAW_API_BASE.replace(/\/+$/, '');

type ModeKey = 'client' | 'pro';
type UserRole = 'customer' | 'partner' | 'host';

export default function ProfileScreen() {
  const router = useRouter();
  const [mode, setMode] = useState<ModeKey>('client');
  const [userRole, setUserRole] = useState<UserRole>('customer');
  const [isUpgrading, setIsUpgrading] = useState(false);

  // Charger le mode + rôle stockés
  useEffect(() => {
    (async () => {
      try {
        const [savedMode, savedRole] = await Promise.all([
          AsyncStorage.getItem('app_mode'),
          AsyncStorage.getItem('userRole'),
        ]);

        const role: UserRole =
          savedRole === 'partner' || savedRole === 'host'
            ? 'partner'
            : 'customer';
        setUserRole(role);

        // Si pas partenaire → on force mode client
        if (role === 'customer') {
          setMode('client');
          await AsyncStorage.setItem('app_mode', 'client');
        } else {
          // partenaire → on respecte le mode sauvegardé (sinon client par défaut)
          if (savedMode === 'pro' || savedMode === 'client') {
            setMode(savedMode as ModeKey);
          } else {
            setMode('pro');
            await AsyncStorage.setItem('app_mode', 'pro');
          }
        }
      } catch (e) {
        console.warn('[PROFILE][INIT]', e);
      }
    })();
  }, []);

  const upgradeToPartner = useCallback(async () => {
    setIsUpgrading(true);
    try {
      const idToken = await AsyncStorage.getItem('idToken');
      if (!idToken) {
        throw new Error('Vous devez être connecté pour devenir partenaire.');
      }

      const resp = await fetch(`${API_BASE}/customers/upgrade-to-partner`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
      });

      const data = await resp.json().catch(() => ({}));

      if (!resp.ok && resp.status !== 409) {
        const msg = data?.error || data?.message || 'Une erreur est survenue.';
        throw new Error(msg);
      }

      // OK: on est partenaire (nouveau ou déjà existant)
      setUserRole('partner');
      await AsyncStorage.setItem('userRole', 'partner');
      return true;
    } catch (e: any) {
      console.error('[UPGRADE_TO_PARTNER][ERROR]', e);
      Alert.alert(
        'Devenir partenaire',
        e?.message || 'Impossible de mettre à jour votre profil partenaire.',
      );
      return false;
    } finally {
      setIsUpgrading(false);
    }
  }, []);

  const saveMode = useCallback(
  async (next: ModeKey) => {
    if (next === mode) return;

    if (next === 'pro') {
      const ok = await upgradeToPartner();
      if (!ok) return; // on ne bascule pas si échec

      // 🔑 On marque ce compte comme partenaire dans le storage
      await AsyncStorage.setItem('userRole', 'partner');
    }

    setMode(next);
    await AsyncStorage.setItem('app_mode', next);

    if (next === 'pro') {
      router.push('/(tabs)/partner');
    }
  },
  [mode, upgradeToPartner, router],
);


  const profileLabel =
    mode === 'client' ? 'Mon profil (Client)' : 'Mon profil (Pro)';

  return (
    <View style={{ flex: 1, backgroundColor: PALETTE.primary }}>
      <SafeAreaView style={{ flex: 1 }}>
        {/* --------- Header --------- */}
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <TouchableOpacity
              onPress={() => router.back()}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="chevron-back" size={26} color={PALETTE.white} />
            </TouchableOpacity>
          </View>

          {/* Avatar + nom + sous-titre */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              marginTop: 6,
            }}
          >
            <Image
              source={require('../../assets/images/react-logo.png')}
              style={styles.avatar}
            />
            <View style={{ flex: 1 }}>
              <Text numberOfLines={1} style={styles.name}>
                Julie Dupont
              </Text>
              <Text numberOfLines={1} style={styles.subtitle}>
                Consultante innovation & growth
              </Text>
            </View>
          </View>

          {/* Bascule Client / Pro */}
          <View style={styles.modeSwitch}>
            <TogglePill
              label={isUpgrading ? '...' : 'Client'}
              icon="person-outline"
              active={mode === 'client'}
              onPress={() => !isUpgrading && saveMode('client')}
            />
            <TogglePill
              label={isUpgrading ? '...' : 'Pro'}
              icon="briefcase-outline"
              active={mode === 'pro'}
              onPress={() => !isUpgrading && saveMode('pro')}
            />
          </View>
        </View>

        {/* --------- Cartes principales --------- */}
        <ScrollView
          style={{ flex: 1, backgroundColor: PALETTE.primary }}
          contentContainerStyle={{ padding: 16, paddingBottom: 28, gap: 12 }}
        >
          <ActionCard
            title={profileLabel}
            subtitle="Informations du compte, coordonnées, vérifications"
            onPress={() =>
              mode === 'pro'
                ? router.push('/(tabs)/partner')
                : router.push('/profile/details')
            }
          />

          <ActionCard
            title="Paramètres"
            subtitle="Préférences, notifications, confidentialité"
            leftIcon="settings-outline"
            onPress={() => router.push('/settings')}
          />

          <ActionCard
            title="Paiements"
            subtitle="Moyens de paiement, factures et reçus"
            leftIcon="card-outline"
            onPress={() => router.push('/payments')}
          />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

/* ---------------- Composants ---------------- */

function TogglePill({
  label,
  icon,
  active,
  onPress,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.toggle, active && styles.toggleActive]}
      activeOpacity={0.9}
    >
      <Ionicons
        name={icon}
        size={14}
        color={active ? PALETTE.primary : '#1c1c1e'}
      />
      <Text style={[styles.toggleText, active && styles.toggleTextActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function ActionCard({
  title,
  subtitle,
  onPress,
  leftIcon,
  rightIcon = 'chevron-forward',
}: {
  title: string;
  subtitle?: string;
  onPress?: () => void;
  leftIcon?: keyof typeof Ionicons.glyphMap;
  rightIcon?: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.9} style={styles.card}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          flex: 1,
        }}
      >
        {leftIcon ? (
          <View style={styles.iconCircle}>
            <Ionicons name={leftIcon} size={18} color={PALETTE.gold} />
          </View>
        ) : (
          <View style={{ width: 0 }} />
        )}

        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {title}
          </Text>
          {!!subtitle && (
            <Text style={styles.cardSubtitle} numberOfLines={2}>
              {subtitle}
            </Text>
          )}
        </View>

        <Ionicons name={rightIcon} size={18} color="#0B1220" />
      </View>
    </TouchableOpacity>
  );
}

/* ---------------- Styles ---------------- */
const AVATAR = 56;

const styles = StyleSheet.create({
  header: {
    backgroundColor: PALETTE.primary,
    paddingHorizontal: 16,
    paddingBottom: 12,
    paddingTop: 4,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 40,
  },
  avatar: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
    borderWidth: 2,
    borderColor: PALETTE.gold,
  },
  name: {
    color: PALETTE.white,
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  subtitle: {
    color: PALETTE.placeholder,
    fontSize: 13,
    marginTop: 2,
  },
  modeSwitch: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
    backgroundColor: 'rgba(255,255,255,0.10)',
    padding: 6,
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    height: 34,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.6)',
  },
  toggleActive: {
    backgroundColor: PALETTE.gold,
    borderColor: PALETTE.gold,
  },
  toggleText: {
    fontSize: 13,
    color: '#1c1c1e',
    fontWeight: '700',
  },
  toggleTextActive: {
    color: PALETTE.primary,
  },
  card: {
    backgroundColor: PALETTE.white,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 14,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#0A0F2C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    color: PALETTE.textDark,
    fontSize: 16,
    fontWeight: '800',
  },
  cardSubtitle: {
    color: 'rgba(11,18,32,0.6)',
    fontSize: 12,
    marginTop: 4,
  },
});
