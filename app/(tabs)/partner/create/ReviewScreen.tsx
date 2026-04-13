// app/(tabs)/partner/create/ReviewScreen.tsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Image,
  Alert, ActivityIndicator, RefreshControl,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';

import * as Location from "expo-location";

const PALETTE = {
  primary: '#0A0F2C', white: '#FFFFFF', cream: '#F9FAFB', textDark:'#0B1220',
  placeholder:'rgba(11,18,32,0.45)', coral:'#FF6B6B', gold:'#FFD700',
  peach:'#EF8A73', peachSoft:'#F8CBC1', border:'rgba(11,18,32,0.18)',
};

const RAW_API_BASE = process.env.EXPO_PUBLIC_API_BASE ?? 'http://127.0.0.1:5055/api/v1';
const API_BASE = RAW_API_BASE.replace(/\/+$/, '');
const PUBLISH_URL = `${API_BASE}/partners/services`;

type Pic = { uri: string; width?: number; height?: number };
type DraftStep1 = { Service?: string; Categorie?: string; Description?: string; Activity_Secteur?: string };
type DraftStep2 = { price?: number; currency?: string };
type DraftStep3 = { images?: Pic[]; cover?: Pic | null; gallery?: Pic[] };

// ✅ maintenant avec instances
type DraftStep4 = {
  availability?: {
    days: number[];
    startTime: string;
    endTime: string;
    instances?: number;
  };
};

function uniqBy<T>(arr: T[], pick: (x: T) => string) {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const it of arr) {
    const k = pick(it);
    if (!seen.has(k)) { seen.add(k); out.push(it); }
  }
  return out;
}

// -- Wrapper: ajoute Authorization + tente /auth/refresh si 401
async function fetchWithAuth(url: string, init: RequestInit = {}) {
  const authToken = await AsyncStorage.getItem('authToken');
  const refreshToken = await AsyncStorage.getItem('refreshToken');

  const doFetch = (token?: string) =>
    fetch(url, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(init.headers || {}),
        Authorization: `Bearer ${token || authToken}`,
      } as any,
    });

  let resp = await doFetch();
  if (resp.status !== 401 || !refreshToken) return resp;

  try {
    const r = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok || !data.authToken) return resp; // garde le 401 original
    await AsyncStorage.setItem('authToken', String(data.authToken));
    resp = await doFetch(String(data.authToken)); // rejoue la requête
    return resp;
  } catch {
    return resp;
  }
}


export default function ReviewScreen() {
  const router = useRouter();
  
  const [coords, setCoords] = useState<any>(null);
  const [loadingLocation, setLoadingLocation] = useState(false);

  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [s1, setS1] = useState<DraftStep1 | null>(null);
  const [s2, setS2] = useState<DraftStep2 | null>(null);
  const [s3, setS3] = useState<DraftStep3 | null>(null);
  const [s4, setS4] = useState<DraftStep4 | null>(null);

  // ⚠️ Pas de garde de rôle ici (host/customer) — on laisse publier côté app

  const allPictures = useMemo<Pic[]>(() => {
    if (!s3) return [];
    const fromNew = [(s3.cover ?? undefined), ...(s3.gallery ?? [])].filter(Boolean) as Pic[];
    const list = fromNew.length ? fromNew : (s3.images ?? []);
    return uniqBy(list, (p) => String(p.uri));
  }, [s3]);


  const getLocation = async () => {
  try {
    setLoadingLocation(true);

    const { status } = await Location.requestForegroundPermissionsAsync();

    if (status !== "granted") {
      Alert.alert("Permission refusée", "Active le GPS pour publier");
      return null;
    }

    const loc = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });

    console.log("📍 HOST LOCATION:", loc.coords);

    setCoords(loc.coords);

    return loc.coords;

  } catch (e) {
    console.log("GPS error", e);
    return null;
  } finally {
    setLoadingLocation(false);
  }
};

  const loadDrafts = useCallback(async () => {
    try {
      const [a,b,c,d] = await Promise.all([
        AsyncStorage.getItem('draft_service_step1'),
        AsyncStorage.getItem('draft_service_step2_price'),
        AsyncStorage.getItem('draft_service_step3_pictures'),
        AsyncStorage.getItem('draft_service_step4_availability'),
      ]);
      setS1(a ? JSON.parse(a) : null);
      setS2(b ? JSON.parse(b) : null);

      if (c) {
        const raw = JSON.parse(c);
        const cover: Pic | null = raw?.cover ?? (Array.isArray(raw?.images) ? raw.images[0] ?? null : null);
        const gallery: Pic[] = Array.isArray(raw?.gallery)
          ? raw.gallery
          : (Array.isArray(raw?.images) ? raw.images.slice(1) : []);
        setS3({ cover, gallery, images: Array.isArray(raw?.images) ? raw.images : undefined });
      } else setS3(null);

      setS4(d ? JSON.parse(d) : null);
    } catch {
      Alert.alert('Erreur', 'Impossible de charger le brouillon.');
    }
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await loadDrafts();
      setLoading(false);
    })();
  }, [loadDrafts]);

  useFocusEffect(
    useCallback(() => { (async () => { await loadDrafts(); })(); return () => {}; }, [loadDrafts])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadDrafts();
    setRefreshing(false);
  }, [loadDrafts]);

  // ✅ Validation plus souple (dispos & photos optionnelles)
  const isValid = useMemo(() =>
  Boolean(
    s1?.Service?.trim() &&
    s1?.Categorie?.trim() &&
    (s1?.Description?.trim()?.length ?? 0) >= 3 &&
    Number(s2?.price) > 0
  ), [s1, s2]
)

  // --- CORRECTION DANS payload (vers ~ligne 230) ---

