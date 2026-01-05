import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import StarRating from "../../../components/StarRating";

export default function LeaveReviewScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const serviceId = params.serviceId as string;
  const reservationId = params.reservationId as string;
  const serviceName = params.title as string;

  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (rating === 0) {
      alert("Merci d'attribuer une note 🌟");
      return;
    }

    setLoading(true);

    try {
      const token = await AsyncStorage.getItem("idToken");

      const res = await fetch(
        `${process.env.EXPO_PUBLIC_API_BASE}/customers/reviews`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ serviceId, rating, comment }),
        }
      );

      const json = await res.json();
      if (!json.ok) {
        alert(json.error || "Une erreur est survenue.");
        return;
      }

      await fetch(
        `${process.env.EXPO_PUBLIC_API_BASE}/customers/reservations/${reservationId}/notifs`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      alert("Merci pour votre avis 🙏");
      router.back();
    } catch (err) {
      alert("Erreur réseau.");
    }

    setLoading(false);
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1 }}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.card}>
          <Text style={styles.title}>Votre avis sur</Text>
          <Text style={styles.serviceName}>{serviceName}</Text>

          <StarRating
            rating={rating}
            onChange={setRating}
            size={42}
            color="#FF5A5F"
          />

          <TextInput
            placeholder="Décrivez votre expérience (optionnel)"
            placeholderTextColor="#999"
            value={comment}
            onChangeText={setComment}
            multiline
            style={styles.commentInput}
          />

          <TouchableOpacity
            disabled={loading}
            onPress={submit}
            style={[styles.button, loading && { opacity: 0.6 }]}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Publier l'avis</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    paddingTop: 50,
    alignItems: "center",
    backgroundColor: "#F7F7F7",
    minHeight: "100%",
  },

  card: {
    width: "100%",
    maxWidth: 600,
    backgroundColor: "#fff",
    padding: 26,
    borderRadius: 24,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },

  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#2B2B2B",
    textAlign: "center",
  },

  serviceName: {
    fontSize: 22,
    fontWeight: "900",
    color: "#FF5A5F",
    textAlign: "center",
    marginBottom: 20,
    marginTop: 2,
  },

  commentInput: {
    marginTop: 25,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    padding: 14,
    borderRadius: 16,
    minHeight: 140,
    fontSize: 15,
    backgroundColor: "#FAFAFA",
    textAlignVertical: "top",
  },

  button: {
    backgroundColor: "#FF5A5F",
    paddingVertical: 16,
    borderRadius: 18,
    alignItems: "center",
    marginTop: 28,
    shadowColor: "#FF5A5F",
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 3,
  },

  buttonText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "800",
  },
});
