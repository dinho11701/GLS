import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Pressable,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

export default function ReviewPendingModal({ item, onClose }) {
  const router = useRouter();

  if (!item) return null;

  return (
    <View
      style={styles.overlay}
      pointerEvents="auto"
      accessibilityViewIsModal
      aria-modal="true"
    >
      <SafeAreaView style={styles.center}>
        <View style={styles.card}>
          <Ionicons name="star-outline" size={36} color="#EF8A73" />

          <Text style={styles.title}>Votre avis est important ✨</Text>

          <Text style={styles.desc}>
            Comment s’est passée votre expérience avec{" "}
            <Text style={{ fontWeight: "bold" }}>{item.serviceName}</Text> ?
          </Text>

          <TouchableOpacity
            style={styles.btn}
            onPress={() => {
              onClose?.();
              router.push({
                pathname: "/leave-review",
                params: {
                  reservationId: item.reservationId,
                  serviceId: item.serviceId,
                  title: item.serviceName,
                },
              });
            }}
          >
            <Text style={styles.btnText}>Laisser un avis</Text>
          </TouchableOpacity>

          <Pressable onPress={onClose} style={styles.skip}>
            <Text style={styles.skipText}>Plus tard</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 9999,
  },

  center: {
    width: "100%",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },

  card: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: "#fff",
    padding: 24,
    borderRadius: 20,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 4,
  },

  title: {
    fontWeight: "900",
    fontSize: 20,
    textAlign: "center",
    marginTop: 10,
    color: "#0A0F2C",
  },

  desc: {
    textAlign: "center",
    marginTop: 8,
    color: "#444",
    fontSize: 15,
  },

  btn: {
    marginTop: 22,
    backgroundColor: "#EF8A73",
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: 16,
  },

  btnText: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 16,
  },

  skip: {
    marginTop: 12,
  },

  skipText: {
    color: "#777",
    fontSize: 14,
  },
});
