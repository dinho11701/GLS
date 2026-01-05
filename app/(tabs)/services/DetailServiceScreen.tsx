import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  Image,
  Dimensions,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";

import TimeSelectorModal from "@/components/TimeSelectorModal";

const { width } = Dimensions.get("window");

const PALETTE = {
  primary: "#0A0F2C",
  white: "#FFFFFF",
  cream: "#F9FAFB",
  textDark: "#0B1220",
  peach: "#EF8A73",
  placeholder: "rgba(0,0,0,0.45)",
  error: "#FF6B6B",
};

/* -------------------------------------------------------------
   DETAIL SERVICE SCREEN
------------------------------------------------------------- */
export default function DetailServiceScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id, date } = useLocalSearchParams();

  const [loading, setLoading] = useState(true);
  const [svc, setSvc] = useState<any>(null);

  const [startTime, setStartTime] = useState<string | null>(null);
  const [endTime, setEndTime] = useState<string | null>(null);

  const [openStart, setOpenStart] = useState(false);
  const [openEnd, setOpenEnd] = useState(false);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  /* -------------------------------------------------------------
     FETCH SERVICE
  ------------------------------------------------------------- */
  const fetchDetail = useCallback(async () => {
    if (!id) return;

    const token = await AsyncStorage.getItem("idToken");
    if (!token) return;

    setLoading(true);

    try {
      const resp = await fetch(
        `${process.env.EXPO_PUBLIC_API_BASE}/customers/services/${id}`,
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const raw = await resp.text();
      const data = JSON.parse(raw || "{}");

      if (!resp.ok) throw new Error(data.message);

      setSvc({ id, ...data });
    } catch (e: any) {
      console.error("error:", e.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  /* -------------------------------------------------------------
     HOURS
  ------------------------------------------------------------- */
  const generateHours = (start: string, end: string) => {
    const out: string[] = [];
    const [sh, sm] = start.split(":").map(Number);
    const [eh, em] = end.split(":").map(Number);

    let cur = sh * 60 + sm;
    const endMin = eh * 60 + em;

    while (cur <= endMin) {
      const h = Math.floor(cur / 60);
      const m = cur % 60;
      out.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
      cur += 30;
    }
    return out;
  };

  const hours = useMemo(() => {
    if (!svc?.Availability) return [];
    return generateHours(svc.Availability.startTime, svc.Availability.endTime);
  }, [svc]);

  const valid =
    startTime &&
    endTime &&
    hours.indexOf(endTime) > hours.indexOf(startTime);

  const basePrice = svc?.Fee ?? 0;

  /* -------------------------------------------------------------
     CHECK AVAILABILITY (UX Pro + loading)
  ------------------------------------------------------------- */
  const checkBeforePayment = useCallback(async () => {
    setErrorMsg(null);
    setChecking(true);

    try {
      const token = await AsyncStorage.getItem("idToken");
      if (!token) return null;

      const url = `${process.env.EXPO_PUBLIC_API_BASE}/customers/services/check-availability?serviceId=${id}&date=${date}&startTime=${startTime}&endTime=${endTime}`;

      const resp = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await resp.json();

      if (!data.ok) {
        setErrorMsg(data.reason || "Ce créneau n’est pas disponible.");
        return null;
      }

      return data;
    } catch (e) {
      setErrorMsg("Erreur lors de la vérification. Réessaye.");
      return null;
    } finally {
      setChecking(false);
    }
  }, [id, date, startTime, endTime]);

  /* -------------------------------------------------------------
     LOADING VIEW
  ------------------------------------------------------------- */
  if (loading || !svc) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: PALETTE.primary }}>
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }

  /* -------------------------------------------------------------
     RENDER
  ------------------------------------------------------------- */
  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" />

      {/* START MODAL */}
      <TimeSelectorModal
        visible={openStart}
        onClose={() => setOpenStart(false)}
        startTime={svc.Availability.startTime}
        endTime={svc.Availability.endTime}
        mode="start"
        onConfirm={(start) => {
          setStartTime(start);
          setEndTime(null);
        }}
      />

      {/* END MODAL */}
      <TimeSelectorModal
        visible={openEnd}
        onClose={() => setOpenEnd(false)}
        startTime={startTime || svc.Availability.startTime}
        endTime={svc.Availability.endTime}
        mode="end"
        onConfirm={(end) => setEndTime(end)}
      />

      <ScrollView contentContainerStyle={{ paddingBottom: 220 }}>
        {/* HEADER IMAGE */}
        <View style={styles.hero}>
          {svc.coverUrl ? (
            <Image source={{ uri: svc.coverUrl }} style={styles.heroImg} />
          ) : (
            <View style={styles.heroPlaceholder} />
          )}
          <View style={styles.heroOverlay} />
          <Text style={styles.heroTitle}>{svc.Service}</Text>
        </View>

        {/* INFO CARD */}
        <View style={styles.infoCard}>
          <Text style={styles.serviceTitle}>{svc.Service}</Text>
          <Text style={styles.category}>{svc.Activity_Secteur}</Text>
          <Text style={styles.price}>{basePrice} $</Text>
        </View>

        {/* DESCRIPTION */}
        <View style={styles.card}>
          <Text style={styles.section}>Description</Text>
          <Text style={styles.desc}>{svc.Description}</Text>
        </View>

        {/* HORAIRE */}
        <View style={styles.card}>
          <Text style={styles.section}>Choisir l’horaire</Text>

          {/* START */}
          <TouchableOpacity style={styles.timeBtn} onPress={() => setOpenStart(true)}>
            <Text style={styles.timeLabel}>Heure de début</Text>
            <Text style={styles.timeValue}>{startTime || "Sélectionner"}</Text>
          </TouchableOpacity>

          {/* END */}
          <TouchableOpacity
            style={[styles.timeBtn, { opacity: startTime ? 1 : 0.35 }]}
            disabled={!startTime}
            onPress={() => setOpenEnd(true)}
          >
            <Text style={styles.timeLabel}>Heure de fin</Text>
            <Text style={styles.timeValue}>{endTime || "Sélectionner"}</Text>
          </TouchableOpacity>

          {endTime && !valid && (
            <Text style={{ color: PALETTE.error, marginTop: 6 }}>
              L’heure de fin doit être après l’heure de début.
            </Text>
          )}

          {/* ERROR MESSAGE BLOCK UX PRO */}
          {errorMsg && (
            <View style={styles.errorBox}>
              <Ionicons name="warning-outline" size={20} color={PALETTE.error} />
              <Text style={styles.errorText}>{errorMsg}</Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* CTA */}
      <View style={[styles.ctaBar, { paddingBottom: insets.bottom + 12 }]}>
        <TouchableOpacity
          disabled={!valid || checking}
          style={[styles.ctaBtn, (!valid || checking) && { opacity: 0.4 }]}
          onPress={async () => {
            const ok = await checkBeforePayment();
            if (!ok) return;

            router.push({
              pathname: "/payment",
              params: {
                serviceId: id,
                date,
                startTime,
                endTime,
                title: svc.Service,
                price: String(basePrice),
              },
            });
          }}
        >
          {checking ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="calendar-outline" size={18} color="#fff" />
              <Text style={styles.ctaBtnText}>Réserver</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

/* -------------------------------------------------------------
   STYLES
------------------------------------------------------------- */
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: PALETTE.primary },

  /* HERO */
  hero: {
    height: width * 0.8,
    backgroundColor: "#111",
    borderBottomLeftRadius: 26,
    borderBottomRightRadius: 26,
    overflow: "hidden",
  },
  heroImg: { width: "100%", height: "100%" },
  heroPlaceholder: { flex: 1, backgroundColor: "#222" },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  heroTitle: {
    position: "absolute",
    bottom: 20,
    left: 20,
    color: "#fff",
    fontSize: 28,
    fontWeight: "900",
  },

  /* INFO CARD */
  infoCard: {
    backgroundColor: PALETTE.white,
    marginTop: -40,
    marginHorizontal: 16,
    padding: 18,
    borderRadius: 18,
  },
  serviceTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: PALETTE.textDark,
  },
  category: {
    marginTop: 4,
    color: PALETTE.placeholder,
  },
  price: {
    marginTop: 10,
    fontSize: 20,
    fontWeight: "900",
  },

  /* CARD */
  card: {
    backgroundColor: PALETTE.white,
    marginHorizontal: 16,
    marginTop: 16,
    padding: 18,
    borderRadius: 18,
  },
  section: {
    fontSize: 18,
    fontWeight: "900",
    marginBottom: 10,
  },
  desc: { color: "#333", lineHeight: 22 },

  /* TIME SELECT */
  timeBtn: {
    backgroundColor: PALETTE.cream,
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
  },
  timeLabel: { fontSize: 13, color: "#666" },
  timeValue: { fontSize: 17, fontWeight: "800", color: PALETTE.textDark },

  /* ERROR BOX */
  errorBox: {
    marginTop: 10,
    padding: 12,
    borderRadius: 10,
    backgroundColor: "rgba(255,107,107,0.12)",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  errorText: {
    color: PALETTE.error,
    fontSize: 14,
    fontWeight: "600",
  },

  /* CTA */
  ctaBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: PALETTE.white,
    padding: 16,
    paddingTop: 12,
  },
  ctaBtn: {
    backgroundColor: PALETTE.peach,
    height: 54,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  ctaBtnText: { color: "#fff", fontWeight: "900", fontSize: 17 },
});
