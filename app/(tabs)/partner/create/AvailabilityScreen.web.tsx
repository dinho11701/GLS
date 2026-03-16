// ✔️ VERSION DÉFINITIVE — AvailabilityScreen.web.tsx
// 🟢 CRÉATION vs ÉDITION FIABLE
// 🟢 PLUS AUCUN PUT EN CRÉATION
// 🟢 PLUS DE BOUTON "METTRE À JOUR" AU DÉPART

import React, { useState, useCallback, useEffect } from "react";
import { useRouter, useLocalSearchParams } from "expo-router";

/* -------------------------------------------------------
   PALETTE
------------------------------------------------------- */
const PALETTE = {
  primary: "#0A0F2C",
  white: "#FFFFFF",
  cream: "#F9FAFB",
  textDark: "#0B1220",
  border: "rgba(11,18,32,0.18)",
  peach: "#EF8A73",
  peachSoft: "#F8CBC1",
};


const DAYS = [
  { key: 1, label: "Lun" },
  { key: 2, label: "Mar" },
  { key: 3, label: "Mer" },
  { key: 4, label: "Jeu" },
  { key: 5, label: "Ven" },
  { key: 6, label: "Sam" },
  { key: 7, label: "Dim" }, // ✅ FIX
];

export default function AvailabilityScreenWeb() {
  const router = useRouter();
  const params = useLocalSearchParams<{ from?: string; id?: string }>();

  /* -------------------------------------------------------
     MODE (LA SEULE LOGIQUE VALIDE)
  ------------------------------------------------------- */
  const isEditMode = params.from === "review" && Boolean(params.id);
  const serviceId = isEditMode ? params.id! : null;

  /* -------------------------------------------------------
     STATES
  ------------------------------------------------------- */
  const [selectedDays, setSelectedDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("18:00");
  const [instances, setInstances] = useState("1");

  /* -------------------------------------------------------
     NETTOYAGE EN CRÉATION (CRITIQUE)
  ------------------------------------------------------- */
  useEffect(() => {
    if (!isEditMode) {
      localStorage.removeItem("edit_service_id");
      localStorage.removeItem("draft_service_step4_availability");
    }
  }, [isEditMode]);

  /* -------------------------------------------------------
     HELPERS
  ------------------------------------------------------- */
  const toggleDay = (day: number) => {
    setSelectedDays((prev) =>
      prev.includes(day)
        ? prev.filter((d) => d !== day)
        : [...prev, day].sort((a, b) => a - b)
    );
  };

  const toMinutes = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };

  const canSave =
    selectedDays.length > 0 &&
    toMinutes(endTime) > toMinutes(startTime) &&
    Number(instances) >= 1;

  /* -------------------------------------------------------
     SAVE
  ------------------------------------------------------- */
  const handleSave = () => {

  console.log("🟢 [AvailabilityScreen] selectedDays AVANT save =", selectedDays);


  if (!canSave) return;

  localStorage.setItem(
    "draft_service_step4_availability",
    JSON.stringify({
      availability: {
        days: selectedDays, // ✅ ISO 1..7 DIRECT
        startTime,
        endTime,
        instances: Number(instances),
      },
    })
  );

console.log(
    "🟢 [AvailabilityScreen] localStorage =",
    JSON.parse(localStorage.getItem("draft_service_step4_availability") || "{}")
  );

  router.replace(
    isEditMode
      ? `/(tabs)/partner/create/ReviewScreen?id=${serviceId}&from=review`
      : `/(tabs)/partner/create/ReviewScreen?from=create`
  );
};
  /* -------------------------------------------------------
     RENDER
  ------------------------------------------------------- */
  return (
    <div style={{ padding: 30, background: PALETTE.cream, minHeight: "100vh" }}>
      <div style={{ maxWidth: 600, margin: "0 auto", background: "#fff", padding: 24, borderRadius: 16 }}>
        <h2>Étape 4/4 : Disponibilités</h2>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 16 }}>
          {DAYS.map((d) => (
            <button
              key={d.key}
              onClick={() => toggleDay(d.key)}
              style={{
                padding: "8px 14px",
                borderRadius: 12,
                border: `1px solid ${PALETTE.border}`,
                background: selectedDays.includes(d.key)
                  ? PALETTE.peachSoft
                  : "#fff",
                cursor: "pointer",
              }}
            >
              {d.label}
            </button>
          ))}
        </div>

        <div style={{ marginTop: 20, display: "flex", gap: 20 }}>
          <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
          <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
        </div>

        <input
          type="number"
          min={1}
          value={instances}
          onChange={(e) => setInstances(e.target.value)}
          style={{ marginTop: 20 }}
        />

        <button
          onClick={handleSave}
          disabled={!canSave}
          style={{
            marginTop: 24,
            width: "100%",
            padding: 14,
            background: PALETTE.peach,
            border: "none",
            borderRadius: 16,
            fontWeight: 900,
            color: "white",
          }}
        >
          {isEditMode ? "Mettre à jour" : "Enregistrer"}
        </button>
      </div>
    </div>
  );
}
/* -------------------------------------------------------
   STYLES
------------------------------------------------------- */
const styles: Record<string, React.CSSProperties> = {
  page: {
    background: PALETTE.cream,
    minHeight: "100vh",
    padding: 30,
  },
  container: {
    maxWidth: 600,
    margin: "0 auto",
    background: PALETTE.white,
    padding: 24,
    borderRadius: 16,
    border: `1px solid ${PALETTE.border}`,
  },
  title: { fontSize: 24, fontWeight: 900 },
  groupTitle: { marginTop: 20, fontWeight: 800 },
  presetRow: { display: "flex", gap: 10 },
  presetBtn: {
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: PALETTE.border,
    background: PALETTE.white,
    padding: "8px 14px",
    borderRadius: 999,
    cursor: "pointer",
    fontWeight: 700,
  },
  daysWrap: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    marginTop: 10,
  },
  dayChip: {
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: PALETTE.border,
    padding: "8px 14px",
    borderRadius: 12,
    cursor: "pointer",
    fontWeight: 800,
  },
  dayChipActive: {
    background: PALETTE.peachSoft,
    borderColor: PALETTE.peach,
  },
  timeRow: { display: "flex", gap: 20, marginTop: 10 },
  input: {
    padding: 10,
    border: `1px solid ${PALETTE.border}`,
    borderRadius: 10,
  },
  saveBtn: {
    marginTop: 24,
    width: "100%",
    background: PALETTE.peach,
    border: "none",
    padding: 14,
    borderRadius: 16,
    fontWeight: 900,
    color: "white",
  },
};