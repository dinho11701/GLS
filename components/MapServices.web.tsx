import React, { useEffect, useState } from "react";

let MapContainer: any;
let TileLayer: any;
let Marker: any;
let Popup: any;
let L: any;

export default function MapServicesWeb({ services = [] }: { services: any[] }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    (async () => {
      const leaflet = await import("leaflet");
      const reactLeaflet = await import("react-leaflet");

      L = leaflet;
      MapContainer = reactLeaflet.MapContainer;
      TileLayer = reactLeaflet.TileLayer;
      Marker = reactLeaflet.Marker;
      Popup = reactLeaflet.Popup;

      // 🔥 FIX ICONES (CDN)
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl:
          "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl:
          "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl:
          "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      setReady(true);
    })();
  }, []);

  if (!ready) {
    return <div style={{ color: "#FFF" }}>Chargement de la carte…</div>;
  }

  const center =
    services.length > 0
      ? [services[0].lat, services[0].lng]
      : [45.5017, -73.5673]; // Montréal

  return (
    <MapContainer
      center={center}
      zoom={13}
      style={{ height: "100%", width: "100%" }}
      scrollWheelZoom
    >
      <TileLayer
        attribution="© OpenStreetMap"
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {services.map((s) => (
        <Marker key={s.id} position={[s.lat, s.lng]}>
          <Popup>
            <strong>{s.title}</strong>
            <br />
            {s.price} $
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}


/* ================= STYLES ================= */

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    width: "100%",
    height: "100%",
    borderRadius: 20,
    overflow: "hidden",
  },
  map: {
    width: "100%",
    height: "100%",
  },
  popup: {
    fontWeight: 700,
    fontSize: 14,
  },
};
