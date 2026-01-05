import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TextInput, FlatList, TouchableOpacity, Dimensions, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';

/* Palette */
const PALETTE = {
  primary: '#0A0F2C', white: '#FFFFFF', cream: '#F9FAFB',
  textDark:'#0B1220', placeholder:'rgba(11,18,32,0.45)', coral:'#FF6B6B',
};

const { width } = Dimensions.get('window');
const GAP = 14;
const TILE_SIZE = (width - 16 * 2 - GAP) / 2;

const RAW_API_BASE = process.env.EXPO_PUBLIC_API_BASE ?? 'http://127.0.0.1:5055/api/v1';
const API_BASE = RAW_API_BASE.replace(/\/+$/, '');

const normalizeKey = (s: string) =>
  (s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();

const iconForSector = (label: string): keyof typeof Ionicons.glyphMap => {
  const k = normalizeKey(label);
  if (/energie|énergie|electric|elec|power|solaire/.test(k)) return 'flash-outline';
  if (/logistique|transport|livraison|delivery|fret|cargo/.test(k)) return 'cube-outline';
  if (/construction|plomb|chantier|travaux/.test(k)) return 'construct-outline';
  if (/beaute|beauté|coiffure|esthet/.test(k)) return 'cut-outline';
  return 'apps-outline';
};

export default function SectorsScreen() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [sectors, setSectors] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const getIdToken = useCallback(async () => AsyncStorage.getItem('idToken'), []);

  const fetchSectors = useCallback(async () => {
    setLoading(true); setErr(null);
    try {
      const idToken = await getIdToken();
      if (!idToken) throw new Error('Veuillez vous connecter.');
      const acc = new Map<string,string>();
      let cursor: string | null = null; let guard = 0;

      do {
        const url = new URL(`${API_BASE}/customers/services`);
        url.searchParams.set('limit','50');
        if (cursor) url.searchParams.set('cursor', cursor);
        url.searchParams.set('sort','createdAt');
        url.searchParams.set('dir','desc');
        url.searchParams.set('_ts', String(Date.now()));

        const resp = await fetch(url.toString(), {
          headers: { 'Content-Type':'application/json', Authorization:`Bearer ${idToken}` }
        });
        const data = await resp.json().catch(()=>({}));
        if (!resp.ok) throw new Error(data?.message || 'Erreur chargement');

        (Array.isArray(data.items) ? data.items : []).forEach((x: any) => {
          // 🔹 Calcul capacité pour ignorer les services "complets"
          const total =
            typeof x.instancesTotal === 'number'
              ? x.instancesTotal
              : typeof x.places === 'number'
                ? x.places
                : typeof x.Availability?.instances === 'number'
                  ? x.Availability.instances
                  : null;

          const booked =
            typeof x.instancesBooked === 'number'
              ? x.instancesBooked
              : 0;

          // Si capacité connue et déjà pleine → on ne considère pas ce service pour les secteurs
          if (total != null && booked >= total) return;

          const lbl = typeof x?.Activity_Secteur === 'string' ? x.Activity_Secteur.trim() : '';
          if (!lbl) return;
          const key = normalizeKey(lbl);
          if (!acc.has(key)) acc.set(key, lbl);
        });

        cursor = data?.nextCursor ?? null;
        guard += 1;
      } while (cursor && guard < 10);

      setSectors(Array.from(acc.values()).sort((a,b) => a.localeCompare(b,'fr')));
    } catch (e: any) {
      setErr(e?.message || 'Impossible de charger les secteurs.');
      setSectors([]);
    } finally { setLoading(false); }
  }, [getIdToken]);

  useEffect(() => { fetchSectors(); }, [fetchSectors]);

  const filtered = useMemo(() => {
    const q = normalizeKey(search);
    if (!q) return sectors;
    return sectors.filter(s => normalizeKey(s).includes(q));
  }, [sectors, search]);

  const renderSector = ({ item }: { item: string }) => (
    <TouchableOpacity
      style={styles.tile}
      activeOpacity={0.9}
      onPress={() => router.push({ pathname: './ServiceSector', params: { sector: item } })}
    >
      <View style={styles.tileIconWrap}>
        <Ionicons name={iconForSector(item)} size={42} color={PALETTE.textDark} />
      </View>
      <Text numberOfLines={2} style={styles.tileText}>{item}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Secteurs</Text>

      <View style={styles.searchBar}>
        <Ionicons name="search" size={20} color={PALETTE.placeholder} />
        <TextInput
          style={styles.searchInput}
          placeholder="Rechercher un secteur…"
          placeholderTextColor={PALETTE.placeholder}
          value={search}
          onChangeText={setSearch}
        />
        {!!search && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={18} color={PALETTE.placeholder} />
          </TouchableOpacity>
        )}
      </View>

      {loading && <ActivityIndicator style={{ marginVertical: 10 }} color={PALETTE.white} />}
      {!!err && <Text style={styles.errorText}>{err}</Text>}

      <FlatList
        data={filtered}
        keyExtractor={(s, i) => `${normalizeKey(s)}-${i}`}
        renderItem={renderSector}
        numColumns={2}
        columnWrapperStyle={{ gap: GAP, paddingHorizontal: 16, marginBottom: GAP }}
        contentContainerStyle={{ paddingTop: 8, paddingBottom: 24 }}
        ListEmptyComponent={!loading ? <Text style={styles.empty}>Aucun secteur.</Text> : null}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container:{ flex:1, backgroundColor:PALETTE.primary, paddingTop:56 },
  title:{ color:PALETTE.white, fontSize:24, fontWeight:'900', paddingHorizontal:16, marginBottom:8 },

  searchBar:{
    flexDirection:'row', alignItems:'center', gap:8, backgroundColor:PALETTE.cream,
    marginHorizontal:16, marginBottom:12, borderRadius:16, paddingHorizontal:12, height:48,
    shadowColor:'#000', shadowOpacity:0.08, shadowRadius:8, shadowOffset:{ width:0, height:2 }, elevation:3,
  },
  searchInput:{ flex:1, fontSize:16, color:PALETTE.textDark },

  tile:{
    width:TILE_SIZE, height:TILE_SIZE, backgroundColor:PALETTE.cream, borderRadius:18, padding:14,
    justifyContent:'space-between', shadowColor:'#000', shadowOpacity:0.08, shadowRadius:8,
    shadowOffset:{ width:0, height:3 }, elevation:2,
  },
  tileIconWrap:{ width:64, height:64, borderRadius:16, alignItems:'center', justifyContent:'center', backgroundColor:'#FFF' },
  tileText:{ color:PALETTE.textDark, fontSize:16, fontWeight:'800' },

  errorText:{ color:PALETTE.coral, marginHorizontal:16, marginBottom:8 },
  empty:{ color:PALETTE.white, opacity:0.8, marginHorizontal:16, marginTop:8 },
});
