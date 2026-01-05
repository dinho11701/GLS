// app/(tabs)/Message/StartConvo.tsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, Alert,
  Platform, BackHandler, ActivityIndicator, FlatList
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiFetch } from '@lib/api';

const PALETTE = { primary:'#0A0F2C', white:'#FFFFFF' };

type Role = 'customer' | 'partner';

type HitPartner = {
  uid: string;
  nom?: string;
  nomOwner?: string;
  partenaire_ID?: string;
  mail?: string;
};

type HitCustomer = {
  uid: string;
  user: string;
  prenom?: string;
  nom?: string;
  email?: string;
};

export default function NewConversation() {
  const router = useRouter();
  const navigation = useNavigation();

  const [role, setRole] = useState<Role>('customer');

  // champ unique selon le rôle
  const [query, setQuery] = useState('');
  const [hitsPartners, setHitsPartners] = useState<HitPartner[]>([]);
  const [hitsCustomers, setHitsCustomers] = useState<HitCustomer[]>([]);
  const [searching, setSearching] = useState(false);
  const [pickedUid, setPickedUid] = useState<string | null>(null);
  const [pickedLabel, setPickedLabel] = useState<string>('');
  const [serviceId, setServiceId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // ---- role from storage
  useEffect(() => {
    (async () => {
      const r = await AsyncStorage.getItem('userRole');
      setRole(r === 'partner' ? 'partner' : 'customer');
    })();
  }, []);

  // --- Back robuste
  const goBack = useCallback(() => {
    // @ts-ignore
    if (navigation?.canGoBack?.()) navigation.goBack();
    else router.replace('/(tabs)/Message');
  }, [navigation, router]);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { goBack(); return true; });
    return () => sub.remove();
  }, [goBack]);

  // ---- Recherche selon rôle (debounce 250ms)
  useEffect(() => {
    let alive = true;
    const t = setTimeout(async () => {
      const q = query.trim();
      setPickedUid(null);
      setPickedLabel('');
      if (!q) { setHitsPartners([]); setHitsCustomers([]); return; }
      setSearching(true);
      try {
        if (role === 'customer') {
          // Customer tape nomOwner
          const data = await apiFetch<{ results: HitPartner[] }>(`partners/resolveByOwner?q=${encodeURIComponent(q)}`);
          if (!alive) return;
          setHitsPartners(data?.results ?? []);
        } else {
          // Partner tape user
          const data = await apiFetch<{ results: HitCustomer[] }>(`customers/resolveByUser?q=${encodeURIComponent(q)}`);
          if (!alive) return;
          setHitsCustomers(data?.results ?? []);
        }
      } catch {
        if (alive) { setHitsPartners([]); setHitsCustomers([]); }
      } finally {
        if (alive) setSearching(false);
      }
    }, 250);

    return () => { alive = false; clearTimeout(t); };
  }, [query, role]);

  const canSubmit = useMemo(() => !!pickedUid, [pickedUid]);

  const start = useCallback(async () => {
    if (!pickedUid) { Alert.alert('Info', 'Choisis un contact.'); return; }

    try {
      setSubmitting(true);

      if (role === 'customer') {
        // crée une conversation avec ce partnerUid
        const data = await apiFetch<{ conversation?: { id: string } }>(
          'customers/messages/conversations',
          { method: 'POST', body: { partnerUid: pickedUid, serviceId: serviceId || undefined } }
        );
        const convId = data?.conversation?.id;
        if (!convId) throw new Error('Création impossible (customer).');

        router.push({
          pathname: '/(tabs)/Message/[id]',
          params: { id: convId, role: 'customer', peerName: pickedLabel || 'Partenaire' },
        });
      } else {
        // PARTNER → endpoint miroir requis côté API:
        // POST /api/v1/partners/messages/conversations  body: { customerId, serviceId? }
        const data = await apiFetch<{ conversation?: { id: string } }>(
          'partners/messages/conversations',
          { method: 'POST', body: { customerId: pickedUid, serviceId: serviceId || undefined } }
        );
        const convId = data?.conversation?.id;
        if (!convId) throw new Error('Création impossible (partner).');

        router.push({
          pathname: '/(tabs)/Message/[id]',
          params: { id: convId, role: 'partner', peerName: pickedLabel || 'Client' },
        });
      }
    } catch (e: any) {
      Alert.alert('Erreur', e?.message || 'Impossible de créer la conversation.');
    } finally {
      setSubmitting(false);
    }
  }, [pickedUid, pickedLabel, serviceId, role, router]);

  // ---- Rendu d’un résultat
  const renderPartner = (p: HitPartner) => (
    <TouchableOpacity
      key={p.uid}
      onPress={() => { setPickedUid(p.uid); setPickedLabel(p.nomOwner || p.nom || p.mail || p.uid); }}
      style={[styles.hitRow, pickedUid === p.uid && styles.hitRowActive]}
    >
      <Text numberOfLines={1} style={styles.hitTitle}>{p.nomOwner || p.nom || p.mail || p.uid}</Text>
      {!!p.partenaire_ID && <Text style={styles.hitSub}>#{p.partenaire_ID}</Text>}
      {!!p.mail && <Text style={styles.hitSub}>{p.mail}</Text>}
    </TouchableOpacity>
  );

  const renderCustomer = (c: HitCustomer) => (
    <TouchableOpacity
      key={c.uid}
      onPress={() => { setPickedUid(c.uid); setPickedLabel(c.user || `${c.prenom ?? ''} ${c.nom ?? ''}`.trim() || c.uid); }}
      style={[styles.hitRow, pickedUid === c.uid && styles.hitRowActive]}
    >
      <Text numberOfLines={1} style={styles.hitTitle}>{c.user}</Text>
      {!!(c.prenom || c.nom) && <Text style={styles.hitSub}>{[c.prenom, c.nom].filter(Boolean).join(' ')}</Text>}
      {!!c.email && <Text style={styles.hitSub}>{c.email}</Text>}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={goBack} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Nouveau message</Text>
        <View style={{ width: 32 }} />
      </View>

      <Text style={styles.label}>
        {role === 'customer' ? 'Nom du propriétaire (nomOwner)' : 'Username du client (user)'}
      </Text>
      <TextInput
        placeholder={role === 'customer' ? 'ex. Alexandre B.' : 'ex. oswald98'}
        placeholderTextColor="rgba(255,255,255,0.7)"
        style={styles.input}
        value={query}
        onChangeText={setQuery}
        autoCapitalize="none"
        autoCorrect={false}
      />

      {searching && (
        <View style={{ paddingVertical: 6 }}>
          <ActivityIndicator color="#fff" />
        </View>
      )}

      <FlatList
        style={{ maxHeight: 220, marginTop: 6 }}
        data={role === 'customer' ? (hitsPartners as any[]) : (hitsCustomers as any[])}
        keyExtractor={(it:any) => it.uid}
        ListEmptyComponent={
          query && !searching ? (
            <Text style={{ color:'#fff', opacity:0.7 }}>Aucun résultat.</Text>
          ) : null
        }
        renderItem={({ item }) => role === 'customer' ? renderPartner(item) : renderCustomer(item)}
      />

      <Text style={[styles.label, { marginTop: 12 }]}>Service (optionnel)</Text>
      <TextInput
        placeholder="serviceId (optionnel)"
        placeholderTextColor="rgba(255,255,255,0.7)"
        style={styles.input}
        value={serviceId}
        onChangeText={setServiceId}
        autoCapitalize="none"
        autoCorrect={false}
      />

      <TouchableOpacity
        onPress={start}
        style={[styles.btn, (!canSubmit || submitting) && { opacity: 0.6 }]}
        disabled={!canSubmit || submitting}
      >
        <Text style={styles.btnText}>{submitting ? 'Création…' : 'Démarrer'}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container:{ flex:1, backgroundColor:PALETTE.primary, padding:16, paddingTop:64 },
  header:{ height:48, flexDirection:'row', alignItems:'center', marginBottom:16 },
  backBtn:{ width:32, height:32, borderRadius:16, alignItems:'center', justifyContent:'center' },
  headerTitle:{ flex:1, color:'#fff', fontSize:20, fontWeight:'900', marginLeft:6 },
  label:{ color:'#fff', fontWeight:'800', marginBottom:6 },
  input:{
    borderWidth:1, borderColor:'rgba(255,255,255,0.25)', borderRadius:12,
    paddingHorizontal:12, paddingVertical:12, color:'#fff', marginBottom:8
  },
  hitRow:{
    paddingVertical:10, paddingHorizontal:12, borderRadius:10,
    backgroundColor:'rgba(255,255,255,0.08)', marginBottom:6
  },
  hitRowActive:{ backgroundColor:'rgba(255,255,255,0.18)' },
  hitTitle:{ color:'#fff', fontWeight:'900' },
  hitSub:{ color:'#fff', opacity:0.8 },
  btn:{ backgroundColor:'#fff', borderRadius:14, paddingVertical:14, alignItems:'center', marginTop:12 },
  btnText:{ color:PALETTE.primary, fontWeight:'900', fontSize:16 }
});
