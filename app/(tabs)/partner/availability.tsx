// app/(tabs)/partner/availability.tsx
import React, { useMemo, useState } from 'react';
import {
View,
Text,
StyleSheet,
ScrollView,
TouchableOpacity,
TextInput,
Switch,
Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import AsyncStorage from "@react-native-async-storage/async-storage";

const API_BASE = process.env.EXPO_PUBLIC_API_BASE;

type DayKey =
| 'monday'
| 'tuesday'
| 'wednesday'
| 'thursday'
| 'friday'
| 'saturday'
| 'sunday';

type DayConfig = {
key: DayKey;
label: string;
enabled: boolean;
start: string;
end: string;
};

type ExceptionPeriod = {
id: string;
startDate: string;
endDate: string;
reason: string;
};

const PALETTE = {
primary: '#0A0F2C',
bg: '#0B1120',
card: '#F9FAFB',
textDark: '#0B1220',
textMuted: '#6B7280',
border: 'rgba(15,23,42,0.08)',
coral: '#F97373',
accent: '#F97316',
accentSoft: '#FEF3C7',
};

const ALL_DAYS: DayConfig[] = [
{ key:'monday',label:'Lundi',enabled:true,start:'09:00',end:'17:00'},
{ key:'tuesday',label:'Mardi',enabled:true,start:'09:00',end:'17:00'},
{ key:'wednesday',label:'Mercredi',enabled:true,start:'09:00',end:'17:00'},
{ key:'thursday',label:'Jeudi',enabled:true,start:'09:00',end:'17:00'},
{ key:'friday',label:'Vendredi',enabled:true,start:'09:00',end:'17:00'},
{ key:'saturday',label:'Samedi',enabled:false,start:'09:00',end:'17:00'},
{ key:'sunday',label:'Dimanche',enabled:false,start:'09:00',end:'17:00'},
];

function timeToMinutes(t:string){
if(!t.includes(':')) return -1;
const[h,m]=t.split(':').map(Number);
return h*60+m;
}

export default function AvailabilityScreen(){

const router = useRouter();

const [days,setDays]=useState<DayConfig[]>(ALL_DAYS);
const [exceptions,setExceptions]=useState<ExceptionPeriod[]>([]);
const [saving,setSaving]=useState(false);

/* PRESETS */

const applyPreset=(preset:'week'|'all'|'custom')=>{
setDays(prev=>prev.map(d=>{
if(preset==='week'){
const weekday=['monday','tuesday','wednesday','thursday','friday'].includes(d.key);
return {...d,enabled:weekday,start:'09:00',end:'17:00'};
}
if(preset==='all'){
return {...d,enabled:true,start:'09:00',end:'21:00'};
}
return d;
}));
};

/* DAYS */

const toggleDayEnabled=(key:DayKey)=>{
setDays(prev=>prev.map(d=>d.key===key?{...d,enabled:!d.enabled}:d));
};

const updateDayTime=(key:DayKey,field:'start'|'end',value:string)=>{
const clean=value.replace(/[^0-9:]/g,'');
setDays(prev=>prev.map(d=>d.key===key?{...d,[field]:clean}:d));
};

const applyToRestOfWeek=()=>{
const ref=days.find(d=>d.enabled)||days[0];
setDays(prev=>prev.map(d=>({...d,start:ref.start,end:ref.end,enabled:ref.enabled})));
};

/* EXCEPTIONS */

const addException=()=>{
const iso=new Date().toISOString().slice(0,10);
setExceptions(prev=>[
...prev,
{id:`${Date.now()}`,startDate:iso,endDate:iso,reason:''}
]);
};

const updateException=(id:string,field:keyof ExceptionPeriod,value:string)=>{
setExceptions(prev=>prev.map(ex=>ex.id===id?{...ex,[field]:value}:ex));
};

const removeException=(id:string)=>{
setExceptions(prev=>prev.filter(ex=>ex.id!==id));
};

/* VALIDATION */

const errors=useMemo(()=>{
const errs:string[]=[];

if(!days.some(d=>d.enabled))
errs.push("Au moins un jour doit être disponible.");

days.forEach(d=>{
if(!d.enabled) return;
const s=timeToMinutes(d.start);
const e=timeToMinutes(d.end);
if(e<=s) errs.push(`Heures invalides pour ${d.label}`);
});

exceptions.forEach(ex=>{
if(ex.startDate>ex.endDate)
errs.push("Date de fin invalide");
});

return errs;

},[days,exceptions]);

const hasErrors=errors.length>0;

/* TRANSFORM */

function mapDaysToWeekly(days: DayConfig[]) {

const timezone = "America/Toronto";

const order: DayKey[] = [
'monday','tuesday','wednesday','thursday','friday','saturday','sunday'
];

return order.map((key,index)=>{

const d = days.find(x=>x.key===key)!;

return {
kind:"weekly",
timezone,
day: index + 1,
date: null,
closed: !d.enabled,
ranges: d.enabled ? [{start:d.start,end:d.end}] : []
};

});
}

function mapExceptions(exceptions:ExceptionPeriod[]){

const timezone="America/Toronto";
const docs:any[]=[];

exceptions.forEach(ex=>{

let cursor=new Date(ex.startDate);
const last=new Date(ex.endDate);

while(cursor<=last){

docs.push({
  kind:"override",
  timezone,
  day:null,
  date:cursor.toISOString().slice(0,10),
  closed:true,
  ranges:[]
});

cursor.setDate(cursor.getDate()+1);

}

});

return docs;

}

/* SAVE */

const handleSave=async()=>{

if(hasErrors){
Alert.alert("Erreur","Corrige les erreurs.");
return;
}

try{

setSaving(true);

const weekly=mapDaysToWeekly(days);
const overrides=mapExceptions(exceptions);

const items=[...weekly,...overrides];

const token=await AsyncStorage.getItem("authToken");

console.log("TOKEN FOUND:", token);

console.log("ITEMS SENT:", items);

const resp=await fetch(`${API_BASE}/partners/availability/bulk`,{
method:"PUT",
headers:{
"Content-Type":"application/json",
Authorization:`Bearer ${token}`
},
body:JSON.stringify({items})
});

const data = await resp.json();

console.log("STATUS:", resp.status);
console.log("RESPONSE:", data);

if (!resp.ok) {
  throw new Error(data.error || "Server error");
}


Alert.alert("Succès","Disponibilités sauvegardées");
router.back();

}catch(e){

Alert.alert("Erreur","Impossible de sauvegarder");

}finally{
setSaving(false);
}

};

const handleCancel=()=>{
setDays(ALL_DAYS);
setExceptions([]);
router.back();
};

/* RENDER */

return(
<View style={{flex:1,backgroundColor:PALETTE.bg}}>
<SafeAreaView style={{flex:1}}>

<View style={styles.header}>
<TouchableOpacity onPress={()=>router.back()}>
<Ionicons name="chevron-back" size={24} color="#fff"/>
</TouchableOpacity>
<Text style={styles.headerTitle}>Gestion des disponibilités</Text>
<View style={{width:24}}/>
</View>

<ScrollView contentContainerStyle={{padding:16}}>

<View style={styles.card}>

<Text style={styles.title}>Définir vos disponibilités</Text>

{days.map(d=>(
<View key={d.key} style={styles.dayRow}>

<View style={{flex:1}}>
<Text style={styles.dayLabel}>{d.label}</Text>
<Switch
value={d.enabled}
onValueChange={()=>toggleDayEnabled(d.key)}
/>
</View>

<TextInput
value={d.start}
onChangeText={t=>updateDayTime(d.key,'start',t)}
style={styles.timeInput}
/>

<TextInput
value={d.end}
onChangeText={t=>updateDayTime(d.key,'end',t)}
style={styles.timeInput}
/>

</View>
))}

<View style={styles.actionsRow}>

<TouchableOpacity style={styles.cancelBtn} onPress={handleCancel}>
<Text>Annuler</Text>
</TouchableOpacity>

<TouchableOpacity
style={[styles.saveBtn,(saving||hasErrors)&&{opacity:.5}]}
onPress={handleSave}
disabled={saving||hasErrors}
>
<Text style={{color:"#fff"}}>
{saving?"Enregistrement...":"Sauvegarder"}
</Text>
</TouchableOpacity>

</View>

</View>

</ScrollView>

</SafeAreaView>
</View>
);

}

const styles=StyleSheet.create({

header:{
flexDirection:'row',
alignItems:'center',
justifyContent:'space-between',
paddingHorizontal:16,
height:56
},

headerTitle:{
flex:1,
textAlign:'center',
color:"#fff",
fontSize:18,
fontWeight:'800'
},

card:{
backgroundColor:"#fff",
borderRadius:24,
padding:18
},

title:{
fontSize:20,
fontWeight:'800',
marginBottom:10
},

dayRow:{
flexDirection:'row',
alignItems:'center',
marginBottom:10,
gap:8
},

dayLabel:{
fontWeight:'700'
},

timeInput:{
borderWidth:1,
borderColor:"#ddd",
borderRadius:10,
padding:6,
width:70,
textAlign:'center'
},

actionsRow:{
flexDirection:'row',
justifyContent:'flex-end',
gap:10,
marginTop:16
},

cancelBtn:{
padding:10,
borderWidth:1,
borderColor:"#ddd",
borderRadius:20
},

saveBtn:{
padding:10,
borderRadius:20,
backgroundColor:PALETTE.accent
}

});