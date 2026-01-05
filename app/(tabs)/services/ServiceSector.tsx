import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TextInput, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const PALETTE = {
  primary:'#0A0F2C', white:'#FFFFFF', cream:'#F9FAFB',
  textDark:'#0B1220', placeholder:'rgba(11,18,32,0.45)', coral:'#FF6B6B',
};

type Region = 'CA-QC'|'CA-ON'|'US-CA'|'US-NY'|'INTL';
const money = (n?: number, currency: 'CAD'|'USD'|'EUR' = 'CAD') =>
  typeof n === 'number'
    ? new Intl.NumberFormat('fr-CA', { style: 'currency', currency }).format(n)
    : '—';

type ServiceItem = {
  id: string;
  Service?: string;
  Description?: string;
  Categorie?: string;
  Activity_Secteur?: string;
  Location_Fixe_Move?: string;
  Fee?: number;

  // 🔹 Champs de capacité (mêmes que Home / secteurs)
  instancesTotal?: number;
  instancesBooked?: number;
  places?: number;
  Availability?: {
    instances?: number;
    days?: number[];
    startTime?: string;
    endTime?: string;
  };
};

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

function hasRemainingCapacity(x: ServiceItem): boolean {
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

  // Si pas de capacité connue -> on considère qu'il est dispo
  if (total == null) return true;

  // Vrai seulement s'il reste au moins 1 place
  return booked < total;
}