const payload = useMemo(() => {

  const fee =
    typeof s2?.price === "number"
      ? s2.price
      : Number(s2?.price) || 0

  return {

    title: s1?.Service?.trim(),

    description: s1?.Description?.trim(),

    // ton backend attend "category"
    category: s1?.Categorie?.trim(),

    fee: fee,

    // valeur temporaire
    radius_km: 10,

  }

}, [s1, s2])

  const publish = useCallback(async () => {

  if (!isValid) {
    Alert.alert("Champs manquants", "Complète les champs requis.");
    return;
  }

  let currentCoords = coords;

  if (!currentCoords) {
    currentCoords = await getLocation();

    if (!currentCoords) {
      Alert.alert("Erreur", "Impossible de récupérer ta position.");
      return;
    }
  }

  setPublishing(true);

  try {

    const token = await AsyncStorage.getItem("authToken");

    if (!token) {
      throw new Error("Non connecté — reconnecte-toi pour publier.");
    }

    const idempotency =
      `svc_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    const finalPayload = {
      ...payload,
      latitude: currentCoords.latitude,
      longitude: currentCoords.longitude,
    };

    console.log("🚀 FINAL PAYLOAD:", finalPayload);

    const resp = await fetchWithAuth(PUBLISH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Idempotency-Key": idempotency,
      },
      body: JSON.stringify(finalPayload),
    });

    const text = await resp.text();
    let data = {};

    try {
      data = text ? JSON.parse(text) : {};
    } catch {}

    const serviceId =
      data?.serviceId ?? data?.item?.id ?? data?.id ?? null;

    if (serviceId && s4?.availability) {
      await fetchWithAuth(
        `${API_BASE}/partners/services/${serviceId}/availability`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            days: s4.availability.days,
            startTime: s4.availability.startTime,
            endTime: s4.availability.endTime,
            instances: s4.availability.instances ?? 1,
          }),
        }
      );
    }

    if (!resp.ok) {
      const msg =
        (data?.message || data?.error || text || "Erreur de publication")
          .toString();
      throw new Error(`${msg} (HTTP ${resp.status})`);
    }

    await Promise.all([
      AsyncStorage.removeItem("draft_service_step1"),
      AsyncStorage.removeItem("draft_service_step2_price"),
      AsyncStorage.removeItem("draft_service_step3_pictures"),
      AsyncStorage.removeItem("draft_service_step4_availability"),
    ]);

    Alert.alert("Publié", "Ton offre a été publiée.", [
      {
        text: "OK",
        onPress: () => router.replace("/(tabs)/partner"),
      },
    ]);

  } catch (e: any) {
    Alert.alert("Échec", e?.message || "Impossible de publier.");
  } finally {
    setPublishing(false);
  }

}, [isValid, payload, router, coords]);

  if (loading) {
    return (
      <View style={{ flex:1, alignItems:'center', justifyContent:'center', backgroundColor:PALETTE.cream }}>
        <ActivityIndicator color={PALETTE.primary} />
        <Text style={{ color:PALETTE.textDark, marginTop:8 }}>Chargement du récap…</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: PALETTE.cream }}>
      <SafeAreaView style={{ flex: 1 }}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="chevron-back" size={26} color={PALETTE.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Récapitulatif</Text>
          <View style={{ width: 26 }} />
        </View>

        {/* Progress */}
        <View style={styles.stepBar}>
          <Text style={styles.stepTitle}>Vérifie puis publie</Text>
          <View style={styles.progressTrack}><View style={styles.progressFill} /></View>
        </View>

        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={PALETTE.primary} />}
        >
          {/* Infos de base */}
          <Section
            title="Infos de base"
            onEdit={() => router.push({ pathname: '/(tabs)/partner/create/InfosBaseScreen', params: { from: 'review' } })}
          >
            <Row label="Titre" value={s1?.Service || '—'} />
            <Row label="Catégorie" value={s1?.Categorie || '—'} />
            <Row label="Description" value={s1?.Description || '—'} multiline />
          </Section>

          {/* Tarification */}
          <Section
            title="Tarification"
            onEdit={() => router.push({ pathname: '/(tabs)/partner/create/PriceScreen', params: { from: 'review' } })}
          >
            <Row label="Prix" value={s2?.price ? `${s2.price} ${(s2?.currency || 'CAD').toUpperCase()}` : '—'} />
          </Section>

          {/* Photos */}
          <Section
            title="Photos"
            onEdit={() => router.push({ pathname: '/(tabs)/partner/create/PictureScreen', params: { from: 'review' } })}
          >
            {allPictures.length ? (
              <View style={styles.imagesGrid}>
                {allPictures.map((img, i) => (
                  <Image key={`${img.uri}-${i}`} source={{ uri: img.uri }} style={styles.photo} />
                ))}
              </View>
            ) : <Text style={styles.muted}>Aucune image ajoutée.</Text>}
          </Section>

          {/* Disponibilités */}
          <Section
            title="Disponibilités"
            onEdit={() => router.push({ pathname: '/(tabs)/partner/create/AvailabilityScreen', params: { from: 'review' } })}
          >
            <Row
              label="Jours"
              value={(s4?.availability?.days || [])
                .map(d => ['','Lun','Mar','Mer','Jeu','Ven','Sam','Dim'][d])
                .join(' • ') || '—'}
              multiline
            />
            <Row
              label="Heures"
              value={s4?.availability ? `${s4.availability.startTime} → ${s4.availability.endTime}` : '—'}
            />
            <Row
              label="Capacité"
              value={
                typeof s4?.availability?.instances === 'number'
                  ? `${s4.availability.instances} instance(s) en parallèle`
                  : '—'
              }
            />
          </Section>
        </ScrollView>

        {/* CTA */}
        <View style={styles.ctaBar}>
          <TouchableOpacity
            style={[styles.publishBtn, (!isValid || publishing) && { opacity: 0.6 }]}
            activeOpacity={0.9}
            disabled={!isValid || publishing}
            onPress={publish}
          >
            {publishing ? <ActivityIndicator color={PALETTE.white} /> : <Text style={styles.publishText}>Publier l’offre</Text>}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

/* UI bits */
function Section({ title, onEdit, children }: React.PropsWithChildren<{ title: string; onEdit: () => void }>) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{title}</Text>
        <TouchableOpacity onPress={onEdit} style={styles.editBtn}>
          <Ionicons name="create-outline" size={16} color={PALETTE.primary} />
          <Text style={styles.editText}>Modifier</Text>
        </TouchableOpacity>
      </View>
      {children}
    </View>
  );
}

function Row({ label, value, multiline }: { label: string; value?: string; multiline?: boolean }) {
  return (
    <View style={[styles.row, multiline && { alignItems: 'flex-start' }]}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, multiline && { lineHeight: 20 }]}>{value || '—'}</Text>
    </View>
  );
}

/* Styles */
const styles = StyleSheet.create({
  header: {
    height: 56, paddingHorizontal: 16, backgroundColor: PALETTE.cream,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: PALETTE.border,
    flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  headerTitle: { flex: 1, color: PALETTE.primary, fontSize: 24, fontWeight: '800' },

  stepBar: {
    paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10,
    backgroundColor: PALETTE.cream, borderBottomColor: PALETTE.border, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  stepTitle: { color: PALETTE.textDark, fontWeight: '800', fontSize: 14, marginBottom: 8 },
  progressTrack: { height: 8, backgroundColor: '#E6E9EF', borderRadius: 999, overflow: 'hidden' },
  progressFill: { width: '100%', height: '100%', backgroundColor: PALETTE.gold },

  card: {
    backgroundColor: PALETTE.white, borderRadius: 16, padding: 14, marginBottom: 12,
    borderWidth: 1.5, borderColor: PALETTE.border,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  cardTitle: { color: PALETTE.textDark, fontWeight: '900', fontSize: 16 },
  editBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: PALETTE.cream,
  },
  editText: { color: PALETTE.primary, fontWeight: '800', fontSize: 12 },

  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 8, gap: 12,
  },
  rowLabel: { color: 'rgba(11,18,32,0.75)', fontWeight: '800', width: 120 },
  rowValue: { color: PALETTE.textDark, fontWeight: '800', flex: 1 },

  imagesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  photo: { width: 96, height: 96, borderRadius: 10, backgroundColor: '#EEE' },
  muted: { color: 'rgba(11,18,32,0.6)' },

  ctaBar: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    backgroundColor: PALETTE.white, borderTopColor: PALETTE.border, borderTopWidth: StyleSheet.hairlineWidth,
    padding: 12,
  },
  publishBtn: { backgroundColor: PALETTE.peach, borderRadius: 16, paddingVertical: 14, alignItems: 'center' },
  publishText: { color: PALETTE.white, fontWeight: '900', fontSize: 16 },
});
