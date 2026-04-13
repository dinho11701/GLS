import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
} from "react-native";
import { Host } from "./types";

type Props = {
  host: Host;
  onViewProfile: () => void;
  onBook: () => void;
  onClose: () => void;
};

export default function HostPreviewCard({
  host,
  onViewProfile,
  onBook,
  onClose,
}: Props) {
  return (
    <View style={styles.container}>
  <View style={styles.card}>

    {/* HANDLE (Uber style) */}
    <View style={styles.handle} />

    {/* HEADER */}
    <View style={styles.header}>
      <View>
        <Text style={styles.name}>{host.name}</Text>

        <Text style={styles.subtitle}>
          ⭐ {host.rating ? host.rating.toFixed(1) : "0.0"} •{" "}
          {host.services?.[0] || "Service"}
        </Text>
      </View>

      <TouchableOpacity onPress={onClose}>
        <Text style={styles.close}>✕</Text>
      </TouchableOpacity>
    </View>

    {/* ACTIONS */}
    <View style={styles.actions}>
      <TouchableOpacity style={styles.secondaryBtn} onPress={onViewProfile}>
        <Text style={styles.secondaryText}>Voir profil</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.primaryBtn} onPress={onBook}>
        <Text style={styles.primaryText}>Réserver</Text>
      </TouchableOpacity>
    </View>

  </View>

    </View>
  );
}


const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 20,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 999,
  },

  card: {
    width: "88%",            // 🔥 plus compact
    maxWidth: 420,

    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 16,

    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 25,
    elevation: 12,
  },

  /* 🔥 Uber handle */
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#ddd",
    alignSelf: "center",
    marginBottom: 10,
  },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  name: {
    fontSize: 18,
    fontWeight: "700",
  },

  subtitle: {
    fontSize: 13,
    color: "#666",
    marginTop: 2,
  },

  close: {
    fontSize: 18,
    color: "#999",
  },

  actions: {
    flexDirection: "row",
    marginTop: 14,
    gap: 10,
  },

  primaryBtn: {
    flex: 1,
    backgroundColor: "#000",
    paddingVertical: 14,
    borderRadius: 16, // 🔥 plus arrondi
    alignItems: "center",
  },

  primaryText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 15,
  },

  secondaryBtn: {
    flex: 1,
    backgroundColor: "#f2f2f2",
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: "center",
  },

  secondaryText: {
    color: "#000",
    fontWeight: "600",
    fontSize: 15,
  },
});