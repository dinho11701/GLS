// app/Login.tsx
import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Image, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DeviceEventEmitter } from 'react-native';

let API_BASE = (process.env.EXPO_PUBLIC_API_BASE ?? 'http://localhost:5055/api/v1').replace(/\/+$/, '');
try {
  // @ts-ignore
  const mod = require('@lib/api');
  if (mod?.API_BASE) API_BASE = String(mod.API_BASE).replace(/\/+$/, '');
} catch {}

const toStr = (v: any) => (v == null ? '' : typeof v === 'string' ? v : String(v));

function normalizeErr(data: any, fallback = 'Erreur de connexion') {
  if (!data) return fallback;
  if (data.error === 'ValidationError' && Array.isArray(data.details)) {
    return data.details.map((d: any) => d?.msg).filter(Boolean).join(' — ') || fallback;
  }
  return (data?.message as string) || (data?.error as string) || fallback;
}

const stripSpaces = (s: string) =>
  s
    .replace(/[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000\uFEFF]/g, ' ')
    .replace(/\s+/g, '');

type Role = 'partner' | 'customer';

async function saveAuthLocal(payload: { token: any; role: Role; user?: any; refreshToken?: any }) {
  const tokenStr = toStr(payload.token);
  const refreshStr = toStr(payload.refreshToken);
  const user = payload.user ?? {};
  const displayName =
    user.displayName ||
    user.fullName ||
    user.name ||
    [user.firstName, user.lastName].filter(Boolean).join(' ') ||
    '';

  const kv: [string, string][] = [
    ['idToken', tokenStr],
    ['refreshToken', refreshStr],
    ['userRole', payload.role],
    ['userJson', JSON.stringify(user)],
  ];
  if (displayName) kv.push(['displayName', displayName]);

  await AsyncStorage.multiSet(kv);
}

let saveAuth: typeof saveAuthLocal = saveAuthLocal;
try {
  // @ts-ignore
  const mod = require('@lib/auth');
  if (typeof mod?.saveAuth === 'function') saveAuth = mod.saveAuth;
} catch {}

const PALETTE = {
  primary: '#0A0F2C',
  coral: '#FF6B6B',
  white: '#FFFFFF',
  offWhite: '#F9FAFB',
  textDim: 'rgba(255,255,255,0.85)',
  placeholder: '#9CA3AF',
  chipBg: 'rgba(255,255,255,0.12)',
  chipActive: '#FF6B6B',
};

