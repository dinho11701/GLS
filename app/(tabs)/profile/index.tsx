import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";

const PALETTE = {
  bg: "#0A0F2C",
  card: "rgba(255,255,255,0.08)",
  gold: "#FFD700",
  white: "#FFFFFF",
  light: "#CCCCCC",
};

export default function ProfileHome() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState({
    prenom: "",
    nom: "",
    email: "",
    user: "",
  });

  /* -------------------------------------------------------
     FETCH USER DYNAMIQUE
  ------------------------------------------------------- */
  const fetchUser = async () => {
    try {
      const token =
        (await AsyncStorage.getItem("idToken")) ||
        (typeof window !== "undefined"
          ? localStorage.getItem("idToken")
          : null);

      if (!token) {
        Alert.alert("Erreur", "Session expirée.");
        return router.replace("/login");
      }

      const res = await fetch(
        `${process.env.EXPO_PUBLIC_API_BASE}/customers/profile`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const data = await res.json();

      if (!data.ok) {
        Alert.alert("Erreur", "Impossible de charger votre profil.");
        return;
      }

      setUser({
        prenom: data.user.prenom ?? "",
        nom: data.user.nom ?? "",
        email: data.user.email ?? "",
        user: data.user.user ?? "",
      });
    } catch {
      Alert.alert("Erreur", "Problème réseau.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUser();
  }, []);

  const logout = async () => {
    await AsyncStorage.removeItem("idToken");
    if (typeof window !== "undefined") localStorage.removeItem("idToken");
    router.replace("/login");
  };

  const Item = ({ icon, label, route }) => (
    <TouchableOpacity
      style={styles.item}
      onPress={() => router.push(`/profile/${route}`)}
    >
      <Ionicons name={icon} size={22} color={PALETTE.gold} />
      <Text style={styles.itemText}>{label}</Text>
      <Ionicons name="chevron-forward-outline" size={20} color={PALETTE.light} />
    </TouchableOpacity>
  );

  /* -------------------------------------------------------
     LOADING
  ------------------------------------------------------- */
  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: "center" }]}>
        <ActivityIndicator size="large" color={PALETTE.gold} />
      </View>
    );
  }

  /* -------------------------------------------------------
     UI
  ------------------------------------------------------- */
  return (
    <ScrollView style={styles.container}>
      <Text style={styles.header}>Mon Profil</Text>

      {/* AVATAR */}
      <View style={styles.avatarContainer}>
        <Image
          source={require("../../../assets/images/avatar.png")}
          style={styles.avatar}
        />
        <Text style={styles.name}>
          {user.prenom} {user.nom}
        </Text>
        <Text style={styles.email}>{user.email}</Text>
      </View>

      {/* MENU */}
      <View style={styles.menuContainer}>
        <Item icon="person-outline" label="Informations personnelles" route="info" />
        <Item icon="calendar-outline" label="Mes réservations" route="reservations" />
        <Item icon="card-outline" label="Historique des transactions" route="payments" />

        <TouchableOpacity style={[styles.item, { marginTop: 10 }]} onPress={logout}>
          <Ionicons name="log-out-outline" size={22} color="#FF5A5A" />
          <Text style={[styles.itemText, { color: "#FF5A5A" }]}>Déconnexion</Text>
          <Ionicons name="chevron-forward-outline" size={20} color="#FF5A5A" />
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

/* -------------------------------------------------------
   STYLES
------------------------------------------------------- */
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: PALETTE.bg,
    padding: 20,
  },

  header: {
    fontSize: 32,
    fontWeight: "900",
    color: PALETTE.gold,
    marginBottom: 20,
  },

  avatarContainer: {
    alignItems: "center",
    marginBottom: 35,
  },

  avatar: {
    width: 120,
    height: 120,
    borderRadius: Platform.OS === "web" ? "50%" : 60,
    marginBottom: 12,
  },

  name: {
    color: PALETTE.white,
    fontSize: 20,
    fontWeight: "700",
  },

  email: {
    color: PALETTE.light,
    fontSize: 14,
    marginTop: 4,
  },

  menuContainer: {
    marginTop: 10,
    gap: 14,
  },

  item: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: PALETTE.card,
    padding: 16,
    borderRadius: 12,
  },

  itemText: {
    flex: 1,
    color: PALETTE.white,
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 12,
  },
});
