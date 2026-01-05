import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Ionicons from "@expo/vector-icons/Ionicons";
import { scale } from "../../../utils/responsive";

const PALETTE = {
  primary: "#0A0F2C",
  white: "#FFFFFF",
  textDark: "#FFFFFF",
  muted: "rgba(255,255,255,0.55)",
};

export default function ServiceDetail() {
  const { id } = useLocalSearchParams();
  const [item, setItem] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchDetail = async () => {
    try {
      const token = await AsyncStorage.getItem("idToken");
      if (!token) return;

      const resp = await fetch(
        `${process.env.EXPO_PUBLIC_API_BASE}/partners/services/${id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const data = await resp.json();
      setItem(data?.item || null);
    } catch (err) {
      console.error("SERVICE DETAIL ERROR:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetail();
  }, []);

  if (loading) {
    return (
      <View style={styles.center}>
        <Ionicons name="hourglass-outline" size={46} color="#aaa" />
      </View>
    );
  }

  if (!item) {
    return (
      <View style={styles.center}>
        <Ionicons name="alert-circle-outline" size={50} color="#aaa" />
        <Text style={styles.emptyText}>Service introuvable</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: scale(18) }}>
      {/* IMAGE */}
      {item.Pictures?.[0]?.uri ? (
        <Image source={{ uri: item.Pictures[0].uri }} style={styles.cover} />
      ) : (
        <View style={styles.coverPlaceholder}>
          <Ionicons name="image-outline" size={scale(40)} color="#fff" />
        </View>
      )}

      {/* NAME / CATEGORY */}
      <Text style={styles.title}>{item.Service}</Text>
      <Text style={styles.category}>{item.Categorie}</Text>

      {/* PRICE */}
      <View style={styles.row}>
        <Ionicons name="pricetag-outline" size={20} color="#0A7" />
        <Text style={styles.price}>{item.Fee} $</Text>
      </View>

      {/* DESCRIPTION */}
      <Text style={styles.sectionTitle}>Description</Text>
      <Text style={styles.description}>{item.Description}</Text>

      {/* DISPONIBILITÉ */}
      <Text style={styles.sectionTitle}>Disponibilité</Text>

      <View style={styles.row}>
        <Ionicons name="calendar-outline" size={20} color={PALETTE.muted} />
        <Text style={styles.infoText}>
          {item.availabilityDays?.length > 0
            ? item.availabilityDays.join(", ")
            : "Non spécifié"}
        </Text>
      </View>

      <View style={styles.row}>
        <Ionicons name="time-outline" size={20} color={PALETTE.muted} />
        <Text style={styles.infoText}>
          {item.availabilityHours || "Non spécifié"}
        </Text>
      </View>

      {/* INSTANCES */}
      <Text style={styles.sectionTitle}>Instances créées</Text>

      <View style={styles.row}>
        <Ionicons name="stats-chart-outline" size={20} color={PALETTE.muted} />
        <Text style={styles.infoText}>
          {item.instancesCount} instance(s)
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: PALETTE.primary },

  center: { flex: 1, justifyContent: "center", alignItems: "center" },

  emptyText: { color: "#bbb", fontSize: scale(16), marginTop: 12 },

  cover: {
    width: "100%",
    height: scale(220),
    borderRadius: scale(18),
    marginBottom: scale(16),
  },

  coverPlaceholder: {
    width: "100%",
    height: scale(220),
    borderRadius: scale(18),
    backgroundColor: "#444",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: scale(16),
  },

  title: { fontSize: scale(22), fontWeight: "800", color: PALETTE.white },
  category: { fontSize: scale(15), color: PALETTE.muted, marginTop: 4 },

  row: { flexDirection: "row", alignItems: "center", marginTop: scale(12) },

  price: { marginLeft: scale(8), fontSize: scale(18), color: "#0A7", fontWeight: "700" },

  sectionTitle: {
    marginTop: scale(22),
    color: PALETTE.white,
    fontSize: scale(17),
    fontWeight: "700",
  },

  description: {
    color: PALETTE.muted,
    marginTop: scale(6),
    fontSize: scale(15),
    lineHeight: scale(20),
  },

  infoText: { color: PALETTE.white, fontSize: scale(15), marginLeft: scale(10) },
});
