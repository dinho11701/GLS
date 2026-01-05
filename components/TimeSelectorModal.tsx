import React, { useMemo } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
} from "react-native";

const PALETTE = {
  bg: "#0A0F2C",
  white: "#FFFFFF",
  gold: "#FFD700",
  soft: "rgba(255,255,255,0.1)",
};

export default function TimeSelectorModal({
  visible,
  onClose,
  onConfirm,
  startTime,
  endTime,
  mode,
}) {
  // Génère plages 30 minutes
  const generate = (start, end) => {
    const out = [];
    let [sh, sm] = start.split(":").map(Number);
    let [eh, em] = end.split(":").map(Number);

    let cur = sh * 60 + sm;
    const endMin = eh * 60 + em;

    while (cur <= endMin) {
      const h = String(Math.floor(cur / 60)).padStart(2, "0");
      const m = String(cur % 60).padStart(2, "0");
      out.push(`${h}:${m}`);
      cur += 30;
    }
    return out;
  };

  const slots = useMemo(() => {
    const all = generate(startTime, endTime);

    if (mode === "start") return all;
    if (mode === "end") {
      return all.filter((t) => t > startTime);
    }
    return all;
  }, [startTime, endTime, mode]);

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>
              {mode === "start"
                ? "Sélectionnez votre heure de début"
                : `Heure de fin (après ${startTime})`}
            </Text>

            <TouchableOpacity onPress={onClose}>
              <Text style={styles.close}>Fermer</Text>
            </TouchableOpacity>
          </View>

          {/* Liste */}
          <FlatList
            data={slots}
            keyExtractor={(item) => item}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.slot}
                onPress={() => {
                  onConfirm(item);
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
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: PALETTE.bg,
    paddingTop: 20,
    paddingHorizontal: 14,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: "55%",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 14,
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
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: PALETTE.soft,
  },
  slotText: {
    color: PALETTE.white,
    fontSize: 17,
    fontWeight: "600",
  },
});
