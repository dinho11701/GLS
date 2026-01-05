// components/TimeSelector.tsx
import React, { useState, useMemo } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Platform,
} from "react-native";

const PALETTE = {
  primary: "#0A0F2C",
  white: "#FFFFFF",
  gold: "#FFD700",
  soft: "rgba(255,255,255,0.12)",
};

export default function TimeSelector({
  visible,
  onClose,
  onSelect,
  startTime = "09:00",
  endTime = "20:00",
  step = 30, // minutes
}) {
  // Génère toutes les heures possibles
  const slots = useMemo(() => {
    let out = [];
    const [sh, sm] = startTime.split(":").map(Number);
    const [eh, em] = endTime.split(":").map(Number);

    let current = sh * 60 + sm;
    const end = eh * 60 + em;

    while (current <= end) {
      const h = Math.floor(current / 60);
      const m = current % 60;
      out.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
      current += step;
    }

    return out;
  }, [startTime, endTime, step]);

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Sélectionnez une heure</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.close}>Fermer</Text>
            </TouchableOpacity>
          </View>

          {/* Liste d'heures */}
          <FlatList
            data={slots}
            keyExtractor={(item) => item}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.slot}
                onPress={() => {
                  onSelect(item);
                  onClose();
                }}
              >
                <Text style={styles.slotText}>{item}</Text>
              </TouchableOpacity>
            )}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: PALETTE.primary,
    paddingTop: 20,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    height: "55%",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  title: {
    color: PALETTE.white,
    fontSize: 18,
    fontWeight: "800",
  },
  close: {
    color: PALETTE.gold,
    fontSize: 16,
    fontWeight: "700",
  },
  slot: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: PALETTE.soft,
  },
  slotText: {
    color: PALETTE.white,
    fontSize: 17,
    fontWeight: "600",
  },
});
