import React, { useState, useMemo } from "react";

const PALETTE = {
  primary: "#0A0F2C",
  white: "#FFFFFF",
  textDark: "#0B1220",
  gold: "#FFD700",
  border: "rgba(148,163,184,0.6)",
};

type Props = {
  selectedDate: Date | null;
  onChangeDate: (date: Date | null) => void;
};

const dayLabels = ["L","Ma","Me","J","V","S","D"];

const startOfMonth = (d: Date) =>
  new Date(d.getFullYear(), d.getMonth(), 1);

const addMonths = (d: Date, n: number) =>
  new Date(d.getFullYear(), d.getMonth() + n, 1);

function getMonthMatrix(current: Date) {

  const first = startOfMonth(current);
  const firstWeekday = (first.getDay() + 6) % 7;

  const daysInMonth = new Date(
    current.getFullYear(),
    current.getMonth()+1,
    0
  ).getDate();

  const cells:(Date|null)[]=[];

  for(let i=0;i<firstWeekday;i++) cells.push(null);

  for(let d=1;d<=daysInMonth;d++)
    cells.push(new Date(current.getFullYear(),current.getMonth(),d));

  while(cells.length%7!==0) cells.push(null);

  const weeks:(Date|null)[][]=[];
  for(let i=0;i<cells.length;i+=7)
    weeks.push(cells.slice(i,i+7));

  return weeks;
}

const formatHeader=(d:Date)=>
  d.toLocaleDateString("fr-CA",{month:"long",year:"numeric"});

export default function BookingDateFilterWeb({
  selectedDate,
  onChangeDate
}:Props){

  const [open,setOpen]=useState(false);

  const [currentMonth,setCurrentMonth]=useState<Date>(
    selectedDate||new Date()
  );

  const [tempDate,setTempDate]=useState<Date|null>(selectedDate);

  const weeks=useMemo(()=>getMonthMatrix(currentMonth),[currentMonth]);

  const today=new Date();
  today.setHours(0,0,0,0);

  const currentMonthStart=startOfMonth(currentMonth);
  const todayMonthStart=startOfMonth(today);

  const canGoPrev=currentMonthStart>todayMonthStart;

  function apply(){
    onChangeDate(tempDate||null);
    setOpen(false);
  }

  function clear(){
    setTempDate(null);
    onChangeDate(null);
    setOpen(false);
  }

  const isSame=(a:Date|null,b:Date|null)=>
    !!a&&!!b&&
    a.getFullYear()===b.getFullYear() &&
    a.getMonth()===b.getMonth() &&
    a.getDate()===b.getDate();

  return(
  <>
    {/* CHIP */}
    <div
      onClick={()=>{
        setCurrentMonth(selectedDate||new Date());
        setTempDate(selectedDate||null);
        setOpen(true);
      }}
      style={styles.pill}
    >
      📅
      <span style={styles.pillText}>
        {selectedDate
          ? selectedDate.toLocaleDateString("fr-CA",{day:"numeric",month:"short"})
          : "Quand ?"}
      </span>
    </div>

    {open && (

      <div style={styles.overlay} onClick={()=>setOpen(false)}>

        <div style={styles.modal} onClick={e=>e.stopPropagation()}>

          <h3 style={styles.title}>Choisir une date</h3>

          {/* NAV */}
          <div style={styles.monthHeader}>

            <button
              disabled={!canGoPrev}
              onClick={()=>canGoPrev && setCurrentMonth(addMonths(currentMonth,-1))}
              style={{
                ...styles.arrowBtn,
                opacity:!canGoPrev?0.3:1
              }}
            >
              ←
            </button>

            <span style={styles.monthLabel}>
              {formatHeader(currentMonth)}
            </span>

            <button
              onClick={()=>setCurrentMonth(addMonths(currentMonth,1))}
              style={styles.arrowBtn}
            >
              →
            </button>

          </div>

          {/* WEEK LABELS */}
          <div style={styles.weekRow}>
            {dayLabels.map((d,i)=>
              <span key={i} style={styles.weekDay}>{d}</span>
            )}
          </div>

          {/* CALENDAR */}
          {weeks.map((week,wi)=>(
            <div key={wi} style={styles.weekRow}>
              {week.map((day,di)=>{

                if(!day)
                  return <div key={di} style={styles.dayCell}/>

                const disabled=day<today;
                const selected=isSame(day,tempDate);

                return(
                  <div
                    key={`${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`}
                    onClick={()=>!disabled && setTempDate(day)}
                    onMouseEnter={(e)=>{
                      if(!disabled && !selected)
                        e.currentTarget.style.background="#F3F4F6";
                    }}
                    onMouseLeave={(e)=>{
                      if(!selected)
                        e.currentTarget.style.background="transparent";
                    }}
                    style={{
                      ...styles.dayCell,
                      ...(selected && styles.dayCellSelected),
                      ...(disabled && styles.dayCellDisabled)
                    }}
                  >
                    <span
                      style={{
                        color:PALETTE.textDark,
                        ...(selected && styles.dayLabelSelected),
                        ...(disabled && styles.dayLabelDisabled)
                      }}
                    >
                      {day.getDate()}
                    </span>
                  </div>
                )
              })}
            </div>
          ))}

          {tempDate && (
            <button onClick={clear} style={styles.clearBtn}>
              Effacer la date
            </button>
          )}

          <div style={styles.actions}>

            <button
              onClick={()=>setOpen(false)}
              style={styles.btnSecondary}
            >
              Annuler
            </button>

            <button
              onClick={apply}
              style={styles.btnPrimary}
            >
              Appliquer
            </button>

          </div>

        </div>

      </div>

    )}
  </>
  )
}

