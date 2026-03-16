// components/HostFilters.native.tsx

import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Switch,
} from "react-native";

type Filters = {
  availableOnly: boolean;
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  maxDistanceKm?: number;
  category?: string;
};

type Props = {
  onApply: (filters: Filters) => void;
  onReset?: () => void;
};

export default function HostFilters({ onApply, onReset }: Props) {
  const [availableOnly, setAvailableOnly] = useState(true);
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [minRating, setMinRating] = useState("");
  const [maxDistanceKm, setMaxDistanceKm] = useState("");
  const [category, setCategory] = useState("");

  const handleApply = () => {
    onApply({
      availableOnly,
      minPrice: minPrice ? Number(minPrice) : undefined,
      maxPrice: maxPrice ? Number(maxPrice) : undefined,
      minRating: minRating ? Number(minRating) : undefined,
      maxDistanceKm: maxDistanceKm ? Number(maxDistanceKm) : undefined,
      category: category || undefined,
    });
  };

  const handleReset = () => {
    setAvailableOnly(true);
    setMinPrice("");
    setMaxPrice("");
    setMinRating("");
    setMaxDistanceKm("");
    setCategory("");
    onReset?.();
  };

  return (
    <ScrollView style={styles.container}>
      
      {/* Disponibilité */}
      <View style={styles.row}>
        <Text style={styles.label}>Disponible uniquement</Text>
        <Switch value={availableOnly} onValueChange={setAvailableOnly} />
      </View>

      {/* Prix */}
      <Text style={styles.sectionTitle}>Prix ($)</Text>
      <View style={styles.row}>
        <TextInput
          placeholder="Min"
          keyboardType="numeric"
          value={minPrice}
          onChangeText={setMinPrice}
          style={styles.input}
        />
        <TextInput
          placeholder="Max"
          keyboardType="numeric"
          value={maxPrice}
          onChangeText={setMaxPrice}
          style={styles.input}
        />
      </View>

      {/* Note */}
      <Text style={styles.sectionTitle}>Note minimale ⭐</Text>
      <TextInput
        placeholder="Ex: 4.5"
        keyboardType="numeric"
        value={minRating}
        onChangeText={setMinRating}
        style={styles.input}
      />

      {/* Distance */}
      <Text style={styles.sectionTitle}>Distance max (km)</Text>
      <TextInput
        placeholder="Ex: 10"
        keyboardType="numeric"
        value={maxDistanceKm}
        onChangeText={setMaxDistanceKm}
        style={styles.input}
      />

      {/* Catégorie */}
      <Text style={styles.sectionTitle}>Catégorie</Text>
      <TextInput
        placeholder="Plomberie, Électricité..."
        value={category}
        onChangeText={setCategory}
        style={styles.input}
      />

      {/* Boutons */}
      <View style={styles.buttonRow}>
        <TouchableOpacity style={styles.resetBtn} onPress={handleReset}>
          <Text style={styles.resetText}>Réinitialiser</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.applyBtn} onPress={handleApply}>
          <Text style={styles.applyText}>Appliquer</Text>
        </TouchableOpacity>
      </View>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "white",
    padding: 16,
  },

  sectionTitle: {
    fontWeight: "600",
    marginTop: 15,
    marginBottom: 6,
  },

  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  label: {
    fontSize: 14,
  },

  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
    flex: 1,
    marginRight: 8,
  },

  buttonRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 20,
  },

  applyBtn: {
    backgroundColor: "#FF6B6B",
    padding: 12,
    borderRadius: 8,
    flex: 1,
    alignItems: "center",
  },

  applyText: {
    color: "white",
    fontWeight: "bold",
  },

  resetBtn: {
    borderWidth: 1,
    borderColor: "#ccc",
    padding: 12,
    borderRadius: 8,
    flex: 1,
    alignItems: "center",
    marginRight: 10,
  },

  resetText: {
    fontWeight: "500",
  },
});