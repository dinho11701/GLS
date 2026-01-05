import React from "react";
import { View, TouchableOpacity, Platform, StyleSheet } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

export default function StarRating({ rating, onChange, size = 32 }) {
  return (
    <View style={styles.container}>
      {[1, 2, 3, 4, 5].map((i) => {
        const filled = i <= rating;

        return (
          <TouchableOpacity
            key={i}
            onPress={() => onChange(i)}
            style={Platform.OS === "web" ? styles.webHitbox : {}}
          >
            <Ionicons
              name={filled ? "star" : "star-outline"}
              size={size}
              color={filled ? "#FFD700" : "#CCCCCC"}
              style={{ marginRight: 6 }}
            />
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
  },

  // Améliore la zone cliquable sur le Web
  webHitbox: {
    cursor: "pointer",
    padding: 4,
  },
});
