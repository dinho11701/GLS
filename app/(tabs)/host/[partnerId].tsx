// app/host/[partnerId].tsx
import React, {
  useEffect,
  useMemo,
  useState,
  useRef,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Animated,
  Dimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const RAW_API_BASE =
  process.env.EXPO_PUBLIC_API_BASE ?? 'http://127.0.0.1:5055/api/v1';
const API_BASE = RAW_API_BASE.replace(/\/+$/, '');

type ServiceItem = {
  id: string;
  Service?: string;
  Fee?: number;
  Categorie?: string;
  Activity_Secteur?: string;
  Description?: string;
  Subscribtion?: boolean;
  Subscribtion_Fee?: number;
  partenaire_ID?: string;
  ownerUid?: string;
  createdAt?: any;
  displayCoord?: { lat: number; lng: number } | null;
  ratingAvg?: number | null;
  ratingCount?: number | null;
};

const PALETTE = {
  primary: '#0A0F2C',
  gold: '#FFD700',
  coral: '#FF6B6B',
  white: '#FFFFFF',
  card: 'rgba(15,23,42,0.95)',
};

const { width } = Dimensions.get('window');
const CARD_WIDTH = width * 0.8;

// --- Bouton "Réserver ce service" avec petite animation ---
function ServiceReserveButton({ onPress }: { onPress: () => void }) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    Animated.sequence([
      Animated.timing(scale, {
        toValue: 0.96,
        duration: 80,
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 1,
        duration: 80,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onPress();
    });
  };

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        style={styles.reserveBtn}
        activeOpacity={0.9}
        onPress={handlePress}
      >
        <Text style={styles.reserveText}>Réserver ce service</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

// Même helper que dans AccueilScreen
async function getIdToken() {
  const keys = ['idToken', 'token', 'jwt', 'authToken'];
  for (const k of keys) {
    const v = await AsyncStorage.getItem(k);
    if (v) {
      if (k !== 'idToken') {
        await AsyncStorage.setItem('idToken', v);
      }
      return v;
    }
  }
  return null;
}

export default function HostServicesScreen() {
  const router = useRouter();
  const { partnerId, companyName: companyNameParam } = useLocalSearchParams<{
    partnerId?: string;
    companyName?: string;
  }>();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);

  // Chargement des services de cet hôte
  useEffect(() => {
    if (!partnerId) return;

    const load = async () => {
      try {
        setLoading(true);
        setError(null);

        const idToken = await getIdToken();
        if (!idToken) {
          setError(
            'Veuillez vous connecter pour voir les services de cet hôte.'
          );
          setLoading(false);
          return;
        }

        // Même endpoint que sur l’accueil
        const resp = await fetch(
          `${API_BASE}/customers/services?limit=50&sort=createdAt&dir=desc`,
          {
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${idToken}`,
            },
          }
        );

        const data = await resp.json().catch(() => ({}));

        if (!resp.ok) {
          throw new Error(data?.message || data?.error || 'Erreur serveur');
        }

        const rows: ServiceItem[] = Array.isArray(data.items)
          ? data.items.map((d: any) => ({ id: d.id, ...d }))
          : [];

        const targetPartnerId = String(partnerId);

        // On retrouve les services de cet hôte comme sur l’accueil
        const hostServices = rows.filter(s => {
          const pidRaw =
            s.partenaire_ID ??
            s.ownerUid ??
            (s as any).owner_uid ??
            (s as any).ownerId ??
            null;
          const pid = pidRaw ? String(pidRaw) : '';
          return pid === targetPartnerId;
        });

        setServices(hostServices.length ? hostServices : rows);
        setActiveIndex(0);
      } catch (e: any) {
        console.warn('[HostServicesScreen] load error', e);
        setError(
          e?.message || 'Impossible de charger les services de cet hôte.'
        );
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [partnerId]);

  // Résumé hôte (comme sur l’accueil)
  const hostSummary = useMemo(() => {
    if (!services.length) return null;

    const first = services[0];

    const companyName =
      (companyNameParam as string) ||
      first.Activity_Secteur ||
      first.Service ||
      'Entreprise';

    let ratingSum = 0;
    let ratingCountTotal = 0;
    services.forEach(s => {
      if (
        typeof s.ratingAvg === 'number' &&
        typeof s.ratingCount === 'number' &&
        s.ratingCount > 0
      ) {
        ratingSum += s.ratingAvg * s.ratingCount;
        ratingCountTotal += s.ratingCount;
      }
    });
    const ratingAvg =
      ratingCountTotal > 0 ? ratingSum / ratingCountTotal : null;

    const fees = services
      .map(s => (typeof s.Fee === 'number' ? s.Fee : null))
      .filter((f): f is number => f != null);

    let priceMin: number | null = null;
    let priceMax: number | null = null;
    if (fees.length) {
      priceMin = Math.min(...fees);
      priceMax = Math.max(...fees);
    }

    return {
      companyName,
      ratingAvg,
      ratingCount: ratingCountTotal,
      priceMin,
      priceMax,
    };
  }, [services, companyNameParam]);

  const handleReserve = (serviceId: string) => {
    // Ici tu plugeras ton vrai flow de réservation
    console.log('Réserver service', serviceId);
  };

  const handleMomentumScrollEnd = (
    event: NativeSyntheticEvent<NativeScrollEvent>
  ) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / width);
    setActiveIndex(index);
  };

  return (
    <View style={styles.container}>
      {/* Header simple type Airbnb */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          activeOpacity={0.8}
        >
          <Ionicons name="chevron-back" size={22} color={PALETTE.white} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {hostSummary?.companyName || companyNameParam || 'Profil hôte'}
          </Text>
          {!!services.length && (
            <Text style={styles.headerSubtitle}>
              {services.length} service
              {services.length > 1 ? 's' : ''}
              {' proposés'}
            </Text>
          )}
        </View>

        <View style={{ width: 32 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Bandeau récap hôte */}
        {hostSummary && (
          <View style={styles.hostCard}>
            <View style={styles.hostCardRow}>
              <Text style={styles.hostName}>{hostSummary.companyName}</Text>

              {/* Petit badge */}
              {!!services.length && (
                <View style={styles.hostBadge}>
                  <Ionicons name="briefcase-outline" size={13} color="#0F172A" />
                  <Text style={styles.hostBadgeText}>
                    {services.length} service
                    {services.length > 1 ? 's' : ''}
                  </Text>
                </View>
              )}
            </View>

            {/* Note moyenne */}
            {hostSummary.ratingAvg != null &&
              hostSummary.ratingCount > 0 && (
                <View style={styles.ratingRow}>
                  <Ionicons name="star" size={16} color="#FBBF24" />
                  <Text style={styles.ratingText}>
                    {hostSummary.ratingAvg.toFixed(1)}
                  </Text>
                  <Text style={styles.ratingCount}>
                    {` · ${hostSummary.ratingCount} avis`}
                  </Text>
                </View>
              )}

            {/* Fourchette de prix */}
            {hostSummary.priceMin != null && (
              <Text style={styles.priceRange}>
                {hostSummary.priceMax != null &&
                hostSummary.priceMax !== hostSummary.priceMin
                  ? `Tarifs : ${hostSummary.priceMin.toFixed(
                      0
                    )}$ – ${hostSummary.priceMax.toFixed(0)}$`
                  : `Tarifs : à partir de ${hostSummary.priceMin.toFixed(0)}$`}
              </Text>
            )}
          </View>
        )}

        {loading && (
          <View style={{ paddingVertical: 20, alignItems: 'center' }}>
            <ActivityIndicator color={PALETTE.gold} />
          </View>
        )}

        {!!error && <Text style={styles.errorText}>{error}</Text>}

        {!loading && !error && !services.length && (
          <Text style={styles.emptyText}>
            Aucun service trouvé pour cet hôte pour le moment.
          </Text>
        )}

        {/* Carousel des services façon Airbnb */}
        {!!services.length && (
          <>
            <Text style={styles.servicesTitle}>Services proposés</Text>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              pagingEnabled
              snapToAlignment="center"
              decelerationRate="fast"
              contentContainerStyle={styles.carouselContent}
              onMomentumScrollEnd={handleMomentumScrollEnd}
            >
              {services.map((service, index) => {
                const isActive = index === activeIndex;
                return (
                  <View
                    key={service.id}
                    style={[
                      styles.serviceCard,
                      isActive && styles.serviceCardActive,
                    ]}
                  >
                    {/* En-tête service */}
                    <View style={styles.serviceHeaderRow}>
                      <Text style={styles.serviceName} numberOfLines={1}>
                        {service.Service || 'Service'}
                      </Text>

                      {typeof service.Fee === 'number' && (
                        <Text style={styles.servicePrice}>
                          {service.Fee.toFixed(0)} $
                        </Text>
                      )}
                    </View>

                    {/* Description */}
                    {!!service.Description && (
                      <Text
                        style={styles.serviceDescription}
                        numberOfLines={3}
                      >
                        {service.Description}
                      </Text>
                    )}

                    {/* Meta (catégorie / secteur) */}
                    <View style={styles.serviceMetaRow}>
                      {service.Categorie && (
                        <Text style={styles.serviceMeta}>
                          {service.Categorie}
                        </Text>
                      )}
                      {service.Activity_Secteur && (
                        <Text style={styles.serviceMeta}>
                          {service.Activity_Secteur}
                        </Text>
                      )}
                    </View>

                    {/* Bouton réserver avec animation */}
                    <View style={{ marginTop: 14 }}>
                      <ServiceReserveButton
                        onPress={() => handleReserve(service.id)}
                      />
                    </View>
                  </View>
                );
              })}
            </ScrollView>

            {/* Petits points d’indication du carousel */}
            {services.length > 1 && (
              <View style={styles.dotsRow}>
                {services.map((_, index) => (
                  <View
                    key={index}
                    style={[
                      styles.dot,
                      index === activeIndex && styles.dotActive,
                    ]}
                  />
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: PALETTE.primary },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 52,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  backBtn: {
    width: 32,
    height: 32,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(248,250,252,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    color: PALETTE.white,
    fontSize: 17,
    fontWeight: '700',
  },
  headerSubtitle: {
    color: 'rgba(209,213,219,0.9)',
    fontSize: 12,
    marginTop: 2,
  },

  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },

  hostCard: {
    backgroundColor: PALETTE.card,
    borderRadius: 18,
    padding: 14,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.45)',
  },
  hostCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  hostName: {
    color: PALETTE.white,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
    flex: 1,
    paddingRight: 8,
  },
  hostBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#FACC15',
    gap: 4,
  },
  hostBadgeText: {
    color: '#0F172A',
    fontSize: 11,
    fontWeight: '700',
  },

  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  ratingText: {
    color: '#FBBF24',
    fontWeight: '700',
    marginLeft: 4,
  },
  ratingCount: {
    color: 'rgba(209,213,219,0.9)',
    marginLeft: 4,
    fontSize: 12,
  },
  priceRange: {
    color: 'rgba(248,250,252,0.9)',
    marginTop: 8,
    fontSize: 13,
  },

  errorText: {
    color: PALETTE.coral,
    marginVertical: 8,
    textAlign: 'center',
  },
  emptyText: {
    color: 'rgba(248,250,252,0.9)',
    marginTop: 10,
    textAlign: 'center',
    fontSize: 13,
  },

  servicesTitle: {
    color: PALETTE.white,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 10,
  },
  carouselContent: {
    paddingVertical: 6,
    paddingBottom: 20,
    paddingRight: 16,
  },

  serviceCard: {
    width: CARD_WIDTH,
    backgroundColor: PALETTE.card,
    borderRadius: 18,
    padding: 14,
    marginRight: 12,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.45)',
    transform: [{ scale: 0.96 }],
  },
  serviceCardActive: {
    borderColor: '#FACC15',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
    transform: [{ scale: 1 }],
  },
  serviceHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  serviceName: {
    color: PALETTE.white,
    fontSize: 15,
    fontWeight: '700',
    flex: 1,
    paddingRight: 8,
  },
  servicePrice: {
    color: '#FACC15',
    fontSize: 14,
    fontWeight: '700',
  },
  serviceDescription: {
    color: 'rgba(226,232,240,0.95)',
    fontSize: 13,
    marginTop: 6,
  },
  serviceMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  serviceMeta: {
    color: 'rgba(148,163,184,0.95)',
    fontSize: 12,
  },

  reserveBtn: {
    backgroundColor: '#F26C5E',
    borderRadius: 999,
    paddingVertical: 10,
    alignItems: 'center',
  },
  reserveText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },

  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: -6,
    marginBottom: 4,
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(148,163,184,0.6)',
  },
  dotActive: {
    width: 14,
    backgroundColor: '#FACC15',
  },
});
