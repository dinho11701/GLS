import React, { useState, useMemo } from "react";
import { View, StyleSheet, Platform, Text } from "react-native";

import { getDistanceKm } from "@/utils/geo";
import { Host } from "./types";

import MapCustomerNative from "./MapCustomerNative";
import MapCustomerWeb from "./MapCustomerHere.web";

import HostPreviewCard from "../../../components/map/HostPreviewCard";
import FiltersPanel from "./FiltersPanel";
import { useRouter } from "expo-router";

type Props = {
  hosts: Host[];
  userLocation: { lat: number; lng: number };
};

export default function CustomerMapScreen({ hosts, userLocation }: Props) {
  const router = useRouter();

  const [selectedHost, setSelectedHost] = useState<Host | null>(null);
  const [showServicesModal, setShowServicesModal] = useState(false);

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
        !filters.service || host.services?.includes(filters.service);

      return coversUser && matchesDistance && matchesRating && matchesService;
    });
  }, [hosts, filters, userLocation]);

  return (
    <View style={styles.container}>
      {/* MAP */}
      {Platform.OS === "web" ? (
        <MapCustomerWeb
          hosts={filteredHosts}
          onSelectHost={(host: Host | null) => {
            console.log("HOST SELECTED", host);
            setSelectedHost(host);
          }}
        />
      ) : (
        <MapCustomerNative
          hosts={filteredHosts}
          onSelectHost={(host: Host | null) => {
            console.log("HOST SELECTED", host);
            setSelectedHost(host);
          }}
        />
      )}

      {/* TEST CARD */}
      {selectedHost && (
        <View
          style={{
            position: "absolute",
            bottom: 100,
            left: 20,
            right: 20,
            backgroundColor: "red",
            padding: 20,
            zIndex: 999,
          }}
        >
          <Text style={{ color: "white" }}>
            TEST CARD: {selectedHost.name}
          </Text>
        </View>
      )}

      {/* FILTERS */}
      <View style={styles.filtersWrapper}>
        <FiltersPanel filters={filters} setFilters={setFilters} />
      </View>

      {/* PREVIEW CARD */}
      {selectedHost && !showServicesModal && (
        <HostPreviewCard
          host={selectedHost}
          onViewProfile={() => {
            router.push({
              pathname: "/partner/[id]",
              params: { id: selectedHost.id },
            });
          }}
          onBook={() => {
            setShowServicesModal(true);
          }}
          onClose={() => setSelectedHost(null)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  filtersWrapper: {
    position: "absolute",
    top: 60,
    alignSelf: "center",
    width: "90%",
    zIndex: 20,
  },
});