// app/(tabs)/partner/create/PriceScreen.tsx
import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Localization from 'expo-localization';

const PALETTE = {
  primary:'#0A0F2C', white:'#FFFFFF', cream:'#F9FAFB', textDark:'#0B1220',
  placeholder:'rgba(11,18,32,0.45)', border:'rgba(11,18,32,0.18)',
  gold:'#FFD700', peach:'#EF8A73',
};

const REGION_TO_CURRENCY: Record<string, string> = {
  CA:'CAD', US:'USD', FR:'EUR', BE:'EUR', CH:'CHF', DE:'EUR', ES:'EUR',
  IT:'EUR', PT:'EUR', NL:'EUR', LU:'EUR', IE:'EUR', GB:'GBP', AU:'AUD',
  NZ:'NZD', JP:'JPY', CN:'CNY', SN:'XOF', CI:'XOF', ML:'XOF', BF:'XOF',
  TG:'XOF', BJ:'XOF', NE:'XOF', GW:'XOF', CM:'XAF', GA:'XAF', CG:'XAF',
  TD:'XAF', CF:'XAF', GQ:'XAF', MA:'MAD', DZ:'DZD', TN:'TND', ZA:'ZAR',
  BR:'BRL', MX:'MXN', IN:'INR',
};

function suggestCurrency(): string {
  const region = Localization.region?.toUpperCase() ?? '';
  return REGION_TO_CURRENCY[region] ?? 'USD';
}

function formatMoneySample(locale: string, currency: string, value: number) {
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: 2 }).format(value);
  } catch {
    return `${value.toFixed(2)} ${currency}`;
  }
}

