import React from "react";
import { View, TouchableOpacity, Text, StyleSheet } from "react-native";

type Props = {
  onZoomIn: () => void;
  onZoomOut: () => void;
};

export default function MapZoomControlsNative({ onZoomIn, onZoomOut }: Props) {
  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.button} onPress={onZoomIn}>
        <Text style={styles.text}>+</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.button} onPress={onZoomOut}>
        <Text style={styles.text}>−</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
  position: "absolute",
  right: 16,
  top: 120,
  backgroundColor: "rgba(0,0,0,0.7)",
  borderRadius: 12,
  overflow: "hidden",

  elevation: 8, // Android
  shadowColor: "#000", // iOS
  shadowOpacity: 0.3,
  shadowRadius: 6,
  shadowOffset: { width: 0, height: 4 },
},
  button: {
    padding: 12,
    alignItems: "center",
  },
  text: {
    color: "white",
    fontSize: 22,
    fontWeight: "bold",
  },
});