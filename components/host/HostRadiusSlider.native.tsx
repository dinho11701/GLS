import React from "react";
import { View, Text, StyleSheet } from "react-native";
import Slider from "@react-native-community/slider";

type Props = {
  value: number;
  onChange: (val: number) => void;
};

const RADIUS_VALUES = [5, 10, 15, 25, 50];

export default function HostRadiusSlider({ value, onChange }: Props) {
  // Trouver l’index correspondant à la valeur actuelle
  const currentIndex = RADIUS_VALUES.indexOf(value);
  const safeIndex = currentIndex === -1 ? 0 : currentIndex;

  return (
    <View style={styles.container}>
      <Text style={styles.label}>
        Rayon d'activité : {RADIUS_VALUES[safeIndex]} km
      </Text>

      <Slider
        style={{ width: "100%", height: 40 }}
        minimumValue={0}
        maximumValue={RADIUS_VALUES.length - 1}
        step={1}
        value={safeIndex}
        onValueChange={(index) => onChange(RADIUS_VALUES[index])}
        minimumTrackTintColor="#FF6B6B"
        maximumTrackTintColor="#ccc"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 120,
    left: 20,
    right: 20,
    backgroundColor: "white",
    padding: 16,
    borderRadius: 16,
    elevation: 6,
  },
  label: {
    fontWeight: "700",
    marginBottom: 8,
  },
});