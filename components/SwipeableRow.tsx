import React, { useRef, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Platform } from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import Ionicons from "@expo/vector-icons/Ionicons";

export default function SwipeableRow({ children, onDelete }: any) {
  const ref = useRef<Swipeable>(null);
  const [hover, setHover] = useState(false);

  // WEB VERSION → pas de swipe, bouton apparaît au hover
  if (Platform.OS === "web") {
    return (
      <View
        style={{ position: "relative" }}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
      >
        {children}

        {hover && (
          <TouchableOpacity style={styles.webDelete} onPress={onDelete}>
            <Ionicons name="trash-outline" size={18} color="#fff" />
          </TouchableOpacity>
        )}
      </View>
    );
  }

  // MOBILE VERSION
  const renderRightActions = () => (
    <TouchableOpacity
      style={styles.deleteButton}
      onPress={() => {
        ref.current?.close();
        onDelete && onDelete();
      }}
    >
      <Ionicons name="trash-outline" size={24} color="#fff" />
      <Text style={styles.deleteText}>Supprimer</Text>
    </TouchableOpacity>
  );

  return (
    <Swipeable ref={ref} renderRightActions={renderRightActions}>
      {children}
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  deleteButton: {
    width: 100,
    backgroundColor: "#E53935",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 12,
    marginVertical: 6,
  },

  deleteText: {
    color: "#fff",
    fontSize: 12,
    marginTop: 4,
    fontWeight: "700",
  },

  webDelete: {
    position: "absolute",
    right: 10,
    top: "50%",
    transform: [{ translateY: -15 }],
    backgroundColor: "#E53935",
    padding: 10,
    borderRadius: 30,
  },
});
