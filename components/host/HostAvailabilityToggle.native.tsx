import React from "react";
import { View, Text, Switch, StyleSheet } from "react-native";

type Props = {
  isActive: boolean;
  onToggle: () => void;
};

export default function HostAvailabilityToggle({
  isActive,
  onToggle,
}: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>
        {isActive ? "Disponible" : "Indisponible"}
      </Text>

      <Switch
        value={isActive}
        onValueChange={onToggle}
        trackColor={{ false: "#ccc", true: "#FF6B6B" }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 40,
    left: 20,
    right: 20,
    backgroundColor: "white",
    padding: 16,
    borderRadius: 16,
    elevation: 6,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  label: {
    fontWeight: "700",
  },
});