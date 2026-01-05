// app/(tabs)/host/list-reservations.tsx
import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";


const PALETTE = {
  primary: "#0A0F2C",
  white: "#FFFFFF",
  textDark: "#0B1220",
  grey: "#555",
  lightGrey: "#E6E6E6",
  peach: "#EF8A73",
  coral: "#FF6B6B",
  green: "#4CAF50",
  amber: "#FFB74D",
  black: "#000",
};

/* ---------------------- HELPERS ---------------------- */

const safeDate = (v) => {
  if (!v) return null;
  if (v?.toDate) return v.toDate();
  const d = new Date(v);
  return isNaN(d) ? null : d;
};

const fmtDate = (v) => {
  const d = safeDate(v);
  if (!d) return "—";
  return new Intl.DateTimeFormat("fr-CA", { dateStyle: "medium" }).format(d);
};

/** ❌ Ne JAMAIS utiliser new Date() pour l’heure → timezone bug
 *  → On retourne l’heure EXACTE du backend (string HH:MM)
 */
const fmtHourRaw = (timeStr) => timeStr || "—";

/* ---------------------- BADGES ---------------------- */
const statusBadgeStyle = (status) => {
  switch (status) {
    case "pending":
      return { bg: PALETTE.amber, text: "En attente" };
    case "accepted":
      return { bg: PALETTE.green, text: "Acceptée" };
    case "refused":
      return { bg: PALETTE.coral, text: "Refusée" };
    case "cancelled":
      return { bg: PALETTE.grey, text: "Annulée" };
    default:
      return { bg: PALETTE.grey, text: status };
  }
};

/* ---------------------- LABELS ---------------------- */
const getServiceTitle = (item) =>
  item.serviceTitle ||
  item.title ||
  item.name ||
  item.service?.title ||
  "Service";

const getDateLabel = (item) => {
  if (item.calendar?.date) {
    return fmtDate(`${item.calendar.date}T00:00:00`);
  }
  return fmtDate(item.startAt);
};

/** ⭐ VERSION FINALE — AUCUNE CONVERSION DATE → UTC */
const getStartHourLabel = (item) => {
  if (item.calendar?.time) {
    return fmtHourRaw(item.calendar.time);
  }
  return fmtHourRaw(item.startHour);
};

const getEndHourLabel = (item) => {
  if (item.calendar?.time && item.durationMin) {
    const [h, m] = item.calendar.time.split(":").map(Number);
    const totalMin = h * 60 + m + item.durationMin;
    const endH = Math.floor(totalMin / 60) % 24;
    const endM = totalMin % 60;
    return `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`;
  }

  return fmtHourRaw(item.endHour || null);
};

/* ---------------------- MAIN SCREEN ---------------------- */
export default function ListReservations() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [reservations, setReservations] = useState([]);

  /* API CALL */
  const fetchReservations = useCallback(async () => {
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem("idToken");

      const resp = await fetch(
        `${process.env.EXPO_PUBLIC_API_BASE}/partners/reservations`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const json = JSON.parse(await resp.text());
      if (!resp.ok) throw new Error(json.error);

      setReservations(json.reservations || []);
    } catch (e) {
      console.log("❌ Fetch error:", e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
  useCallback(() => {
    fetchReservations();
  }, [])
);


  /* Send Accept / Refuse */
  const updateStatus = async (id, status) => {
    try {
      const token = await AsyncStorage.getItem("idToken");

      await fetch(
        `${process.env.EXPO_PUBLIC_API_BASE}/partners/reservations/${id}/status`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ status }),
        }
      );

      fetchReservations();
    } catch (e) {
      console.log("❌ Status update error:", e.message);
    }
  };

  /* Render */
  const renderItem = ({ item }) => {
    const title = getServiceTitle(item);
    const date = getDateLabel(item);
    const start = getStartHourLabel(item);
    const end = getEndHourLabel(item);
    const badge = statusBadgeStyle(item.status);

    return (
      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <Text style={styles.title}>{title}</Text>

          <View style={[styles.badge, { backgroundColor: badge.bg }]}>
            <Text style={styles.badgeText}>{badge.text}</Text>
          </View>
        </View>

        <View style={styles.infoRow}>
          <Ionicons name="calendar-outline" size={17} color={PALETTE.grey} />
          <Text style={styles.meta}>{date}</Text>
        </View>

        <View style={styles.infoRow}>
          <Ionicons name="time-outline" size={17} color={PALETTE.grey} />
          <Text style={styles.meta}>{start} → {end}</Text>
        </View>

        {item.status === "pending" && (
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.actionBtn, styles.acceptBtn]}
              onPress={() => updateStatus(item.id, "accepted")}
            >
              <Text style={styles.actionText}>Accepter</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionBtn, styles.refuseBtn]}
              onPress={() => updateStatus(item.id, "refused")}
            >
              <Text style={styles.actionText}>Refuser</Text>
            </TouchableOpacity>
          </View>
        )}

        <TouchableOpacity
          style={styles.detailBtn}
          onPress={() =>
            router.push({
              pathname: `/reservations/${item.id}`,
              params: { reservation: JSON.stringify(item) },
            })
          }
        >
          <Ionicons name="eye-outline" size={17} color={PALETTE.white} />
          <Text style={styles.detailText}>Voir détails</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.screen}>
      <Text style={styles.header}>Réservations</Text>

      {loading ? (
        <ActivityIndicator color={PALETTE.white} size="large" />
      ) : (
        <FlatList
          data={reservations}
          renderItem={renderItem}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ paddingBottom: 200 }}
        />
      )}
    </View>
  );
}

/* ---------------------- STYLES ---------------------- */
const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: PALETTE.primary,
    paddingTop: 60,
    paddingHorizontal: 18,
  },

  header: {
    color: PALETTE.white,
    fontSize: 32,
    fontWeight: "900",
    marginBottom: 22,
  },

  card: {
    backgroundColor: PALETTE.white,
    padding: 20,
    borderRadius: 22,
    marginBottom: 22,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },

  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },

  title: {
    fontSize: 18,
    fontWeight: "800",
    color: PALETTE.textDark,
    maxWidth: "70%",
  },

  badge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    minWidth: 90,
    alignItems: "center",
  },

  badgeText: {
    fontSize: 13,
    fontWeight: "700",
    color: PALETTE.white,
  },

  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    gap: 8,
  },

  meta: {
    color: PALETTE.grey,
    fontSize: 15,
    fontWeight: "500",
  },

  actionRow: {
    flexDirection: "row",
    gap: 14,
    marginTop: 18,
  },

  actionBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 14,
    alignItems: "center",
  },

  acceptBtn: { backgroundColor: "#3CB371" },
  refuseBtn: { backgroundColor: "#FF6B6B" },

  actionText: {
    color: PALETTE.white,
    fontWeight: "800",
    fontSize: 16,
  },

  detailBtn: {
    marginTop: 18,
    backgroundColor: PALETTE.peach,
    paddingVertical: 12,
    borderRadius: 14,
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
  },

  detailText: {
    color: PALETTE.white,
    fontWeight: "800",
    fontSize: 16,
  },
});