export default function PriceScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ from?: string }>();
  const returnToReview = params?.from === 'review';

  const locale = Localization.locale ?? 'en-US';

  const [currency, setCurrency] = useState<string>(suggestCurrency());
  const [price, setPrice] = useState<string>('');         // requis
  const [travelFee, setTravelFee] = useState<string>(''); // optionnel

  // Pré-remplir depuis le draft si retour sur l’écran
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem('draft_service_step2_price');
        if (raw) {
          const d = JSON.parse(raw) || {};
          if (typeof d.price === 'number') setPrice(String(d.price));
          if (typeof d.travelFee === 'number') setTravelFee(String(d.travelFee));
          if (typeof d.currency === 'string') setCurrency(d.currency);
        }
      } catch {}
    })();
  }, []);

  // normalise devise
  useEffect(() => { setCurrency(c => (c || '').toUpperCase().slice(0,3)); }, []);

  const valid = useMemo(() => {
    const p = Number(price.replace(',', '.'));
    if (!price.trim() || isNaN(p) || p <= 0) return false;
    if (travelFee.trim()) {
      const f = Number(travelFee.replace(',', '.'));
      if (isNaN(f) || f < 0) return false;
    }
    return /^[A-Za-z]{3}$/.test(currency.trim());
  }, [price, travelFee, currency]);

  const pricePreview = useMemo(() => {
    const p = Number(price.replace(',', '.'));
    if (isNaN(p) || p <= 0) return '';
    return formatMoneySample(locale, currency.trim().toUpperCase(), p);
  }, [price, currency, locale]);

  const travelPreview = useMemo(() => {
    const f = Number(travelFee.replace(',', '.'));
    if (!travelFee.trim() || isNaN(f) || f < 0) return '';
    return formatMoneySample(locale, currency.trim().toUpperCase(), f);
  }, [travelFee, currency, locale]);

  const handleBack = useCallback(() => {
    if (returnToReview) {
      router.replace('/(tabs)/partner/create/ReviewScreen');
    } else {
      router.back();
    }
  }, [returnToReview, router]);

  const saveAndNext = useCallback(async () => {
    if (!valid) return;
    try {
      // on sauve au format attendu par ReviewScreen (sans type/minHours)
      await AsyncStorage.setItem(
        'draft_service_step2_price',
        JSON.stringify({
          price: Number(price.replace(',', '.')),
          currency: currency.trim().toUpperCase(),
          travelFee: travelFee.trim() ? Number(travelFee.replace(',', '.')) : undefined,
          locale,
        })
      );

      if (returnToReview) {
        // Retour direct au récap si on vient de là
        router.replace('/(tabs)/partner/create/ReviewScreen');
      } else {
        // Flow normal
        router.push('/(tabs)/partner/create/PictureScreen');
      }
    } catch {
      Alert.alert('Erreur', "Impossible d’enregistrer la tarification.");
    }
  }, [valid, price, travelFee, currency, locale, returnToReview, router]);

  return (
    <View style={{ flex:1, backgroundColor: PALETTE.cream }}>
      <SafeAreaView style={{ flex:1 }}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack}>
            <Ionicons name="chevron-back" size={26} color={PALETTE.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Créer (Pro)</Text>
          <View style={{ width:26 }} />
        </View>

        <View style={styles.stepBar}>
          <Text style={styles.stepTitle}>Étape 2/4 : Tarification</Text>
          <View style={styles.progressTrack}><View style={[styles.progressFill, { width: '50%' }]} /></View>
          <Text style={styles.localeHint}>{`Langue: ${locale} • Devise suggérée: ${suggestCurrency()}`}</Text>
        </View>

        <ScrollView contentContainerStyle={{ padding:16, paddingBottom:28 }}>
          <FieldLabel label="Prix" />
          <Input placeholder="Ex. 120" value={price} onChangeText={setPrice} keyboardType="decimal-pad" />
          {!!pricePreview && <Text style={styles.preview}>{`Aperçu: ${pricePreview}`}</Text>}

          <FieldLabel label="Frais de déplacement (optionnel)" />
          <Input placeholder="Ex. 15" value={travelFee} onChangeText={setTravelFee} keyboardType="decimal-pad" />
          {!!travelPreview && <Text style={styles.preview}>{`Aperçu: ${travelPreview}`}</Text>}

          <FieldLabel label="Devise (3 lettres — ex. CAD, EUR, USD)" />
          <Input
            placeholder={suggestCurrency()}
            value={currency}
            onChangeText={(v) => setCurrency(v.toUpperCase().slice(0,3))}
            autoCapitalize="characters"
          />

          <TouchableOpacity style={[styles.cta, !valid && { opacity: 0.5 }]} activeOpacity={0.9} disabled={!valid} onPress={saveAndNext}>
            <Text style={styles.ctaText}>{returnToReview ? 'Enregistrer et revenir au récap' : 'Continuer'}</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function FieldLabel({ label }: { label: string }) {
  return <Text style={styles.fieldLabel}>{label}</Text>;
}

function Input(props: React.ComponentProps<typeof TextInput>) {
  return (
    <View style={styles.inputWrap}>
      <TextInput {...props} placeholderTextColor={PALETTE.placeholder} style={styles.input} />
    </View>
  );
}

const styles = StyleSheet.create({
  header:{ height:56, paddingHorizontal:16, backgroundColor:PALETTE.cream,
    borderBottomWidth:StyleSheet.hairlineWidth, borderBottomColor:PALETTE.border,
    flexDirection:'row', alignItems:'center', gap:12 },
  headerTitle:{ flex:1, color:PALETTE.primary, fontSize:24, fontWeight:'800' },

  stepBar:{ paddingHorizontal:16, paddingTop:14, paddingBottom:10,
    backgroundColor:PALETTE.cream, borderBottomColor:PALETTE.border, borderBottomWidth:StyleSheet.hairlineWidth },
  stepTitle:{ color:PALETTE.textDark, fontWeight:'800', fontSize:14, marginBottom:8 },
  progressTrack:{ height:8, backgroundColor:'#E6E9EF', borderRadius:999, overflow:'hidden' },
  progressFill:{ height:'100%', backgroundColor:PALETTE.gold },
  localeHint:{ marginTop:8, color:'rgba(11,18,32,0.6)' },

  fieldLabel:{ marginTop:16, marginBottom:6, color:PALETTE.textDark, fontWeight:'800', fontSize:14 },

  inputWrap:{ backgroundColor:PALETTE.white, borderRadius:12, borderWidth:1.5, borderColor:PALETTE.border, overflow:'hidden' },
  input:{ paddingHorizontal:12, paddingVertical:12, color:PALETTE.textDark, fontSize:15 },

  preview:{ marginTop:6, color:'rgba(11,18,32,0.7)', fontWeight:'700' },

  cta:{ marginTop:24, backgroundColor:PALETTE.peach, borderRadius:16, paddingVertical:14, alignItems:'center' },
  ctaText:{ color:PALETTE.white, fontWeight:'800', fontSize:16 },
});
