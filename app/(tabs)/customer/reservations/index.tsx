import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  Animated,
  Platform,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter, useFocusEffect } from "expo-router";
import SwipeableRow from "../../../../components/SwipeableRow";
import { scale, verticalScale, moderateScale } from "../../../../utils/responsive";

const PALETTE = {
  primary: "#0A0F2C",
  white: "#FFFFFF",
  card: "#F9FAFB",
  textDark: "#0B1220",
  muted: "rgba(11,18,32,0.45)",
  peach: "#EF8A73",
  shadow: "rgba(0,0,0,0.12)",
};

export default function ReservationsScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<any[]>([]);

  /* ------------------------------------------------------------------
      API LIST
  ------------------------------------------------------------------ */
  const fetchReservations = useCallback(async () => {
    const token = await AsyncStorage.getItem("idToken");
    if (!token) return;

    try {
      const resp = await fetch(
        `${process.env.EXPO_PUBLIC_API_BASE}/customers/reservations`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await resp.json();
      setItems(data || []);
    } catch (err) {
      console.error("RESERVATION FETCH ERROR:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReservations();
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchReservations();
    }, [fetchReservations])
  );

  /* ------------------------------------------------------------------
      DELETE (remove from UI instantly)
  ------------------------------------------------------------------ */
  const handleDelete = async (id: string) => {
    const token = await AsyncStorage.getItem("idToken");
    if (!token) return;

    // 🔥 Retirer immédiatement de l'UI → UX meilleure
    setItems((prev) => prev.filter((i) => i.reservationId !== id));

    await fetch(
      `${process.env.EXPO_PUBLIC_API_BASE}/customers/reservations/${id}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      }
    );
  };

  /* ------------------------------------------------------------------
      FORMAT DATE
  ------------------------------------------------------------------ */
  const formatDate = (d: string) => {
    if (!d) return "—";
    const [year, month, day] = d.split("-");

    const monthsFr = [
      "",
      "janvier", "février", "mars", "avril", "mai", "juin",
      "juillet", "août", "septembre", "octobre", "novembre", "décembre",
    ];

    return `${day} ${monthsFr[Number(month)]} ${year}`;
  };

  /* ------------------------------------------------------------------
      STATUS COLORS
  ------------------------------------------------------------------ */
  const statusColors: any = {
    confirmed: "#4CAF50",
    pending: "#FFC107",
    cancelled: "#E53935",
  };

  /* ------------------------------------------------------------------
      RENDER ITEM (WITH SWIPE + STATUS)
  ------------------------------------------------------------------ */
  const renderItem = ({ item }: any) => {
    const scaleAnim = new Animated.Value(1);

    return (
      <SwipeableRow onDelete={() => handleDelete(item.reservationId)}>
        <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
          <TouchableOpacity
            activeOpacity={0.90}
            onPress={() =>
              router.push(`/customer/reservations/${item.reservationId}`)
            }
            style={styles.card}
          >
            {/* IMAGE */}
            {item.coverUrl ? (
              <Image source={{ uri: item.coverUrl }} style={styles.cover} />
            ) : (
              <View style={styles.coverEmpty}>
                <Ionicons name="image-outline" size={moderateScale(28)} color="#fff" />
              </View>
            )}

            {/* TEXTS */}
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{item.serviceName}</Text>

              <Text style={styles.date}>
                {formatDate(item.date)} — {item.time}
              </Text>

              {/* STATUS */}
              <View
                style={[
                  styles.statusPill,
                  { backgroundColor: statusColors[item.status] || "#777" },
                ]}
              >
                <Text style={styles.statusText}>{item.status}</Text>
              </View>
            </View>

            <Ionicons name="chevron-forward" size={20} color="#999" />
          </TouchableOpacity>
        </Animated.View>
      </SwipeableRow>
    );
  };

  /* ------------------------------------------------------------------
      EMPTY STATES
  ------------------------------------------------------------------ */
  if (loading) {
    return (
      <View style={styles.center}>
        <Ionicons name="hourglass-outline" size={45} color="#aaa" />
      </View>
    );
  }

  if (items.length === 0) {
    return (
      <View style={styles.center}>
        <Ionicons name="calendar-outline" size={60} color="#777" />
        <Text style={styles.emptyText}>Aucune réservation pour le moment</Text>
      </View>
    );
  }

  /* ------------------------------------------------------------------
      MAIN
  ------------------------------------------------------------------ */
  return (
    <View style={styles.container}>
      <FlatList
        data={items}
        renderItem={renderItem}
        keyExtractor={(i) => i.reservationId}
        contentContainerStyle={{ padding: scale(16) }}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

/* ------------------------------------------------------------------
      STYLES — RESPONSIVE
------------------------------------------------------------------ */
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: PALETTE.primary,
  },

  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: scale(20),
  },

  emptyText: {
    marginTop: verticalScale(12),
    color: "#bbb",
    fontSize: moderateScale(16),
  },

  card: {
    flexDirection: "row",
    backgroundColor: PALETTE.white,
    padding: scale(16),
    borderRadius: moderateScale(18),
    marginBottom: verticalScale(14),
    alignItems: "center",
    shadowColor: PALETTE.shadow,
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },

  cover: {
    width: scale(70),
    height: scale(70),
    borderRadius: moderateScale(16),
    marginRight: scale(14),
  },

  coverEmpty: {
    width: scale(70),
    height: scale(70),
    borderRadius: moderateScale(16),
    marginRight: scale(14),
    backgroundColor: "#555",
    justifyContent: "center",
    alignItems: "center",
  },

  title: {
    fontSize: moderateScale(17),
    fontWeight: "800",
    color: PALETTE.textDark,
  },

  date: {
    marginTop: verticalScale(4),
    fontSize: moderateScale(14),
    color: PALETTE.muted,
  },

  statusPill: {
    marginTop: verticalScale(6),
    alignSelf: "flex-start",
    paddingHorizontal: scale(12),
    paddingVertical: verticalScale(5),
    borderRadius: moderateScale(12),
  },

  statusText: {
    fontSize: moderateScale(12),
    color: "#fff",
    fontWeight: "700",
    textTransform: "capitalize",
  },
});
