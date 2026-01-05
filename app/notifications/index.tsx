// app/notifications/index.tsx
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
} from "react-native";
import { useNotifications } from "../../hooks/useNotifications";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";

export default function NotificationsScreen() {
  const router = useRouter();
  const { items, refresh, markRead, remove } = useNotifications();

  const [visibleCount, setVisibleCount] = useState(10); // ⭐ montrer 10 au début

  useEffect(() => {
    refresh();
  }, []);

  /* --------------------------------------------------
     Navigation intelligente
  -------------------------------------------------- */
  const handlePress = async (item) => {
    await markRead(item.id);

    if (item.type === "message" && item.data?.conversationId) {
      return router.push(`/Message/${item.data.conversationId}`);
    }

    if (item.type === "reservation" && item.data?.reservationId) {
      return router.push(`/reservations/${item.data.reservationId}`);
    }

    console.log("Notif sans action dédiée :", item);
  };

  /* --------------------------------------------------
     Render d'une notif
  -------------------------------------------------- */
  const renderItem = ({ item }) => {
    const unread = item.status === "unread";

    return (
      <TouchableOpacity
        style={[styles.item, unread && styles.unreadItem]}
        onPress={() => handlePress(item)}
      >
        <View style={styles.row}>
          <Ionicons
            name={
              item.type === "message"
                ? "chatbubble-ellipses-outline"
                : item.type === "reservation"
                ? "calendar-outline"
                : "notifications-outline"
            }
            size={22}
            color="#fff"
            style={{ marginRight: 10 }}
          />

          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{item.title}</Text>
            {item.body && <Text style={styles.body}>{item.body}</Text>}
          </View>

          <TouchableOpacity onPress={() => remove(item.id)}>
            <Ionicons name="trash-outline" size={22} color="#f66" />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  /* --------------------------------------------------
     “Voir plus” Instagram style
  -------------------------------------------------- */
  const showMore = () => {
    setVisibleCount((prev) => prev + 10);
  };

  const hasMore = visibleCount < items.length;

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Notifications</Text>

      <FlatList
        data={items.slice(0, visibleCount)} // ⭐ afficher partiellement
        keyExtractor={(i) => i.id}
        renderItem={renderItem}
        contentContainerStyle={{ paddingBottom: 80 }}
      />

      {hasMore && (
        <TouchableOpacity style={styles.moreBtn} onPress={showMore}>
          <Text style={styles.moreText}>Voir plus</Text>
          <Ionicons name="chevron-down-outline" size={18} color="#FFD700" />
        </TouchableOpacity>
      )}
    </View>
  );
}

/* --------------------- STYLES --------------------- */
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0A0F2C",
    paddingTop: 60,
    paddingHorizontal: 16,
  },

  header: {
    color: "#FFD700",
    fontSize: 32,
    fontWeight: "900",
    marginBottom: 20,
  },

  item: {
    padding: 14,
    borderRadius: 12,
    backgroundColor: "#132042",
    marginBottom: 12,
  },

  unreadItem: {
    borderLeftWidth: 4,
    borderLeftColor: "#FFD700",
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
  },

  title: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },

  body: {
    color: "#ccc",
    marginTop: 4,
    fontSize: 14,
  },

  /* --- Bouton Voir plus (Instagram style) --- */
  moreBtn: {
    marginTop: 10,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },

  moreText: {
    color: "#FFD700",
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 4,
  },
});
