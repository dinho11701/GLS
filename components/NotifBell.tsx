import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, Platform } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

export default function NotifBell({ count = 0, onPress }) {
  return (
    <TouchableOpacity
      style={[styles.container, Platform.OS === "web" && { cursor: "pointer" }]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Notifications"
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
    >
      <Ionicons name="notifications-outline" size={26} color="#fff" />

      {/* 🔴 Badge */}
      {count > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{count > 9 ? "9+" : count}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 6,
    marginRight: 4,
    justifyContent: "center",
    alignItems: "center",
  },

  badge: {
    position: "absolute",
    top: 2,
    right: 2,
    backgroundColor: "#FF3B30",
    borderRadius: 20,
    minWidth: 18,
    height: 18,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 3,
  },

  badgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
  },
});
