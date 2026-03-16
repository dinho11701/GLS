// components/EditServiceButton.tsx

import React from "react";
import { Platform, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

export default function EditServiceButton({ id }: { id: string }) {
  const router = useRouter();

  const goToEdit = () => {
    // ⚠️ Route correcte pour Expo Router
    router.push(`/(tabs)/partner/create?id=${id}`);
  };

  // -----------------------
  // 📱 MOBILE VERSION
  // -----------------------
  if (Platform.OS !== "web") {
    return (
      <TouchableOpacity
        onPress={(e) => {
          e.stopPropagation();
          goToEdit();
        }}
        style={{ padding: 6 }}
      >
        <Ionicons name="create-outline" size={22} color="#FFD700" />
      </TouchableOpacity>
    );
  }

  // -----------------------
  // 💻 WEB VERSION
  // -----------------------
  return (
    <div
      onClick={(e) => {
        e.stopPropagation(); // Empêche l'ouverture du détail
        goToEdit();
      }}
      style={{
        cursor: "pointer",
        padding: 6,
        opacity: 0.85,
        transition: "0.2s",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Ionicons name="create-outline" size={22} color="#FFD700" />
    </div>
  );
}
