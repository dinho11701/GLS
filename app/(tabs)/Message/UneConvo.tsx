// app/(tabs)/Message/UneConvo.tsx
import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, Alert, ActivityIndicator, BackHandler, DeviceEventEmitter
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from '@expo/vector-icons/Ionicons';
import { apiFetch } from '@lib/api';

const PALETTE = { primary:'#0A0F2C', white:'#FFFFFF', bubble:'#F1F5F9', me:'#D1FAE5' };

type Role = 'customer'|'partner';
type Msg = {
  id: string;
  text: string;
  senderRole: Role;
  createdAt?: any;        // Date | Firestore Timestamp | number
  clientId?: string;      // id optimiste local
};

async function getRole(): Promise<Role> {
  const r = await AsyncStorage.getItem('userRole');
  return (r === 'partner' || r === 'customer') ? r : 'customer';
}

function toDate(v: any): Date | undefined {
  if (!v) return undefined;
  if (v instanceof Date) return v;
  if (typeof v?.toDate === 'function') return v.toDate();
  if (typeof v?.seconds === 'number') return new Date(v.seconds * 1000);
  if (typeof v === 'number') return new Date(v);
  return undefined;
}

export default function ConversationScreen() {
  const params = useLocalSearchParams<{ id?: string; role?: Role; peerName?: string | string[] }>();
  const router = useRouter();
  const navigation = useNavigation();

  const convId = String(params.id ?? '').trim();

  // Rôle : pris des params puis confirmé via le storage
  const [role, setRole] = useState<Role>((params.role as Role) || 'customer');
  const [roleReady, setRoleReady] = useState<boolean>(!!params.role);

  const rawPeer = params.peerName;
  const peerName =
    typeof rawPeer === 'string' ? rawPeer :
    Array.isArray(rawPeer) && rawPeer.length > 0 ? rawPeer[0] : 'Conversation';

  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const listRef = useRef<FlatList<Msg>>(null);

  // Base API selon le rôle
  const messagesBase = useMemo(
    () => (role === 'partner' ? 'partners/messages' : 'customers/messages'),
    [role]
  );

  // Résoudre le rôle depuis le storage si non fourni
  useEffect(() => {
    if (roleReady) return;
    (async () => {
      const r = await getRole();
      setRole(r);
      setRoleReady(true);
    })();
  }, [roleReady]);

  // Back robuste
  const goBack = useCallback(() => {
    try {
      // @ts-ignore canGoBack runtime
      if (router?.canGoBack?.()) { router.back(); return; }
      // @ts-ignore
      if (navigation?.canGoBack?.()) { navigation.goBack(); return; }
      router.replace('/(tabs)/Message');
    } catch {
      router.replace('/(tabs)/Message');
    }
  }, [router, navigation]);

  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== 'android') return;
      const sub = BackHandler.addEventListener('hardwareBackPress', () => { goBack(); return true; });
      return () => sub.remove();
    }, [goBack])
  );

  const load = useCallback(async () => {
    if (!convId || !roleReady) { setLoading(false); return; }
    setLoading(true);
    try {
      const data = await apiFetch<{ messages: Msg[] }>(
        `${messagesBase}/conversations/${convId}/messages?limit=30&_ts=${Date.now()}`
      );
      const arr: Msg[] = (data.messages ?? []).slice().reverse().map(m => ({
        ...m,
        createdAt: toDate(m.createdAt) ?? undefined,
      }));
      setMsgs(arr);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: false }), 0);
    } catch (e: any) {
      Alert.alert('Erreur', e?.message || 'Impossible de charger la conversation.');
      setMsgs([]);
    } finally {
      setLoading(false);
    }
  }, [convId, messagesBase, roleReady]);

  // 1) Charger quand le rôle est prêt
  useEffect(() => { if (roleReady) load(); }, [roleReady, load]);

  // 2) Marquer comme lu quand l’écran prend le focus
  useFocusEffect(useCallback(() => {
    (async () => {
      if (!convId || !roleReady) return;
      try {
        await apiFetch(`${messagesBase}/conversations/${convId}/read`, { method: 'POST' });
      } catch {}
      load();
    })();
  }, [convId, messagesBase, roleReady, load]));

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || !convId || !roleReady) return;
    setInput('');

    // Message optimiste
    const clientId = `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const temp: Msg = {
      id: clientId,          // clé FlatList immédiate
      clientId,              // permettra le remplacement 1:1
      text,
      senderRole: role,
      createdAt: new Date(),
    };
    setMsgs((prev) => [...prev, temp]);

    try {
      const data = await apiFetch<{ message?: Msg }>(
        `${messagesBase}/conversations/${convId}/messages`,
        { method: 'POST', body: { text } }
      );

      if (data?.message?.id) {
        const serverMsg: Msg = {
          ...data.message,
          createdAt: toDate(data.message.createdAt) ?? new Date(), // timestamp concret
        };
        // Remplacement 1:1 par clientId, sinon fallback par texte+rôle
        setMsgs((prev) => {
          const idx = prev.findIndex(m => m.clientId === clientId || (m.id === clientId));
          if (idx >= 0) {
            const next = prev.slice();
            next[idx] = { ...serverMsg };
            return next;
          }
          // si pour une raison X le tmp n’est plus là, on append proprement
          return [...prev, serverMsg];
        });

        DeviceEventEmitter.emit('conv:updated', {
          id: convId,
          lastMessage: { text: serverMsg.text, at: Date.now(), senderRole: role }
        });
      } else {
        // échec silencieux : retirer le tmp
        setMsgs((prev) => prev.filter(m => m.clientId !== clientId && m.id !== clientId));
      }
    } catch {
      setMsgs((prev) => prev.filter(m => m.clientId !== clientId && m.id !== clientId));
      Alert.alert('Erreur', 'Envoi impossible. Vérifie ta connexion.');
    } finally {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
    }
  }, [convId, messagesBase, input, role, roleReady]);

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.select({ ios:'padding' })}>
      <SafeAreaView edges={['top']} style={styles.safeHeader}>
        <View style={styles.header} pointerEvents="box-none">
          <TouchableOpacity
            onPress={goBack}
            hitSlop={{ top: 16, left: 16, right: 16, bottom: 16 }}
            style={styles.backBtn}
            testID="btn-back"
          >
            <Ionicons name="chevron-back" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={styles.titleWrap}>
            <Text numberOfLines={1} style={styles.title}>{peerName}</Text>
          </View>
          <View style={{ width: 32 }} />
        </View>
      </SafeAreaView>

      {!convId ? (
        <View style={{ flex:1, alignItems:'center', justifyContent:'center', paddingHorizontal:24 }}>
          <Text style={{ color:'#fff', opacity:0.8, textAlign:'center' }}>Conversation invalide ou manquante.</Text>
        </View>
      ) : loading ? (
        <View style={{ flex:1, alignItems:'center', justifyContent:'center' }}>
          <ActivityIndicator color="#fff" />
        </View>
      ) : msgs.length === 0 ? (
        <View style={{ flex:1, alignItems:'center', justifyContent:'center', paddingHorizontal:24 }}>
          <Text style={{ color:'#fff', opacity:0.8, textAlign:'center' }}>Aucun message pour l’instant. Dis bonjour 👋</Text>
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={msgs}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ padding: 12, paddingBottom: 90 }}
          renderItem={({ item }) => {
            const mine = item.senderRole === role;
            return (
              <View style={[styles.row, mine ? { justifyContent:'flex-end' } : { justifyContent:'flex-start' }]}>
                <View style={[styles.bubble, mine ? styles.bubbleMe : styles.bubbleOther]}>
                  <Text style={{ color:'#0B1220' }}>{item.text}</Text>
                </View>
              </View>
            );
          }}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          onLayout={() => listRef.current?.scrollToEnd({ animated: false })}
        />
      )}

      <View style={styles.inputBar}>
        <TextInput
          style={styles.input}
          placeholder="Votre message…"
          placeholderTextColor="rgba(255,255,255,0.7)"
          value={input}
          onChangeText={setInput}
          onSubmitEditing={send}
          returnKeyType="send"
        />
        <TouchableOpacity onPress={send} style={styles.sendBtn}>
          <Ionicons name="send" size={18} color="#0A0F2C" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container:{ flex:1, backgroundColor:PALETTE.primary },
  safeHeader:{ backgroundColor: PALETTE.primary, zIndex: 10, elevation: 10 },
  header:{ height:64, paddingHorizontal:12, flexDirection:'row', alignItems:'center' },
  backBtn:{ width:32, height:32, borderRadius:16, alignItems:'center', justifyContent:'center' },
  titleWrap:{ flex:1, marginLeft:6 },
  title:{ color:'#fff', fontSize:18, fontWeight:'900' },
  subtitle:{ color:'rgba(255,255,255,0.75)', fontSize:12, marginTop:2 },
  row:{ flexDirection:'row', marginVertical:4 },
  bubble:{ maxWidth:'80%', paddingVertical:10, paddingHorizontal:12, borderRadius:14, backgroundColor:PALETTE.bubble },
  bubbleMe:{ backgroundColor:PALETTE.me },
  bubbleOther:{ backgroundColor:PALETTE.bubble },
  inputBar:{
    position:'absolute', left:0, right:0, bottom:0,
    flexDirection:'row', alignItems:'center', gap:8,
    padding:10, backgroundColor:'rgba(255,255,255,0.08)'
  },
  input:{
    flex:1, borderWidth:1, borderColor:'rgba(255,255,255,0.25)',
    borderRadius:999, paddingHorizontal:14, paddingVertical:10, color:'#fff'
  },
  sendBtn:{ width:42, height:42, borderRadius:21, backgroundColor:'#fff', alignItems:'center', justifyContent:'center' },
});
