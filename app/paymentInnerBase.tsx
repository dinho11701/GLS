import React, { useState } from "react";
import {
View,
Text,
StyleSheet,
TextInput,
TouchableOpacity,
ScrollView,
Alert,
ActivityIndicator,
Platform
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";


import { useLocalSearchParams, useRouter } from "expo-router";
import { apiFetch } from "@lib/api";

const PALETTE = {
primary:"#0A0F2C",
white:"#FFFFFF",
cream:"#F9FAFB",
textDark:"#0B1220",
placeholder:"rgba(11,18,32,0.45)",
peach:"#EF8A73",
border:"rgba(11,18,32,0.12)",
gray:"rgba(11,18,32,0.65)"
};

const SERVICE_FEE_PCT = 0.08;


const money = (n:number)=>new Intl.NumberFormat("fr-CA",{
style:"currency",
currency:"CAD"
}).format(n);

const round2=(n:number)=>Math.round(n*100)/100;

export default function PaymentInnerBase({ stripe = null }){

const router = useRouter();
const params = useLocalSearchParams<any>();

const serviceId = params.serviceId ?? "";
const basePrice = Number(params.price ?? 0);

const [name,setName]=useState("");
const [email,setEmail]=useState("");
const [loading,setLoading]=useState(false);


const fee = round2(basePrice * SERVICE_FEE_PCT);
const total = round2(basePrice + fee);

const canSubmit =
serviceId &&
basePrice>0 &&
name.length>1 &&
/^\S+@\S+\.\S+$/.test(email);

const API_BASE = (
process.env.EXPO_PUBLIC_API_BASE ?? "http://127.0.0.1:5055/api/v1"
).replace(/\/+$/, "");

const handlePayment = async ()=>{

if(!canSubmit || loading) return;

setLoading(true);

try{

/* --------------------------------------------------- */
/* TOKEN */
/* --------------------------------------------------- */

const token = await AsyncStorage.getItem("authToken");

if(!token){
setLoading(false);
Alert.alert("Erreur","Utilisateur non connecté");
return;
}

/* --------------------------------------------------- */
/* CREATE PAYMENT INTENT */
/* --------------------------------------------------- */

const resp = await fetch(`${API_BASE}/customers/payments/intents`,{
method:"POST",
headers:{
"Content-Type":"application/json",
Authorization:`Bearer ${token}`
},
body:JSON.stringify({
amount: Math.round(total*100),
currency:"cad",
Service_ID:String(serviceId)
})
});

const data = await resp.json();

if(!resp.ok){
throw new Error(data.error || "Erreur paiement");
}

/* --------------------------------------------------- */
/* WEB PAYMENT */
/* --------------------------------------------------- */

if(Platform.OS === "web"){

console.log("🌐 WEB PAYMENT → REDIRECT");

const stripeUrl = data.checkoutUrl;

if (!stripeUrl) {
  setLoading(false);
  Alert.alert("Erreur","Stripe non disponible");
  return;
}

window.location.href = stripeUrl;
return;

}

/* --------------------------------------------------- */
/* MOBILE PAYMENT */
/* --------------------------------------------------- */

if(Platform.OS !== "web" && !stripe){
Alert.alert("Erreur","Stripe non disponible");
return;
}

const clientSecret = data.payment_intent.client_secret;

console.log("🔥 CLIENT SECRET FRONT:", clientSecret);
console.log("🔥 PAYMENT RESPONSE:", data);


// 1️⃣ INIT
const { error: initError } = await stripe.initPaymentSheet({
  paymentIntentClientSecret: clientSecret,
  merchantDisplayName: "LaSolution App",
  returnURL: "app1://stripe-redirect",
});

if (initError) {
  Alert.alert("Erreur init Stripe", initError.message);
  return;
}

console.log("🚀 OPENING STRIPE SHEET...");

// 2️⃣ OPEN SHEET
const { error } = await stripe.presentPaymentSheet();

if (error) {
  console.log("❌ STRIPE ERROR:", error);
  Alert.alert("Paiement annulé", error.message);
  return;
} else {
  console.log("✅ STRIPE SUCCESS");
}

/* --------------------------------------------------- */
/* SUCCESS */
/* --------------------------------------------------- */

Alert.alert(
"Paiement réussi 🎉",
"Votre réservation est confirmée.",
[
{
text:"Voir mes réservations",
onPress:()=>router.replace("/(tabs)/Message")
}
]
);

}catch(err:any){

Alert.alert("Erreur",err.message || "Paiement impossible");

}finally{

setLoading(false);

}

};

/* --------------------------------------------------- */

return(

<View style={styles.screen}>

<ScrollView contentContainerStyle={{paddingBottom:120}}>

<View style={styles.card}>

<Text style={styles.sectionTitle}>
Informations client
</Text>

<TextInput
style={styles.input}
placeholder="Nom complet"
value={name}
onChangeText={setName}
/>

<TextInput
style={styles.input}
placeholder="Courriel"
value={email}
onChangeText={setEmail}
/>

</View>

<View style={styles.card}>

<Text style={styles.sectionTitle}>Résumé</Text>

<Text style={styles.line}>
{params.title}
</Text>

<Text style={styles.line}>
{params.startTime} → {params.endTime}
</Text>

<Text style={styles.line}>
Date : {params.date}
</Text>

<View style={styles.sep}/>

<Row label="Prix" value={money(basePrice)}/>
<Row label="Frais service" value={money(fee)}/>

<View style={styles.sep}/>

<Row label="Total" value={money(total)} bold/>

</View>

</ScrollView>

<View style={styles.ctaBar}>

<TouchableOpacity
disabled={!canSubmit || loading}
onPress={handlePayment}
style={[
styles.ctaBtn,
(!canSubmit || loading) && {opacity:0.5}
]}
>

{loading
? <ActivityIndicator color="#fff"/>
: <Text style={styles.ctaText}>Payer</Text>
}

</TouchableOpacity>

</View>

</View>

);

}

function Row({label,value,bold}:{label:string,value:string,bold?:boolean}){

return(

<View style={styles.row}>

<Text style={[styles.label,bold && {fontWeight:"900"}]}>
{label}
</Text>

<Text style={[styles.value,bold && {fontWeight:"900"}]}>
{value}
</Text>

</View>

);

}

const styles = StyleSheet.create({

screen:{flex:1,backgroundColor:PALETTE.primary},

card:{
backgroundColor:"#fff",
margin:14,
padding:14,
borderRadius:18
},

sectionTitle:{
fontWeight:"900",
fontSize:16,
marginBottom:10
},

input:{
backgroundColor:"#F9FAFB",
borderRadius:12,
padding:12,
marginTop:10
},

line:{color:"#555",marginTop:4},

sep:{
height:1,
backgroundColor:"#ddd",
marginVertical:12
},

row:{
flexDirection:"row",
justifyContent:"space-between",
marginTop:6
},

label:{color:"#444"},
value:{color:"#000"},

ctaBar:{
position:"absolute",
bottom:0,
left:0,
right:0,
backgroundColor:"#fff",
padding:14
},

ctaBtn:{
backgroundColor:"#EF8A73",
height:46,
borderRadius:14,
alignItems:"center",
justifyContent:"center"
},

ctaText:{
color:"#fff",
fontWeight:"900",
fontSize:16
}

});