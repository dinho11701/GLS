import React, { useEffect, useRef, useState } from "react";

import MapZoomControls from "../../components/map/MapZoomControls.web";
import HostFilters from "../../components/map/HostFilters.web";

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

export default function MapCustomerWeb() {

  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const circleRef = useRef<any>(null);

  const [services,setServices] = useState<Service[]>([]);
  const [selectedService,setSelectedService] = useState<Service|null>(null);
  const [userLocation,setUserLocation] = useState<any>(null);
  const [filters,setFilters] = useState<any>({});
  const [showFilters,setShowFilters] = useState(false);
  const [loading,setLoading] = useState(false);

  /* ===============================
     INIT MAP
  =============================== */

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

    // Charger HERE si pas déjà chargé
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

    if (!H || !mapRef.current) {
      console.log("HERE toujours pas chargé");
      return;
    }

    console.log("HERE chargé:", H);

    const platform = new H.service.Platform({
      apikey: process.env.EXPO_PUBLIC_HERE_API_KEY
    });

    const layers = platform.createDefaultLayers();

    const map = new H.Map(
      mapRef.current,
      layers.vector.normal.map,
      {
        zoom: 12,
        center: { lat: 45.5019, lng: -73.5674 },
        pixelRatio: window.devicePixelRatio || 1
      }
    );

    new H.mapevents.Behavior(new H.mapevents.MapEvents(map));

    H.ui.UI.createDefault(map, layers);

    window.addEventListener("resize", () => map.getViewPort().resize());

    mapInstance.current = map;
  };

  init();

}, []);

  /* ===============================
     USER GPS
  =============================== */

  useEffect(()=>{

    if(!mapInstance.current) return;

    const H = (window as any).H;

    navigator.geolocation.getCurrentPosition((pos)=>{

      const coords={
        latitude:pos.coords.latitude,
        longitude:pos.coords.longitude
      };

      setUserLocation(coords);

      mapInstance.current.setCenter({
        lat:coords.latitude,
        lng:coords.longitude
      });

      const marker = new H.map.Marker({
        lat:coords.latitude,
        lng:coords.longitude
      });

      mapInstance.current.addObject(marker);

    });

  },[mapInstance.current]);

  /* ===============================
     FETCH SERVICES
  =============================== */

  useEffect(()=>{

    if(!userLocation) return;

    const fetchServices = async()=>{

      setLoading(true);

      try{

        const params = new URLSearchParams({
          lat:String(userLocation.latitude),
          lng:String(userLocation.longitude)
        });

        if(filters.category){
          params.append("category",filters.category.toLowerCase());
        }

        const res = await fetch(
          `${API_BASE}/customers/services/nearby?${params}`
        );

        const data = await res.json();

        if(data.ok){
          setServices(data.items);
          renderMarkers(data.items);
        }

      }catch(err){
        console.error(err);
      }
      finally{
        setLoading(false);
      }

    };

    fetchServices();

  },[userLocation,filters]);

  /* ===============================
     MARKERS
  =============================== */

  const renderMarkers = (items:Service[])=>{

    if(!mapInstance.current) return;

    const H = (window as any).H;

    markersRef.current.forEach(m=>{
      mapInstance.current.removeObject(m);
    });

    markersRef.current=[];

    items.forEach((svc)=>{

      const marker = new H.map.Marker({
        lat:svc.latitude,
        lng:svc.longitude
      });

      marker.addEventListener("tap",()=>{
        setSelectedService(svc);
        drawCircle(svc);
      });

      mapInstance.current.addObject(marker);
      markersRef.current.push(marker);

    });

  };

  /* ===============================
     DRAW RADIUS
  =============================== */

  const drawCircle=(svc:Service)=>{

    if(!mapInstance.current) return;

    const H = (window as any).H;

    if(circleRef.current){
      mapInstance.current.removeObject(circleRef.current);
    }

    const circle = new H.map.Circle(
      { lat:svc.latitude,lng:svc.longitude },
      svc.radius_km * 1000
    );

    mapInstance.current.addObject(circle);

    circleRef.current=circle;

  };

  /* ===============================
     ZOOM
  =============================== */

  const zoomIn=()=>{
    if(!mapInstance.current) return;
    mapInstance.current.setZoom(mapInstance.current.getZoom()+1);
  };

  const zoomOut=()=>{
    if(!mapInstance.current) return;
    mapInstance.current.setZoom(mapInstance.current.getZoom()-1);
  };

  /* ===============================
     UI
  =============================== */

  return(

    <div style={styles.container}>

      <div ref={mapRef} style={styles.map}/>

      <button
        style={styles.filterButton}
        onClick={()=>setShowFilters(true)}
      >
        Filtres
      </button>

      {loading && (
        <div style={styles.loader}>
          Chargement...
        </div>
      )}

      {selectedService && (
        <div style={styles.card}>
          <h3>{selectedService.title}</h3>
          <p>⭐ {selectedService.rating ?? 4.5}</p>
          <p>À partir de {selectedService.fee ?? 90}$</p>
        </div>
      )}

      {showFilters && (
        <HostFilters
          onApply={(f)=>{
            setFilters(f);
            setShowFilters(false);
          }}
          onReset={()=>{
            setFilters({});
            setShowFilters(false);
          }}
        />
      )}

      <MapZoomControls
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
      />

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

filterButton:{
  position:"absolute",
  top:60,
  right:20,
  background:"#FF6B6B",
  padding:"12px",
  borderRadius:30,
  color:"#fff",
  border:"none",
  fontWeight:"bold",
  cursor:"pointer"
},

loader:{
  position:"absolute",
  top:"50%",
  left:"50%",
  transform:"translate(-50%,-50%)",
  background:"#fff",
  padding:"10px 16px",
  borderRadius:10
},

card:{
  position:"absolute",
  bottom:0,
  left:0,
  right:0,
  background:"#fff",
  padding:20,
  borderTopLeftRadius:20,
  borderTopRightRadius:20
}

};