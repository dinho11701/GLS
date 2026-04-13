import React, { useEffect, useRef, useState } from "react";

import MapZoomControls from "../../components/map/MapZoomControls.web";
import HostFilters from "../../components/map/HostFilters.web";
import HostPreviewCard from "../../components/map/HostPreviewCard";
import HostDetailsModal from "../features/customer/HostDetailsModal.web";


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

type Props = {
  onSelectHost?: (host: any) => void;
};

export default function MapCustomerWeb({ onSelectHost }: Props) {

  const [selectedHostForBooking, setSelectedHostForBooking] = useState<any>(null);
  const [internalSelectedHost, setInternalSelectedHost] = useState<any>(null);

  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const markersRef = useRef<any[]>([]);

  const [services, setServices] = useState<Service[]>([]);
  const [userLocation, setUserLocation] = useState<any>(null);
  const [filters, setFilters] = useState<any>({});
  const [showFilters, setShowFilters] = useState(false);
  const [loading, setLoading] = useState(false);

  /* ===============================
     INIT MAP
  =============================== */
  useEffect(() => {
    const loadScript = (src: string) =>
      new Promise((resolve) => {
        const script = document.createElement("script");
        script.src = src;
        script.async = true;
        script.onload = resolve;
        document.body.appendChild(script);
      });

    const init = async () => {
      if (!(window as any).H) {
        await loadScript("https://js.api.here.com/v3/3.1/mapsjs-core.js");
        await loadScript("https://js.api.here.com/v3/3.1/mapsjs-service.js");
        await loadScript("https://js.api.here.com/v3/3.1/mapsjs-mapevents.js");
        await loadScript("https://js.api.here.com/v3/3.1/mapsjs-ui.js");

        const css = document.createElement("link");
        css.rel = "stylesheet";
        css.href = "https://js.api.here.com/v3/3.1/mapsjs-ui.css";
        document.head.appendChild(css);
      }

      const H = (window as any).H;

      const platform = new H.service.Platform({
        apikey: process.env.EXPO_PUBLIC_HERE_API_KEY,
      });

      const map = new H.Map(
        mapRef.current,
        platform.createDefaultLayers().vector.normal.map,
        {
          zoom: 12,
          center: { lat: 45.5019, lng: -73.5674 },
        }
      );

      new H.mapevents.Behavior(new H.mapevents.MapEvents(map));
      mapInstance.current = map;
    };

    init();
  }, []);

  /* ===============================
     GPS
  =============================== */
  useEffect(() => {
    if (!mapInstance.current) return;

    const H = (window as any).H;

    navigator.geolocation.getCurrentPosition((pos) => {
      const coords = {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      };

      setUserLocation(coords);

      const marker = new H.map.Marker({
        lat: coords.latitude,
        lng: coords.longitude,
      });

      mapInstance.current.addObject(marker);
    });
  }, [mapInstance.current]);

  /* ===============================
     FETCH
  =============================== */
  useEffect(() => {
    if (!userLocation) return;

    const fetchServices = async () => {
      setLoading(true);

      try {
        const params = new URLSearchParams({
          lat: String(userLocation.latitude),
          lng: String(userLocation.longitude),
        });

        const res = await fetch(
          `${API_BASE}/customers/services/nearby?${params}`
        );

        const data = await res.json();

        if (data.ok) {
          setServices(data.items);
          renderMarkers(data.items);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchServices();
  }, [userLocation, filters]);

  /* ===============================
     MARKERS
  =============================== */
  const renderMarkers = (items: Service[]) => {
    if (!mapInstance.current) return;

    const H = (window as any).H;

    markersRef.current.forEach((m) =>
      mapInstance.current.removeObject(m)
    );

    markersRef.current = [];

    items.forEach((svc) => {
      const marker = new H.map.Marker({
        lat: svc.latitude,
        lng: svc.longitude,
      });

      marker.addEventListener("pointerdown", () => {
        const hostData = {
          id: svc.id,
          name: svc.title,
          lat: svc.latitude,
          lng: svc.longitude,
          rating: svc.rating || 0,
	  services: [svc.title],
        };

        if (onSelectHost) {
          onSelectHost(hostData);
        } else {
          setInternalSelectedHost(hostData);
        }
      });

      mapInstance.current.addObject(marker);
      markersRef.current.push(marker);
    });
  };

  /* ===============================
     UI
  =============================== */
  return (
    <div style={styles.container}>
      <div ref={mapRef} style={styles.map} />

      {/* 🔥 BOUTON FILTRE */}
      <button
        style={styles.filterButton}
        onClick={() => setShowFilters(true)}
      >
        Filtres
      </button>

      {/* 🔥 MODAL FILTRE */}
      {showFilters && (
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
      )}

      {/* 🔥 CARD */}
      {internalSelectedHost && (
  <HostPreviewCard
    host={internalSelectedHost}

    onViewProfile={() => {
      console.log("VIEW PROFILE", internalSelectedHost.id);
    }}

    onBook={() => {
      console.log("BOOK", internalSelectedHost.id);
      setSelectedHostForBooking(internalSelectedHost);
      setInternalSelectedHost(null);
    }}

    onClose={() => setInternalSelectedHost(null)}


  />
)}


{/* 🔥 MODAL SERVICES (IMPORTANT → OUTSIDE) */}
{selectedHostForBooking && (
  <HostDetailsModal
    host={selectedHostForBooking}
    onClose={() => setSelectedHostForBooking(null)}
  />
)}
      {loading && <div style={styles.loader}>Chargement...</div>}

      <MapZoomControls />
    </div>
  );
}

const styles: any = {
  container: {
    width: "100%",
    height: "100vh",
    position: "relative",
  },
  map: {
    width: "100%",
    height: "100%",
  },
  filterButton: {
    position: "absolute",
    top: 60,
    right: 20,
    background: "#FF6B6B",
    padding: "12px",
    borderRadius: 30,
    color: "#fff",
    border: "none",
    fontWeight: "bold",
    cursor: "pointer",
    zIndex: 9999,
  },
  loader: {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: "translate(-50%,-50%)",
    background: "#fff",
    padding: "10px 16px",
    borderRadius: 10,
  },
  card: {
    position: "absolute",
    bottom: 20,
    left: 16,
    right: 16,
    background: "#fff",
    padding: 16,
    borderRadius: 12,
    zIndex: 9999,
    boxShadow: "0px 4px 20px rgba(0,0,0,0.2)",
  },
  close: {
    marginTop: 10,
    color: "blue",
    cursor: "pointer",
  },
};