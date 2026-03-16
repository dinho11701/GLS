import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  Platform,
  ScrollView,
  Alert,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";

/* ======================================================
   🔥 API — FORCÉ POUR ÉVITER LES BUGS EXPO WEB
====================================================== */
const API_BASE = "http://localhost:5055/api/v1";



export default function LeaveReviewScreen() {
  const router = useRouter();
  const { reservationId, serviceId, title } = useLocalSearchParams<{
    reservationId: string;
    serviceId: string;
    title?: string;
  }>();

  const [rating, setRating] = useState<number>(0);
  const [comment, setComment] = useState<string>("");

  const canSubmit = rating > 0;

  /* ======================================================
     SUBMIT REVIEW
  ====================================================== */
  const handleSubmit = async () => {
    if (!canSubmit) return;

    try {
      const token =
        (await AsyncStorage.getItem("idToken")) ||
        (typeof window !== "undefined"
          ? localStorage.getItem("idToken")
          : null);

      console.log("🧪 API_BASE =", API_BASE);
      console.log("🧪 TOKEN =", token?.slice(0, 20));

      if (!token) {
        Alert.alert("Session expirée", "Veuillez vous reconnecter.");
        return;
      }

      const resp = await fetch(`${API_BASE}/customers/reviews`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          serviceId,
          rating,
          comment,
        }),
      });

      let data: any = null;
      try {
        data = await resp.json();
      } catch {
        /* ignore JSON parse error */
      }

      if (!resp.ok) {
        Alert.alert(
          "Erreur",
          data?.error || `Erreur ${resp.status}`
        );
        return;
      }

      // ✅ SUCCÈS
      Alert.alert("Merci ⭐", "Votre avis a été envoyé.");
      router.replace("/"); // empêche le retour au modal
    } catch (err) {
      console.error("[LEAVE REVIEW][ERROR]", err);
      Alert.alert("Erreur réseau", "Veuillez réessayer.");
    }
  };

  /* ======================================================
     RENDER
  ====================================================== */
  return (
    <ScrollView
      contentContainerStyle={styles.page}
      keyboardShouldPersistTaps="handled"
    >
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={26} color="#0A0F2C" />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Laisser un avis</Text>
        <View style={{ width: 26 }} />
      </View>

      {/* CARD */}
      <View style={styles.card}>
        <Text style={styles.serviceTitle}>
          {title || "Votre service"}
        </Text>

        {/* ⭐ RATING */}
        <View style={styles.starsRow}>
          {[1, 2, 3, 4, 5].map((n) => (
            <TouchableOpacity
              key={n}
              onPress={() => setRating(n)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={n <= rating ? "star" : "star-outline"}
                size={34}
                color={n <= rating ? "#FFD700" : "#9CA3AF"}
                style={{ marginHorizontal: 4 }}
              />
            </TouchableOpacity>
          ))}
        </View>

        {/* COMMENT */}
        <TextInput
          value={comment}
          onChangeText={setComment}
          placeholder="Décrivez votre expérience (optionnel)"
          placeholderTextColor="#9CA3AF"
          multiline
          numberOfLines={Platform.OS === "web" ? 4 : 5}
          style={styles.textArea}
        />

        {/* SUBMIT */}
        <TouchableOpacity
          style={[
            styles.submitBtn,
            !canSubmit && styles.submitBtnDisabled,
          ]}
          disabled={!canSubmit}
          onPress={handleSubmit}
        >
          <Text style={styles.submitText}>Envoyer l’avis</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

/* ======================================================
   STYLES (WEB + MOBILE)
====================================================== */
const styles: any = {
  page: {
    flexGrow: 1,
    backgroundColor: "#F9FAFB",
    padding: 16,
    alignItems: "center",
  },
  header: {
    width: "100%",
    maxWidth: 520,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: "#0A0F2C",
  },
  card: {
    width: "100%",
    maxWidth: 520,
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 20,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  serviceTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0A0F2C",
    textAlign: "center",
    marginBottom: 18,
  },
  starsRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginBottom: 20,
  },
  textArea: {
    minHeight: 110,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 14,
    fontSize: 15,
    color: "#111827",
    textAlignVertical: "top",
    marginBottom: 20,
  },
  submitBtn: {
    backgroundColor: "#EF8A73",
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
  },
  submitBtnDisabled: {
    opacity: 0.5,
  },
  submitText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "900",
  },
};