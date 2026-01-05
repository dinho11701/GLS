// app/(tabs)/Message/ListConvo.tsx
import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Image,
  RefreshControl, ActivityIndicator, DeviceEventEmitter, Alert
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiFetch } from '@lib/api';
import { logoutAll } from '@lib/session';

const PALETTE = { primary:'#0A0F2C', white:'#FFFFFF', text:'#0B1220', dim:'rgba(11,18,32,0.55)' };

type Conversation = {
  id: string;
  lastMessage?: { text?: string; at?: any; senderRole?: 'customer'|'partner' };
  updatedAt?: any;
  partnerUid?: string;
  partnerName?: string;
  partnerSlug?: string;
  customerId?: string;
  customerName?: string;
  participantKeys?: string[];
};

async function getRole(): Promise<'customer'|'partner'> {
  const r = await AsyncStorage.getItem('userRole');
  return (r === 'partner' || r === 'customer') ? (r as any) : 'customer';
}

async function getMe(): Promise<{ id?: string; uid?: string; role?: string } | null> {
  try {
    const entries = await AsyncStorage.multiGet(['uid','userJson','userRole']);
    const uidKV = entries.find(([k]) => k === 'uid')?.[1];
    const userJsonKV = entries.find(([k]) => k === 'userJson')?.[1];
    let uid = uidKV || '';
    let role = entries.find(([k]) => k === 'userRole')?.[1] || undefined;

    if (!uid && userJsonKV) {
      try {
        const u = JSON.parse(userJsonKV || '{}') || {};
        uid = u.uid || u.id || uid;
        role = (u.role || role);
      } catch {}
    }
    if (uid) return { id: uid, uid, role };

    const me = await apiFetch<any>('auth/me', { cache: 'no-store' as any }).catch(() => null);
    const u = me?.user ?? me ?? {};
    return u ? { id: u.id ?? u._id ?? u.uid, uid: u.uid ?? u.id ?? u._id, role: u.role } : null;
  } catch {
    try {
      const me = await apiFetch<any>('auth/me', { cache: 'no-store' as any }).catch(() => null);
      const u = me?.user ?? me ?? {};
      return u ? { id: u.id ?? u._id ?? u.uid, uid: u.uid ?? u.id ?? u._id, role: u.role } : null;
    } catch { return null; }
  }
}

// ---------- name cache & resolvers ----------
const nameKey = (role: 'customer'|'partner', id?: string|null) => id ? `${role}:${id}` : '';

async function fetchDisplayNameFor(key: string): Promise<string | null> {
  try {
    const [role, id] = key.split(':');
    if (!role || !id) return null;

    if (role === 'customer') {
      const data = await apiFetch<any>(`customers/${encodeURIComponent(id)}`, { cache: 'no-store' as any });
      const u = data?.customer ?? data ?? {};
      const dn = u.displayName || u.fullName || u.name || [u.firstName, u.lastName].filter(Boolean).join(' ');
      return dn?.trim() || null;
    } else {
      const data = await apiFetch<any>(`partners/${encodeURIComponent(id)}`, { cache: 'no-store' as any });
      const u = data?.partner ?? data ?? {};
      const dn = u.displayName || u.fullName || u.name || [u.firstName, u.lastName].filter(Boolean).join(' ');
      return dn?.trim() || null;
    }
  } catch { return null; }
}

function tsToMs(v: any): number {
  if (!v) return 0;
  try {
    if (typeof v.toMillis === 'function') return v.toMillis();
    if (typeof v.toDate === 'function') return v.toDate().getTime();
    if (typeof v === 'number') return v;
    if (typeof v === 'string') return new Date(v).getTime() || 0;
    if (typeof v.seconds === 'number') {
      return v.seconds * 1000 + Math.floor((v.nanoseconds || 0) / 1e6);
    }
  } catch {}
  const n = new Date(v as any).getTime();
  return Number.isFinite(n) ? n : 0;
}

