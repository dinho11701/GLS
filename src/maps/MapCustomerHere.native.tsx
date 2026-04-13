import React, { useRef, useState, useEffect, useCallback } from "react";
import {
  View,
  StyleSheet,
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

const DEFAULT_REGION: Region = {
  latitude: 45.5019,
  longitude: -73.5674,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};

export default function MapCustomerNative({ hosts = [], onSelectHost }) {

  const mapRef = useRef<MapView>(null);

  const [region, setRegion] = useState(DEFAULT_REGION);
  const [userLocation, setUserLocation] = useState(null);
  const [services, setServices] = useState([]); // 🔥 fallback
  const [filters, setFilters] = useState({});
  const [showFilters, setShowFilters] = useState(false);
  const [loading, setLoading] = useState(false);

  console.log("HOSTS LENGTH:", hosts.length);

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
     🔥 FETCH NEARBY (IMPORTANT)
  =============================== */

  useEffect(() => {
    if (!userLocation) return;

    setLoading(true);

    fetch(
      `${API_BASE}/customers/services/nearby?lat=${userLocation.latitude}&lng=${userLocation.longitude}`
    )
      .then(res => res.json())
      .then(data => {
        console.log("NEARBY DATA:", data.items);
        setServices(data.items || []);
      })
      .catch(err => console.log("nearby error", err))
      .finally(() => setLoading(false));

  }, [userLocation]);

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
     🔥 DATA SOURCE (IMPORTANT)
  =============================== */

  const dataToUse = services;

  console.log("FINAL DATA LENGTH:", dataToUse.length);

  /* ===============================
     RENDER
  =============================== */

  return (
    <View style={styles.container}>

      {/* FILTER BUTTON */}
      <TouchableOpacity
        style={styles.filterButton}
        onPress={() => setShowFilters(true)}
      >
        <Text style={{ color: "white", fontWeight: "bold" }}>Filtres</Text>
      </TouchableOpacity>

      {/* LOADER */}
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
        {/* USER */}
        {userLocation && (
          <Marker coordinate={userLocation} pinColor="blue" />
        )}

        {/* 🔥 HOSTS / SERVICES */}
{dataToUse.map((item) => {
  const lat = item.lat ?? item.latitude;
  const lng = item.lng ?? item.longitude;

  if (!lat || !lng) return null;

  // 🔥 IMPORTANT
  const distance = item.distance_km ?? 999;

  // 🔥 seuil (10km)
  const isNearby = distance <= 10;

  return (
    <React.Fragment key={item.id}>
      
      {/* 🔴 PIN */}
      <Marker
        coordinate={{ latitude: lat, longitude: lng }}
        title={item.name || item.title}
        pinColor={isNearby ? "#FF6B6B" : "#999"} // 🔥 DIFFÉRENCE
        onPress={() => onSelectHost?.(item)}
      />

      {/* 🔵 CERCLE UNIQUEMENT SI PROCHE */}
      {isNearby && (
        <Circle
          center={{ latitude: lat, longitude: lng }}
          radius={(item.radiusKm || item.radius_km || 5) * 1000}
          strokeColor="rgba(255,107,107,0.8)"
          fillColor="rgba(255,107,107,0.2)"
        />
      )}

    </React.Fragment>
  );
})}
      </MapView>

      {/* FILTER MODAL */}
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
});