export default function LoginScreen() {
  const router = useRouter();
  const { audience, returnTo } = useLocalSearchParams<{ audience?: string; returnTo?: string }>();
  const audienceNorm = (audience || '').toString().toLowerCase();

  const [pickedRole, setPickedRole] = useState<Role | null>(
    audienceNorm === 'partner'
      ? 'partner'
      : audienceNorm === 'customer'
      ? 'customer'
      : null
  );

  const roleToUse: Role = useMemo(
    () => pickedRole ?? (audienceNorm === 'partner' ? 'partner' : 'customer'),
    [pickedRole, audienceNorm]
  );

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  /** Déduire le rôle réel */
  const inferRoleFromUser = useCallback(
    (user: any): Role => {
      const claims = user?.claims || user?.customClaims || {};
      const raw =
        user?.role ||
        claims.role ||
        (claims.isPartner ? 'partner' : null) ||
        (user?.isPartner ? 'partner' : null);

      if (raw === 'partner' || raw === 'host') return 'partner';
      return roleToUse === 'partner' ? 'partner' : 'customer';
    },
    [roleToUse]
  );

  const finalizeLogin = useCallback(
    async (token: string, user: any, refreshToken?: any) => {
      const inferred = inferRoleFromUser(user);
      await saveAuth({ token, role: inferred, user, refreshToken });

      await AsyncStorage.setItem('userRole', inferred);

      if (inferred === 'partner') {
        await AsyncStorage.setItem('partner:token', token);
      } else {
        await AsyncStorage.removeItem('partner:token');
      }

      DeviceEventEmitter.emit('auth:changed', {
        at: Date.now(),
        signedIn: true,
        role: inferred,
      });

      if (returnTo) router.replace(String(returnTo));
      else if (inferred === 'partner') router.replace('/(tabs)/partner');
      else router.replace('/(tabs)');
    },
    [router, returnTo, inferRoleFromUser]
  );

  const onLoginPress = useCallback(async () => {
    if (loading) return;
    setErr(null);

    const cleanEmail = stripSpaces(email).toLowerCase().trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setErr('Adresse e-mail invalide.');
      return;
    }
    if (password.length < 6) {
      setErr('Mot de passe trop court (min. 6).');
      return;
    }

    setLoading(true);
    try {
      const resp = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mail: cleanEmail, password, audience: roleToUse }),
      });

      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(normalizeErr(data));

      const token = toStr(data.idToken ?? data.token);
      if (!token) throw new Error('Token manquant.');

      const refresh = toStr(data.refreshToken);
      const user = data.user ?? {};

      setPassword('');
      await finalizeLogin(token, user, refresh);
    } catch (e: any) {
      setErr(e?.message || 'Erreur de connexion');
    } finally {
      setLoading(false);
    }
  }, [email, password, roleToUse, loading, finalizeLogin]);

  const onCreateAccountPress = () => {
    const qs = roleToUse === 'partner' ? '?audience=partner' : '';
    router.push(`/Inscription${qs}`);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.select({ ios: 'padding', android: undefined })}
      style={styles.screen}
    >
      <ScrollView
        contentContainerStyle={styles.scrollInner}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.container}>
          
          {/* LOGO */}
          <View style={styles.logoContainer}>
            <Image
              source={require('@/assets/images/new-logo.png')}
              style={styles.logo}
              resizeMode="contain"
            />
            <Text style={styles.brandLine1}>LaSolution</Text>
            <Text style={styles.brandLine2}>App</Text>

            {/* Role picker */}
            <View style={styles.roleSwitchRow}>
              <TouchableOpacity
                onPress={() => setPickedRole('customer')}
                style={[
                  styles.roleChip,
                  roleToUse === 'customer' && styles.roleChipActive,
                ]}
              >
                <Text style={styles.roleChipText}>Client</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setPickedRole('partner')}
                style={[
                  styles.roleChip,
                  roleToUse === 'partner' && styles.roleChipActive,
                ]}
              >
                <Text style={styles.roleChipText}>Partenaire</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.roleLabel}>
              {roleToUse === 'partner'
                ? 'Connexion partenaire'
                : 'Connexion client'}
            </Text>
          </View>

          {/* FORM */}
          <View style={styles.form}>
            <Text style={styles.label}>Adresse e-mail</Text>
            <TextInput
              placeholder="Adresse e-mail"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.input}
              value={email}
              onChangeText={t => setEmail(stripSpaces(t))}
              placeholderTextColor={PALETTE.placeholder}
            />

            <Text style={[styles.label, { marginTop: 18 }]}>Mot de passe</Text>
            <View style={styles.inputWrap}>
              <TextInput
                placeholder="Mot de passe"
                secureTextEntry={!showPwd}
                style={[styles.input, styles.inputWithIcon]}
                value={password}
                onChangeText={setPassword}
                placeholderTextColor={PALETTE.placeholder}
              />
              <TouchableOpacity
                onPress={() => setShowPwd(v => !v)}
                style={styles.eyeBtn}
              >
                <Ionicons name={showPwd ? 'eye-off' : 'eye'} size={20} color="#fff" />
              </TouchableOpacity>
            </View>

            {!!err && <Text style={styles.errorText}>{err}</Text>}

            <TouchableOpacity
              style={[styles.buttonPrimary, loading && styles.disabled]}
              onPress={onLoginPress}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonPrimaryText}>Se connecter</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.linkOnly} onPress={onCreateAccountPress}>
              <Text style={styles.linkOnlyText}>Créer un compte</Text>
            </TouchableOpacity>
          </View>

        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/* ----------------- STYLES RESPONSIVE ----------------- */
const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: PALETTE.primary,
  },

  scrollInner: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: 40,
  },

  container: {
    width: '100%',
    maxWidth: 420,      // ⭐ IMPORTANT POUR WEB
    alignSelf: 'center',
    paddingHorizontal: 28,
  },

  logoContainer: {
    alignItems: 'center',
    marginBottom: 28,
  },
  logo: {
    width: 90,
    height: 90,
  },
  brandLine1: {
    color: PALETTE.white,
    fontSize: 22,
    fontWeight: '700',
    marginTop: 6,
  },
  brandLine2: {
    color: PALETTE.white,
    fontSize: 26,
    fontWeight: '800',
    marginTop: 2,
  },

  roleSwitchRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 14,
  },
  roleChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: PALETTE.chipBg,
  },
  roleChipActive: {
    backgroundColor: PALETTE.chipActive,
  },
  roleChipText: {
    color: PALETTE.white,
    fontWeight: '700',
  },
  roleLabel: {
    color: PALETTE.textDim,
    marginTop: 10,
    fontWeight: '700',
  },

  form: {
    marginTop: 12,
    width: '100%',
  },

  label: {
    color: PALETTE.white,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },

  input: {
    backgroundColor: PALETTE.offWhite,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    marginBottom: 12,
    fontSize: 16,
    color: '#0F172A',
    width: '100%',
  },

  inputWrap: {
    width: '100%',
    position: 'relative',
  },
  inputWithIcon: {
    paddingRight: 48,
  },

  eyeBtn: {
    position: 'absolute',
    right: 10,
    top: 10,
    height: 28,
    width: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  errorText: {
    color: '#FF6B6B',
    marginBottom: 10,
    fontWeight: '600',
  },

  buttonPrimary: {
    backgroundColor: PALETTE.coral,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    width: '100%',
    marginTop: 6,
  },
  buttonPrimaryText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 18,
  },

  linkOnly: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  linkOnlyText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },

  disabled: {
    opacity: 0.6,
  },
});
