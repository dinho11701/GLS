// app/(tabs)/PaymentScreen.tsx
import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  Platform,
  Switch,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { apiFetch } from "@lib/api";

const PALETTE = {
  primary: "#0A0F2C",
  white: "#FFFFFF",
  cream: "#F9FAFB",
  textDark: "#0B1220",
  placeholder: "rgba(11,18,32,0.45)",
  coral: "#FF6B6B",
  gold: "#FFD700",
  peach: "#EF8A73",
  border: "rgba(11,18,32,0.12)",
  green: "#10B981",
  gray: "rgba(11,18,32,0.65)",
};

type Region = "CA-QC" | "CA-ON" | "US-CA" | "US-NY" | "INTL";
const SERVICE_FEE_PCT = 0.08;

const TAX_RULES: Record<Region, { label: string; rate: number }[]> = {
  "CA-QC": [
    { label: "TPS (5%)", rate: 0.05 },
    { label: "TVQ (9.975%)", rate: 0.09975 },
  ],
  "CA-ON": [{ label: "TVH (13%)", rate: 0.13 }],
  "US-CA": [{ label: "Sales tax CA (7.25%)", rate: 0.0725 }],
  "US-NY": [{ label: "Sales tax NY (8.875%)", rate: 0.08875 }],
  INTL: [],
};

const money = (n?: number, currency: "CAD" | "USD" | "EUR" = "CAD") =>
  typeof n === "number"
    ? new Intl.NumberFormat("fr-CA", { style: "currency", currency }).format(n)
    : "—";

const round2 = (n: number) => Math.round(n * 100) / 100;

function calcBreakdown(basePrice: number, region: Region) {
  const serviceFee = round2(basePrice * SERVICE_FEE_PCT);
  const taxLines = TAX_RULES[region] ?? [];
  const taxes = round2(taxLines.reduce((sum, t) => sum + basePrice * t.rate, 0));
  const total = round2(basePrice + serviceFee + taxes);
  return { serviceFee, taxes, total, taxLines };
}

