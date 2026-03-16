import React, { useEffect, useRef, useState } from "react";

import HostRadiusSlider from "../../components/host/HostRadiusSlider";
import HostAvailabilityToggle from "../../components/host/HostAvailabilityToggle";

import type { Host } from "../../types/host";

/* HERE MAP TYPE */
declare const H: any;

type Props = {
  host?: Host;
  onSave?: (updatedHost: Host) => Promise<void>;
};

export default function HostMapWeb({ host, onSave }: Props) {

  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const circleRef = useRef<any>(null);

  if (!host) return null;

  const [location, setLocation] = useState({
    latitude: host.lat,
    longitude: host.lng
  });

  const [radiusKm, setRadiusKm] = useState(host.radiusKm);
  const [isActive, setIsActive] = useState(host.isActive ?? true);

  /* ---------------- INIT MAP ---------------- */

  useEffect(() => {

  const loadScript = (src: string) => {
    return new Promise((resolve) => {
      const script = document.createElement("script");
      script.src = src;
      script.async = true;
      script.onload = resolve;
      document.body.appendChild(script);
    });
  };

  const init = async () => {

    if (typeof window === "undefined") return;

    /* LOAD HERE IF NOT LOADED */

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

    if (!H || !mapRef.current) return;

    const platform = new H.service.Platform({
      apikey: process.env.EXPO_PUBLIC_HERE_API_KEY
    });

    const layers = platform.createDefaultLayers();

    const map = new H.Map(
      mapRef.current,
      layers.vector.normal.map,
      {
        zoom: 12,
        center: {
          lat: location.latitude,
          lng: location.longitude
        },
        pixelRatio: window.devicePixelRatio || 1
      }
    );

    new H.mapevents.Behavior(
      new H.mapevents.MapEvents(map)
    );

    H.ui.UI.createDefault(map, layers);

    window.addEventListener("resize", () =>
      map.getViewPort().resize()
    );

    mapInstance.current = map;

    /* MARKER */

    const marker = new H.map.Marker({
      lat: location.latitude,
      lng: location.longitude
    });

    map.addObject(marker);
    markerRef.current = marker;

    /* CIRCLE */

    const circle = new H.map.Circle(
      { lat: location.latitude, lng: location.longitude },
      radiusKm * 1000
    );

    map.addObject(circle);
    circleRef.current = circle;

    /* CLICK MAP */

    map.addEventListener("tap", (evt: any) => {

      const coord = map.screenToGeo(
        evt.currentPointer.viewportX,
        evt.currentPointer.viewportY
      );

      updateLocation(coord.lat, coord.lng);

    });

  };

  init();

  return () => {
    mapInstance.current?.dispose();
  };

}, []);

  /* ---------------- UPDATE LOCATION ---------------- */

  const updateLocation = (lat: number, lng: number) => {

    setLocation({ latitude: lat, longitude: lng });

    if (markerRef.current) {

      markerRef.current.setGeometry({
        lat,
        lng
      });

    }

    if (circleRef.current) {

      circleRef.current.setCenter({
        lat,
        lng
      });

    }

  };

  /* ---------------- UPDATE RADIUS ---------------- */

  useEffect(() => {

    if (circleRef.current) {

      circleRef.current.setRadius(
        radiusKm * 1000
      );

    }

  }, [radiusKm]);

  /* ---------------- SAVE ---------------- */

  const handleSave = async () => {

    const updatedHost: Host = {
      ...host,
      lat: location.latitude,
      lng: location.longitude,
      radiusKm,
      isActive
    };

    try {

      await onSave?.(updatedHost);

      alert("Zone d’activité enregistrée ✅");

    } catch {

      alert("Erreur sauvegarde");

    }

  };

  /* ---------------- UI ---------------- */

  return (

  <div style={styles.container}>

    <div ref={mapRef} style={styles.map} />

    <div style={styles.controls}>

      <div style={styles.card}>
        <HostRadiusSlider
          value={radiusKm}
          onChange={setRadiusKm}
        />
      </div>

      <div style={styles.card}>
        <HostAvailabilityToggle
          isActive={isActive}
          onToggle={() => setIsActive(!isActive)}
        />
      </div>

      <button
        style={styles.saveBtn}
        onClick={handleSave}
      >
        Enregistrer mon rayon d’activité
      </button>

    </div>

  </div>

);

}
const styles:any = {

container:{
  width:"100%",
  height:"100vh",
  position:"relative"
},

map:{
  width:"100%",
  height:"100%"
},

controls:{
  position:"absolute",
  bottom:30,
  left:"50%",
  transform:"translateX(-50%)",
  width:"90%",
  maxWidth:420,
  display:"flex",
  flexDirection:"column",
  gap:12
},

card:{
  background:"#fff",
  padding:"16px",
  borderRadius:14,
  boxShadow:"0 6px 20px rgba(0,0,0,0.2)"
},

saveBtn:{
  background:"#FF6B6B",
  border:"none",
  padding:"16px",
  borderRadius:14,
  color:"#fff",
  fontWeight:700,
  fontSize:16,
  cursor:"pointer",
  boxShadow:"0 6px 20px rgba(0,0,0,0.25)"
}

};