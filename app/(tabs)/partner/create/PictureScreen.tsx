// app/(tabs)/partner/create/PictureScreen.tsx
import React, { useCallback, useEffect, useState } from 'react';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Image,
  Alert, ActivityIndicator, Platform
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter, useLocalSearchParams } from 'expo-router'; // 👈 ajouté

const PALETTE = {
  primary:'#0A0F2C', white:'#FFFFFF', cream:'#F9FAFB', textDark:'#0B1220',
  placeholder:'rgba(11,18,32,0.45)', coral:'#FF6B6B', gold:'#FFD700',
  peach:'#EF8A73', peachSoft:'#F8CBC1', border:'rgba(11,18,32,0.18)', ink:'rgba(11,18,32,0.08)'
};

type Pic = { uri:string; width?:number; height?:number };
const STORAGE_KEY = 'draft_service_step3_pictures';
const MAX = 6;

export default function PictureScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { from } = useLocalSearchParams<{ from?: string }>(); // 👈 récupère la provenance

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [cover, setCover] = useState<Pic | null>(null);
  const [gallery, setGallery] = useState<Pic[]>([]);

  // Chargement + migration éventuelle (images -> cover+gallery)
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const data: any = JSON.parse(raw);

          // Nouveau format déjà présent
          let newCover: Pic | null = data?.cover ?? null;
          let newGallery: Pic[] = Array.isArray(data?.gallery) ? data.gallery : [];

          // Ancien format: { images: Pic[] }
          if (!newCover && !newGallery?.length && Array.isArray(data?.images) && data.images.length) {
            newCover = data.images[0] ?? null;
            newGallery = data.images.slice(1);
          }

          setCover(newCover);
          setGallery(newGallery);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const askPermission = useCallback(async () => {
    if (Platform.OS === 'web') return true;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission requise', "Autorise l’accès à la galerie/appareil photo.");
      return false;
    }
    return true;
  }, []);

  const addPictures = useCallback((pics: Pic[]) => {
    setCover(c => c ?? pics.shift() ?? null);
    if (pics.length) setGallery(g => [...g, ...pics].slice(0, MAX - (cover ? 1 : 0)));
  }, [cover]);

  const pickAssets = useCallback(async (source: 'library' | 'camera') => {
    const total = (cover ? 1 : 0) + gallery.length;
    if (total >= MAX) return Alert.alert('Limite atteinte', `Jusqu’à ${MAX} photos.`);
    const ok = await askPermission(); if (!ok) return;

    if (source === 'library') {
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.9, selectionLimit: MAX - total
      });
      if (res.canceled) return;
      addPictures((res.assets ?? []).map(a => ({ uri:a.uri, width:a.width, height:a.height })));
    } else {
      const res = await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.9 });
      if (res.canceled) return;
      const a = res.assets?.[0]; if (!a) return;
      addPictures([{ uri:a.uri, width:a.width, height:a.height }]);
    }
  }, [askPermission, cover, gallery.length, addPictures]);

  const setAsCover = useCallback((p: Pic, idx?: number) => {
    setGallery(prev => {
      const next = [...prev];
      if (typeof idx === 'number') next.splice(idx, 1);
      if (cover) next.unshift(cover);
      return next;
    });
    setCover(p);
  }, [cover]);

  const removeCover = useCallback(() => {
    setCover(() => {
      const first = gallery[0] ?? null;
      if (first) setGallery(g => g.slice(1));
      return first;
    });
  }, [gallery]);

  const removeFromGallery = useCallback((idx: number) => {
    setGallery(prev => prev.filter((_, i) => i !== idx));
  }, []);

  // ✅ Sauvegarde en double format: {cover,gallery} + {images}
  const saveAndNext = useCallback(async () => {
    setSaving(true);
    try {
      const images: Pic[] = [
        ...(cover ? [cover] : []),
        ...gallery,
      ];
      await AsyncStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ cover, gallery, images }) // <-- compat ReviewScreen
      );

      // 👇 si on vient du Review, on y retourne directement
      if (from === 'review') {
        router.replace('/(tabs)/partner/create/ReviewScreen');
      } else {
        router.push('/(tabs)/partner/create/AvailabilityScreen');
      }
    } catch {
      Alert.alert('Erreur', 'Impossible de sauvegarder les photos.');
    } finally {
      setSaving(false);
    }
  }, [cover, gallery, router, from]);

  if (loading) {
    return (
      <View style={{ flex:1, alignItems:'center', justifyContent:'center', backgroundColor: PALETTE.cream }}>
        <ActivityIndicator color={PALETTE.primary} />
        <Text style={{ color: PALETTE.textDark, marginTop: 8 }}>Chargement…</Text>
      </View>
    );
  }

  const totalCount = (cover ? 1 : 0) + gallery.length;

  return (
    <View style={{ flex:1, backgroundColor: PALETTE.cream }}>
      <SafeAreaView style={{ flex:1 }}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => {
              // 👇 retour intelligent : si ouvert depuis Review, on replace Review
              if (from === 'review') {
                router.replace('/(tabs)/partner/create/ReviewScreen');
              } else {
                router.back();
              }
            }}
            hitSlop={{ top:10, bottom:10, left:10, right:10 }}
          >
            <Ionicons name="chevron-back" size={26} color={PALETTE.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Créer (Pro)</Text>
          <View style={{ width:26 }} />
        </View>

        {/* Step */}
        <View style={styles.stepBar}>
          <Text style={styles.stepTitle}>Étape 3/4 : Photos</Text>
          <View style={styles.progressTrack}><View style={[styles.progressFill, { width:'75%' }]} /></View>
          <Text style={styles.helperText}>Ajoute des images de qualité. {totalCount}/{MAX}</Text>
        </View>

        <ScrollView contentContainerStyle={{ padding:16, paddingBottom: (insets.bottom || 16) + 180 }}>
          {/* Cover card */}
          <View style={styles.heroCard}>
            {cover ? (
              <>
                <Image source={{ uri: cover.uri }} style={styles.heroImage} />
                <View style={styles.heroBadges}>
                  <View style={styles.badge}>
                    <Ionicons name="star" size={14} color={PALETTE.white} />
                    <Text style={styles.badgeText}>Cover</Text>
                  </View>
                </View>
                <View style={styles.heroActions}>
                  <TouchableOpacity style={styles.heroBtn} onPress={() => pickAssets('camera')}>
                    <Ionicons name="camera-outline" size={18} color={PALETTE.primary} />
                    <Text style={styles.heroBtnText}>Photo</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.heroBtn} onPress={() => pickAssets('library')}>
                    <Ionicons name="image-outline" size={18} color={PALETTE.primary} />
                    <Text style={styles.heroBtnText}>Galerie</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.heroBtn, { backgroundColor:'#fff0f0', borderColor:'#ffd6d6' }]} onPress={removeCover}>
                    <Ionicons name="trash-outline" size={18} color={PALETTE.coral} />
                    <Text style={[styles.heroBtnText, { color: PALETTE.coral }]}>Retirer</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <View style={styles.emptyHero}>
                <Ionicons name="images-outline" size={32} color={PALETTE.placeholder} />
                <Text style={styles.emptyTitle}>Ajoute ta première photo</Text>
                <Text style={styles.emptySub}>Une belle image de couverture attire plus de clients.</Text>
                <View style={{ flexDirection:'row', gap:8, marginTop:10 }}>
                  <TouchableOpacity style={styles.primaryBtn} onPress={() => pickAssets('camera')}>
                    <Ionicons name="camera-outline" size={18} color={PALETTE.white} />
                    <Text style={styles.primaryBtnText}>Prendre une photo</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.secondaryBtn} onPress={() => pickAssets('library')}>
                    <Ionicons name="image-outline" size={18} color={PALETTE.primary} />
                    <Text style={styles.secondaryBtnText}>Depuis galerie</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>

          {/* Grid */}
          {gallery.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Galerie</Text>
              <View style={styles.grid}>
                {gallery.map((img, idx) => (
                  <View key={`${img.uri}-${idx}`} style={styles.cell}>
                    <Image source={{ uri: img.uri }} style={styles.photo} />
                    <View style={styles.cellActions}>
                      <TouchableOpacity style={styles.cellBtn} onPress={() => setAsCover(img, idx)}>
                        <Ionicons name="star-outline" size={16} color={PALETTE.white} />
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.cellBtn, { backgroundColor:'rgba(0,0,0,0.55)' }]} onPress={() => removeFromGallery(idx)}>
                        <Ionicons name="trash-outline" size={16} color={PALETTE.white} />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
                {(cover ? 1 : 0) + gallery.length < MAX && (
                  <TouchableOpacity style={[styles.cell, styles.cellAdd]} onPress={() => pickAssets('library')}>
                    <Ionicons name="add" size={28} color={PALETTE.primary} />
                    <Text style={{ color: PALETTE.primary, fontWeight:'700', marginTop:4 }}>Ajouter</Text>
                  </TouchableOpacity>
                )}
              </View>
            </>
          )}
        </ScrollView>

        {/* Bottom CTA (relevé au-dessus du home-indicator) */}
        <View
          style={[
            styles.ctaBar,
            {
              bottom: (insets.bottom || 0) + 20,
              paddingBottom: 12,
              zIndex: 50,
              elevation: 8,
            },
          ]}
        >
          <TouchableOpacity
            style={[styles.cta, saving && { opacity: 0.6 }]}
            activeOpacity={0.9}
            disabled={saving}
            onPress={saveAndNext}
          >
            {saving ? <ActivityIndicator color={PALETTE.white} /> : <Text style={styles.ctaText}>Continuer</Text>}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