export default function PaymentScreen() {
  const router = useRouter();

  const params = useLocalSearchParams<{
    serviceId?: string;
    title?: string;
    price?: string;
    currency?: string;
    region?: Region;
    date?: string;
    startTime?: string;
    endTime?: string;
  }>();

  const basePrice = Number(params.price || 0);
  const region: Region = params.region || "CA-QC";
  const currency: "CAD" | "USD" | "EUR" =
    params.currency || (region.startsWith("US") ? "USD" : "CAD");
  const serviceId = params.serviceId || "";

  const startTime = params.startTime;
  const endTime = params.endTime;
  const date = params.date;

  const { serviceFee, taxes, total, taxLines } = useMemo(
    () => calcBreakdown(basePrice, region),
    [basePrice, region]
  );

  // FORM STATE
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [exp, setExp] = useState("");
  const [cvc, setCvc] = useState("");
  const [saveCard, setSaveCard] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const canReserve =
    fullName.trim().length > 0 &&
    email.trim().length > 0 &&
    /^\S+@\S+\.\S+$/.test(email);

  const handlePay = async () => {
    console.log("🟦 RAW params:", params);

    if (!canReserve) {
      Alert.alert("Vérifie tes infos", "Merci de compléter nom + courriel.");
      return;
    }

    if (!serviceId) {
      Alert.alert("Erreur", "Identifiant du service manquant.");
      return;
    }

    if (!date || !startTime || !endTime) {
      Alert.alert(
        "Erreur",
        "Date, heure de début ou heure de fin manquante."
      );
      return;
    }

    setSubmitting(true);

    try {
      const payload = {
        serviceId,
        date,
        startTime,
        endTime,
      };

      console.log("🟦 PAYLOAD FINAL envoyé:", payload);

      const res = await apiFetch("customers/reservations", {
        method: "POST",
        body: payload,
      });

      console.log("🟧 Réponse backend:", res);

      if (res?.reservationId) {
        Alert.alert(
          "Réservation confirmée",
          "Ta réservation a été créée avec succès.",
          [{ text: "OK", onPress: () => router.replace("/(tabs)/Message") }]
        );
        return;
      }

      throw new Error(res?.error || res?.message || "Impossible de réserver.");
    } catch (err: any) {
      console.log("❌ ERREUR handlePay:", err);
      Alert.alert(
        "Erreur",
        err?.message || "Impossible de créer la réservation."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
          <Ionicons name="chevron-back" size={22} color={PALETTE.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          Paiement
        </Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 140 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Infos payeur */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Tes informations</Text>

          <View style={styles.inputWrap}>
            <Ionicons
              name="person-outline"
              size={16}
              color={PALETTE.placeholder}
            />
            <TextInput
              style={styles.input}
              placeholder="Nom complet"
              value={fullName}
              onChangeText={setFullName}
              placeholderTextColor={PALETTE.placeholder}
            />
          </View>

          <View style={styles.rowGap}>
            <View style={[styles.inputWrap, { flex: 1 }]}>
              <Ionicons
                name="mail-outline"
                size={16}
                color={PALETTE.placeholder}
              />
              <TextInput
                style={styles.input}
                placeholder="Courriel"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                placeholderTextColor={PALETTE.placeholder}
              />
            </View>

            <View style={{ width: 10 }} />

            <View style={[styles.inputWrap, { width: 150 }]}>
              <Ionicons
                name="call-outline"
                size={16}
                color={PALETTE.placeholder}
              />
              <TextInput
                style={styles.input}
                placeholder="Téléphone"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                placeholderTextColor={PALETTE.placeholder}
              />
            </View>
          </View>
        </View>

        {/* Carte */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Carte de paiement (simulation)</Text>

          <View style={styles.inputWrap}>
            <Ionicons
              name="card-outline"
              size={16}
              color={PALETTE.placeholder}
            />
            <TextInput
              style={styles.input}
              placeholder="Numéro de carte (facultatif)"
              value={cardNumber}
              onChangeText={(v) =>
                setCardNumber(v.replace(/\D/g, "").slice(0, 16))
              }
              keyboardType="numeric"
              maxLength={19}
              placeholderTextColor={PALETTE.placeholder}
            />
          </View>

          <View style={styles.rowGap}>
            <View style={[styles.inputWrap, { width: 120 }]}>
              <Ionicons
                name="time-outline"
                size={16}
                color={PALETTE.placeholder}
              />
              <TextInput
                style={styles.input}
                placeholder="MM/AA"
                value={exp}
                onChangeText={setExp}
                keyboardType="numeric"
                maxLength={5}
                placeholderTextColor={PALETTE.placeholder}
              />
            </View>

            <View style={[styles.inputWrap, { width: 120 }]}>
              <Ionicons
                name="lock-closed-outline"
                size={16}
                color={PALETTE.placeholder}
              />
              <TextInput
                style={styles.input}
                placeholder="CVC"
                value={cvc}
                onChangeText={setCvc}
                keyboardType="numeric"
                maxLength={4}
                placeholderTextColor={PALETTE.placeholder}
                secureTextEntry
              />
            </View>

            <View style={{ flex: 1 }} />
          </View>

          <View style={styles.saveRow}>
            <Switch value={saveCard} onValueChange={setSaveCard} />
            <Text style={styles.saveTxt}>Enregistrer la carte</Text>
          </View>
        </View>

        {/* Recap */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Résumé</Text>

          <Text style={styles.lineLabel}>
            {params.title} ({startTime} → {endTime})
          </Text>
          <Text style={styles.lineLabel}>Date : {date}</Text>

          <View style={styles.sep} />

          <View style={styles.lineRow}>
            <Text style={styles.lineLabel}>Prix</Text>
            <Text style={styles.lineValue}>{money(basePrice, currency)}</Text>
          </View>

          <View style={styles.lineRow}>
            <Text style={styles.lineLabel}>Frais de service (8%)</Text>
            <Text style={styles.lineValue}>{money(serviceFee, currency)}</Text>
          </View>

          {taxLines.map((t, i) => (
            <View key={i} style={styles.lineRow}>
              <Text style={styles.lineLabel}>{t.label}</Text>
              <Text style={styles.lineValue}>
                {money(round2(basePrice * t.rate), currency)}
              </Text>
            </View>
          ))}

          <View style={styles.sep} />

          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>{money(total, currency)}</Text>
          </View>
        </View>
      </ScrollView>

      {/* CTA */}
      <View style={styles.ctaBar}>
        <TouchableOpacity
          disabled={!canReserve || submitting}
          style={[
            styles.ctaBtn,
            (!canReserve || submitting) && { opacity: 0.5 },
          ]}
          onPress={handlePay}
        >
          <Text style={styles.ctaBtnText}>
            {submitting ? "Traitement..." : "Payer (simulation)"}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: PALETTE.primary },

  header: {
    height: 56,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  headerBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },

  headerTitle: {
    flex: 1,
    color: PALETTE.white,
    fontSize: 20,
    fontWeight: "900",
  },

  card: {
    backgroundColor: PALETTE.white,
    marginHorizontal: 14,
    marginTop: 12,
    padding: 14,
    borderRadius: 18,
  },

  sectionTitle: {
    color: PALETTE.textDark,
    fontSize: 16,
    fontWeight: "900",
    marginBottom: 10,
  },

  rowGap: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
  },

  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: PALETTE.cream,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 10,
  },

  input: { flex: 1, color: PALETTE.textDark, fontSize: 15 },

  saveRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 12,
  },

  saveTxt: { color: PALETTE.gray },

  lineRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },

  lineLabel: { color: "rgba(11,18,32,0.7)", fontWeight: "700" },
  lineValue: { color: PALETTE.textDark, fontWeight: "800" },

  sep: { height: 1, backgroundColor: PALETTE.border, marginVertical: 12 },

  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  totalLabel: { color: PALETTE.textDark, fontSize: 16, fontWeight: "900" },
  totalValue: { color: PALETTE.textDark, fontSize: 18, fontWeight: "900" },

  ctaBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: PALETTE.white,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },

  ctaBtn: {
    backgroundColor: PALETTE.peach,
    borderRadius: 14,
    paddingHorizontal: 22,
    height: 46,
    alignItems: "center",
    justifyContent: "center",
  },

  ctaBtnText: {
    color: PALETTE.white,
    fontWeight: "900",
    fontSize: 16,
  },
});
