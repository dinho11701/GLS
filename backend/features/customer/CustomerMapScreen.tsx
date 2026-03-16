import React, { useState, useMemo } from "react";
import { View, StyleSheet, Platform } from "react-native";

import MapCustomerNative from "@/maps/MapCustomer.native";
import MapCustomerWeb from "@/maps/MapCustomer.web";

import FiltersPanel from "./FiltersPanel";
import HostDetailsSheet from "./HostDetailsSheet.native";
import HostDetailsModal from "./HostDetailsModal.web";

import { getDistanceKm } from "@/utils/geo";
import { Host } from "./types";

type Props = {
  hosts: Host[];
  userLocation: { lat: number; lng: number };
};

export default function CustomerMapScreen({ hosts, userLocation }: Props) {
  const [selectedHost, setSelectedHost] = useState<Host | null>(null);
  const [filters, setFilters] = useState({
    service: "",
    maxDistance: 20,
    minRating: 0,
  });

  const filteredHosts = useMemo(() => {
    return hosts.filter((host) => {
      const distance = getDistanceKm(
        userLocation.lat,
        userLocation.lng,
        host.lat,
        host.lng
      );

      const coversUser = distance <= host.radiusKm;
      const matchesDistance = distance <= filters.maxDistance;
      const matchesRating = host.rating >= filters.minRating;
      const matchesService =
        !filters.service || host.services.includes(filters.service);

      return coversUser && matchesDistance && matchesRating && matchesService;
    });
  }, [hosts, filters, userLocation]);

  const MapComponent =
    Platform.OS === "web" ? MapCustomerWeb : MapCustomerNative;

  const DetailsComponent =
    Platform.OS === "web" ? HostDetailsModal : HostDetailsSheet;

  return (
    <View style={styles.container}>
      <FiltersPanel filters={filters} setFilters={setFilters} />

      <MapComponent
        hosts={filteredHosts}
        onSelectHost={setSelectedHost}
      />

      {selectedHost && (
        <DetailsComponent
          host={selectedHost}
          onClose={() => setSelectedHost(null)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});