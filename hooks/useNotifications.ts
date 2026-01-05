// hooks/useNotifications.ts
import { useEffect, useState, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const API =
  (process.env.EXPO_PUBLIC_API_BASE ?? "http://127.0.0.1:5055/api/v1")
    .replace(/\/+$/, "");

export function useNotifications() {
  const [counters, setCounters] = useState({
    total: 0,
    byType: { reservation: 0, message: 0, payment: 0 },
  });

  const [items, setItems] = useState([]);

  /* ---------------------------------------------------------
     HELPERS
  --------------------------------------------------------- */
  const getToken = async () => {
    const t = await AsyncStorage.getItem("idToken");
    return t || null;
  };

  /* ---------------------------------------------------------
     FETCH COUNTERS
  --------------------------------------------------------- */
  const fetchCounters = useCallback(async () => {
    const token = await getToken();
    if (!token) return;

    try {
      const r = await fetch(`${API}/customers/notifs/counters`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await r.json();
      if (r.ok) setCounters(data);
    } catch (err) {
      console.warn("notif counter error", err);
    }
  }, []);

  /* ---------------------------------------------------------
     FETCH ALL NOTIFS
  --------------------------------------------------------- */
  const fetchItems = useCallback(async () => {
    const token = await getToken();
    if (!token) return;

    try {
      const r = await fetch(`${API}/customers/notifs`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await r.json();
      if (r.ok && Array.isArray(data.items)) setItems(data.items);
    } catch (err) {
      console.warn("notif list error", err);
    }
  }, []);

  /* ---------------------------------------------------------
     LIST ONLY MESSAGE NOTIFS
  --------------------------------------------------------- */
  const listMessages = useCallback(async () => {
    const token = await getToken();
    if (!token) return [];

    try {
      const r = await fetch(
        `${API}/customers/notifs?type=message&limit=100`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      const data = await r.json();
      if (r.ok && Array.isArray(data.items)) return data.items;

      return [];
    } catch (err) {
      console.warn("notif listMessages error", err);
      return [];
    }
  }, []);

  /* ---------------------------------------------------------
     MARK AS READ
  --------------------------------------------------------- */
  const markRead = useCallback(async (notifId: string) => {
    const token = await getToken();
    if (!token) return;

    try {
      await fetch(`${API}/customers/notifs/${notifId}/read`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });

      // update local state
      setItems((prev) =>
        prev.map((i) =>
          i.id === notifId ? { ...i, status: "read" } : i
        )
      );

      fetchCounters();
    } catch (err) {
      console.warn("notif markRead error", err);
    }
  }, []);

  /* ---------------------------------------------------------
     DELETE NOTIF
  --------------------------------------------------------- */
  const remove = useCallback(async (notifId: string) => {
    const token = await getToken();
    if (!token) return;

    try {
      await fetch(`${API}/customers/notifs/${notifId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      // update local list
      setItems((prev) => prev.filter((i) => i.id !== notifId));

      // recalc counters
      fetchCounters();
    } catch (err) {
      console.warn("notif delete error", err);
    }
  }, []);

  /* ---------------------------------------------------------
     AUTO-REFRESH COUNTERS EVERY 30s
  --------------------------------------------------------- */
  useEffect(() => {
    fetchCounters();
    const int = setInterval(fetchCounters, 30000);
    return () => clearInterval(int);
  }, []);

  /* ---------------------------------------------------------
     PUBLIC API
  --------------------------------------------------------- */
  return {
    counters,
    items,

    refresh: () => {
      fetchCounters();
      fetchItems();
    },

    listMessages,
    markRead,
    remove,
  };
}
