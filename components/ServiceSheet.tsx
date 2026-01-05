// components/ServiceSheet.tsx
import React, { useCallback, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

type HostSummary = {
  companyName: string;
  serviceTypes: string[];
  ratingAvg: number | null;
  ratingCount: number;
  priceMin: number | null;
  priceMax: number | null;
};

type Service = {
  id: string;
  Service?: string;
  Fee?: number;
  Categorie?: string;
  Description?: string;
  partenaire_ID?: string;
  ownerUid?: string;
};

type Props = {
  visible: boolean;
  hostSummary: HostSummary | null;
  services: Service[];
  partnerId?: string | null;

  // 🔥 Nouveaux props
  serviceId: string | null;
  selectedDateISO: string | null;

  onClose: () => void;
};

export default function ServiceSheet({
  visible,
  hostSummary,
  services,
  partnerId,
  serviceId,
  selectedDateISO,
  onClose,
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  if (!hostSummary) return null;

  const {
    companyName,
    serviceTypes,
    ratingAvg,
    ratingCount,
    priceMin,
    priceMax,
  } = hostSummary;

  const effectivePartnerId =
    partnerId ||
    services[0]?.partenaire_ID ||
    services[0]?.ownerUid ||
    null;

  /** ----------------------
   * 🔥 Réserver maintenant
   * ---------------------- */
  const handleBook = useCallback(async () => {
    if (!serviceId) {
      alert("Service introuvable.");
      return;
    }
    if (!selectedDateISO) {
      alert("Veuillez sélectionner une date.");
      return;
    }

    try {
      setLoading(true);

      const idToken =
        (await AsyncStorage.getItem('idToken')) ||
        (await AsyncStorage.getItem('token'));

      if (!idToken) {
        alert("Veuillez vous connecter.");
        setLoading(false);
        return;
      }

      const resp = await fetch(
        `${process.env.EXPO_PUBLIC_API_BASE}/customers/reservations`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${idToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            serviceId,
            dateISO: selectedDateISO,
          }),
        }
      );

      const data = await resp.json();

      if (!resp.ok) {
        alert(data.error || "Impossible de réserver.");
        setLoading(false);
        return;
      }

      // 🔥 Succès → va vers la page de confirmation
      router.push({
        pathname: "/booking/confirm",
        params: {
          reservationId: data.reservationId,
        },
      });

      onClose();
    } catch (e) {
      console.error("[BOOK][ERR]", e);
      alert("Erreur lors de la réservation.");
    } finally {
      setLoading(false);
    }
  }, [serviceId, selectedDateISO]);

  /** ----------------------
   * 🔗 Voir profil complet
   * ---------------------- */
  const handleGoToProfile = () => {
    if (!effectivePartnerId) return;

    router.push({
      pathname: "/host/[partnerId]",
      params: {
        partnerId: String(effectivePartnerId),
        companyName,
      },
    });

    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.backdrop}>
        <TouchableOpacity
          style={{ flex: 1 }}
          activeOpacity={1}
          onPress={onClose}
        />
        <View style={styles.sheet}>
          <View style={styles.grabber} />

          <View style={styles.headerRow}>
            <Text style={styles.title} numberOfLines={2}>
              {companyName}
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.close}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            style={{ maxHeight: 360 }}
            showsVerticalScrollIndicator={false}
          >
            {!!serviceTypes.length && (
              <Text style={styles.metaItem}>
                Services offerts · {serviceTypes.join(" · ")}
              </Text>
            )}

            {ratingAvg != null && ratingCount > 0 && (
              <View style={styles.ratingRow}>
                <Text style={styles.ratingText}>{ratingAvg.toFixed(1)} ★</Text>
                <Text style={styles.ratingCount}>({ratingCount} avis)</Text>
              </View>
            )}

            {priceMin != null && (
              <Text style={[styles.metaItem, { marginTop: 8 }]}>
                Tarif indicatif :
                {priceMax && priceMax !== priceMin
                  ? ` ${priceMin}$ – ${priceMax}$`
                  : ` à partir de ${priceMin}$`}
              </Text>
            )}

            {!!services.length && (
              <>
                <Text style={styles.sectionTitle}>Services proposés</Text>
                {services.map((s) => (
                  <View key={s.id} style={styles.serviceRow}>
                    <Text style={styles.serviceName}>
                      {s.Service || "Service"}
                    </Text>
                    {typeof s.Fee === "number" && (
                      <Text style={styles.serviceFee}>{s.Fee} $</Text>
                    )}
                  </View>
                ))}
              </>
            )}
          </ScrollView>

          {/* ----------- CTA Zone ----------- */}
          <View style={styles.actionsRow}>
            {/* 🔥 Réserver */}
            <TouchableOpacity
              style={styles.bookCta}
              activeOpacity={0.9}
              onPress={handleBook}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#111" />
              ) : (
                <Text style={styles.bookCtaText}>Réserver maintenant</Text>
              )}
            </TouchableOpacity>

            {/* Profil */}
            <TouchableOpacity
              style={styles.secondaryCta}
              onPress={handleGoToProfile}
            >
              <Text style={styles.secondaryCtaText}>
                Voir le profil complet
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#0B1220",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 28,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
  },
  grabber: {
    alignSelf: "center",
    width: 46,
    height: 5,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.25)",
    marginBottom: 8,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
    flex: 1,
    paddingRight: 12,
  },
  close: { color: "#FFFFFF", fontSize: 20 },

  metaItem: {
    color: "#E9EEF8",
    fontSize: 13,
    opacity: 0.9,
    marginTop: 4,
  },

  ratingRow: { flexDirection: "row", marginTop: 6, alignItems: "center" },
  ratingText: { color: "#FBBF24", fontWeight: "700", fontSize: 14 },
  ratingCount: { color: "#D1D5DB", fontSize: 13, marginLeft: 4 },

  sectionTitle: {
    color: "#FFC857",
    fontSize: 14,
    fontWeight: "700",
    marginTop: 16,
    marginBottom: 6,
  },
  serviceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  serviceName: { color: "#E9EEF8", fontSize: 13 },
  serviceFee: { color: "#FACC15", fontSize: 13, fontWeight: "700" },

  actionsRow: { marginTop: 18, gap: 10 },

  bookCta: {
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: "#FFD700",
    alignItems: "center",
  },
  bookCtaText: {
    color: "#111827",
    fontSize: 14,
    fontWeight: "700",
  },

  secondaryCta: {
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
  },
  secondaryCtaText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
});
