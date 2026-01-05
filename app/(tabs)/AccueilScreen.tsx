// app/(tabs)/AccueilScreen.tsx

import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
} from "react-native";

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";

import ServiceSheet from "../../components/ServiceSheet";
import BookingDateFilter from "../../components/BookingDateFilter";

const RAW_API_BASE =
  process.env.EXPO_PUBLIC_API_BASE ?? "http://127.0.0.1:5055/api/v1";
const API_BASE = RAW_API_BASE.replace(/\/+$/, "");

type Region = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};

const PALETTE = {
  primary: "#0A0F2C",
  gold: "#FFD700",
  coral: "#FF6B6B",
  white: "#FFFFFF",
};

const TILE_BG = "#0F1B3D";

/* ------------------------------------------------------------------
   🔥 AccueilScreen
-------------------------------------------------------------------*/
export default function AccueilScreen() {

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [region, setRegion] = useState<Region>({
    latitude: 45.5,
    longitude: -73.56,
    latitudeDelta: 0.1,
    longitudeDelta: 0.1,
  });

  const [services, setServices] = useState<any[]>([]);
  const [selectedServiceId, setSelectedServiceId] = useState<number | null>(null);
  const [selectedPartnerId, setSelectedPartnerId] = useState<number | null>(null);
  const [selectedHostServices, setSelectedHostServices] = useState<any[]>([]);
  const [selectedHostSummary, setSelectedHostSummary] = useState<any>(null);

  const selectedDateISO = selectedDate.toISOString().slice(0, 10);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.greeting}>Bonjour</Text>
        <Text style={styles.subtitle}>Découvrez les services autour de vous.</Text>

        <BookingDateFilter
          selectedDate={selectedDate}
          onChangeDate={setSelectedDate}
        />

        <Text style={styles.sectionTitle}>Services près de vous</Text>

        {/* 🌍 MAP PLACEHOLDER */}
        <View style={styles.mapCard}>
          <View style={styles.webMapPlaceholder}>
            <Text style={styles.webMapText}>🗺️ La carte est temporairement désactivée.</Text>
            <Text style={[styles.webMapText, { fontSize: 14 }]}>
              (PriceMap sera réactivé plus tard)
            </Text>
          </View>
        </View>

        {/* 📄 LISTE DES SERVICES */}
        <View style={{ marginTop: 20 }}>
          {services.map((svc) => {
            const total = svc.instancesTotal ?? svc.Availability?.instances ?? 1;
            const booked = svc.instancesBooked ?? 0;
            const isFull = booked >= total;

            return (
              <TouchableOpacity
                key={svc.id}
                disabled={isFull}
                activeOpacity={isFull ? 1 : 0.6}
                onPress={() => {
                  setSelectedServiceId(svc.id);
                  setSelectedPartnerId(svc.partnerId);
                }}
                style={[styles.serviceCard, isFull && styles.serviceCardDisabled]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.serviceTitle, isFull && { color: "#999" }]}>
                    {svc.Service}
                  </Text>

                  <Text style={[styles.serviceCategory, isFull && { color: "#777" }]}>
                    {svc.Categorie || "Service"}
                  </Text>

                  <Text style={[styles.serviceFee, isFull && { color: "#aaa" }]}>
                    {svc.Fee}$ / service
                  </Text>

                  {isFull && <Text style={styles.fullBadge}>Complet pour cette date</Text>}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      <ServiceSheet
        visible={!!selectedServiceId && !!selectedPartnerId}
        onClose={() => {
          setSelectedServiceId(null);
          setSelectedPartnerId(null);
        }}
        hostSummary={selectedHostSummary}
        services={selectedHostServices}
        partnerId={selectedPartnerId}
        serviceId={selectedServiceId}
        selectedDateISO={selectedDateISO}
      />
    </View>
  );
}

/* -------------------------------- STYLES ------------------------------- */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: PALETTE.primary },
  scrollContent: { paddingHorizontal: 20, paddingTop: 60, paddingBottom: 100 },

  greeting: { fontSize: 32, fontWeight: "800", color: PALETTE.white },
  subtitle: { color: "rgba(255,255,255,0.8)", fontSize: 15, marginBottom: 16 },
  sectionTitle: { color: PALETTE.gold, fontSize: 20, fontWeight: "700", marginVertical: 12 },

  mapCard: { height: 360, borderRadius: 24, backgroundColor: TILE_BG },
  webMapPlaceholder: {
    flex: 1, justifyContent: "center", alignItems: "center", borderRadius: 24,
  },
  webMapText: { color: "#fff", fontSize: 16, opacity: 0.8, textAlign: "center" },

  serviceCard: { backgroundColor: "#FFF", padding: 16, borderRadius: 16, marginBottom: 12 },
  serviceCardDisabled: { backgroundColor: "#E6E6E6", opacity: 0.6 },
  serviceTitle: { fontSize: 16, fontWeight: "700", color: "#0B1220" },
  serviceCategory: { marginTop: 4, color: "#6B7280" },
  serviceFee: { marginTop: 6, color: "#0B1220", fontSize: 15, fontWeight: "600" },
  fullBadge: {
    marginTop: 8, backgroundColor: "#444", color: "#FFF",
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, fontSize: 11,
  },
});
