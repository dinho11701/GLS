import React, { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";

import DeleteServiceButton from "../../../components/DeleteServiceButton";
import EditServiceButton from "../../../components/EditServiceButton";

const API_BASE =
  (process.env.EXPO_PUBLIC_API_BASE ?? "http://127.0.0.1:5055/api/v1").replace(
    /\/+$/,
    ""
  );

/* -------------------------------------------------------
   NORMALISATION DES JOURS (ROBUSTE)
   - accepte string | number
------------------------------------------------------- */
const DAY_LABELS_ISO_1_7: Record<number, string> = {
  1: "Lun",
  2: "Mar",
  3: "Mer",
  4: "Jeu",
  5: "Ven",
  6: "Sam",
  7: "Dim",
};

function formatDay(day: string | number): string {
  // ✅ déjà un libellé (backend ou calculé)
  if (typeof day === "string") return day;

  // ✅ ISO 1..7
  if (day >= 1 && day <= 7) return DAY_LABELS_ISO_1_7[day];

  // ✅ JS 0..6 (sécurité)
  if (day >= 0 && day <= 6)
    return DAY_LABELS_ISO_1_7[day === 0 ? 7 : day];

  return "";
}

export default function MyServicesPage() {
  const router = useRouter();
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  /* -------------------------------------------
        LOAD SERVICES
  ------------------------------------------- */
  const loadServices = async () => {
    try {
      const token =
        (await AsyncStorage.getItem("idToken")) ||
        (typeof window !== "undefined"
          ? localStorage.getItem("idToken")
          : null);

      if (!token) return;

      const resp = await fetch(`${API_BASE}/partners/my-services`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await resp.json();

      if (resp.ok) {
        setServices(data.items || []);
      }
    } catch (e) {
      console.error("LOAD MY SERVICES ERROR:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadServices();
  }, []);

  /* -------------------------------------------
        HANDLE DELETE
  ------------------------------------------- */
  const onDeleted = (id: string) => {
    setServices((prev) => prev.filter((s) => s.id !== id));
  };

  return (
    <div style={styles.page}>
      <h1 style={styles.title}>📦 Mes services</h1>

      {loading && <p style={{ opacity: 0.7 }}>Chargement…</p>}

      <div style={styles.grid}>
        {services.map((svc) => (
          <div
            key={svc.id}
            style={{ ...styles.card, position: "relative" }}
            onClick={() => router.push(`/partner/services/${svc.id}`)}
            onMouseEnter={(e) => {
              const del = e.currentTarget.querySelector(".delete-btn") as HTMLElement | null;
              const edit = e.currentTarget.querySelector(".edit-btn") as HTMLElement | null;
              if (del) del.style.opacity = "1";
              if (edit) edit.style.opacity = "1";
            }}
            onMouseLeave={(e) => {
              const del = e.currentTarget.querySelector(".delete-btn") as HTMLElement | null;
              const edit = e.currentTarget.querySelector(".edit-btn") as HTMLElement | null;
              if (del) del.style.opacity = "0";
              if (edit) edit.style.opacity = "0";
            }}
          >
            {/* ✏️ EDIT BUTTON */}
            <div
              className="edit-btn"
              style={{
                opacity: 0,
                transition: "opacity 0.2s",
                position: "absolute",
                top: 10,
                left: 10,
                zIndex: 10,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <EditServiceButton id={svc.id} />
            </div>

            {/* 🗑️ DELETE BUTTON */}
            <div
              className="delete-btn"
              style={{
                opacity: 0,
                transition: "opacity 0.2s",
                position: "absolute",
                top: 10,
                right: 10,
                zIndex: 10,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <DeleteServiceButton id={svc.id} onDeleted={onDeleted} />
            </div>

            {/* CONTENT */}
            <h2 style={styles.cardTitle}>{svc.Service}</h2>
            <p style={styles.cardSector}>{svc.Activity_Secteur}</p>
            <p style={styles.cardFee}>{svc.Fee} $</p>

            {/* ✅ JOURS — PLUS JAMAIS DE ? */}
            {Array.isArray(svc.availabilityDays) &&
              svc.availabilityDays.length > 0 && (
                <p style={styles.availability}>
                  🗓{" "}
                  {svc.availabilityDays
                    .map(formatDay)
                    .filter(Boolean)
                    .join(", ")}
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

/* -------------------------------------------
   STYLES
------------------------------------------- */
const styles = {
  page: {
    padding: "40px",
    minHeight: "100vh",
    backgroundColor: "#0A0F2C",
    color: "white",
    fontFamily: "sans-serif",
  },
  title: {
    fontSize: "32px",
    fontWeight: "900",
    marginBottom: "25px",
    color: "#FFD700",
  },
  grid: {
    display: "grid",
    gap: "20px",
    gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
    marginTop: "20px",
  },
  card: {
    padding: "22px",
    borderRadius: "14px",
    backgroundColor: "rgba(255,255,255,0.1)",
    border: "1px solid rgba(255,255,255,0.25)",
    cursor: "pointer",
    transition: "transform 0.25s ease",
  },
  cardTitle: { fontSize: "20px", fontWeight: "800", marginBottom: "8px" },
  cardSector: { opacity: 0.7, marginBottom: 6 },
  cardFee: { marginTop: 10, fontWeight: "900", fontSize: "18px" },
  availability: { opacity: 0.8, fontSize: "14px" },
  instances: { marginTop: 10, opacity: 0.9, fontWeight: "600" },
};