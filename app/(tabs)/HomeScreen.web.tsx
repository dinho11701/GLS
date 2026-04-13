import React, { useEffect, useState, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import BookingDateFilter from "../../components/BookingDateFilter.web";
import BecomeHostBannerWeb from "../../components/BecomeHostBanner.web";
import ReviewPendingModalWeb from "../../components/ReviewPendingModal.web";
import ListCategoryWeb from "../../components/ListCategory.web";
import ServiceCard from "../../components/ServiceCard/ServiceCard";

import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

const API_BASE = (
  process.env.EXPO_PUBLIC_API_BASE ?? "http://127.0.0.1:5055/api/v1"
).replace(/\/+$/, "");

function formatDateLocal(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(date.getDate()).padStart(2, "0")}`;
}

export default function HomeScreenWeb() {

  const router = useRouter();

  const [services,setServices] = useState<any[]>([]);
  const [popular,setPopular] = useState<any[]>([]);
  const [categories,setCategories] = useState<any[]>([]);

  const [selectedDate,setSelectedDate] = useState<Date|null>(null);
  const [selectedCategory,setSelectedCategory] = useState<string|null>(null);

  const [pendingReview,setPendingReview] = useState<any|null>(null);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState<string|null>(null);
  const [userRole,setUserRole] = useState<string|null>(null);

  const [myServices,setMyServices] = useState<any[]>([]);
  const [myBookings,setMyBookings] = useState<any[]>([]);

  /* ROLE */

  useEffect(()=>{

    const loadRole = async()=>{

      const role =
        (await AsyncStorage.getItem("userRole")) ||
        (typeof window !== "undefined"
          ? localStorage.getItem("userRole")
          : null);

      setUserRole(role);

    };

    loadRole();

  },[]);

  /* FETCH CATEGORIES */

  const fetchCategories = useCallback(async()=>{

    try{

      const resp = await fetch(`${API_BASE}/categories`);
      const data = await resp.json();

      setCategories(Array.isArray(data.items)?data.items:[]);

    }catch(e){
      console.log("categories error",e);
    }

  },[]);

  /* FETCH SERVICES */

  const fetchServices = useCallback(async()=>{

    try{

      setLoading(true);

      const token =
        (await AsyncStorage.getItem("authToken")) ||
        (typeof window !== "undefined"
          ? localStorage.getItem("authToken")
          : null);

      if(!token) return;

      let url = `${API_BASE}/customers/services?limit=20`;

      if(selectedDate){
        const iso = formatDateLocal(selectedDate);
        url += `&date=${iso}`;
      }

      if(selectedCategory){
        url += `&category=${selectedCategory}`;
      }

      const resp = await fetch(url,{
        headers:{Authorization:`Bearer ${token}`}
      });

      const data = await resp.json();

      const list = Array.isArray(data.items)?data.items:[];

      setServices(list);
      setPopular(list.slice(0,10));

    }catch{

      setError("Erreur de chargement des services.");

    }finally{

      setLoading(false);

    }

  },[selectedDate,selectedCategory]);

  /* HOST FETCH */

  const fetchHostServices = useCallback(async()=>{

    const token =
      (await AsyncStorage.getItem("authToken")) ||
      (typeof window !== "undefined"
        ? localStorage.getItem("authToken")
        : null);

    if(!token) return;

    try{

      const resp = await fetch(`${API_BASE}/partners/services/my-services`,{
        headers:{ Authorization:`Bearer ${token}` }
      });

      const data = await resp.json();
      setMyServices(Array.isArray(data.items) ? data.items : []);

    }catch{
      setMyServices([]);
    }

  },[]);

  const fetchMyBookings = useCallback(async()=>{

    const token =
      (await AsyncStorage.getItem("authToken")) ||
      (typeof window !== "undefined"
        ? localStorage.getItem("authToken")
        : null);

    if(!token) return;

    try{

      const resp = await fetch(`${API_BASE}/partners/reservations`,{
        headers:{ Authorization:`Bearer ${token}` }
      });

      const data = await resp.json();
      setMyBookings(Array.isArray(data.reservations) ? data.reservations : []);

    }catch{
      setMyBookings([]);
    }

  },[]);

  /* INIT */

  useEffect(()=>{

    if(!userRole) return;

    if(userRole==="customer"){
      fetchCategories();
      fetchServices();
    }

    if(userRole==="host" || userRole==="partner"){
      fetchHostServices();
      fetchMyBookings();
    }

  },[userRole]);

  /* RELOAD FILTER */

  useEffect(()=>{

    if(userRole==="customer"){
      fetchServices();
    }

  },[selectedCategory,selectedDate]);

  /* RENDER */

  return(

    <div style={styles.page}>

      <div style={styles.headerWrapper}>

        <h1 style={styles.brand}>LaSolution App</h1>

        <div style={styles.headerRight}>

          <Ionicons
            name="map-outline"
            size={26}
            color="#FFD700"
            style={styles.iconBtn}
            onClick={()=>{
              if(userRole === "host" || userRole === "partner"){
                router.push("/(tabs)/HostMap");
              }else{
                router.push("/(tabs)/MapCustomer");
              }
            }}
          />

          <Ionicons
            name="chatbubble-ellipses-outline"
            size={26}
            color="#FFD700"
            style={styles.iconBtn}
            onClick={()=>router.push("/(tabs)/Message")}
          />

          <Ionicons
            name="person-circle-outline"
            size={28}
            color="#FFD700"
            style={styles.iconBtn}
            onClick={()=>router.push("/profile")}
          />

        </div>

      </div>

      {/* CUSTOMER */}

      {userRole==="customer" && (

        <>

          <div style={{textAlign:"center",marginTop:20}}>
            <BookingDateFilter
              selectedDate={selectedDate}
              onChangeDate={setSelectedDate}
            />
          </div>

          <BecomeHostBannerWeb/>

          {error && <div style={styles.errorBox}>{error}</div>}

          <ListCategoryWeb
            categories={categories}
            selectedCategory={selectedCategory}
            onPressCategory={(cat)=>{

              if(selectedCategory===cat.slug){
                setSelectedCategory(null);
              }else{
                setSelectedCategory(cat.slug);
              }

            }}
          />

          <h2 style={styles.section}>Services populaires</h2>

          {loading && <p>Chargement...</p>}

          <div style={styles.grid}>

{(selectedCategory || selectedDate ? services : popular).map((svc)=>(
  
  <div
    key={svc.id}
    onClick={() =>
      router.push({
        pathname:"/(tabs)/services/DetailServiceScreen",
        params:{
          id:svc.id,
          date:selectedDate
            ? formatDateLocal(selectedDate)
            : undefined
        }
      })
    }
    style={{cursor:"pointer"}}
  >

    <ServiceCard service={svc} />

  </div>

))}

</div>

        </>

      )}

      {/* HOST */}

      {(userRole==="host" || userRole==="partner") && (

        <div style={styles.hostContainer}>

          <div style={styles.sectionBox}>
            <h2 style={styles.sectionTitle}>📦 Mes services</h2>
            <p>{myServices.length} service(s)</p>
          </div>

          <div
  style={styles.sectionBox}
  onClick={() => router.push("/(tabs)/reservations/ListReservations")}
>
  <h2 style={styles.sectionTitle}>📅 Mes réservations</h2>
  <p>{myBookings.length} réservation(s)</p>
</div>

        </div>

      )}

      <ReviewPendingModalWeb
        item={pendingReview}
        onClose={()=>setPendingReview(null)}
      />

    </div>

  );

}

const styles:any = {

page:{
padding:"30px",
background:"#0A0F2C",
minHeight:"100vh",
color:"white"
},

headerWrapper:{
display:"flex",
justifyContent:"space-between",
alignItems:"center"
},

headerRight:{
display:"flex",
alignItems:"center",
gap:"20px"
},

brand:{
fontSize:"34px",
fontWeight:"900",
color:"#FFD700"
},

iconBtn:{cursor:"pointer"},

hostContainer:{
marginTop:40,
display:"flex",
flexDirection:"column",
gap:"40px",
maxWidth:"900px",
margin:"0 auto"
},

sectionBox:{
background:"rgba(255,255,255,0.1)",
padding:"24px",
borderRadius:"14px"
},

sectionTitle:{
fontSize:"24px",
fontWeight:"900",
color:"#FFD700"
},

section:{
marginTop:"25px",
fontSize:"22px",
fontWeight:"900"
},

grid:{
marginTop:"20px",
display:"grid",
gridTemplateColumns:"repeat(auto-fill, minmax(240px,1fr))",
gap:"20px"
},

sectionBox:{
  background:"rgba(255,255,255,0.1)",
  padding:"24px",
  borderRadius:"14px",
  cursor:"pointer",
  transition:"0.2s",
},

sectionBoxHover:{
  transform:"scale(1.02)"
}



};