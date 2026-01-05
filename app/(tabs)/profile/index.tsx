import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Image } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";

const PALETTE = {
  bg: "#0A0F2C",
  card: "#132042",
  gold: "#FFD700",
  white: "#FFFFFF",
  light: "#CCCCCC",
};

export default function ProfileScreen() {
  const router = useRouter();
  const [user, setUser] = useState({
    fname: "",
    lname: "",
    email: "",
    avatar: null,
  });

  // 🔥 Remplaceras ça par un fetch réel côté backend
  useEffect(() => {
    setUser({
      fname: "Oswald",
      lname: "Essongue",
      email: "oswald@example.com",
      avatar: null, // url si photo personnalisée
    });
  }, []);

  const logout = async () => {
    await AsyncStorage.removeItem("idToken");
    router.replace("/login");
  };

  const Item = ({ icon, label, onPress }) => (
    <TouchableOpacity style={styles.item} onPress={onPress}>
      <Ionicons name={icon} size={22} color={PALETTE.gold} style={{ marginRight: 12 }} />
      <Text style={styles.itemText}>{label}</Text>
      <Ionicons name="chevron-forward-outline" size={20} color={PALETTE.light} />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      
      {/* ---- HEADER ---- */}
      <Text style={styles.header}>Mon Profil</Text>

      {/* ---- AVATAR + NOM ---- */}
      <View style={styles.avatarContainer}>
        <Image
          source={
            user.avatar
              ? { uri: user.avatar }
              : require("../../../assets/images/avatar.png")
          }
          style={styles.avatar}
        />

        <Text style={styles.name}>{user.fname} {user.lname}</Text>
        <Text style={styles.email}>{user.email}</Text>
      </View>

      {/* ---- MENU ---- */}
      <View style={styles.menuContainer}>
        <Item
          icon="person-outline"
          label="Informations personnelles"
          onPress={() => router.push("/profile/info")}
        />

        <Item
          icon="calendar-outline"
          label="Mes réservations"
          onPress={() => router.push("/profile/reservations")}
        />

        <Item
          icon="card-outline"
          label="Historique des paiements"
          onPress={() => router.push("/profile/payments")}
        />

        <Item
          icon="log-out-outline"
          label="Déconnexion"
          onPress={logout}
        />
      </View>
    </View>
  );
}

/* ---------------------------- STYLES ---------------------------- */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: PALETTE.bg,
    paddingHorizontal: 20,
    paddingTop: 50,
  },

  header: {
    fontSize: 32,
    fontWeight: "900",
    color: PALETTE.gold,
    marginBottom: 30,
  },

  /* ---- AVATAR ---- */
  avatarContainer: {
    alignItems: "center",
    marginBottom: 40,
  },

  avatar: {
    width: 120,
    height: 120,
    borderRadius: 80,
    backgroundColor: "#1F2A48",
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

  /* ---- MENU ---- */
  menuContainer: {
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
  },
});
