// app/(tabs)/partner/create/InfoBaseScreen.tsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert, Keyboard,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter, useLocalSearchParams } from 'expo-router';

/* PALETTE */
const PALETTE = {
  primary:'#0A0F2C', white:'#FFFFFF', cream:'#F9FAFB', textDark:'#0B1220',
  placeholder:'rgba(11,18,32,0.45)', coral:'#FF6B6B', gold:'#FFD700',
  peach:'#EF8A73', peachSoft:'#F8CBC1', border:'rgba(11,18,32,0.18)',
};

const RECOMMENDED_DESC_MIN = 20; // non bloquant, juste un conseil

export default function InfoBaseScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ from?: string }>();
  const returnToReview = params?.from === 'review';

  const [title, setTitle] = useState('');
  const [categorie, setCategorie] = useState('');
  const [description, setDescription] = useState('');

  // Pré-remplir depuis le draft si l’utilisateur revient en arrière
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem('draft_service_step1');
        if (raw) {
          const d = JSON.parse(raw);
          setTitle(d?.Service ?? '');
          setCategorie(d?.Categorie ?? '');
          setDescription(d?.Description ?? '');
        }
      } catch {}
    })();
  }, []);

  // ✅ Assouplir la description : 1+ caractère suffit
  const canContinue = useMemo(
    () => title.trim().length >= 3 && categorie.trim().length >= 2 && description.trim().length >= 1,
    [title, categorie, description]
  );

  const handleContinue = useCallback(async () => {
    if (!canContinue) return;
    Keyboard.dismiss();

    const draft = {
      Service: title.trim(),
      Categorie: categorie.trim(),
      Description: description.trim(),
    };

    try {
      await AsyncStorage.setItem('draft_service_step1', JSON.stringify(draft));
      if (returnToReview) {
        router.replace('/(tabs)/partner/create/ReviewScreen');
      } else {
        router.push('/(tabs)/partner/create/PriceScreen');
      }
    } catch {
      Alert.alert('Erreur', 'Impossible de sauvegarder le brouillon local.');
    }
  }, [canContinue, title, categorie, description, returnToReview, router]);

  const handleBack = useCallback(() => {
    if (returnToReview) router.replace('/(tabs)/partner/create/ReviewScreen');
    else router.back();
  }, [returnToReview, router]);

  const descLen = description.trim().length;
  const showDescHint = descLen > 0 && descLen < RECOMMENDED_DESC_MIN;

  return (
    <View style={{ flex: 1, backgroundColor: PALETTE.cream }}>
      <SafeAreaView style={{ flex: 1 }}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} hitSlop={{ top:10, bottom:10, left:10, right:10 }}>
            <Ionicons name="chevron-back" size={26} color={PALETTE.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Créer (Pro)</Text>
          <View style={{ width: 26 }} />
        </View>

        {/* Progress */}
        <View style={styles.stepBar}>
          <Text style={styles.stepTitle}>Étape 1/4 : Infos de base</Text>
          <View style={styles.progressTrack}><View style={styles.progressFill} /></View>
        </View>

        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 28 }}
          keyboardShouldPersistTaps="always"
        >
          <FieldLabel label="Titre de l’offre" />
          <Input placeholder="Ex. Maintenance bornes EV" value={title} onChangeText={setTitle} />

          <FieldLabel label="Catégorie" />
          <Input placeholder="Ex. Coiffure, Plomberie, Location…" value={categorie} onChangeText={setCategorie} />

          <FieldLabel label="Description" />
          <Input
            multiline numberOfLines={4}
            placeholder="Décris ton offre"
            value={description}
            onChangeText={setDescription}
          />
          {showDescHint && (
            <Text style={styles.hint}>
              Astuce : une description plus détaillée (≥ {RECOMMENDED_DESC_MIN} caractères) améliore la conversion.
              ({descLen}/{RECOMMENDED_DESC_MIN})
            </Text>
          )}

          <TouchableOpacity
            style={[styles.continueBtn, !canContinue && { opacity: 0.5 }]}
            activeOpacity={0.9}
            disabled={!canContinue}
            onPress={handleContinue}
          >
            <Text style={styles.continueText}>
              {returnToReview ? 'Enregistrer et revenir au récap' : 'Continuer'}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

/* Petits composants */
function FieldLabel({ label }: { label: string }) {
  return <Text style={styles.fieldLabel}>{label}</Text>;
}
function Input(props: React.ComponentProps<typeof TextInput>) {
  return (
    <View style={styles.inputWrap}>
      <TextInput
        {...props}
        placeholderTextColor={PALETTE.placeholder}
        style={[styles.input, props.multiline && { height: 110, textAlignVertical: 'top' }]}
      />
    </View>
  );
}

/* Styles */
const styles = StyleSheet.create({
  header:{ height:56, paddingHorizontal:16, backgroundColor:PALETTE.cream, borderBottomWidth:StyleSheet.hairlineWidth, borderBottomColor:PALETTE.border, flexDirection:'row', alignItems:'center', gap:12 },
  headerTitle:{ flex:1, color:PALETTE.primary, fontSize:24, fontWeight:'800' },
  stepBar:{ paddingHorizontal:16, paddingTop:14, paddingBottom:10, backgroundColor:PALETTE.cream, borderBottomColor:PALETTE.border, borderBottomWidth:StyleSheet.hairlineWidth },
  stepTitle:{ color:PALETTE.textDark, fontWeight:'800', fontSize:14, marginBottom:8 },
  progressTrack:{ height:8, backgroundColor:'#E6E9EF', borderRadius:999, overflow:'hidden' },
  progressFill:{ width:'25%', height:'100%', backgroundColor:PALETTE.gold },
  fieldLabel:{ marginTop:16, marginBottom:6, color:PALETTE.textDark, fontWeight:'800', fontSize:14 },
  inputWrap:{ backgroundColor:PALETTE.white, borderRadius:12, borderWidth:1.5, borderColor:PALETTE.border, overflow:'hidden' },
  input:{ paddingHorizontal:12, paddingVertical:12, color:PALETTE.textDark, fontSize:15 },
  hint:{ marginTop:6, color:'rgba(11,18,32,0.7)', fontWeight:'600' },
  continueBtn:{ marginTop:24, backgroundColor:PALETTE.peach, borderRadius:16, paddingVertical:14, alignItems:'center' },
  continueText:{ color:PALETTE.white, fontWeight:'800', fontSize:16 },
});
