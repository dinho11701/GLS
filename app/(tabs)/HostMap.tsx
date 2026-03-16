//app/tabs/HostMaps.tsx
import React, { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import HostMapNative from "../../src/maps/HostMap";
import {
  fetchPartnerZone,
  savePartnerZone,
} from "../../src/api/partnerZone";

import type { Host } from "../../src/types/host";

export default function HostMapScreen() {
  const [host, setHost] = useState<Host | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await fetchPartnerZone();

        setHost({
          id: data.partnerId,
          name: "Mon entreprise",
          lat: data.center.latitude,
          lng: data.center.longitude,
          radiusKm: data.radiusKm,
          isActive: data.available,
          services: [],
        });
      } catch (err) {
        console.log("No existing zone → creating default");

        // si aucune zone encore créée
        setHost({
          id: "temp",
          name: "Mon entreprise",
          lat: 45.5019,
          lng: -73.5674,
          radiusKm: 10,
          isActive: true,
          services: [],
        });
      }
    };

    load();
  }, []);

  if (!host) {
    return (
      <View style={{ flex: 1, justifyContent: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <HostMapNative
      host={host}
      onSave={async (updated) => {
        await savePartnerZone({
          latitude: updated.lat,
          longitude: updated.lng,
          radiusKm: updated.radiusKm,
          available: updated.isActive ?? true,
        });

        setHost(updated);
      }}
    />
  );
}