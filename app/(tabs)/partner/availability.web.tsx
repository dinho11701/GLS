import React, { useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";

const API_BASE = process.env.EXPO_PUBLIC_API_BASE;

/* -------------------------------
   PALETTE
------------------------------- */
const PALETTE = {
  primary: "#0A0F2C",
  bg: "#0B1120",
  card: "#FFFFFF",
  textDark: "#0B1220",
  textMuted: "#6B7280",
  border: "rgba(15,23,42,0.15)",
  coral: "#F97373",
  accent: "#F97316",
  accentSoft: "#FEF3C7",
};

type DayKey =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

type DayConfig = {
  key: DayKey;
  label: string;
  enabled: boolean;
  start: string;
  end: string;
};

type ExceptionPeriod = {
  id: string;
  startDate: string;
  endDate: string;
  reason: string;
};

/* -------------------------------
   BASE DAYS
------------------------------- */
const BASE_DAYS: DayConfig[] = [
  { key: "monday", label: "Lundi", enabled: true, start: "09:00", end: "17:00" },
  { key: "tuesday", label: "Mardi", enabled: true, start: "09:00", end: "17:00" },
  { key: "wednesday", label: "Mercredi", enabled: true, start: "09:00", end: "17:00" },
  { key: "thursday", label: "Jeudi", enabled: true, start: "09:00", end: "17:00" },
  { key: "friday", label: "Vendredi", enabled: true, start: "09:00", end: "17:00" },
  { key: "saturday", label: "Samedi", enabled: false, start: "09:00", end: "17:00" },
  { key: "sunday", label: "Dimanche", enabled: false, start: "09:00", end: "17:00" },
];

function timeToMin(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

export default function AvailabilityWeb() {
  const router = useRouter();

  const [days, setDays] = useState<DayConfig[]>(BASE_DAYS);
  const [exceptions, setExceptions] = useState<ExceptionPeriod[]>([]);
  const [saving, setSaving] = useState(false);

  /* -------------------------------
     PRESETS
  ------------------------------- */
  const applyPreset = (p: "week" | "all" | "custom") => {
    setDays((prev) =>
      prev.map((d) => {
        if (p === "week") {
          const wk = ["monday", "tuesday", "wednesday", "thursday", "friday"];
          return { ...d, enabled: wk.includes(d.key), start: "09:00", end: "17:00" };
        }
        if (p === "all") {
          return { ...d, enabled: true, start: "09:00", end: "21:00" };
        }
        return d;
      })
    );
  };

  /* -------------------------------
     DAYS
  ------------------------------- */
  const toggleDay = (key: DayKey) => {
    setDays((prev) =>
      prev.map((d) => (d.key === key ? { ...d, enabled: !d.enabled } : d))
    );
  };

  const updateHour = (
    key: DayKey,
    field: "start" | "end",
    value: string
  ) => {
    setDays((prev) =>
      prev.map((d) =>
        d.key === key ? { ...d, [field]: value } : d
      )
    );
  };

  const applyToAll = () => {
    const ref = days.find((d) => d.enabled) ?? days[0];
    setDays((prev) =>
      prev.map((d) => ({
        ...d,
        enabled: ref.enabled,
        start: ref.start,
        end: ref.end,
      }))
    );
  };

  /* -------------------------------
     EXCEPTIONS
  ------------------------------- */
  const addException = () => {
    const now = new Date();
    const id = `${now.getTime()}-${Math.random().toString(36).slice(2, 6)}`;
    const iso = now.toISOString().slice(0, 10);

    setExceptions((prev) => [
      ...prev,
      { id, startDate: iso, endDate: iso, reason: "" },
    ]);
  };

  const updateException = (
    id: string,
    field: keyof ExceptionPeriod,
    value: string
  ) => {
    setExceptions((prev) =>
      prev.map((ex) => (ex.id === id ? { ...ex, [field]: value } : ex))
    );
  };

  const deleteException = (id: string) => {
    setExceptions((prev) => prev.filter((ex) => ex.id !== id));
  };

  /* -------------------------------
     VALIDATION
  ------------------------------- */
  const errors = useMemo(() => {
    const err: string[] = [];

    if (!days.some((d) => d.enabled))
      err.push("Au moins un jour doit être disponible.");

    days.forEach((d) => {
      if (!d.enabled) return;
      if (timeToMin(d.end) <= timeToMin(d.start))
        err.push(`Heure invalide pour ${d.label}`);
    });

    exceptions.forEach((ex) => {
      if (ex.startDate > ex.endDate)
        err.push(`Exception invalide : ${ex.reason || ex.startDate}`);
    });

    return err;
  }, [days, exceptions]);

  const hasErrors = errors.length > 0;

  /* -------------------------------
     MAPPING BACKEND
  ------------------------------- */
  const mapDays = (days: DayConfig[]) => {
    const tz = "America/Toronto";
    const order: DayKey[] = [
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
      "sunday",
    ];

    return order.map((k, idx) => {
      const d = days.find((x) => x.key === k)!;
      return {
        kind: "weekly",
        tz,
        day: idx + 1, // ✅ ISO 1..7
        closed: !d.enabled,
        ranges: d.enabled ? [{ start: d.start, end: d.end }] : [],
      };
    });
  };

  const mapOverrides = (exceptions: ExceptionPeriod[]) => {
    const tz = "America/Toronto";
    const docs: any[] = [];

    exceptions.forEach((ex) => {
      let cur = new Date(ex.startDate);
      const end = new Date(ex.endDate);

      while (cur <= end) {
        docs.push({
          kind: "override",
          tz,
          date: cur.toISOString().slice(0, 10),
          closed: true,
          ranges: [],
          reason: ex.reason || null,
        });
        cur.setDate(cur.getDate() + 1);
      }
    });

    return docs;
  };

  /* -------------------------------
     SAVE
  ------------------------------- */
  async function save() {
    if (hasErrors) return alert("Corrige les erreurs.");

    setSaving(true);
    const token = await AsyncStorage.getItem("idToken");

    try {
      for (const w of mapDays(days)) {
        const resp = await fetch(`${API_BASE}/partners/availability`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(w),
        });

        if (!resp.ok) {
          const err = await resp.json();
          throw new Error(err?.error || "Erreur de sauvegarde");
        }
      }

      for (const o of mapOverrides(exceptions)) {
        const resp = await fetch(`${API_BASE}/partners/availability`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(o),
        });

        if (!resp.ok) {
          const err = await resp.json();
          throw new Error(err?.error || "Erreur de sauvegarde");
        }
      }

      alert("Disponibilités enregistrées.");
      router.back();
    } catch (e: any) {
      alert(e.message || "Erreur serveur.");
    } finally {
      setSaving(false);
    }
  }

  /* -------------------------------
     RENDER
  ------------------------------- */
  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <h1 style={styles.title}>Gestion des disponibilités</h1>

        {/* PRESETS */}
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>Configuration rapide</h3>
          <div style={styles.pillsRow}>
            <button style={styles.pill} onClick={() => applyPreset("week")}>
              Lun–Ven 9h–17h
            </button>
            <button style={styles.pill} onClick={() => applyPreset("all")}>
              Tous les jours 9h–21h
            </button>
            <button style={styles.pill} onClick={() => applyPreset("custom")}>
              Personnaliser
            </button>
          </div>
        </div>

        {/* WEEKLY */}
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>Horaires récurrents</h3>
          <button style={styles.applyAllBtn} onClick={applyToAll}>
            Appliquer à toute la semaine
          </button>

          {days.map((d) => (
            <div key={d.key} style={styles.dayRow}>
              <label style={styles.dayLabel}>
                <input
                  type="checkbox"
                  checked={d.enabled}
                  onChange={() => toggleDay(d.key)}
                />{" "}
                {d.label}
              </label>

              <div style={styles.timeCol}>
                <span>De</span>
                <input
                  type="time"
                  value={d.start}
                  disabled={!d.enabled}
                  onChange={(e) =>
                    updateHour(d.key, "start", e.target.value)
                  }
                  style={styles.timeInput}
                />
              </div>

              <div style={styles.timeCol}>
                <span>À</span>
                <input
                  type="time"
                  value={d.end}
                  disabled={!d.enabled}
                  onChange={(e) =>
                    updateHour(d.key, "end", e.target.value)
                  }
                  style={styles.timeInput}
                />
              </div>
            </div>
          ))}
        </div>

        {/* ERRORS */}
        {hasErrors && (
          <div style={styles.errorBox}>
            <b>Corrigez :</b>
            <ul>
              {errors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          </div>
        )}

        {/* ACTIONS */}
        <div style={styles.actions}>
          <button style={styles.cancelBtn} onClick={() => router.back()}>
            Annuler
          </button>
          <button
            style={{
              ...styles.saveBtn,
              opacity: saving || hasErrors ? 0.6 : 1,
            }}
            disabled={saving || hasErrors}
            onClick={save}
          >
            {saving ? "Enregistrement…" : "Enregistrer"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------
   STYLES
------------------------------- */
const styles: Record<string, React.CSSProperties> = {
  page: {
    background: PALETTE.bg,
    minHeight: "100vh",
    padding: 20,
    overflowY: "auto",
    fontFamily: "sans-serif",
  },
  container: {
    maxWidth: 900,
    margin: "0 auto",
    background: PALETTE.card,
    borderRadius: 20,
    padding: 30,
  },
  title: {
    color: PALETTE.textDark,
    fontWeight: 900,
    fontSize: 26,
    marginBottom: 20,
  },
  section: { margin: "20px 0" },
  sectionTitle: { fontWeight: 800, fontSize: 18 },
  pillsRow: { display: "flex", gap: 10, flexWrap: "wrap" },
  pill: { padding: "8px 14px", borderRadius: 999, cursor: "pointer" },
  applyAllBtn: { marginBottom: 12, cursor: "pointer" },
  dayRow: {
    display: "flex",
    gap: 12,
    alignItems: "center",
    flexWrap: "wrap",
    borderBottom: "1px solid #E5E7EB",
    paddingBottom: 10,
    marginBottom: 10,
  },
  dayLabel: { fontWeight: 700 },
  timeCol: { display: "flex", flexDirection: "column" },
  timeInput: { padding: 4, borderRadius: 6 },
  errorBox: {
    background: "#FEE2E2",
    padding: 12,
    borderRadius: 12,
    color: "#991B1B",
  },
  actions: { display: "flex", justifyContent: "flex-end", gap: 15 },
  cancelBtn: { padding: "10px 16px", cursor: "pointer" },
  saveBtn: {
    background: PALETTE.accent,
    padding: "10px 16px",
    borderRadius: 8,
    color: "white",
    fontWeight: 700,
    cursor: "pointer",
  },
};