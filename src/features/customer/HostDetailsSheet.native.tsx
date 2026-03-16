import React from "react";
import { View, Text, StyleSheet } from "react-native";

export default function HostDetailsSheet({ host, onClose }) {
  return (
    <View style={styles.sheet}>
      <Text style={styles.title}>{host.name}</Text>
      <Text>⭐ {host.rating}</Text>
      <Text>Services: {host.services.join(", ")}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: "absolute",
    bottom: 0,
    width: "100%",
    backgroundColor: "#fff",
    padding: 20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
  },
});