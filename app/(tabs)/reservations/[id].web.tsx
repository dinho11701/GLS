import React, { useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
  Animated,
  useWindowDimensions,
  Platform,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import AsyncStorage from "@react-native-async-storage/async-storage";

/* ---------------- PALETTE ---------------- */

const PALETTE = {
  primary: "#0A0F2C",
  white: "#FFFFFF",
  textDark: "#0B1220",
  grey: "#777",
  coral: "#FF6B6B",
  green: "#4CAF50",
  amber: "#FFB74D",
};

/* ---------------- HELPERS ---------------- */

// 📅 Jour seul (2 mars 2026)
const fmtDay = (iso?: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";

  return new Intl.DateTimeFormat("fr-CA", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(d);
};

// 🕒 Heure seule (09 h 00)
const fmtTime = (iso?: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";

  return new Intl.DateTimeFormat("fr-CA", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
};

const getBadgeStyle = (status: string) => {
  switch (status) {
    case "pending":
      return { label: "En attente", bg: PALETTE.amber };
    case "accepted":
    case "confirmed":
      return { label: "Confirmée", bg: PALETTE.green };
    case "refused":
      return { label: "Refusée", bg: PALETTE.coral };
    default:
      return { label: status, bg: PALETTE.grey };
  }
};

/* ---------------- COMPONENT ---------------- */

export default function ReservationDetail() {
  const router = useRouter();
  const { reservation } = useLocalSearchParams();
  const { width } = useWindowDimensions();

  const isMobile = width < 480;
  const isWebWide = Platform.OS === "web" && width >= 900;
  const contentWidth = isWebWide ? 900 : width - 32;

  const [loadingAction, setLoadingAction] = useState(false);
  const badgeAnim = useRef(new Animated.Value(1)).current;

  const [data, setData] = useState<any>(() => {
    try {
      return reservation ? JSON.parse(reservation as string) : null;
    } catch {
      return null;
    }
  });

  if (!data) {
    return (
      <View style={styles.screen}>
        <Text style={styles.error}>Réservation introuvable.</Text>
      </View>
    );
  }

  const badge = getBadgeStyle(data.status);
  const showActions = data.status === "pending";

  // 🔑 SOURCE DE VÉRITÉ DATE / HEURES
  const startISO =
    data.startAtISO ??
    (data.startAt?.toDate
      ? data.startAt.toDate().toISOString()
      : data.calendar?.date
      ? `${data.calendar.date}T${data.calendar.time || "00:00"}:00`
      : null);

  const endISO =
    data.endAtISO ??
    (data.endAt?.toDate ? data.endAt.toDate().toISOString() : null);

  /* ---------------- UPDATE STATUS ---------------- */

  const doUpdateStatus = async (nextStatus: "accepted" | "refused") => {
    setLoadingAction(true);
    try {
      const token = await AsyncStorage.getItem("idToken");

      const resp = await fetch(
        `${process.env.EXPO_PUBLIC_API_BASE}/partners/reservations/${data.id}/status`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ status: nextStatus }),
        }
      );

      if (!resp.ok) {
        const err = await resp.json();
        throw new Error(err?.error || "Erreur serveur");
      }

      setData((prev: any) => ({ ...prev, status: nextStatus }));

      router.replace({
        pathname: "/reservations/ListReservations",
        params: { refresh: "1" },
      });
    } catch (e: any) {
      Alert.alert("Erreur", e.message || "Impossible de mettre à jour.");
    } finally {
      setLoadingAction(false);
    }
  };

  const updateStatus = (nextStatus: "accepted" | "refused") => {
    if (Platform.OS === "web") return doUpdateStatus(nextStatus);

    Alert.alert(
      nextStatus === "accepted"
        ? "Accepter la réservation ?"
        : "Refuser la réservation ?",
      "Cette action est définitive.",
      [
        { text: "Annuler", style: "cancel" },
        { text: "Confirmer", onPress: () => doUpdateStatus(nextStatus) },
      ]
    );
  };

  const images =
    data.images?.length > 0
      ? data.images
      : ["https://images.pexels.com/photos/261102/pexels-photo-261102.jpeg"];

  /* ---------------- UI ---------------- */

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={{ alignItems: "center", paddingBottom: 140 }}>
        <View style={{ width: contentWidth }}>
          {/* Back */}
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={28} color={PALETTE.white} />
          </TouchableOpacity>

          {/* Images */}
          <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}>
            {images.map((img: string, i: number) => (
              <Image
                key={i}
                source={{ uri: img }}
                style={{
                  width: contentWidth,
                  height: isMobile ? 180 : 260,
                  borderRadius: 16,
                  marginRight: 10,
                }}
              />
            ))}
          </ScrollView>

          {/* Title */}
          <Text style={[styles.title, { fontSize: isMobile ? 26 : 32 }]}>
            {data.serviceTitle || "Réservation"}
          </Text>

          {/* Status */}
          <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
            <Text style={styles.statusText}>{badge.label}</Text>
          </View>

          {/* Date / Time */}
          <View style={styles.calendarCard}>
            <Ionicons name="calendar" size={22} color={PALETTE.primary} />
            <View>
              <Text style={styles.calendarText}>{fmtDay(startISO)}</Text>
              <Text style={styles.timeText}>
                {fmtTime(startISO)} → {fmtTime(endISO)}
              </Text>
            </View>
          </View>

          {/* Details */}
          <View style={styles.card}>
            <Text style={styles.section}>Client</Text>
            <Text style={styles.item}>🆔 {data.customerId || "—"}</Text>

            <Text style={[styles.section, { marginTop: 18 }]}>Service</Text>
            <Text style={styles.item}>
              💵 Prix : {data.price ? `${data.price} $` : "—"}
            </Text>

            <Text style={[styles.section, { marginTop: 18 }]}>Notes</Text>
            <Text style={styles.note}>{data.note || "Aucune note."}</Text>
          </View>

          {/* Actions */}
          {showActions && (
            <View
              style={[
                styles.actionsRow,
                { flexDirection: isMobile ? "column" : "row" },
              ]}
            >
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
        </View>
      </ScrollView>
    </View>
  );
}

/* ---------------- STYLES ---------------- */

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: PALETTE.primary,
    paddingTop: Platform.OS === "web" ? 40 : 50,
  },

  backBtn: { marginBottom: 12 },

  title: {
    color: PALETTE.white,
    fontWeight: "900",
    marginVertical: 12,
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
    fontSize: 16,
    fontWeight: "800",
    color: PALETTE.textDark,
  },

  timeText: {
    fontSize: 15,
    color: PALETTE.grey,
    marginTop: 2,
  },

  card: {
    backgroundColor: PALETTE.white,
    padding: 22,
    borderRadius: 20,
  },

  section: {
    fontSize: 18,
    fontWeight: "900",
    marginBottom: 10,
  },

  item: { fontSize: 16, marginBottom: 6 },

  note: { fontSize: 15, color: PALETTE.grey },

  actionsRow: { gap: 14, marginTop: 20 },

  actionBtn: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    flex: 1,
  },

  accept: { backgroundColor: PALETTE.green },
  refuse: { backgroundColor: PALETTE.coral },

  actionText: {
    color: PALETTE.white,
    fontWeight: "800",
    fontSize: 16,
  },

  error: {
    marginTop: 60,
    color: PALETTE.white,
    fontSize: 18,
    textAlign: "center",
  },
});