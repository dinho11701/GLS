import React, { useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Dimensions,
  ActivityIndicator,
  Alert,
  Animated,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import AsyncStorage from "@react-native-async-storage/async-storage";

const screenWidth = Dimensions.get("window").width;

const PALETTE = {
  primary: "#0A0F2C",
  white: "#FFFFFF",
  textDark: "#0B1220",
  grey: "#777",
  coral: "#FF6B6B",
  green: "#4CAF50",
  amber: "#FFB74D",
};

/* ---------------------- HELPERS ---------------------- */
const toDate = (v) => (v?.toDate ? v.toDate() : new Date(v));

const formatDateTime = (v) => {
  const d = toDate(v);
  if (!d) return "Date inconnue";
  return new Intl.DateTimeFormat("fr-CA", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
};

const getBadgeStyle = (status) => {
  switch (status) {
    case "pending":
      return { label: "En attente", bg: PALETTE.amber };
    case "accepted":
      return { label: "Acceptée", bg: PALETTE.green };
    case "confirmed":
      return { label: "Confirmée", bg: PALETTE.green };
    case "refused":
      return { label: "Refusée", bg: PALETTE.coral };
    default:
      return { label: status, bg: PALETTE.grey };
  }
};

/* ---------------------- COMPONENT ---------------------- */
export default function ReservationDetail() {
  const router = useRouter();
  const { reservation } = useLocalSearchParams();

  const [loadingAction, setLoadingAction] = useState(false);

  // Animation badge
  const badgeAnim = useRef(new Animated.Value(0)).current;

  const animateBadge = () => {
    Animated.timing(badgeAnim, {
      toValue: 1,
      duration: 350,
      useNativeDriver: true,
    }).start();
  };

  const [data, setData] = useState(() => {
    try {
      return reservation ? JSON.parse(reservation) : null;
    } catch {
      return null;
    }
  });

  if (!data)
    return (
      <View style={styles.screen}>
        <Text style={styles.error}>Réservation introuvable.</Text>
      </View>
    );

  const badge = getBadgeStyle(data.status);

  /* --------------------- Accepter / Refuser --------------------- */
  const updateStatus = async (status) => {
    Alert.alert(
      status === "accepted" ? "Accepter la réservation ?" : "Refuser la réservation ?",
      "",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Confirmer",
          onPress: async () => {
            try {
              setLoadingAction(true);

              // 🔥 Optimistic update
              setData((prev) => ({ ...prev, status }));
              animateBadge();

              const token = await AsyncStorage.getItem("idToken");

              const resp = await fetch(
                `${process.env.EXPO_PUBLIC_API_BASE}/partners/reservations/${data.id}/status`,
                {
                  method: "PATCH",
                  headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({ status }),
                }
              );

              if (!resp.ok) throw new Error("Erreur API");

              setLoadingAction(false);

              Alert.alert(
                "Succès",
                status === "accepted"
                  ? "Réservation acceptée."
                  : "Réservation refusée."
              );

              // Navigation FIX → chemin correct
              router.replace("/reservations/ListReservations");
            } catch (e) {
              setLoadingAction(false);
              Alert.alert("Erreur", "Impossible de mettre à jour.");
            }
          },
        },
      ]
    );
  };

  /* --------------------- Images --------------------- */
  const images =
    (data.images?.length ? data.images : []) ||
    data.photos ||
    [];

  const finalImages =
    images.length > 0
      ? images
      : ["https://images.pexels.com/photos/261102/pexels-photo-261102.jpeg"];

  const finalDate =
    data.calendar?.date && data.calendar?.time
      ? formatDateTime(`${data.calendar.date}T${data.calendar.time}:00`)
      : formatDateTime(data.startAtISO || data.startAt || data.date);

  const endTime =
    data.calendar?.date && data.calendar?.time && data.durationMin
      ? formatDateTime(
          new Date(
            new Date(`${data.calendar.date}T${data.calendar.time}:00`).getTime() +
              (data.durationMin ?? 0) * 60000
          )
        )
      : "—";

  const showActions =
    data.status === "pending" || data.status === "confirmed";

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        {/* Back Button */}
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={30} color={PALETTE.white} />
        </TouchableOpacity>

        {/* Slider */}
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          style={{ marginBottom: 20 }}
        >
          {finalImages.map((img, index) => (
            <Image key={index} source={{ uri: img }} style={styles.sliderImage} />
          ))}
        </ScrollView>

        {/* Title */}
        <Text style={styles.title}>{data.serviceTitle || "Réservation"}</Text>

        {/* Animated badge */}
        <Animated.View
          style={[
            styles.statusBadge,
            { backgroundColor: badge.bg, opacity: badgeAnim },
          ]}
        >
          <Text style={styles.statusText}>{badge.label}</Text>
        </Animated.View>

        {/* Calendar */}
        <View style={styles.calendarCard}>
          <Ionicons name="calendar" size={26} color={PALETTE.primary} />
          <Text style={styles.calendarText}>{finalDate}</Text>
        </View>

        {/* Details */}
        <View style={styles.card}>
          <Text style={styles.section}>Détails du client</Text>
          <Text style={styles.item}>👤 {data.customerName || "Inconnu"}</Text>
          <Text style={styles.item}>📧 {data.customerEmail || "—"}</Text>
          <Text style={styles.item}>📞 {data.customerPhone || "—"}</Text>

          <Text style={[styles.section, { marginTop: 20 }]}>Service</Text>

          <Text style={styles.item}>📅 Début : {finalDate}</Text>
          <Text style={styles.item}>⏱ Durée : {data.durationMin ?? "—"} min</Text>
          <Text style={styles.item}>⏳ Fin estimée : {endTime}</Text>
          <Text style={styles.item}>
            💵 Prix : {data.price ? `${data.price} $` : "—"}
          </Text>

          <Text style={[styles.section, { marginTop: 20 }]}>Notes</Text>
          <Text style={styles.note}>{data.note || "Aucune note."}</Text>
        </View>

        {/* ACTION BUTTONS */}
        {showActions && (
          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={[styles.actionBtn, styles.accept]}
              onPress={() => updateStatus("accepted")}
            >
              {loadingAction ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.actionText}>Accepter</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionBtn, styles.refuse]}
              onPress={() => updateStatus("refused")}
            >
              {loadingAction ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.actionText}>Refuser</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

/* ---------------------- STYLES ---------------------- */
const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: PALETTE.primary,
    paddingTop: 50,
    paddingHorizontal: 18,
  },

  sliderImage: {
    width: screenWidth - 36,
    height: 180,
    borderRadius: 14,
    marginRight: 10,
    resizeMode: "cover",
  },

  backBtn: { marginBottom: 14 },

  title: {
    color: PALETTE.white,
    fontSize: 30,
    fontWeight: "900",
    marginBottom: 10,
  },

  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    alignSelf: "flex-start",
    marginBottom: 20,
  },

  statusText: { color: PALETTE.white, fontWeight: "800" },

  calendarCard: {
    backgroundColor: PALETTE.white,
    padding: 16,
    borderRadius: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 20,
  },

  calendarText: {
    fontSize: 17,
    fontWeight: "700",
    color: PALETTE.textDark,
  },

  card: {
    backgroundColor: PALETTE.white,
    padding: 22,
    borderRadius: 20,
  },

  section: {
    fontSize: 18,
    fontWeight: "900",
    color: PALETTE.textDark,
    marginBottom: 12,
  },

  item: {
    fontSize: 16,
    color: "#333",
    marginBottom: 6,
  },

  note: {
    fontSize: 15,
    color: PALETTE.grey,
  },

  actionsRow: {
    flexDirection: "row",
    gap: 14,
    marginTop: 20,
  },

  actionBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },

  accept: { backgroundColor: PALETTE.green },
  refuse: { backgroundColor: PALETTE.coral },

  actionText: {
    color: PALETTE.white,
    fontWeight: "800",
    fontSize: 16,
  },

  error: {
    marginTop: 50,
    color: PALETTE.white,
    fontSize: 18,
    textAlign: "center",
  },
});
