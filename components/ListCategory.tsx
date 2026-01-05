import React from "react";
import { View, Text, FlatList, StyleSheet, TouchableOpacity } from "react-native";

const PALETTE = {
  tagBg: "#18233D",
  tagText: "#FFFFFF",
  border: "rgba(255,255,255,0.18)",
};

type Props = {
  categories: string[];
  onPressCategory: (cat: string) => void;
};

export default function ListCategory({ categories, onPressCategory }: Props) {
  if (!categories || categories.length === 0) return null;

  return (
    <View style={{ marginTop: 20 }}>
      <Text style={styles.title}>Catégories</Text>

      <FlatList
        data={categories}
        keyExtractor={(item) => item}
        horizontal
        showsHorizontalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={{ width: 12 }} />}
        contentContainerStyle={{ paddingVertical: 4 }}
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => onPressCategory(item)} style={styles.badge}>
            <Text style={styles.badgeText}>{item}</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  title: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 10,
  },

  badge: {
    backgroundColor: PALETTE.tagBg,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: PALETTE.border,
  },

  badgeText: {
    color: PALETTE.tagText,
    fontSize: 14,
    fontWeight: "600",
  },
});
