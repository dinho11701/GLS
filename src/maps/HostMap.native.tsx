// src/maps/HostMap.native.tsx

import React, { useState, useEffect, useRef } from "react";
import { View, StyleSheet, Text, TouchableOpacity, Alert } from "react-native";
import MapView, {
  Marker,
  Circle,
  Region,
  MapPressEvent,
} from "react-native-maps";

import HostRadiusSlider from "../../components/host/HostRadiusSlider.native";
import HostAvailabilityToggle from "../../components/host/HostAvailabilityToggle.native";

import type { Host } from "../../types/host";

type Props = {
  host?: Host;
  onSave?: (updatedHost: Host) => Promise<void>; // 🔥 backend ready
};

export default function HostMapNative({ host, onSave }: Props) {
  const mapRef = useRef<MapView>(null);

  if (!host) return <View style={{ flex: 1 }} />;

  const [location, setLocation] = useState({
    latitude: host.lat,
    longitude: host.lng,
  });

  const [radiusKm, setRadiusKm] = useState(host.radiusKm);
  const [isActive, setIsActive] = useState(host.isActive ?? true);

  useEffect(() => {
    setLocation({
      latitude: host.lat,
      longitude: host.lng,
    });
    setRadiusKm(host.radiusKm);
    setIsActive(host.isActive ?? true);
  }, [host]);

  // 🔥 Zoom automatique selon rayon
  useEffect(() => {
    if (!mapRef.current) return;

    const delta = radiusKm / 100; // Ajuste sensibilité zoom
    const region: Region = {
      latitude: location.latitude,
      longitude: location.longitude,
      latitudeDelta: delta,
      longitudeDelta: delta,
    };

    mapRef.current.animateToRegion(region, 400);
  }, [radiusKm, location]);

  const handleMapPress = (e: MapPressEvent) => {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    setLocation({ latitude, longitude });
  };

  const handleMarkerDrag = (e: MapPressEvent) => {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    setLocation({ latitude, longitude });
  };

  const handleSave = async () => {
    const updatedHost: Host = {
      ...host,
  lat: location.latitude,
  lng: location.longitude,
      radiusKm,
      isActive,
    };

    try {
      await onSave?.(updatedHost);
      Alert.alert("Succès", "Zone d’activité enregistrée ✅");
    } catch (err) {
      Alert.alert("Erreur", "Impossible d’enregistrer");
    }
  };

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        onPress={handleMapPress}
      >
        {/* 🔥 Marker draggable */}
        <Marker
          coordinate={location}
          title={host.name}
          draggable
          onDragEnd={handleMarkerDrag}
        />

        {/* 🔥 Cercle dynamique */}
        <Circle
          center={location}
          radius={radiusKm * 1000}
          strokeColor={
            isActive
              ? "rgba(255,107,107,0.9)"
              : "rgba(180,180,180,0.6)"
          }
          fillColor={
            isActive
              ? "rgba(255,107,107,0.25)"
              : "rgba(180,180,180,0.15)"
          }
        />
      </MapView>

      {/* 🔥 Slider */}
      <HostRadiusSlider value={radiusKm} onChange={setRadiusKm} />

      {/* 🔥 Switch dispo */}
      <HostAvailabilityToggle
        isActive={isActive}
        onToggle={() => setIsActive(!isActive)}
      />

      {/* 🔥 Bouton save */}
      <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
        <Text style={styles.saveText}>
          Enregistrer mon rayon d’activité
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },

  saveBtn: {
    position: "absolute",
    bottom: 40,
    alignSelf: "center",
    backgroundColor: "#FF6B6B",
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 30,
    elevation: 6,
  },

  saveText: {
    color: "white",
    fontWeight: "bold",
    fontSize: 14,
  },
});