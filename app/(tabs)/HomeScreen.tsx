// app/(tabs)/HomeScreen.tsx
import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Animated,
  Dimensions,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";

import { useNotifications } from "../../hooks/useNotifications";
import NotifBell from "../../components/NotifBell";

import BookingDateFilter from "../../components/BookingDateFilter";
import ServiceCard from "../../components/ServiceCard";
import ListCategory from "../../components/ListCategory";
import ReviewPendingModal from "../../components/ReviewPendingModal";

/* ---------------------------------------------------------
   CONSTANTS
--------------------------------------------------------- */
const PALETTE = {
  primary: "#0A0F2C",
  white: "#FFFFFF",
  textDark: "#0B1220",
  gold: "#FFD700",
};

type Service = {
  id: string;
  Service?: string;
  Activity_Secteur?: string;
  Fee?: number;
  Availability?: { instances?: number; days?: number[] };
};

/* ---------------------------------------------------------
   API BASE
--------------------------------------------------------- */
const RAW_API_BASE =
  process.env.EXPO_PUBLIC_API_BASE ?? "http://127.0.0.1:5055/api/v1";
const API_BASE = RAW_API_BASE.replace(/\/+$/, "");

/* ---------------------------------------------------------
   HELPERS
--------------------------------------------------------- */
const normalizeKey = (s: string) =>
  (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const isServiceAvailableOnDate = (service: Service, selectedDate: Date | null) => {
  if (!selectedDate) return true;

  const days = service.Availability?.days;
  if (!Array.isArray(days) || !days.length) return true;

  const jsDay = selectedDate.getDay();
  const fbDay = jsDay === 0 ? 7 : jsDay;

  return days.includes(fbDay);
};

/* ============================================================
   HOME SCREEN
============================================================ */
export default function HomeScreen() {
  const router = useRouter();

  /* ⭐ Notifications */
  const { counters, refresh } = useNotifications();

  const width = Dimensions.get("window").width;
  const numColumns = width > 900 ? 3 : width > 600 ? 2 : 2;
  const cardWidth = width / numColumns - 28;

  const [loading, setLoading] = useState(false);
  const [sectors, setSectors] = useState<string[]>([]);
  const [popular, setPopular] = useState<Service[]>([]);
  const [allServices, setAllServices] = useState<Service[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const [pendingReview, setPendingReview] = useState(null);
  const [showReviewModal, setShowReviewModal] = useState(false);

  /* Banner Animation */
  const [bannerMessage, setBannerMessage] = useState<string | null>(null);
  const bannerAnim = useRef(new Animated.Value(0)).current;

  /* ---------------------------------------------------------
     FETCH SERVICES
  --------------------------------------------------------- */
  const getIdToken = async () => await AsyncStorage.getItem("idToken");

  const fetchData = useCallback(async () => {
    setLoading(true);

    const apiDate =
      selectedDate?.toISOString().substring(0, 10) ??
      new Date().toISOString().substring(0, 10);

    try {
      const idToken = await getIdToken();
      if (!idToken) return;

      const qParams = new URLSearchParams({
        limit: "50",
        sort: "createdAt",
        dir: "desc",
        date: apiDate,
        _ts: Date.now().toString(),
      });

      const resp = await fetch(
        `${API_BASE}/customers/services?${qParams.toString()}`,
        { headers: { Authorization: `Bearer ${idToken}` } }
      );

      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.message);

      const newList: Service[] = Array.isArray(data.items)
        ? data.items.map((s: any) => ({ id: s.id, ...s }))
        : [];

      setAllServices(newList);
    } catch (err) {
      setAllServices([]);
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    fetchData();
    //refresh(); // ⭐ Refresh notifications 
  }, [selectedDate]);

  useFocusEffect(
    useCallback(() => {
      fetchData();
      checkPendingReviews();
      refresh(); // ⭐ Refresh counters each time tab reopens
    }, [])
  );

  /* ---------------------------------------------------------
     FETCH PENDING REVIEW
  --------------------------------------------------------- */
  const checkPendingReviews = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem("idToken");
      if (!token) return;

      const resp = await fetch(`${API_BASE}/customers/reviews/pending`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await resp.json();
      if (resp.ok && data.ok && data.item) {
        setPendingReview(data.item);
        setShowReviewModal(true);
      }
    } catch (err) {
      console.log("ERR pending review:", err);
    }
  }, []);

  /* ---------------------------------------------------------
     FILTER SERVICES
  --------------------------------------------------------- */
  useEffect(() => {
    if (!allServices.length) return;

    const filtered = allServices.filter((svc) =>
      isServiceAvailableOnDate(svc, selectedDate)
    );

    setPopular(filtered.slice(0, 12));

    const map = new Map();
    filtered.forEach((s) => {
      const label = s.Activity_Secteur?.trim();
      if (label) map.set(normalizeKey(label), label);
    });

    setSectors([...map.values()]);
  }, [allServices, selectedDate]);

  /* ---------------------------------------------------------
     HEADER
  --------------------------------------------------------- */
  const renderHeader = () => (
    <View style={styles.headerContainer}>
      {/* ---- Brand + Notifications Bell ---- */}
      <View style={styles.headerRow}>
        <Text style={styles.brandTop}>LaSolution App</Text>

        <NotifBell
          count={counters.total}
          onPress={() => router.push("/notifications")}
        />
      </View>

      <Text style={styles.heroSub}>
        Trouvez des services professionnels près de chez vous.
      </Text>

      <BookingDateFilter selectedDate={selectedDate} onChangeDate={setSelectedDate} />

      {bannerMessage && (
        <Animated.View
          style={[
            styles.banner,
            {
              opacity: bannerAnim,
              transform: [
                {
                  translateY: bannerAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-15, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <Ionicons name="notifications-outline" size={20} color="#000" />
          <Text style={styles.bannerText}>{bannerMessage}</Text>
        </Animated.View>
      )}

      <ListCategory
        categories={sectors}
        onPressCategory={(cat) =>
          router.push({
            pathname: "services/ServiceSector",
            params: { secteur: cat },
          })
        }
      />

      <Text style={styles.sectionTitle}>Services populaires</Text>
    </View>
  );

  /* ---------------------------------------------------------
     RENDER SERVICE
  --------------------------------------------------------- */
  const renderService = ({ item }: { item: Service }) => (
    <ServiceCard
      item={item}
      pulse={false}
      cardWidth={cardWidth}
      onPress={() =>
        router.push({
          pathname: "services/DetailServiceScreen",
          params: {
            id: item.id,
            date:
              selectedDate?.toISOString()?.substring(0, 10) ??
              new Date().toISOString().substring(0, 10),
          },
        })
      }
    />
  );

  /* ---------------------------------------------------------
     FINAL RENDER
  --------------------------------------------------------- */
  if (loading && !popular.length) {
    return (
      <View style={[styles.container, { justifyContent: "center" }]}>
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {showReviewModal && pendingReview && (
        <ReviewPendingModal
          item={pendingReview}
          onClose={() => setShowReviewModal(false)}
        />
      )}

      <FlatList
        data={popular}
        keyExtractor={(item) => item.id}
        renderItem={renderService}
        numColumns={numColumns}
        columnWrapperStyle={{ gap: 14, paddingHorizontal: 16 }}
        ListHeaderComponent={renderHeader}
        contentContainerStyle={{ paddingBottom: 50, gap: 16 }}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

/* ======================================================
   STYLES
====================================================== */
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: PALETTE.primary,
  },

  headerContainer: {
    paddingHorizontal: 16,
    paddingTop: 28,
    paddingBottom: 20,
  },

  /* Row brand + notif */
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  brandTop: {
    color: PALETTE.gold,
    fontSize: 34,
    fontWeight: "900",
  },

  heroSub: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 15,
    marginTop: 6,
    marginBottom: 20,
  },

  banner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFE68A",
    padding: 12,
    borderRadius: 12,
    marginTop: 10,
    marginBottom: 10,
    elevation: 3,
  },

  bannerText: {
    flex: 1,
    color: "#000",
    fontWeight: "700",
  },

  sectionTitle: {
    marginTop: 18,
    color: "#fff",
    fontSize: 22,
    fontWeight: "900",
  },
});