export default function ServicesBySector() {
  const router = useRouter();
  const { sector } = useLocalSearchParams<{ sector?: string }>();
  const sectorName = Array.isArray(sector) ? sector[0] : sector || 'Secteur';

  const region: Region = 'CA-QC';
  const currency: 'CAD'|'USD'|'EUR' = region.startsWith('US') ? 'USD' : 'CAD';

  const [search, setSearch] = useState('');
  const [items, setItems] = useState<ServiceItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const getIdToken = useCallback(async () => AsyncStorage.getItem('idToken'), []);

  const buildUrl = useCallback((opts:{ q?: string|null; cursor?: string|null }) => {
    const p = new URLSearchParams();
    p.set('limit','20');
    p.set('secteur', sectorName);
    if (opts.q && opts.q.trim()) p.set('q', opts.q.trim());
    if (opts.cursor) p.set('cursor', opts.cursor);
    p.set('_ts', String(Date.now()));
    return `${API_BASE}/customers/services?${p.toString()}`;
  }, [sectorName]);

  const fetchFirst = useCallback(async () => {
    setLoading(true); setErr(null);
    try {
      const token = await getIdToken();
      if (!token) throw new Error('Veuillez vous connecter.');
      const resp = await fetch(buildUrl({ q: search }), {
        headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${token}` }
      });
      const data = await resp.json().catch(()=>({}));
      if (!resp.ok) throw new Error(data?.message || 'Erreur chargement');
      const raw: ServiceItem[] = Array.isArray(data.items)
        ? data.items.map((d:any)=>({ id:d.id, ...d }))
        : [];
      const list = raw.filter(hasRemainingCapacity); // 🔹 on garde seulement ceux avec des places
      setItems(list);
      setCursor(data?.nextCursor ?? null);
    } catch (e:any) {
      setErr(e?.message || 'Chargement impossible.');
      setItems([]);
      setCursor(null);
    } finally { setLoading(false); }
  }, [getIdToken, buildUrl, search]);

  const fetchNext = useCallback(async () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const token = await getIdToken(); if (!token) return;
      const resp = await fetch(buildUrl({ q: search, cursor }), {
        headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${token}` }
      });
      const data = await resp.json().catch(()=>({}));
      if (!resp.ok) throw new Error();
      const raw: ServiceItem[] = Array.isArray(data.items)
        ? data.items.map((d:any)=>({ id:d.id, ...d }))
        : [];
      const more = raw.filter(hasRemainingCapacity); // 🔹 idem pour la pagination
      setItems(prev => [...prev, ...more]);
      setCursor(data?.nextCursor ?? null);
    } catch {
    } finally {
      setLoadingMore(false);
    }
  }, [cursor, loadingMore, getIdToken, buildUrl, search]);

  useEffect(() => { fetchFirst(); }, [fetchFirst]);
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(fetchFirst, 250);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [search]); // eslint-disable-line react-hooks/exhaustive-deps

  const renderService = ({ item }: { item: ServiceItem }) => (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.9}
      onPress={() => router.push({
        pathname: './DetailServiceScreen',
        params: {
          id: item.id,
          item: JSON.stringify(item),
          region,
          currency,
        },
      })}
    >
      <View style={styles.leftIcon}>
        <Ionicons name={iconForSector(item.Activity_Secteur || '')} size={20} color={PALETTE.textDark} />
      </View>
      <View style={{ flex:1 }}>
        <Text numberOfLines={1} style={styles.title}>{item.Service || 'Service'}</Text>
        <Text numberOfLines={2} style={styles.desc}>{item.Description || '—'}</Text>
        <View style={styles.metaRow}>
          {!!item.Activity_Secteur && <Text style={styles.chip}>{item.Activity_Secteur}</Text>}
          {!!item.Categorie && <Text style={styles.chip}>{item.Categorie}</Text>}
        </View>
      </View>
      <View style={{ alignItems:'flex-end', gap:6, marginLeft:8 }}>
        {typeof item.Fee === 'number' && (
          <Text style={styles.price}>{money(item.Fee, currency)}</Text>
        )}
        <Ionicons name="chevron-forward" size={18} color={PALETTE.placeholder} />
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Header simple */}
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={PALETTE.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{sectorName}</Text>
        <View style={{ width:24 }} />
      </View>

      {/* Search */}
      <View style={styles.searchBar}>
        <Ionicons name="search" size={20} color={PALETTE.placeholder} />
        <TextInput
          style={styles.searchInput}
          placeholder={`Rechercher dans ${sectorName}…`}
          placeholderTextColor={PALETTE.placeholder}
          value={search}
          onChangeText={setSearch}
          returnKeyType="search"
          onSubmitEditing={fetchFirst}
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
        data={items}
        keyExtractor={(it, idx) => (it?.id ? `${it.id}-${idx}` : String(idx))}
        renderItem={renderService}
        contentContainerStyle={{ paddingHorizontal:16, paddingBottom:24, gap:10 }}
        ItemSeparatorComponent={() => <View style={{ height:10 }} />}
        showsVerticalScrollIndicator={false}
        onEndReachedThreshold={0.4}
        onEndReached={fetchNext}
        ListFooterComponent={loadingMore ? <ActivityIndicator style={{ marginTop:8 }} color={PALETTE.white} /> : null}
        ListEmptyComponent={!loading ? <Text style={styles.empty}>Aucun service.</Text> : null}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container:{ flex:1, backgroundColor:PALETTE.primary, paddingTop:56 },

  headerRow:{ flexDirection:'row', alignItems:'center', gap:12, paddingHorizontal:16, marginBottom:8 },
  headerTitle:{ flex:1, color:PALETTE.white, fontSize:20, fontWeight:'900' },

  searchBar:{
    flexDirection:'row', alignItems:'center', gap:8, backgroundColor:PALETTE.cream,
    marginHorizontal:16, marginBottom:12, borderRadius:16, paddingHorizontal:12, height:48,
    shadowColor:'#000', shadowOpacity:0.08, shadowRadius:8, shadowOffset:{ width:0, height:2 }, elevation:3,
  },
  searchInput:{ flex:1, fontSize:16, color:PALETTE.textDark },

  card:{ flexDirection:'row', alignItems:'flex-start', backgroundColor:PALETTE.cream, borderRadius:16, padding:12, gap:12 },
  leftIcon:{ width:36, height:36, borderRadius:10, backgroundColor:PALETTE.white, alignItems:'center', justifyContent:'center' },
  title:{ color:PALETTE.textDark, fontSize:16, fontWeight:'800' },
  desc:{ color:'rgba(11,18,32,0.6)', marginTop:2 },
  metaRow:{ flexDirection:'row', gap:8, marginTop:8, flexWrap:'wrap' },
  chip:{ backgroundColor:PALETTE.white, borderRadius:999, paddingVertical:4, paddingHorizontal:10, color:PALETTE.textDark, fontSize:12, fontWeight:'700' },
  price:{ color:PALETTE.textDark, fontWeight:'800' },

  errorText:{ color:PALETTE.coral, marginHorizontal:16, marginBottom:8 },
  empty:{ color:PALETTE.white, opacity:0.8, marginHorizontal:16, marginTop:8 },
});
