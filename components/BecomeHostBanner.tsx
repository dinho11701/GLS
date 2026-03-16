import React from "react";
import { View, Text, StyleSheet, Image, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";

export default function BecomeHostBanner() {
  const router = useRouter();

  return (
    <View style={styles.card}>
      <Image
        source={require("@/assets/images/host.png")}
        style={styles.image}
        resizeMode="contain"
      />

      <Text style={styles.title}>Devenez hôte</Text>
      <Text style={styles.text}>
        Proposez vos services, gérez vos horaires et générez un revenu.
      </Text>

      <TouchableOpacity
        style={styles.btn}
        onPress={() => router.push("/(tabs)/partner/CreateService")}
      >
        <Text style={styles.btnText}>Commencer</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "rgba(255,255,255,0.12)",
    padding: 20,
    borderRadius: 16,
    alignItems: "center",
    marginTop: 20,
  },
  image: {
    width: 160,
    height: 120,
    marginBottom: 10,
  },
  title: {
    fontSize: 20,
    fontWeight: "900",
    color: "#FFD700",
    marginBottom: 6,
  },
  text: {
    textAlign: "center",
    color: "white",
    opacity: 0.85,
    lineHeight: 20,
  },
  btn: {
    marginTop: 14,
    backgroundColor: "#FFD700",
    paddingVertical: 10,
    paddingHorizontal: 26,
    borderRadius: 10,
  },
  btnText: {
    fontWeight: "800",
    color: "#0A0F2C",
    fontSize: 16,
  },
});
