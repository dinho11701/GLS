import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  Platform,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Ionicons from "@expo/vector-icons/Ionicons";
import SwipeableRow from "../../../../components/SwipeableRow";
import { scale } from "../../../../utils/responsive";

const PALETTE = {
  primary: "#0A0F2C",
  white: "#FFFFFF",
  card: "#F9FAFB",
  textDark: "#0B1220",
  muted: "rgba(11,18,32,0.45)",
  shadow: "rgba(0,0,0,0.15)",
  danger: "#E53935",
};

export default function MyServicesScreen() {
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  /* ------------------------------------------------------------------
      FETCH SERVICES
  ------------------------------------------------------------------ */
  const fetchServices = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem("idToken");
      if (!token) return;

      const resp = await fetch(
        `${process.env.EXPO_PUBLIC_API_BASE}/partners/my-services`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const data = await resp.json();
      setItems(data?.items || []);
    } catch (err) {
      console.error("MY SERVICES ERR:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchServices();
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchServices();
    }, [fetchServices])
  );

  /* ------------------------------------------------------------------
      DELETE SERVICE
  ------------------------------------------------------------------ */
  const handleDelete = async (id: string) => {
    const token = await AsyncStorage.getItem("idToken");
    if (!token) return;

    await fetch(`${process.env.EXPO_PUBLIC_API_BASE}/partners/services/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });

    fetchServices();
  };

  /* ------------------------------------------------------------------
      CARD RENDER
  ------------------------------------------------------------------ */
  const renderItem = ({ item }: any) => {
    const cardUi = (
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => router.push(`partner/services/${item.id}`)}
        style={styles.card}
      >
        {/* IMAGE */}
        {item?.Pictures?.[0]?.uri ? (
          <Image source={{ uri: item.Pictures[0].uri }} style={styles.cover} />
        ) : (
          <View style={styles.coverPlaceholder}>
            <Ionicons name="image-outline" size={scale(26)} color="#fff" />
          </View>
        )}

        {/* TEXT */}
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{item.Service}</Text>
          <Text style={styles.category}>{item.Categorie}</Text>
          <Text style={styles.price}>{item.Fee} $</Text>
        </View>

        {/* DELETE ICON — WEB ONLY */}
        {Platform.OS === "web" && (
          <TouchableOpacity
            style={styles.deleteIcon}
            onPress={() => handleDelete(item.id)}
          >
            <Ionicons name="trash-outline" size={20} color="#fff" />
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );

    // MOBILE → swipe to delete
    if (Platform.OS !== "web") {
      return (
        <SwipeableRow onDelete={() => handleDelete(item.id)}>
          {cardUi}
        </SwipeableRow>
      );
    }

    return cardUi;
  };

  /* ------------------------------------------------------------------
      EMPTY
  ------------------------------------------------------------------ */
  if (loading) {
    return (
      <View style={styles.center}>
        <Ionicons name="hourglass-outline" size={48} color="#aaa" />
      </View>
    );
  }

  if (items.length === 0) {
    return (
      <View style={styles.center}>
        <Ionicons name="briefcase-outline" size={56} color="#777" />
        <Text style={styles.emptyText}>Aucun service créé pour le moment</Text>
      </View>
    );
  }

  /* ------------------------------------------------------------------
      UI
  ------------------------------------------------------------------ */
  return (
    <View style={styles.container}>
      <FlatList
        data={items}
        renderItem={renderItem}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ padding: scale(16) }}
        showsVerticalScrollIndicator={false}
      />
    </View>
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
  },

  emptyText: {
    marginTop: scale(14),
    color: "#bbb",
    fontSize: scale(16),
  },

  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: PALETTE.white,
    padding: scale(14),
    marginBottom: scale(14),
    borderRadius: scale(18),
    shadowColor: PALETTE.shadow,
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
    position: "relative",
    transitionDuration: "150ms",
  },

  cover: {
    width: scale(70),
    height: scale(70),
    borderRadius: scale(14),
    marginRight: scale(14),
  },

  coverPlaceholder: {
    width: scale(70),
    height: scale(70),
    borderRadius: scale(14),
    marginRight: scale(14),
    backgroundColor: "#555",
    justifyContent: "center",
    alignItems: "center",
  },

  title: {
    fontSize: scale(17),
    fontWeight: "800",
    color: PALETTE.textDark,
  },

  category: {
    marginTop: scale(2),
    fontSize: scale(13),
    color: PALETTE.muted,
  },

  price: {
    marginTop: scale(4),
    fontSize: scale(15),
    fontWeight: "700",
    color: "#0A7",
  },

  deleteIcon: {
    position: "absolute",
    right: scale(20),
    top: "40%",
    backgroundColor: PALETTE.danger,
    padding: scale(6),
    borderRadius: scale(12),
    opacity: 0,
    transitionDuration: "150ms",
  },
});

/* ------------------------------------------------------------------
      WEB HOVER BEHAVIOR
------------------------------------------------------------------ */
if (Platform.OS === "web") {
  // hover sur la carte
  (styles.card as any)[":hover"] = {
    cursor: "pointer",
    transform: "scale(1.02)",
    transition: "150ms",
  };

  // afficher la poubelle au hover
  (styles.deleteIcon as any)[":hover"] = {
    opacity: 1,
  };

  // la poubelle apparaît quand on hover la carte
  (styles.card as any)[":hover .deleteIcon"] = {
    opacity: 1,
  };
}
