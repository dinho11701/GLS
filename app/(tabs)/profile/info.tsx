import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
  Platform,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const PALETTE = {
  bg: "#0A0F2C",
  card: "rgba(255,255,255,0.08)",
  gold: "#FFD700",
  white: "#FFFFFF",
  light: "#CCCCCC",
  divider: "rgba(255,255,255,0.15)",
};

export default function InfoProfileScreen() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState({
    prenom: "",
    nom: "",
    email: "",
  });

  /* -------------------------------------------------------
     FETCH USER PROFILE (DYNAMIQUE)
  ------------------------------------------------------- */
  const fetchUser = async () => {
    try {
      const token =
        (await AsyncStorage.getItem("idToken")) ||
        (typeof window !== "undefined"
          ? localStorage.getItem("idToken")
          : null);

      if (!token) return;

      const res = await fetch(
        `${process.env.EXPO_PUBLIC_API_BASE}/customers/profile`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      const data = await res.json();

      if (!res.ok || !data.ok) {
        Alert.alert("Erreur", "Impossible de charger le profil.");
        return;
      }

      setUser({
        prenom: data.user.prenom ?? "",
        nom: data.user.nom ?? "",
        email: data.user.email ?? "",
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

  /* -------------------------------------------------------
     LOADING UI
  ------------------------------------------------------- */
  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: "center" }]}>
        <ActivityIndicator color={PALETTE.gold} size="large" />
      </View>
    );
  }

  /* -------------------------------------------------------
     UI
  ------------------------------------------------------- */
  return (
    <ScrollView style={styles.container}>
      {/* HEADER */}
      <View style={styles.headerBlock}>
        <Image
          source={require("../../../assets/images/avatar.png")}
          style={styles.avatar}
        />
        <Text style={styles.name}>{user.prenom} {user.nom}</Text>
        <Text style={styles.emailText}>{user.email}</Text>
      </View>

      {/* CARD */}
      <View style={styles.card}>
        <Text style={styles.title}>Informations personnelles</Text>

        <View style={styles.row}>
          <Text style={styles.label}>Prénom</Text>
          <Text style={styles.value}>{user.prenom}</Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.row}>
          <Text style={styles.label}>Nom</Text>
          <Text style={styles.value}>{user.nom}</Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.row}>
          <Text style={styles.label}>Email</Text>
          <Text style={styles.value}>{user.email}</Text>
        </View>
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

  headerBlock: {
    alignItems: "center",
    marginBottom: 25,
  },

  avatar: {
    width: 110,
    height: 110,
    borderRadius: Platform.OS === "web" ? "50%" : 80,
    marginBottom: 12,
  },

  name: {
    color: PALETTE.white,
    fontSize: 22,
    fontWeight: "800",
  },

  emailText: {
    color: PALETTE.light,
    fontSize: 14,
    marginTop: 4,
  },

  card: {
    backgroundColor: PALETTE.card,
    padding: 20,
    borderRadius: 18,
  },

  title: {
    color: PALETTE.gold,
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 20,
  },

  row: {
    marginBottom: 14,
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
    marginVertical: 12,
  },
});
