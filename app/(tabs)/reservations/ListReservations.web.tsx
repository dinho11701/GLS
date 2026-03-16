import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  useWindowDimensions,
  Platform,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter, useLocalSearchParams } from "expo-router";

/* ---------------- PALETTE ---------------- */

const PALETTE = {
  primary: "#0A0F2C",
  white: "#FFFFFF",
  textDark: "#0B1220",
  grey: "#555",
  green: "#4CAF50",
  amber: "#FFB74D",
  coral: "#FF6B6B",
};

/* ---------------- HELPERS ---------------- */

// 📅 Jour seul (2 mars 2026)
const fmtDay = (iso?: string) => {
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
const fmtTime = (iso?: string) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";

  return new Intl.DateTimeFormat("fr-CA", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
};

const statusBadge = (status: string) => {
  switch (status) {
    case "pending":
      return { text: "En attente", bg: PALETTE.amber };
    case "accepted":
    case "confirmed":
      return { text: "Confirmée", bg: PALETTE.green };
    case "refused":
      return { text: "Refusée", bg: PALETTE.coral };
    default:
      return { text: status, bg: PALETTE.grey };
  }
};

/* ---------------- MAIN ---------------- */

export default function ListReservationsWeb() {
  const { refresh } = useLocalSearchParams();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  const [loading, setLoading] = useState(true);
  const [reservations, setReservations] = useState<any[]>([]);

  const fetchReservations = useCallback(async () => {
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem("idToken");
      const resp = await fetch(
        `${process.env.EXPO_PUBLIC_API_BASE}/partners/reservations`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error);

      setReservations(json.reservations || []);
    } catch (e: any) {
      console.log("❌ Fetch error", e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReservations();
  }, [refresh]);

  return (
    <View style={styles.screen}>
      <Text style={styles.header}>Réservations</Text>

      {loading ? (
        <ActivityIndicator size="large" color={PALETTE.white} />
      ) : (
        <ScrollView
          contentContainerStyle={[
            styles.list,
            !isMobile && styles.listDesktop,
          ]}
        >
          {reservations.map((item) => {
            const badge = statusBadge(item.status);

            // 🔑 SOURCE DE VÉRITÉ DATE / HEURES
            const startISO =
              item.startAtISO ??
              (item.startAt?.toDate
                ? item.startAt.toDate().toISOString()
                : item.calendar?.date
                ? `${item.calendar.date}T00:00:00`
                : undefined);

            const endISO =
              item.endAtISO ??
              (item.endAt?.toDate
                ? item.endAt.toDate().toISOString()
                : undefined);

            return (
              <View
                key={item.id}
                style={[styles.card, !isMobile && styles.cardDesktop]}
              >
                {/* HEADER */}
                <View style={styles.rowBetween}>
                  <Text style={styles.title}>
                    {item.serviceTitle || "Service"}
                  </Text>
                  <View style={[styles.badge, { backgroundColor: badge.bg }]}>
                    <Text style={styles.badgeText}>{badge.text}</Text>
                  </View>
                </View>

                {/* DATE + HEURE */}
                <View style={styles.infoRow}>
                  <Ionicons
                    name="calendar-outline"
                    size={16}
                    color={PALETTE.grey}
                  />
                  <Text style={styles.meta}>
                    {fmtDay(startISO)} · {fmtTime(startISO)} –{" "}
                    {fmtTime(endISO)}
                  </Text>
                </View>

                {/* ACTION */}
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() =>
                    router.push({
                      pathname: `/reservations/${item.id}`,
                      params: { reservation: JSON.stringify(item) },
                    })
                  }
                >
                  <Text style={styles.actionText}>Voir</Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

/* ---------------- STYLES ---------------- */

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: PALETTE.primary,
    paddingTop: 60,
    paddingHorizontal: 18,
  },
  header: {
    color: PALETTE.white,
    fontSize: 30,
    fontWeight: "900",
    marginBottom: 24,
    textAlign: Platform.OS === "web" ? "center" : "left",
  },
  list: { paddingBottom: 120 },
  listDesktop: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 24,
  },
  card: {
    backgroundColor: PALETTE.white,
    borderRadius: 20,
    padding: 20,
    marginBottom: 22,
  },
  cardDesktop: { width: 380 },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
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
  },
  badgeText: {
    color: PALETTE.white,
    fontWeight: "700",
    fontSize: 13,
  },
  infoRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    marginBottom: 14,
  },
  meta: {
    fontSize: 15,
    color: PALETTE.grey,
  },
  actionBtn: {
    backgroundColor: PALETTE.green,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  actionText: {
    color: PALETTE.white,
    fontWeight: "800",
    fontSize: 15,
  },
});