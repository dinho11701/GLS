import React, { useRef, useState, useEffect, useCallback } from "react";
import {
  View,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  Text,
  Modal,
  ActivityIndicator,
} from "react-native";
import MapView, { Marker, Circle, Region } from "react-native-maps";
import * as Location from "expo-location";

import MapZoomControls from "../../components/map/MapZoomControls.native";
import HostFilters from "../../components/map/HostFilters.native";

const API_BASE = "http://127.0.0.1:5055/api/v1";


type Service = {
  id: string;
  title: string;
  latitude: number;
  longitude: number;
  radius_km: number;
  available: boolean;
  fee?: number;
  rating?: number;
};

const DEFAULT_REGION: Region = {
  latitude: 45.5019,
  longitude: -73.5674,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};

export default function MapCustomerNative() {
  const mapRef = useRef<MapView>(null);

  const [region, setRegion] = useState(DEFAULT_REGION);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [filters, setFilters] = useState<any>({});
  const [showFilters, setShowFilters] = useState(false);
  const [loading, setLoading] = useState(false);

  /* ===============================
     GPS
  =============================== */

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const coords = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };

      setUserLocation(coords);

      const newRegion = {
        ...coords,
        latitudeDelta: 0.03,
        longitudeDelta: 0.03,
      };

      setRegion(newRegion);
      mapRef.current?.animateToRegion(newRegion, 500);
    })();
  }, []);

  /* ===============================
     FETCH SERVICES
  =============================== */

  useEffect(() => {
    if (!userLocation) return;

    const fetchServices = async () => {
      try {
        setLoading(true);

        const params = new URLSearchParams({
          lat: String(userLocation.latitude),
          lng: String(userLocation.longitude),
        });

        if (filters.category) {
          params.append("category", filters.category.toLowerCase());
        }

        const res = await fetch(`${API_BASE}/customers/services/nearby?${params.toString()}`);
        const data = await res.json();

console.log("API RESPONSE:", data);

if (data.ok) {
  console.log("ITEMS:", data.items);
  setServices(data.items);
}

      } catch (err) {
        console.error("Fetch error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchServices();
  }, [userLocation, filters]);

  /* ===============================
     ZOOM
  =============================== */

  const zoomIn = useCallback(() => {
    const newRegion = {
      ...region,
      latitudeDelta: region.latitudeDelta / 2,
      longitudeDelta: region.longitudeDelta / 2,
    };
    setRegion(newRegion);
    mapRef.current?.animateToRegion(newRegion, 250);
  }, [region]);

  const zoomOut = useCallback(() => {
    const newRegion = {
      ...region,
      latitudeDelta: region.latitudeDelta * 2,
      longitudeDelta: region.longitudeDelta * 2,
    };
    setRegion(newRegion);
    mapRef.current?.animateToRegion(newRegion, 250);
  }, [region]);

  /* ===============================
     RENDER
  =============================== */

  return (
    <View style={styles.container}>

      <TouchableOpacity
        style={styles.filterButton}
        onPress={() => setShowFilters(true)}
      >
        <Text style={{ color: "white", fontWeight: "bold" }}>Filtres</Text>
      </TouchableOpacity>

      {loading && (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color="#FF6B6B" />
        </View>
      )}

      <MapView
        ref={mapRef}
        style={styles.map}
        region={region}
        onRegionChangeComplete={setRegion}
        showsUserLocation
      >
        {userLocation && (
          <Marker coordinate={userLocation} pinColor="blue" />
        )}

        {services.map((svc) => (
          <React.Fragment key={svc.id}>
            <Marker
              coordinate={{
                latitude: svc.latitude,
                longitude: svc.longitude,
              }}
              title={svc.title}
              pinColor="#FF6B6B"
              onPress={() => setSelectedService(svc)}
            />

            {selectedService?.id === svc.id && (
              <Circle
                center={{
                  latitude: svc.latitude,
                  longitude: svc.longitude,
                }}
                radius={svc.radius_km * 1000}
                strokeColor="rgba(255,107,107,0.8)"
                fillColor="rgba(255,107,107,0.2)"
              />
            )}
          </React.Fragment>
        ))}
      </MapView>

      {selectedService && (
        <View style={styles.card}>
          <Text style={styles.title}>{selectedService.title}</Text>
          <Text>⭐ {selectedService.rating ?? 4.5}</Text>
          <Text>À partir de {selectedService.fee ?? 90}$</Text>
        </View>
      )}

      <Modal visible={showFilters} animationType="slide">
        <HostFilters
          onApply={(f) => {
            setFilters(f);
            setShowFilters(false);
          }}
          onReset={() => {
            setFilters({});
            setShowFilters(false);
          }}
        />
      </Modal>

      <MapZoomControls onZoomIn={zoomIn} onZoomOut={zoomOut} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },

  filterButton: {
    position: "absolute",
    top: 60,
    right: 20,
    backgroundColor: "#FF6B6B",
    padding: 12,
    borderRadius: 30,
    zIndex: 999,
  },

  loader: {
    position: "absolute",
    top: "50%",
    alignSelf: "center",
    zIndex: 999,
  },

  card: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "white",
    padding: 16,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    elevation: 10,
  },

  title: {
    fontSize: 18,
    fontWeight: "bold",
  },
});