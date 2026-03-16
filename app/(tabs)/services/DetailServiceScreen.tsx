import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  Image,
  Dimensions,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";

import TimeSelectorModal from "@/components/TimeSelectorModal";

const { width } = Dimensions.get("window");

const PALETTE = {
  primary: "#0A0F2C",
  white: "#FFFFFF",
  cream: "#F9FAFB",
  textDark: "#0B1220",
  peach: "#EF8A73",
  placeholder: "rgba(0,0,0,0.45)",
  error: "#FF6B6B",
};

export default function DetailServiceScreen() {

  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id, date } = useLocalSearchParams();

  const [loading, setLoading] = useState(true);
  const [svc, setSvc] = useState<any>(null);

  const [startTime, setStartTime] = useState<string | null>(null);
  const [endTime, setEndTime] = useState<string | null>(null);

  const [openStart, setOpenStart] = useState(false);
  const [openEnd, setOpenEnd] = useState(false);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  const API_BASE =
    process.env.EXPO_PUBLIC_API_BASE ??
    "http://127.0.0.1:5055/api/v1";

  /* ---------------- FETCH SERVICE ---------------- */

  const fetchDetail = useCallback(async () => {

    if (!id) return;

    const token = await AsyncStorage.getItem("authToken");
    if (!token) return;

    setLoading(true);

    try {

      const resp = await fetch(
        `${API_BASE}/customers/services/${id}`,
        {
          headers:{
            "Content-Type":"application/json",
            Authorization:`Bearer ${token}`,
          }
        }
      );

      const data = await resp.json();

      if (!resp.ok) throw new Error(data.message);

      setSvc(data.item);

    } catch (e:any) {

      console.error("fetch service error:", e.message);

    } finally {

      setLoading(false);

    }

  }, [id]);

  useEffect(()=>{
    fetchDetail();
  },[fetchDetail]);

  /* ---------------- HOURS ---------------- */

  const generateHours = (start, end) => {

    const out = [];

    const [sh, sm] = start.split(":").map(Number);
    const [eh, em] = end.split(":").map(Number);

    let cur = sh * 60 + sm;
    const endMin = eh * 60 + em;

    // empêche 17h30 si fin 17h
    while (cur + 30 <= endMin) {

      const h = Math.floor(cur / 60);
      const m = cur % 60;

      out.push(
        `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
      );

      cur += 30;

    }

    return out;
  };

  const hours = useMemo(()=>{

    if(!svc?.availabilityStart || !svc?.availabilityEnd) return [];

    return generateHours(
      svc.availabilityStart,
      svc.availabilityEnd
    );

  },[svc]);

  const valid =
    startTime !== null &&
    endTime !== null &&
    hours.indexOf(endTime) > hours.indexOf(startTime);

  const basePrice = svc?.fee ?? 0;

  /* ---------------- VALIDATION AUTO ---------------- */

  useEffect(()=>{

    if(!startTime || !endTime){
      setErrorMsg(null);
      return;
    }

    if(hours.indexOf(endTime) <= hours.indexOf(startTime)){
      setErrorMsg("Heure de fin invalide.");
      return;
    }

    setErrorMsg(null);

  },[startTime,endTime]);

  /* ---------------- CHECK AVAILABILITY ---------------- */

  const checkBeforePayment = useCallback(async()=>{

    if(!date) return true;

    setChecking(true);

    try{

      const token = await AsyncStorage.getItem("authToken");
      if(!token) return true;

      const url =
        `${API_BASE}/customers/services/check-availability` +
        `?serviceId=${id}&date=${date}&startTime=${startTime}&endTime=${endTime}`;

      const resp = await fetch(url,{
        headers:{ Authorization:`Bearer ${token}` }
      });

      const data = await resp.json();

      if(!data.ok){
        setErrorMsg(data.reason || "Créneau non disponible.");
        return false;
      }

      return true;

    }catch(e){

      console.log("availability check error",e);
      return true;

    }finally{

      setChecking(false);

    }

  },[id,date,startTime,endTime]);

  /* ---------------- LOADING ---------------- */

  if(loading || !svc){
    return(
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#fff"/>
      </View>
    )
  }

  /* ---------------- RENDER ---------------- */

  return(

    <View style={styles.screen}>

      <StatusBar barStyle="light-content"/>

      <TimeSelectorModal
        visible={openStart}
        onClose={()=>setOpenStart(false)}
        availabilityStart={svc?.availabilityStart}
        availabilityEnd={svc?.availabilityEnd}
        mode="start"
        onConfirm={(t)=>{
          setStartTime(t)
          setEndTime(null)
          setErrorMsg(null)
        }}
      />

      <TimeSelectorModal
        visible={openEnd}
        onClose={()=>setOpenEnd(false)}
        availabilityStart={svc?.availabilityStart}
        availabilityEnd={svc?.availabilityEnd}
        selectedStartTime={startTime}
        mode="end"
        onConfirm={(t)=>{
          setEndTime(t)
          setErrorMsg(null)
        }}
      />

      <ScrollView contentContainerStyle={{paddingBottom:220}}>

        <View style={styles.hero}>

          {svc.coverUrl
            ? <Image source={{uri:svc.coverUrl}} style={styles.heroImg}/>
            : <View style={styles.heroPlaceholder}/>
          }

          <View style={styles.heroOverlay}/>
          <Text style={styles.heroTitle}>{svc.title}</Text>

        </View>

        <View style={styles.infoCard}>

          <Text style={styles.serviceTitle}>{svc.title}</Text>
          <Text style={styles.category}>{svc.slug}</Text>
          <Text style={styles.price}>{basePrice} $</Text>

        </View>

        <View style={styles.card}>

          <Text style={styles.section}>Description</Text>
          <Text style={styles.desc}>{svc.description}</Text>

        </View>

        <View style={styles.card}>

          <Text style={styles.section}>Choisir l’horaire</Text>

          <TouchableOpacity
            style={styles.timeBtn}
            onPress={()=>setOpenStart(true)}
          >
            <Text style={styles.timeLabel}>Heure de début</Text>
            <Text style={styles.timeValue}>
              {startTime || "Sélectionner"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.timeBtn,{opacity:startTime?1:0.35}]}
            disabled={!startTime}
            onPress={()=>setOpenEnd(true)}
          >
            <Text style={styles.timeLabel}>Heure de fin</Text>
            <Text style={styles.timeValue}>
              {endTime || "Sélectionner"}
            </Text>
          </TouchableOpacity>

          {errorMsg && (
            <View style={styles.errorBox}>
              <Ionicons name="warning-outline" size={16} color={PALETTE.error}/>
              <Text style={styles.errorMsg}>{errorMsg}</Text>
            </View>
          )}

        </View>

      </ScrollView>

      <View style={[styles.ctaBar,{paddingBottom:insets.bottom+12}]}>

        <TouchableOpacity
          disabled={!valid || checking}
          style={[
            styles.ctaBtn,
            (!valid || checking) && { opacity: 0.4 }
          ]}
          onPress={async () => {

            const ok = await checkBeforePayment();

            if(!ok) return;

            router.push({
              pathname: "/payment",
              params: {
                serviceId: id,
                date: date ?? "",
                startTime,
                endTime,
                title: svc.title,
                price: basePrice
              }
            });

          }}
        >

          {checking
            ? <ActivityIndicator color="#fff"/>
            : <>
                <Ionicons name="calendar-outline" size={18} color="#fff"/>
                <Text style={styles.ctaBtnText}>Réserver</Text>
              </>
          }

        </TouchableOpacity>

      </View>

    </View>

  )

}

const styles = StyleSheet.create({
screen:{ flex:1, backgroundColor:PALETTE.primary },
center:{ flex:1, justifyContent:"center", alignItems:"center", backgroundColor:PALETTE.primary },
hero:{ height:width*0.8, backgroundColor:"#111", borderBottomLeftRadius:26, borderBottomRightRadius:26, overflow:"hidden" },
heroImg:{ width:"100%", height:"100%" },
heroPlaceholder:{ flex:1, backgroundColor:"#222" },
heroOverlay:{ ...StyleSheet.absoluteFillObject, backgroundColor:"rgba(0,0,0,0.35)" },
heroTitle:{ position:"absolute", bottom:20, left:20, color:"#fff", fontSize:28, fontWeight:"900" },
infoCard:{ backgroundColor:"#fff", marginTop:-40, marginHorizontal:16, padding:18, borderRadius:18 },
serviceTitle:{ fontSize:22, fontWeight:"900", color:PALETTE.textDark },
category:{ marginTop:4, color:PALETTE.placeholder },
price:{ marginTop:10, fontSize:20, fontWeight:"900" },
card:{ backgroundColor:"#fff", marginHorizontal:16, marginTop:16, padding:18, borderRadius:18 },
section:{ fontSize:18, fontWeight:"900", marginBottom:10 },
desc:{ color:"#333", lineHeight:22 },
timeBtn:{ backgroundColor:PALETTE.cream, padding:14, borderRadius:12, marginBottom:10 },
timeLabel:{ fontSize:13, color:"#666" },
timeValue:{ fontSize:17, fontWeight:"800", color:PALETTE.textDark },
ctaBar:{ position:"absolute", bottom:0, left:0, right:0, backgroundColor:"#fff", padding:16 },
ctaBtn:{ backgroundColor:PALETTE.peach, height:54, borderRadius:16, flexDirection:"row", alignItems:"center", justifyContent:"center", gap:8 },
errorBox:{ flexDirection:"row", alignItems:"center", gap:6, marginTop:10 },
errorMsg:{ color:PALETTE.error, fontWeight:"700" },
ctaBtnText:{ color:"#fff", fontWeight:"900", fontSize:17 }
});