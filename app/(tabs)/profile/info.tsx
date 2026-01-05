import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Alert,
  Image,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";

const PALETTE = {
  bg: "#0A0F2C",
  card: "#132042",
  gold: "#FFD700",
  white: "#FFFFFF",
  light: "#CCCCCC",
  divider: "rgba(255,255,255,0.15)",
};

export default function InfoProfileScreen() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState({
    nom: "",
    prenom: "",
    email: "",
    user: "",
  });

  /* -------------------------------------------------------
     FETCH USER FROM BACKEND
  ------------------------------------------------------- */
  const fetchUser = async () => {
    try {
      const token = await AsyncStorage.getItem("idToken");
      if (!token) return;

      const res = await fetch(
        `${process.env.EXPO_PUBLIC_API_BASE}/customers/profile`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const data = await res.json();
      if (!data.ok) {
        Alert.alert("Erreur", "Impossible de charger le profil.");
        return;
      }

      setUser({
        nom: data.user.nom || "",
        prenom: data.user.prenom || "",
        email: data.user.email || "",
        user: data.user.user || "",
      });
    } catch (err) {
      console.log("ERR fetch profile:", err);
      Alert.alert("Erreur", "Problème réseau.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUser();
  }, []);

  /* -------------------------------------------------------
     REUSABLE ROW COMPONENT
  ------------------------------------------------------- */
  const Row = ({ label, value }) => (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value || "-"}</Text>
    </View>
  );

  /* -------------------------------------------------------
     LOADING VIEW
  ------------------------------------------------------- */
  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: "center" }]}>
        <ActivityIndicator size="large" color={PALETTE.gold} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* ---- HEADER ---- */}
      <View style={styles.headerBlock}>
        <Image
          source={require("../../../assets/images/avatar.png")}
          style={styles.avatar}
        />
        <Text style={styles.name}>{user.prenom} {user.nom}</Text>
        <Text style={styles.emailText}>{user.email}</Text>
      </View>

      {/* ---- CARD INFO ---- */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Informations personnelles</Text>

        <Row label="Prénom" value={user.prenom} />
        <View style={styles.divider} />

        <Row label="Nom" value={user.nom} />
        <View style={styles.divider} />

        <Row label="Email" value={user.email} />
        <View style={styles.divider} />

        <Row label="Nom d'utilisateur" value={user.user} />
      </View>

      {/* ---- BOUTON MODIFIER ---- */}
      <TouchableOpacity
        style={styles.editBtn}
        onPress={() => router.push("/profile/edit")}
      >
        <Ionicons name="create-outline" size={20} color="#000" />
        <Text style={styles.editText}>Modifier</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

/* ---------------------------- STYLES ---------------------------- */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: PALETTE.bg,
    padding: 20,
  },

  /* HEADER */
  headerBlock: {
    alignItems: "center",
    marginBottom: 25,
  },

  avatar: {
    width: 110,
    height: 110,
    borderRadius: 80,
    marginBottom: 12,
  },

  name: {
    color: PALETTE.white,
    fontSize: 22,
    fontWeight: "800",
  },

  emailText: {
    color: PALETTE.light,
    marginTop: 4,
    fontSize: 14,
  },

  /* CARD */
  card: {
    backgroundColor: PALETTE.card,
    padding: 20,
    borderRadius: 18,
    marginBottom: 30,
  },

  sectionTitle: {
    color: PALETTE.gold,
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 18,
  },

  row: {
    marginBottom: 16,
  },

  label: {
    color: PALETTE.light,
    fontSize: 13,
  },

  value: {
    color: PALETTE.white,
    fontSize: 17,
    fontWeight: "600",
    marginTop: 3,
  },

  divider: {
    height: 1,
    backgroundColor: PALETTE.divider,
    marginBottom: 16,
  },

  /* EDIT BUTTON */
  editBtn: {
    backgroundColor: PALETTE.gold,
    padding: 15,
    borderRadius: 12,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },

  editText: {
    marginLeft: 8,
    fontSize: 18,
    fontWeight: "700",
  },
});
