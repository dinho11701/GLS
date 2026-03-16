import React from "react";
import MapView, { Marker, Circle } from "react-native-maps";

export default function MapCustomerNative({ hosts, onSelectHost }) {
  return (
    <MapView style={{ flex: 1 }}>
      {hosts.map((host) => (
        <>
          <Marker
            key={host.id}
            coordinate={{
              latitude: host.lat,
              longitude: host.lng,
            }}
            onPress={() => onSelectHost(host)}
          />

          <Circle
            center={{
              latitude: host.lat,
              longitude: host.lng,
            }}
            radius={host.radiusKm * 1000}
            strokeColor="rgba(0,0,255,0.4)"
            fillColor="rgba(0,0,255,0.1)"
          />
        </>
      ))}
    </MapView>
  );
}