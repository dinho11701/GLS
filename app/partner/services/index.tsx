// app/partner/services/index.tsx

import React, { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";

const API_BASE =
  (process.env.EXPO_PUBLIC_API_BASE ?? "http://127.0.0.1:5055/api/v1").replace(
    /\/+$/,
    ""
  );

export default function MyServicesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [services, setServices] = useState([]);
  const [error, setError] = useState<string | null>(null);

  /* -------------------------------------------------------
     LOAD ALL SERVICES FOR THIS HOST
  ------------------------------------------------------- */
  const fetchMyServices = async () => {
    try {
      setLoading(true);
      setError(null);

      const token =
        (await AsyncStorage.getItem("idToken")) ||
        (typeof window !== "undefined" ? localStorage.getItem("idToken") : null);

      if (!token) {
        setError("Session expirée. Veuillez vous reconnecter.");
        return;
      }

      const resp = await fetch(`${API_BASE}/partners/my-services`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await resp.json();

      if (!resp.ok) throw new Error(data?.error || "Erreur serveur");

      setServices(data.items || []);
    } catch (err) {
      setError("Impossible de charger les services.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMyServices();
  }, []);

  /* -------------------------------------------------------
     RENDER
  ------------------------------------------------------- */
  return (
    <div style={styles.page}>
      <h1 style={styles.title}>📦 Mes services</h1>

      {loading && <p style={styles.loading}>Chargement…</p>}

      {error && <p style={styles.error}>{error}</p>}

      {!loading && services.length === 0 && (
        <p style={styles.empty}>Aucun service trouvé.</p>
      )}

      <div style={styles.grid}>
        {services.map((svc) => (
          <div
            key={svc.id}
            style={styles.card}
            onClick={() => router.push(`/partner/services/${svc.id}`)}
            onMouseEnter={(e) =>
              (e.currentTarget.style.transform = "scale(1.03)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.transform = "scale(1)")
            }
          >
            <h3 style={styles.cardTitle}>{svc.Service}</h3>

            <p style={styles.cardSector}>{svc.Activity_Secteur}</p>

            <p style={styles.price}>{svc.Fee} $</p>

            {/* Availability */}
            {svc.availabilityDays?.length > 0 && (
              <p style={styles.availability}>
                🗓 {svc.availabilityDays.join(", ")}
              </p>
            )}

            {svc.availabilityHours && (
              <p style={styles.availability}>⏱ {svc.availabilityHours}</p>
            )}

            <p style={styles.instances}>
              🔄 Instances : {svc.instancesCount}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* -------------------------------------------------------
   STYLES
------------------------------------------------------- */
const styles = {
  page: {
    padding: "35px",
    backgroundColor: "#0A0F2C",
    minHeight: "100vh",
    color: "white",
    fontFamily: "sans-serif",
  },

  title: {
    fontSize: "32px",
    fontWeight: "900",
    color: "#FFD700",
    marginBottom: "25px",
  },

  loading: {
    opacity: 0.7,
  },

  error: {
    backgroundColor: "#FF4A4A",
    padding: "12px",
    borderRadius: "8px",
    fontWeight: "700",
    maxWidth: "400px",
  },

  empty: {
    opacity: 0.7,
    marginTop: "15px",
    fontStyle: "italic",
  },

  grid: {
    marginTop: "20px",
    display: "grid",
    gap: "20px",
    gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
  },

  card: {
    backgroundColor: "rgba(255,255,255,0.10)",
    padding: "22px",
    borderRadius: "12px",
    border: "1px solid rgba(255,255,255,0.2)",
    transition: "0.2s ease",
    cursor: "pointer",
  },

  cardTitle: {
    fontSize: "20px",
    fontWeight: "800",
    marginBottom: "8px",
  },

  cardSector: {
    opacity: 0.8,
    marginBottom: "6px",
  },

  price: {
    fontWeight: "900",
    marginTop: "10px",
    marginBottom: "8px",
    fontSize: "18px",
  },

  availability: {
    opacity: 0.8,
    fontSize: "14px",
  },

  instances: {
    marginTop: "10px",
    opacity: 0.9,
    fontWeight: "600",
  },
};
