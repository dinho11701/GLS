import React, { useEffect, useState, useCallback } from "react";
import {
View,
Text,
ScrollView,
StyleSheet,
ActivityIndicator
} from "react-native";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";

import BookingDateFilter from "../../components/BookingDateFilter";
import ServiceCard from "../../components/ServiceCard/ServiceCard";
import ListCategory from "../../components/ListCategory";

const API_BASE = (
process.env.EXPO_PUBLIC_API_BASE ?? "http://127.0.0.1:5055/api/v1"
).replace(/\/+$/, "");

export default function HomeScreen() {

const router = useRouter();

const [services,setServices] = useState([]);
const [popular,setPopular] = useState([]);
const [categories,setCategories] = useState([]);

const [loading,setLoading] = useState(true);
const [userRole,setUserRole] = useState(null);

const [selectedDate,setSelectedDate] = useState(null);
const [selectedCategory,setSelectedCategory] = useState(null);

const [myServices,setMyServices] = useState([]);
const [myBookings,setMyBookings] = useState([]);

useEffect(()=>{
loadRole();
},[]);

async function loadRole(){

const role =
(await AsyncStorage.getItem("userRole")) ||
(typeof window !== "undefined"
? localStorage.getItem("userRole")
: null);

setUserRole(role);

}

/* ---------------- Categories ---------------- */

const fetchCategories = useCallback(async()=>{

try{

const resp = await fetch(`${API_BASE}/categories`);
const data = await resp.json();

setCategories(Array.isArray(data.items) ? data.items : []);

}catch(e){
console.log("categories error",e);
}

},[]);

/* ---------------- Services ---------------- */

const fetchServices = useCallback(async()=>{

try{

const token = await AsyncStorage.getItem("authToken");
if(!token) return;

let url = `${API_BASE}/customers/services?limit=20`;

if(selectedDate){
const iso = selectedDate.toISOString().split("T")[0];
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

}catch(e){
console.log("services error",e);
}

},[selectedDate,selectedCategory]);

/* ---------------- Partner ---------------- */

const fetchHostServices = useCallback(async()=>{

const token = await AsyncStorage.getItem("authToken");
if(!token) return;

const resp = await fetch(`${API_BASE}/partners/services/my-services`,{
headers:{Authorization:`Bearer ${token}`}
});

const data = await resp.json();

setMyServices(Array.isArray(data.items)?data.items:[]);

},[]);

const fetchMyBookings = useCallback(async()=>{

const token = await AsyncStorage.getItem("authToken");
if(!token) return;

const resp = await fetch(`${API_BASE}/partners/reservations`,{
headers:{Authorization:`Bearer ${token}`}
});

const data = await resp.json();

setMyBookings(Array.isArray(data.reservations)?data.reservations:[]);

},[]);

/* ---------------- Init ---------------- */

useEffect(()=>{

async function init(){

if(!userRole) return;

if(userRole==="customer"){
await fetchCategories();
await fetchServices();
}

if(userRole==="partner" || userRole==="host"){
await fetchHostServices();
await fetchMyBookings();
}

setLoading(false);

}

init();

},[
userRole,
fetchCategories,
fetchServices,
fetchHostServices,
fetchMyBookings
]);

/* 🔥 reload services when filter changes */

useEffect(()=>{

if(userRole==="customer"){
fetchServices();
}

},[selectedCategory,selectedDate]);

if(loading){
return(
<View style={styles.center}>
<ActivityIndicator size="large" color="#FFD700"/>
</View>
);
}

return (

<View style={styles.container}>

<View style={styles.header}>
<Text style={styles.brand}>
LaSolution App
</Text>
</View>

{/* ---------------- CUSTOMER ---------------- */}

{userRole==="customer" && (

<ScrollView>

<BookingDateFilter
selectedDate={selectedDate}
onChangeDate={setSelectedDate}
/>

<ListCategory
categories={categories}
selectedCategory={selectedCategory}
onPressCategory={(cat)=>{

if(selectedCategory===cat.slug){
setSelectedCategory(null)
}else{
setSelectedCategory(cat.slug)
}

}}
/>

<Text style={styles.sectionTitle}>
Services populaires
</Text>

<View style={styles.grid}>

{(selectedCategory || selectedDate ? services : popular).map((svc)=>(
<ServiceCard
key={svc.id}
service={svc}
/>
))}

</View>

</ScrollView>

)}

{/* ---------------- HOST / PARTNER ---------------- */}

{(userRole==="partner" || userRole==="host") && (

<ScrollView>

<View style={styles.hostCard}>
<Text style={styles.hostTitle}>📦 Mes services</Text>
<Text style={styles.hostCount}>{myServices.length} service(s)</Text>
</View>

<View style={styles.hostCard}>
<Text style={styles.hostTitle}>📅 Mes réservations</Text>
<Text style={styles.hostCount}>{myBookings.length} réservation(s)</Text>
</View>

</ScrollView>

)}

</View>

);

}

const styles = StyleSheet.create({

container:{
flex:1,
backgroundColor:"#0A0F2C",
padding:20
},

center:{
flex:1,
justifyContent:"center",
alignItems:"center",
backgroundColor:"#0A0F2C"
},

header:{
marginBottom:20
},

brand:{
fontSize:26,
fontWeight:"900",
color:"#FFD700"
},

sectionTitle:{
fontSize:20,
fontWeight:"800",
color:"#FFD700",
marginBottom:12
},

grid:{
flexDirection:"row",
flexWrap:"wrap",
gap:12
},

hostCard:{
backgroundColor:"rgba(255,255,255,0.1)",
padding:20,
borderRadius:14,
marginBottom:20
},

hostTitle:{
fontSize:18,
fontWeight:"900",
color:"#FFD700",
marginBottom:6
},

hostCount:{
fontSize:16,
color:"#fff"
}

});