// components/DeleteServiceButton.tsx

import React, { useState } from "react";
import { Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";

const API_BASE =
  (process.env.EXPO_PUBLIC_API_BASE ?? "http://127.0.0.1:5055/api/v1")
    .replace(/\/+$/, "");

export default function DeleteServiceButton({ id, onDeleted }) {
  const [loading, setLoading] = useState(false);
  const isWeb = Platform.OS === "web";

  const deleteService = async (e) => {
    e.stopPropagation(); // ❗ important : évite d’ouvrir le service au clic

    if (!confirm("Supprimer ce service ?")) return;

    try {
      setLoading(true);

      const token =
        localStorage.getItem("idToken") ||
        (typeof window === "undefined"
          ? null
          : await AsyncStorage.getItem("idToken"));

      const resp = await fetch(`${API_BASE}/partners/services/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await resp.json();

      if (resp.ok) {
        onDeleted(id);
      } else {
        alert(data.error || "Erreur lors de la suppression");
      }
    } catch (err) {
      console.error("DELETE ERROR:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      onClick={deleteService}
      style={{
        position: isWeb ? "absolute" : "relative",
        top: isWeb ? 10 : 0,
        right: isWeb ? 10 : 0,
        padding: 6,
        backgroundColor: "rgba(255, 0, 0, 0.85)",
        borderRadius: 40,
        cursor: "pointer",
        zIndex: 20,
      }}
    >
      <Ionicons name="trash-outline" size={18} color="white" />
    </div>
  );
}
