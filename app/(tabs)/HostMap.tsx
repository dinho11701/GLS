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
          id: data.zone.partner_id,
          name: "Mon entreprise",
          lat: data.zone.latitude,
          lng: data.zone.longitude,
          radiusKm: data.zone.radius_km,
          isActive: data.zone.available,
          services: [],
        });

      } catch (err) {
        console.log("❌ fetchPartnerZone failed:", err);

        // fallback SAFE
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
        try {
          await savePartnerZone({
            latitude: updated.lat,
            longitude: updated.lng,
            radiusKm: updated.radiusKm,
            available: updated.isActive ?? true,
          });

          setHost(updated);

        } catch (err) {
          console.log("❌ Save error:", err);
        }
      }}
    />
  );
}