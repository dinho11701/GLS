import React, { useEffect, useState } from "react";
import { useLocalSearchParams } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";

const PALETTE = {
  primary: "#0A0F2C",
  white: "#FFFFFF",
  muted: "rgba(255,255,255,0.55)",
};

export default function ServiceDetailWeb() {
  const { id } = useLocalSearchParams();
  const [item, setItem] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  /* -------------------------------
        FETCH SERVICE DETAIL
  ------------------------------- */
  const fetchDetail = async () => {
    try {
      const token =
        (await AsyncStorage.getItem("idToken")) ||
        (typeof window !== "undefined" ? localStorage.getItem("idToken") : null);

      if (!token) return;

      const resp = await fetch(
        `${process.env.EXPO_PUBLIC_API_BASE}/partners/services/${id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const data = await resp.json();
      setItem(data?.item || null);
    } catch (err) {
      console.error("SERVICE DETAIL WEB ERROR:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetail();
  }, []);

  if (loading) {
    return (
      <div style={styles.center}>
        <Ionicons name="hourglass-outline" size={48} color="#aaa" />
      </div>
    );
  }

  if (!item) {
    return (
      <div style={styles.center}>
        <Ionicons name="alert-circle-outline" size={50} color="#aaa" />
        <p style={styles.emptyText}>Service introuvable</p>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      {/* IMAGE FULL WIDTH */}
      {item.Pictures?.[0]?.uri ? (
        <img src={item.Pictures[0].uri} style={styles.cover} />
      ) : (
        <div style={styles.coverPlaceholder}>
          <Ionicons name="image-outline" size={60} color="#fff" />
        </div>
      )}

      {/* CONTENT */}
      <div style={styles.content}>
        <h1 style={styles.title}>{item.Service}</h1>
        <p style={styles.category}>{item.Categorie}</p>

        {/* PRICE */}
        <div style={styles.row}>
          <Ionicons name="pricetag-outline" size={22} color="#00c56e" />
          <span style={styles.price}>{item.Fee} $</span>
        </div>

        {/* DESCRIPTION */}
        <h2 style={styles.sectionTitle}>Description</h2>
        <p style={styles.description}>{item.Description}</p>

        {/* DISPONIBILITÉ */}
        <h2 style={styles.sectionTitle}>Disponibilité</h2>

        <div style={styles.row}>
          <Ionicons name="calendar-outline" size={20} color={PALETTE.muted} />
          <span style={styles.infoText}>
            {item.availabilityDays?.length > 0
              ? item.availabilityDays.join(", ")
              : "Non spécifié"}
          </span>
        </div>

        <div style={styles.row}>
          <Ionicons name="time-outline" size={20} color={PALETTE.muted} />
          <span style={styles.infoText}>
            {item.availabilityHours || "Non spécifié"}
          </span>
        </div>

        {/* INSTANCES */}
        <h2 style={styles.sectionTitle}>Instances créées</h2>

        <div style={styles.row}>
          <Ionicons name="stats-chart-outline" size={20} color={PALETTE.muted} />
          <span style={styles.infoText}>{item.instancesCount} instance(s)</span>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------
     NEW FULL-WIDTH STYLES
------------------------------- */
const styles: any = {
  page: {
    backgroundColor: PALETTE.primary,
    color: PALETTE.white,
    minHeight: "100vh",
    width: "100vw",
    margin: 0,
    padding: 0,
    overflowX: "hidden",
    fontFamily: "Inter, sans-serif",
  },

  /* image = full width */
  cover: {
    width: "100vw",
    height: "380px",
    objectFit: "cover",
  },

  coverPlaceholder: {
    width: "100vw",
    height: "380px",
    backgroundColor: "#333",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
  },

  content: {
    padding: "40px 60px",
    maxWidth: "1400px",
    margin: "0 auto",
  },

  center: {
    minHeight: "80vh",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    color: "#bbb",
  },

  emptyText: { marginTop: 12, fontSize: 18 },

  title: { fontSize: "38px", fontWeight: 900, marginBottom: "10px" },

  category: { fontSize: "20px", color: PALETTE.muted },

  row: { display: "flex", alignItems: "center", marginTop: "16px", gap: "10px" },

  price: { fontSize: "24px", fontWeight: 700, color: "#00c56e" },

  sectionTitle: {
    marginTop: "32px",
    fontSize: "24px",
    fontWeight: 800,
  },

  description: {
    color: PALETTE.muted,
    marginTop: "8px",
    lineHeight: "28px",
    fontSize: "18px",
    maxWidth: "800px",
  },

  infoText: { fontSize: "17px" },
};
