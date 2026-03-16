import React, { useEffect, useState, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";

const API_BASE = (
  process.env.EXPO_PUBLIC_API_BASE ?? "http://127.0.0.1:5055/api/v1"
).replace(/\/+$/, "");

type GroupBy = "day" | "week" | "month";

export default function PartnerDashboardWeb() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [groupBy, setGroupBy] = useState<GroupBy>("day");
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");

  const [data, setData] = useState<any | null>(null);

  /* ----------------------------------
     FETCH STATS
  ---------------------------------- */
  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const token =
        (await AsyncStorage.getItem("idToken")) ||
        (typeof window !== "undefined"
          ? localStorage.getItem("idToken")
          : null);

      if (!token) return;

      const params = new URLSearchParams({
        groupBy,
        ...(from && { from }),
        ...(to && { to }),
      });

      const resp = await fetch(
        `${API_BASE}/partners/statistiques?${params}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const json = await resp.json();
      if (!resp.ok) throw new Error(json?.message || "Erreur API");

      setData(json);
    } catch (e: any) {
      setError(e.message || "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  }, [groupBy, from, to]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  /* ----------------------------------
     HELPERS
  ---------------------------------- */
  const money = (v: number, cur = "CAD") =>
    new Intl.NumberFormat("fr-CA", {
      style: "currency",
      currency: cur,
      maximumFractionDigits: 2,
    }).format(v || 0);

  /* ----------------------------------
     RENDER
  ---------------------------------- */
  return (
    <div style={styles.page}>
      <h1 style={styles.title}>📊 Dashboard partenaire</h1>

      {/* FILTERS */}
      <div style={styles.filters}>
        <select
          value={groupBy}
          onChange={(e) => setGroupBy(e.target.value as GroupBy)}
        >
          <option value="day">Par jour</option>
          <option value="week">Par semaine</option>
          <option value="month">Par mois</option>
        </select>

        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
      </div>

      {loading && <p>Chargement…</p>}
      {error && <p style={styles.error}>{error}</p>}

      {data && (
        <>
          {/* KPI */}
          <div style={styles.kpis}>
            <Kpi title="💰 Revenus" value={money(data.kpis.revenue_total, data.kpis.revenue_currency)} />
            <Kpi title="📅 Réservations" value={data.kpis.reservations_total} />
            <Kpi title="✅ Confirmées" value={data.kpis.reservations_confirmed} />
            <Kpi title="❌ Annulées" value={data.kpis.reservations_cancelled} />
            <Kpi title="🔁 Conversion" value={`${data.kpis.conversion_rate_pct}%`} />
            <Kpi title="⭐ Note moyenne" value={`${data.kpis.avg_rating} (${data.kpis.reviews_count})`} />
          </div>

          {/* CHARTS */}
          <Section title="📈 Revenus par période">
            <BarChart
              data={data.series.revenueByPeriod.map((x: any) => ({
                label: x.bucket,
                value: x.amount,
              }))}
            />
          </Section>

          <Section title="📊 Réservations par statut">
            {data.series.reservationsByStatus.map((s: any) => (
              <div key={s.status} style={{ marginBottom: 12 }}>
                <strong>{s.status}</strong>
                <BarChart
                  data={s.data.map((x: any) => ({
                    label: x.bucket,
                    value: x.count,
                  }))}
                />
              </div>
            ))}
          </Section>

          <Section title="⭐ Répartition des évaluations">
            <BarChart
              data={Object.entries(data.series.ratings.distribution).map(
                ([k, v]: any) => ({ label: `${k}★`, value: v })
              )}
            />
          </Section>

          {/* SAMPLES */}
          <Section title="🕒 Dernières réservations">
            {data.samples.reservations.length === 0 ? (
              <p>Aucune réservation</p>
            ) : (
              data.samples.reservations.map((r: any) => (
                <div key={r.id} style={styles.sampleRow}>
                  <strong>{r.customerName || "Client"}</strong>
                  <span>{r.status}</span>
                </div>
              ))
            )}
          </Section>

          <Section title="💬 Derniers avis">
            {data.samples.reviews.length === 0 ? (
              <p>Aucun avis</p>
            ) : (
              data.samples.reviews.map((r: any) => (
                <div key={r.id} style={styles.sampleRow}>
                  <span>{"⭐".repeat(Math.round(r.rating || 0))}</span>
                  <span>{r.comment || "—"}</span>
                </div>
              ))
            )}
          </Section>
        </>
      )}
    </div>
  );
}

/* ----------------------------------
   SMALL COMPONENTS
---------------------------------- */
function Kpi({ title, value }: { title: string; value: any }) {
  return (
    <div style={styles.kpi}>
      <div style={styles.kpiTitle}>{title}</div>
      <div style={styles.kpiValue}>{value}</div>
    </div>
  );
}

function Section({ title, children }: any) {
  return (
    <div style={styles.section}>
      <h2>{title}</h2>
      {children}
    </div>
  );
}

function BarChart({ data }: { data: { label: string; value: number }[] }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div style={styles.chart}>
      {data.map((d, i) => (
        <div key={i} style={styles.barRow}>
          <span style={styles.barLabel}>{d.label}</span>
          <div style={styles.barTrack}>
            <div
              style={{
                ...styles.bar,
                width: `${(d.value / max) * 100}%`,
              }}
            />
          </div>
          <span style={styles.barValue}>{d.value}</span>
        </div>
      ))}
    </div>
  );
}

/* ----------------------------------
   STYLES
---------------------------------- */
const styles: any = {
  page: {
    padding: 24,
    background: "#0A0F2C",
    minHeight: "100vh",
    color: "white",
    fontFamily: "sans-serif",
  },
  title: {
    fontSize: 32,
    fontWeight: 900,
    marginBottom: 20,
  },
  filters: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    marginBottom: 20,
  },
  error: { color: "#F87171" },
  kpis: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: 16,
    marginBottom: 30,
  },
  kpi: {
    background: "rgba(255,255,255,0.1)",
    padding: 16,
    borderRadius: 12,
  },
  kpiTitle: { opacity: 0.8, marginBottom: 6 },
  kpiValue: { fontSize: 20, fontWeight: 800 },
  section: {
    marginBottom: 30,
  },
  chart: { marginTop: 10 },
  barRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  barLabel: { width: 90, fontSize: 12, opacity: 0.8 },
  barTrack: {
    flex: 1,
    background: "rgba(255,255,255,0.15)",
    height: 8,
    borderRadius: 4,
  },
  bar: {
    height: "100%",
    background: "#FFD700",
    borderRadius: 4,
  },
  barValue: { width: 40, textAlign: "right" },
  sampleRow: {
    display: "flex",
    justifyContent: "space-between",
    background: "rgba(255,255,255,0.08)",
    padding: 10,
    borderRadius: 8,
    marginBottom: 6,
  },
};