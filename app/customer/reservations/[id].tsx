import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Image,
  ScrollView,
  TouchableOpacity,
  Animated,
  Modal,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Ionicons from "@expo/vector-icons/Ionicons";
import { DateTime } from "luxon";

const PALETTE = {
  primary: "#0A0F2C",
  white: "#FFFFFF",
  card: "#F9FAFB",
  textDark: "#0B1220",
  muted: "rgba(11,18,32,0.55)",
  peach: "#EF8A73",
  red: "#E53935",
};

export default function ReservationDetails() {
  const { id } = useLocalSearchParams();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [reservation, setReservation] = useState<any>(null);
  const [modalVisible, setModalVisible] = useState(false);

  const opacity = React.useRef(new Animated.Value(0)).current;
  const headerAnim = React.useRef(new Animated.Value(-60)).current;

  // -------------------------------------------------------------------
  const formatTime = (ts: any) => {
    if (!ts || !ts._seconds) return "—";
    return DateTime.fromSeconds(ts._seconds).toFormat("HH:mm");
  };

  const formatTimeRange = (start: any, end: any) =>
    `${formatTime(start)} → ${formatTime(end)}`;

  const formatPrice = (p: number, c: string) => (p ? `${p} ${c}` : "—");

  // -------------------------------------------------------------------
  const cancelReservation = async () => {
    const token = await AsyncStorage.getItem("idToken");

    try {
      const resp = await fetch(
        `${process.env.EXPO_PUBLIC_API_BASE}/customers/reservations/${id}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (resp.ok) {
        alert("Réservation annulée ✔️");
        setModalVisible(false);
        router.back();
      } else {
        alert("Impossible d'annuler ❌");
      }
    } catch (e) {
      alert("Erreur de connexion.");
    }
  };

  // -------------------------------------------------------------------
  const fetchDetail = useCallback(async () => {
    setLoading(true);

    const token = await AsyncStorage.getItem("idToken");

    try {
      const resp = await fetch(
        `${process.env.EXPO_PUBLIC_API_BASE}/customers/reservations/${id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const json = await resp.json();
      setReservation(json);

      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(headerAnim, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }),
      ]).start();
    } catch (e) {
      console.log("DETAIL ERROR:", e);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  // -------------------------------------------------------------------
  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#fff" size="large" />
      </View>
    );
  }

  if (!reservation) {
    return (
      <View style={styles.center}>
        <Text style={{ color: "#fff" }}>⚠️ Impossible de charger</Text>
      </View>
    );
  }

  // -------------------------------------------------------------------
  const canLeaveReview =
    reservation.status === "completed" && !reservation.hasReview;

  return (
    <Animated.View style={[styles.container, { opacity }]}>
      <ScrollView>
        {/* HEADER IMAGE */}
        <Animated.View
          style={[
            styles.headerImgWrap,
            { transform: [{ translateY: headerAnim }] },
          ]}
        >
          {reservation.coverUrl ? (
            <Image source={{ uri: reservation.coverUrl }} style={styles.headerImg} />
          ) : (
            <View style={styles.headerPlaceholder}>
              <Ionicons name="image-outline" size={60} color="#fff" />
            </View>
          )}

          <View style={styles.headerOverlay} />

          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={28} color="#fff" />
          </TouchableOpacity>
        </Animated.View>

        {/* CARD */}
        <View style={styles.card}>
          <Text style={styles.title}>{reservation.serviceName}</Text>

          <View
            style={[
              styles.statusPill,
              {
                backgroundColor:
                  {
                    confirmed: "#4CAF50",
                    pending: "#FFC107",
                    cancelled: PALETTE.red,
                    completed: "#0288D1",
                  }[reservation.status] || PALETTE.peach,
              },
            ]}
          >
            <Text style={styles.statusText}>{reservation.status}</Text>
          </View>

          <Text style={styles.section}>Informations</Text>

          {/* DATE */}
          <View style={styles.row}>
            <Ionicons name="calendar-outline" size={22} color={PALETTE.muted} />
            <Text style={styles.rowText}>{reservation.date || "—"}</Text>
          </View>

          {/* TIMES */}
          <View style={styles.row}>
            <Ionicons name="time-outline" size={22} color={PALETTE.muted} />
            <Text style={styles.rowText}>
              {formatTimeRange(reservation.startAt, reservation.endAt)}
            </Text>
          </View>

          {/* PRICE */}
          <View style={styles.row}>
            <Ionicons name="cash-outline" size={22} color={PALETTE.muted} />
            <Text style={styles.rowText}>
              {formatPrice(reservation.price, reservation.currency)}
            </Text>
          </View>

          {/* HOST */}
          <View style={styles.row}>
            <Ionicons name="person-outline" size={22} color={PALETTE.muted} />
            <Text style={styles.rowText}>
              Hôte : {reservation.partnerUid.substring(0, 12)}…
            </Text>
          </View>

          {/* ⭐ AJOUT — BOUTON "LAISSER UN AVIS" */}
          {canLeaveReview && (
            <TouchableOpacity
              style={styles.reviewBtn}
              onPress={() =>
                router.push(
                  `/customer/reviews/leave?serviceId=${reservation.serviceId}&reservationId=${reservation.reservationId}`
                )
              }
            >
              <Ionicons name="star" size={18} color="#fff" />
              <Text style={styles.reviewBtnText}>Laisser un avis</Text>
            </TouchableOpacity>
          )}

          {/* CANCEL BUTTON */}
          <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(true)}>
            <Text style={styles.cancelText}>Annuler la réservation</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* CANCEL MODAL */}
      <Modal visible={modalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalText}>Voulez-vous vraiment annuler ?</Text>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => setModalVisible(false)}
              >
                <Text style={{ fontWeight: "600" }}>Non</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalConfirm}
                onPress={cancelReservation}
              >
                <Text style={{ color: "#fff", fontWeight: "700" }}>
                  Oui, annuler
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </Animated.View>
  );
}