/* ===== Styles ===== */
const styles = StyleSheet.create({
  header:{ height:56, paddingHorizontal:16, backgroundColor:PALETTE.cream, borderBottomWidth:StyleSheet.hairlineWidth, borderBottomColor:PALETTE.border, flexDirection:'row', alignItems:'center', gap:12 },
  headerTitle:{ flex:1, color:PALETTE.primary, fontSize:24, fontWeight:'800' },

  stepBar:{ paddingHorizontal:16, paddingTop:14, paddingBottom:10, backgroundColor:PALETTE.cream, borderBottomColor:PALETTE.border, borderBottomWidth:StyleSheet.hairlineWidth },
  stepTitle:{ color:PALETTE.textDark, fontWeight:'800', fontSize:14, marginBottom:8 },
  progressTrack:{ height:8, backgroundColor:'#E6E9EF', borderRadius:999, overflow:'hidden' },
  progressFill:{ height:'100%', backgroundColor:PALETTE.gold },
  helperText:{ marginTop:8, color:'rgba(11,18,32,0.6)' },

  heroCard:{ backgroundColor:PALETTE.white, borderRadius:16, borderWidth:1, borderColor:PALETTE.ink, overflow:'hidden', shadowColor:'#000', shadowOpacity:0.06, shadowRadius:12, shadowOffset:{ width:0, height:4 } },
  heroImage:{ width:'100%', aspectRatio:16/9 },
  heroBadges:{ position:'absolute', top:10, left:10, flexDirection:'row', gap:6 },
  badge:{ flexDirection:'row', alignItems:'center', gap:6, backgroundColor:'rgba(0,0,0,0.55)', paddingHorizontal:10, paddingVertical:6, borderRadius:999 },
  badgeText:{ color:PALETTE.white, fontWeight:'700', fontSize:12 },
  heroActions:{ padding:12, flexDirection:'row', gap:8, backgroundColor:'#FAFBFC', borderTopWidth:StyleSheet.hairlineWidth, borderTopColor:PALETTE.ink },
  heroBtn:{ flexDirection:'row', alignItems:'center', gap:8, backgroundColor:PALETTE.white, borderWidth:1, borderColor:PALETTE.ink, paddingHorizontal:12, paddingVertical:10, borderRadius:999 },
  heroBtnText:{ color:PALETTE.primary, fontWeight:'800' },

  emptyHero:{ alignItems:'center', justifyContent:'center', paddingVertical:24, gap:8 },
  emptyTitle:{ color:PALETTE.textDark, fontWeight:'900', fontSize:16 },
  emptySub:{ color:PALETTE.placeholder, textAlign:'center', paddingHorizontal:8 },

  primaryBtn:{ flexDirection:'row', alignItems:'center', gap:8, backgroundColor:PALETTE.peach, paddingHorizontal:14, paddingVertical:12, borderRadius:999 },
  primaryBtnText:{ color:PALETTE.white, fontWeight:'900' },
  secondaryBtn:{ flexDirection:'row', alignItems:'center', gap:8, backgroundColor:PALETTE.white, borderWidth:1, borderColor:PALETTE.ink, paddingHorizontal:14, paddingVertical:12, borderRadius:999 },
  secondaryBtnText:{ color:PALETTE.primary, fontWeight:'800' },

  sectionTitle:{ marginTop:16, marginBottom:8, color:PALETTE.textDark, fontWeight:'800', fontSize:14 },
  grid:{ flexDirection:'row', flexWrap:'wrap', gap:10 },
  cell:{ width:'31.7%', aspectRatio:1, borderRadius:12, overflow:'hidden', backgroundColor:'#EEE', position:'relative' },
  cellAdd:{ borderWidth:1, borderColor:PALETTE.ink, alignItems:'center', justifyContent:'center', backgroundColor:PALETTE.white },
  photo:{ width:'100%', height:'100%' },
  cellActions:{ position:'absolute', top:6, right:6, gap:6 },
  cellBtn:{ width:26, height:26, borderRadius:13, backgroundColor:'rgba(0,0,0,0.4)', alignItems:'center', justifyContent:'center' },

  ctaBar:{ position:'absolute', left:0, right:0, backgroundColor:PALETTE.white, borderTopColor:PALETTE.border, borderTopWidth:StyleSheet.hairlineWidth, paddingHorizontal:16 },
  cta:{ backgroundColor:PALETTE.peach, borderRadius:16, paddingVertical:14, alignItems:'center', maxWidth:520, alignSelf:'center', width:'100%' },
  ctaText:{ color:PALETTE.white, fontWeight:'900', fontSize:16 },
});
