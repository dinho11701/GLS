import React from "react";
import { View, TextInput, StyleSheet } from "react-native";

export default function FiltersPanel({ filters, setFilters }) {
  return (
    <View style={styles.container}>
      <TextInput
        placeholder="Service (plomberie...)"
        style={styles.input}
        value={filters.service}
        onChangeText={(text) =>
          setFilters((f) => ({ ...f, service: text }))
        }
      />

      <TextInput
        placeholder="Distance max (km)"
        style={styles.input}
        keyboardType="numeric"
        value={String(filters.maxDistance)}
        onChangeText={(text) =>
          setFilters((f) => ({ ...f, maxDistance: Number(text) }))
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  
  container: {
    padding: 12,
    backgroundColor: "#fff",
    borderRadius: 12,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },

  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 8,
    marginBottom: 8,
  },
});