const styles:any={

pill:{
  display:"inline-flex",
  alignItems:"center",
  gap:8,
  background:"rgba(15,23,42,0.9)",
  border:`1px solid ${PALETTE.border}`,
  borderRadius:999,
  padding:"10px 16px",
  cursor:"pointer"
},

pillText:{
  color:"#E5E7EB",
  fontWeight:600,
  fontSize:14
},

overlay:{
  position:"fixed",
  inset:0,
  background:"rgba(15,23,42,0.45)",
  display:"flex",
  alignItems:"center",
  justifyContent:"center",
  zIndex:1000
},

modal:{
  background:PALETTE.white,
  padding:"26px 28px",
  borderRadius:26,
  width:420,
  maxWidth:"92vw",
  boxShadow:"0 20px 50px rgba(0,0,0,0.35)"
},

title:{
  fontSize:18,
  fontWeight:900,
  marginBottom:16,
  color:PALETTE.textDark
},

monthHeader:{
  display:"flex",
  justifyContent:"space-between",
  alignItems:"center",
  marginBottom:18
},

monthLabel:{
  fontWeight:700,
  textTransform:"capitalize",
  fontSize:15,
  color:PALETTE.textDark
},

weekRow:{
  display:"grid",
  gridTemplateColumns:"repeat(7,1fr)",
  gap:6,
  marginBottom:6,
  textAlign:"center"
},

weekDay:{
  fontSize:13,
  fontWeight:700,
  color:"#9CA3AF"
},

dayCell:{
  height:42,
  display:"flex",
  alignItems:"center",
  justifyContent:"center",
  borderRadius:999,
  cursor:"pointer",
  transition:"all 0.15s"
},

dayCellSelected:{
  backgroundColor:PALETTE.primary
},

dayCellDisabled:{
  opacity:0.25,
  cursor:"default"
},

dayLabelSelected:{
  color:PALETTE.gold,
  fontWeight:800
},

dayLabelDisabled:{
  color:"#9CA3AF"
},

arrowBtn:{
  background:"none",
  border:"none",
  fontSize:20,
  cursor:"pointer",
  padding:"4px 10px",
  color:PALETTE.textDark
},

clearBtn:{
  marginTop:18,
  background:"none",
  border:"none",
  color:"#6B7280",
  textDecoration:"underline",
  cursor:"pointer",
  fontSize:13
},

actions:{
  display:"flex",
  gap:12,
  marginTop:18
},

btnSecondary:{
  flex:1,
  padding:"12px 0",
  borderRadius:999,
  background:"#F9FAFB",
  border:"1px solid #D1D5DB",
  fontWeight:700,
  fontSize:15
},

btnPrimary:{
  flex:1,
  padding:"12px 0",
  borderRadius:999,
  background:PALETTE.primary,
  color:PALETTE.gold,
  fontWeight:900,
  fontSize:15
}

};