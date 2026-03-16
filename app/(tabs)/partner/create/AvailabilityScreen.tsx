// app/(tabs)/partner/create/AvailabilityScreen.tsx
import React, { useMemo, useState, useCallback } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';

/* ------------ PALETTE ------------ */
const PALETTE = {
  primary:'#0A0F2C', white:'#FFFFFF', cream:'#F9FAFB',
  textDark:'#0B1220', placeholder:'rgba(11,18,32,0.45)',
  coral:'#FF6B6B', gold:'#FFD700', peach:'#EF8A73',
  peachSoft:'#F8CBC1', border:'rgba(11,18,32,0.18)',
};

const DAYS = [
  { key: 1, label: 'Lun' },
  { key: 2, label: 'Mar' },
  { key: 3, label: 'Mer' },
  { key: 4, label: 'Jeu' },
  { key: 5, label: 'Ven' },
  { key: 6, label: 'Sam' },
  { key: 7, label: 'Dim' }, 
];


export default function AvailabilityScreen() {
  const router = useRouter();

  // État minimal
  const [selectedDays, setSelectedDays] = useState<number[]>([1,2,3,4,5]);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime]     = useState('18:00');

  // 🔢 Nombre d’instances / places dispo en parallèle
  const [instances, setInstances] = useState('1');

  const toggleDay = useCallback((d: number) => {
    setSelectedDays(prev =>
      prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d].sort((a,b)=>a-b)
    );
  }, []);

  const setPreset = useCallback((p:'all'|'week'|'weekend') => {
    if (p==='all') setSelectedDays(DAYS.map(d=>d.key));
    if (p==='week') setSelectedDays([1,2,3,4,5]);
    if (p==='weekend') setSelectedDays([6,0]);
  }, []);

  // Validation (HH:MM + ordre)
  const timeOk  = useMemo(
    () => /^([01]\d|2[0-3]):[0-5]\d$/.test(startTime) && /^([01]\d|2[0-3]):[0-5]\d$/.test(endTime),
    [startTime,endTime]
  );
  const rangeOk = useMemo(
    () => timeOk && toMinutes(endTime) > toMinutes(startTime),
    [timeOk,startTime,endTime]
  );

  // Validation nb d’instances (ex: 1 à 10)
  const instancesOk = useMemo(() => {
    const n = parseInt(instances, 10);
    if (Number.isNaN(n)) return false;
    return n >= 1 && n <= 10;
  }, [instances]);

  const canSave = useMemo(
    () => selectedDays.length > 0 && rangeOk && instancesOk,
    [selectedDays, rangeOk, instancesOk]
  );

  const handleSave = useCallback(async () => {

  if (!canSave) return;

  try {

    const availability = {
      days: selectedDays,
      startTime,
      endTime,
      instances: parseInt(instances,10)
    }

    await AsyncStorage.setItem(
      "draft_service_step4_availability",
      JSON.stringify({ availability })
    )

    router.replace('/(tabs)/partner/create/ReviewScreen')

  } catch(err){

    console.error("SAVE AVAILABILITY ERROR:", err)

    Alert.alert("Erreur","Impossible d'enregistrer les disponibilités")

  }

},[selectedDays,startTime,endTime,instances,canSave])

  return (
    <View style={{ flex:1, backgroundColor:PALETTE.cream }}>
      <SafeAreaView style={{ flex:1 }}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            hitSlop={{ top:10, bottom:10, left:10, right:10 }}
          >
            <Ionicons name="chevron-back" size={26} color={PALETTE.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Créer (Pro)</Text>
          <View style={{ width:26 }} />
        </View>

        {/* Progress */}
        <View style={styles.stepBar}>
          <Text style={styles.stepTitle}>Étape 4/4 : Disponibilités</Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: '100%' }]} />
          </View>
        </View>

        <ScrollView contentContainerStyle={{ padding:16, paddingBottom:28 }}>
          {/* Presets */}
          <Text style={styles.groupTitle}>Jours disponibles</Text>
          <View style={styles.presetRow}>
            <PresetBtn label="Tous" onPress={() => setPreset('all')} />
            <PresetBtn label="Semaine" onPress={() => setPreset('week')} />
            <PresetBtn label="Week-end" onPress={() => setPreset('weekend')} />
          </View>

          {/* Jours */}
          <View style={styles.daysWrap}>
            {DAYS.map(d => (
              <DayChip
                key={d.key}
                label={d.label}
                active={selectedDays.includes(d.key)}
                onPress={() => toggleDay(d.key)}
              />
            ))}
          </View>

          {/* Heures */}
          <Text style={styles.groupTitle}>Plage horaire (heure locale)</Text>
          <View style={styles.timeRow}>
            <LabeledInput
              label="Début"
              value={startTime}
              onChangeText={setStartTime}
              placeholder="09:00"
              keyboardType="numbers-and-punctuation"
              maxLength={5}
            />
            <Text style={styles.timeSep}>—</Text>
            <LabeledInput
              label="Fin"
              value={endTime}
              onChangeText={setEndTime}
              placeholder="18:00"
              keyboardType="numbers-and-punctuation"
              maxLength={5}
            />
          </View>
          {!rangeOk && (
            <Text style={styles.helpError}>
              Format HH:MM (24h) et l’heure de fin doit être après le début.
            </Text>
          )}

          {/* Nb d’instances */}
          <Text style={styles.groupTitle}>Capacité du service</Text>
          <View style={{ maxWidth:180 }}>
            <LabeledInput
              label="Nombre d’instances"
              value={instances}
              onChangeText={(txt) => {
                // On garde que les chiffres
                const cleaned = txt.replace(/[^0-9]/g, '');
                setInstances(cleaned);
              }}
              placeholder="1"
              keyboardType="number-pad"
              maxLength={2}
            />
          </View>
          {!instancesOk && (
            <Text style={styles.helpError}>
              Indique un nombre entre 1 et 10.
            </Text>
          )}

          {/* Enregistrer */}
          <TouchableOpacity
            style={[styles.saveBtn, !canSave && { opacity:0.5 }]}
            activeOpacity={0.9}
            disabled={!canSave}
            onPress={handleSave}
          >
            <Text style={styles.saveText}>Enregistrer</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