/* ------------------------------------------------------------------
      STYLES
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
    backgroundColor: PALETTE.primary,
  },

  headerImgWrap: {
    height: 300,
    backgroundColor: "#333",
    overflow: "hidden",
  },
  headerImg: { width: "100%", height: "100%", position: "absolute" },
  headerPlaceholder: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#666",
  },
  headerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.25)",
  },
  backBtn: {
    position: "absolute",
    top: 50,
    left: 20,
    padding: 10,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.55)",
  },

  card: {
    backgroundColor: PALETTE.white,
    padding: 22,
    marginHorizontal: 16,
    marginTop: -40,
    borderRadius: 26,
  },

  title: { fontSize: 26, fontWeight: "900", color: PALETTE.textDark },

  statusPill: {
    alignSelf: "flex-start",
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusText: { color: "#fff", fontWeight: "700" },

  section: {
    fontSize: 20,
    fontWeight: "800",
    marginTop: 28,
    marginBottom: 16,
    color: PALETTE.textDark,
  },

  row: { flexDirection: "row", alignItems: "center", marginBottom: 14, gap: 12 },
  rowText: { fontSize: 16, color: PALETTE.textDark, fontWeight: "500" },

  /** ⭐ NEW BUTTON: Leave a Review */
  reviewBtn: {
    marginTop: 22,
    backgroundColor: "#FFB300",
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 10,
  },
  reviewBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "800",
  },

  cancelBtn: {
    marginTop: 28,
    backgroundColor: PALETTE.red,
    paddingVertical: 14,
    borderRadius: 18,
    alignItems: "center",
  },
  cancelText: { color: "#fff", fontSize: 16, fontWeight: "700" },

  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  modalCard: {
    backgroundColor: "#fff",
    width: "85%",
    padding: 22,
    borderRadius: 16,
  },
  modalText: { fontSize: 17, marginBottom: 20, textAlign: "center" },
  modalActions: { flexDirection: "row", justifyContent: "space-between" },
  modalCancel: {
    flex: 1,
    padding: 12,
    alignItems: "center",
    backgroundColor: "#eee",
    borderRadius: 10,
    marginRight: 8,
  },
  modalConfirm: {
    flex: 1,
    padding: 12,
    alignItems: "center",
    backgroundColor: PALETTE.red,
    borderRadius: 10,
    marginLeft: 8,
  },
});
