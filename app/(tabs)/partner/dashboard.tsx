import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";

const API_BASE = (
  process.env.EXPO_PUBLIC_API_BASE ?? "http://127.0.0.1:5055/api/v1"
).replace(/\/+$/, "");

type GroupBy = "day" | "week" | "month";

export default function PartnerDashboardNative() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [groupBy, setGroupBy] = useState<GroupBy>("day");
  const [data, setData] = useState<any | null>(null);

  /* ----------------------------------
     FETCH STATS
  ---------------------------------- */
  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const token = await AsyncStorage.getItem("idToken");
      if (!token) return;

      const params = new URLSearchParams({ groupBy });

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
  }, [groupBy]);

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
    <ScrollView style={styles.page} contentContainerStyle={{ paddingBottom: 40 }}>
      <Text style={styles.title}>📊 Dashboard</Text>

      {/* GROUP BY */}
      <View style={styles.segment}>
        {(["day", "week", "month"] as GroupBy[]).map((g) => (
          <TouchableOpacity
            key={g}
            onPress={() => setGroupBy(g)}
            style={[
              styles.segmentBtn,
              groupBy === g && styles.segmentBtnActive,
            ]}
          >
            <Text style={styles.segmentText}>
              {g === "day" ? "Jour" : g === "week" ? "Semaine" : "Mois"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading && <ActivityIndicator size="large" color="#FFD700" />}
      {error && <Text style={styles.error}>{error}</Text>}

      {data && (
        <>
          {/* KPIs */}
          <View style={styles.kpis}>
            <Kpi title="💰 Revenus" value={money(data.kpis.revenue_total)} />
            <Kpi title="📅 Réservations" value={data.kpis.reservations_total} />
            <Kpi title="✅ Confirmées" value={data.kpis.reservations_confirmed} />
            <Kpi title="❌ Annulées" value={data.kpis.reservations_cancelled} />
            <Kpi title="⭐ Note" value={`${data.kpis.avg_rating}`} />
          </View>

          {/* CHARTS */}
          <Section title="📈 Revenus">
            <BarChart
              data={data.series.revenueByPeriod.map((x: any) => ({
                label: x.bucket,
                value: x.amount,
              }))}
            />
          </Section>

          <Section title="📊 Réservations par statut">
            {data.series.reservationsByStatus.map((s: any) => (
              <View key={s.status} style={{ marginBottom: 16 }}>
                <Text style={styles.subTitle}>{s.status}</Text>
                <BarChart
                  data={s.data.map((x: any) => ({
                    label: x.bucket,
                    value: x.count,
                  }))}
                />
              </View>
            ))}
          </Section>

          <Section title="⭐ Évaluations">
            <BarChart
              data={Object.entries(data.series.ratings.distribution).map(
                ([k, v]: any) => ({
                  label: `${k}★`,
                  value: v,
                })
              )}
            />
          </Section>
        </>
      )}
    </ScrollView>
  );
}

/* ----------------------------------
   COMPONENTS
---------------------------------- */
function Kpi({ title, value }: { title: string; value: any }) {
  return (
    <View style={styles.kpi}>
      <Text style={styles.kpiTitle}>{title}</Text>
      <Text style={styles.kpiValue}>{value}</Text>
    </View>
  );
}

function Section({ title, children }: any) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function BarChart({ data }: { data: { label: string; value: number }[] }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <View>
      {data.map((d, i) => (
        <View key={i} style={styles.barRow}>
          <Text style={styles.barLabel}>{d.label}</Text>
          <View style={styles.barTrack}>
            <View
              style={[
                styles.bar,
                { width: `${(d.value / max) * 100}%` },
              ]}
            />
          </View>
          <Text style={styles.barValue}>{d.value}</Text>
        </View>
      ))}
    </View>
  );
}

/* ----------------------------------
   STYLES
---------------------------------- */
const styles = StyleSheet.create({
  page: {
    backgroundColor: "#0A0F2C",
    padding: 20,
    flex: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: "900",
    color: "#FFD700",
    marginBottom: 16,
  },
  error: {
    color: "#F87171",
    marginVertical: 10,
  },
  segment: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 12,
    marginBottom: 20,
  },
  segmentBtn: {
    flex: 1,
    padding: 10,
    alignItems: "center",
  },
  segmentBtnActive: {
    backgroundColor: "#FFD700",
    borderRadius: 12,
  },
  segmentText: {
    fontWeight: "700",
    color: "#0A0F2C",
  },
  kpis: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 24,
  },
  kpi: {
    width: "48%",
    backgroundColor: "rgba(255,255,255,0.1)",
    padding: 14,
    borderRadius: 12,
  },
  kpiTitle: {
    opacity: 0.8,
    marginBottom: 4,
    color: "white",
  },
  kpiValue: {
    fontSize: 18,
    fontWeight: "800",
    color: "#FFD700",
  },
  section: {
    marginBottom: 28,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#FFD700",
    marginBottom: 10,
  },
  subTitle: {
    color: "white",
    fontWeight: "700",
    marginBottom: 6,
  },
  barRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  barLabel: {
    width: 70,
    fontSize: 12,
    color: "white",
    opacity: 0.7,
  },
  barTrack: {
    flex: 1,
    height: 8,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 4,
    marginHorizontal: 6,
  },
  bar: {
    height: "100%",
    backgroundColor: "#FFD700",
    borderRadius: 4,
  },
  barValue: {
    width: 30,
    textAlign: "right",
    color: "white",
    fontWeight: "700",
  },
});