/* ---- UI petites pièces ---- */
function DayChip({ label, active, onPress }: { label:string; active:boolean; onPress:() => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={[styles.dayChip, active && styles.dayChipActive]}
    >
      <Text style={[styles.dayChipText, active && styles.dayChipTextActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function PresetBtn({ label, onPress }: { label:string; onPress:() => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={styles.presetBtn}
    >
      <Text style={styles.presetText}>{label}</Text>
    </TouchableOpacity>
  );
}

function LabeledInput(
  props: React.ComponentProps<typeof TextInput> & { label:string }
) {
  return (
    <View style={{ flex:1 }}>
      <Text style={styles.smallLabel}>{props.label}</Text>
      <View style={styles.inputWrap}>
        <TextInput
          {...props}
          placeholderTextColor={PALETTE.placeholder}
          style={[
            styles.input,
            { textAlign:'center', fontWeight:'800', fontSize:16 },
          ]}
        />
      </View>
    </View>
  );
}

/* ---- Helpers ---- */
function toMinutes(t: string): number {
  const [h,m] = t.split(':').map(x => parseInt(x,10));
  if (Number.isNaN(h) || Number.isNaN(m)) return -1;
  return h*60 + m;
}

/* ---- Styles ---- */
const styles = StyleSheet.create({
  header:{
    height:56,
    paddingHorizontal:16,
    backgroundColor:PALETTE.cream,
    borderBottomWidth:StyleSheet.hairlineWidth,
    borderBottomColor:PALETTE.border,
    flexDirection:'row',
    alignItems:'center',
    gap:12
  },
  headerTitle:{ flex:1, color:PALETTE.primary, fontSize:24, fontWeight:'800' },

  stepBar:{
    paddingHorizontal:16,
    paddingTop:14,
    paddingBottom:10,
    backgroundColor:PALETTE.cream,
    borderBottomColor:PALETTE.border,
    borderBottomWidth:StyleSheet.hairlineWidth
  },
  stepTitle:{ color:PALETTE.textDark, fontWeight:'800', fontSize:14, marginBottom:8 },
  progressTrack:{ height:8, backgroundColor:'#E6E9EF', borderRadius:999, overflow:'hidden' },
  progressFill:{ height:'100%', backgroundColor:PALETTE.gold },

  groupTitle:{ marginTop:16, marginBottom:8, color:PALETTE.textDark, fontWeight:'900', fontSize:14 },

  presetRow:{ flexDirection:'row', gap:10 },
  presetBtn:{
    backgroundColor:PALETTE.white,
    borderRadius:999,
    borderWidth:1.5,
    borderColor:PALETTE.border,
    paddingHorizontal:12,
    height:36,
    alignItems:'center',
    justifyContent:'center'
  },
  presetText:{ color:PALETTE.textDark, fontWeight:'800' },

  daysWrap:{ flexDirection:'row', flexWrap:'wrap', gap:8, marginTop:10 },
  dayChip:{
    backgroundColor:PALETTE.white,
    borderColor:PALETTE.border,
    borderWidth:1.5,
    borderRadius:12,
    paddingHorizontal:12,
    height:36,
    alignItems:'center',
    justifyContent:'center'
  },
  dayChipActive:{ backgroundColor:PALETTE.peachSoft, borderColor:PALETTE.peach },
  dayChipText:{ color:PALETTE.textDark, fontWeight:'800' },
  dayChipTextActive:{ color:PALETTE.primary },

  timeRow:{ flexDirection:'row', alignItems:'center', gap:10 },
  timeSep:{ color:'rgba(11,18,32,0.5)', fontWeight:'900' },

  inputWrap:{
    backgroundColor:PALETTE.white,
    borderRadius:12,
    borderWidth:1.5,
    borderColor:PALETTE.border,
    overflow:'hidden'
  },
  input:{ paddingHorizontal:12, paddingVertical:12, color:PALETTE.textDark, fontSize:15 },
  smallLabel:{ color:'rgba(11,18,32,0.75)', fontWeight:'800', fontSize:12, marginBottom:6 },

  saveBtn:{
    marginTop:24,
    backgroundColor:PALETTE.peach,
    borderRadius:16,
    paddingVertical:14,
    alignItems:'center'
  },
  saveText:{ color:PALETTE.white, fontWeight:'800', fontSize:16 },

  helpError:{ color:PALETTE.coral, marginTop:6 },
});