export default function MessagesList() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [items, setItems] = useState<Conversation[]>([]);
  const [role, setRole] = useState<'customer'|'partner'>('customer');

  // cache des noms
  const [nameCache, setNameCache] = useState<Record<string,string>>({});

  const tapLockRef = useRef(false);

  const ensurePeerName = useCallback(async (c: Conversation, myRole: 'customer'|'partner') => {
    const peerKey =
      myRole === 'partner'
        ? nameKey('customer', c.customerId)
        : nameKey('partner', c.partnerUid);
    if (!peerKey || nameCache[peerKey]) return;

    const dn = await fetchDisplayNameFor(peerKey);
    if (dn) setNameCache(prev => ({ ...prev, [peerKey]: dn }));
  }, [nameCache]);

  const load = useCallback(async () => {
    try {
      const r = await getRole();
      setRole(r);

      const me = await getMe();
      const myUid = me?.uid || me?.id || '';
      console.log('[MessagesList] role =', r, '| myUid =', myUid);
      if (r === 'partner' && !myUid) {
        Alert.alert('Partner UID manquant', 'Connecté en partner mais myUid est vide (vérifie le login).');
      }

      const primaryPath = r === 'partner'
        ? 'partners/messages/conversations?limit=20'
        : 'customers/messages/conversations?limit=20';

      const data1 = await apiFetch<{ conversations?: Conversation[] }>(
        `${primaryPath}&_ts=${Date.now()}`, { cache: 'no-store' as any }
      );
      let list: Conversation[] = data1?.conversations ?? [];
      console.log('[MessagesList] primaryPath =', primaryPath, '| primaryCount =', list.length);

      if (r === 'partner') {
        const needFallback = (list?.length ?? 0) === 0;
        console.log('[MessagesList] needFallback(partner) =', needFallback);
        if (needFallback && myUid) {
          const data2 = await apiFetch<{ conversations?: Conversation[] }>(
            `customers/messages/conversations?limit=50&_ts=${Date.now()}`, { cache: 'no-store' as any }
          );
          const customerSide = data2?.conversations ?? [];
          const mineByUid = customerSide.filter(c =>
            Array.isArray(c.participantKeys) &&
            c.participantKeys.some(k => k === `partner:${myUid}`)
          );
          console.log('[MessagesList] customerSideCount =', customerSide.length, '| mineByUidCount =', mineByUid.length);
          const map = new Map<string, Conversation>();
          for (const c of [...list, ...mineByUid]) map.set(String(c.id), c);
          list = Array.from(map.values());
        }
      }

      list = list.slice().sort((a, b) => tsToMs(b.updatedAt) - tsToMs(a.updatedAt));
      console.log('[MessagesList] finalCount =', list.length);
      setItems(list);
    } catch (e) {
      console.log('[MessagesList] load error:', e);
      setItems([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { setLoading(true); load(); }, [load]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  // résolution paresseuse des noms après load
  useEffect(() => {
    if (!items.length) return;
    (async () => {
      for (const c of items) await ensurePeerName(c, role);
    })();
  }, [items, role, ensurePeerName]);

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('conv:updated', (p: { id: string; lastMessage: any }) => {
      setItems(prev => prev
        .map(it => it.id === p.id
          ? { ...it, lastMessage: p.lastMessage, updatedAt: p.lastMessage?.at ?? Date.now() }
          : it
        )
        .sort((a, b) => tsToMs(b.updatedAt) - tsToMs(a.updatedAt))
      );
    });
    return () => sub.remove();
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
  }, [load]);

  const optimisticTouch = useCallback((id: string, peerName: string) => {
    setItems(prev => prev.map(it => it.id === id
      ? { ...it, partnerName: (role === 'customer' ? peerName : it.partnerName) }
      : it
    ));
  }, [role]);

  const openConversation = useCallback((id: string, peerName: string) => {
    if (tapLockRef.current) return;
    tapLockRef.current = true;
    setTimeout(() => { tapLockRef.current = false; }, 400);

    optimisticTouch(id, peerName);

    const url =
      `/(tabs)/Message/${encodeURIComponent(id)}?role=${encodeURIComponent(role)}&peerName=${encodeURIComponent(peerName)}`;
    router.push(url);
  }, [optimisticTouch, role, router]);

  const signOut = useCallback(async () => {
    try {
      try { await apiFetch('auth/logout', { method: 'POST' as any }); } catch {}
      await logoutAll();
      router.replace('/'); // ton index = Login
    } catch (e: any) {
      Alert.alert('Erreur', e?.message || 'Impossible de se déconnecter.');
    }
  }, [router]);

  if (loading) {
    return (
      <View style={{ flex:1, backgroundColor:PALETTE.primary, alignItems:'center', justifyContent:'center' }}>
        <ActivityIndicator color="#fff" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.headerRow}>
        <Text style={styles.headerTitle}>Messages</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
          <TouchableOpacity onPress={() => router.push('/(tabs)/Message/New')} accessibilityLabel="Nouveau message">
            <Ionicons name="create-outline" size={22} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity onPress={signOut} accessibilityLabel="Se déconnecter">
            <Ionicons name="log-out-outline" size={22} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={items}
        keyExtractor={(it) => String(it.id)}
        extraData={items}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />}
        contentContainerStyle={{ paddingBottom: 24 }}
        renderItem={({ item }) => {
          // priorité champs → cache → fallback id/slug → libellé générique
          const peerName =
            role === 'partner'
              ? (
                  item.customerName
                  || nameCache[nameKey('customer', item.customerId)]
                  || item.customerId
                  || 'Client'
                )
              : (
                  item.partnerName
                  || item.partnerSlug
                  || nameCache[nameKey('partner', item.partnerUid)]
                  || item.partnerUid
                  || 'Partenaire'
                );

          const lastText = (item?.lastMessage?.text || '').trim();
          const snippet = lastText.length > 0 ? lastText : 'Nouvelle conversation';

          return (
            <TouchableOpacity
              style={styles.card}
              activeOpacity={0.9}
              onPress={() => openConversation(String(item.id), peerName || 'Conversation')}
            >
              <View style={styles.avatarWrap}>
                <Image source={{ uri: 'https://i.pravatar.cc/100?u=' + item.id }} style={styles.avatar} />
              </View>

              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text numberOfLines={1} style={styles.name}>{peerName}</Text>
                  <Ionicons name="chevron-forward" size={16} color={PALETTE.dim} />
                </View>
                <Text numberOfLines={2} style={styles.snippet}>{snippet}</Text>
              </View>
            </TouchableOpacity>
          );
        }}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        ListEmptyComponent={
          <View style={{ paddingVertical: 80, alignItems: 'center' }}>
            <Text style={{ color: '#fff', opacity: 0.8 }}>Aucune conversation pour l’instant.</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container:{ flex:1, backgroundColor:PALETTE.primary, paddingTop:64, paddingHorizontal:16 },
  headerRow:{ flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginBottom:12 },
  headerTitle:{ color:'#fff', fontSize:32, fontWeight:'900' },
  card:{ flexDirection:'row', alignItems:'center', backgroundColor:PALETTE.white, borderRadius:18, padding:12, shadowColor:'#000', shadowOpacity:0.1, shadowRadius:6, shadowOffset:{ width:0, height:3 }, elevation:2 },
  avatarWrap:{ width:48, height:48, borderRadius:24, overflow:'hidden', marginRight:12 },
  avatar:{ width:'100%', height:'100%' },
  name:{ flex:1, color:PALETTE.text, fontSize:16, fontWeight:'800' },
  snippet:{ marginTop:2, color:PALETTE.dim, fontSize:13 },
});
