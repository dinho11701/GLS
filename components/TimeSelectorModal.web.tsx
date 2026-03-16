import React, { useMemo } from "react";

const PALETTE = {
  bg: "#0A0F2C",
  white: "#FFFFFF",
  gold: "#FFD700",
  soft: "rgba(255,255,255,0.1)",
};

export default function TimeSelectorModal({
  visible,
  onClose,
  onConfirm,
  availabilityStart,
  availabilityEnd,
  selectedStartTime,
  mode,
}) {

  const generateSlots = (start: string, end: string) => {

    if (!start || !end) return [];

    const slots: string[] = [];

    const [sh, sm] = start.substring(0,5).split(":").map(Number);
    const [eh, em] = end.substring(0,5).split(":").map(Number);

    let cur = sh * 60 + sm;
    const endMin = eh * 60 + em;

    while (cur <= endMin) {

      const h = String(Math.floor(cur / 60)).padStart(2, "0");
      const m = String(cur % 60).padStart(2, "0");

      slots.push(`${h}:${m}`);

      cur += 30;

    }

    return slots;

  };

  const slots = useMemo(() => {

    const all = generateSlots(availabilityStart, availabilityEnd);

    if (mode === "start") return all;

    if (mode === "end" && selectedStartTime) {

      const startMin =
        Number(selectedStartTime.split(":")[0]) * 60 +
        Number(selectedStartTime.split(":")[1]);

      return all.filter((t) => {

        const min =
          Number(t.split(":")[0]) * 60 +
          Number(t.split(":")[1]);

        return min > startMin;

      });

    }

    return [];

  }, [availabilityStart, availabilityEnd, selectedStartTime, mode]);

  if (!visible) return null;

  return (

    <div style={styles.overlay} onClick={onClose}>

      <div
        style={styles.sheet}
        onClick={(e)=>e.stopPropagation()}
      >

        <div style={styles.header}>

          <h3 style={styles.title}>
            {mode === "start"
              ? "Sélectionnez votre heure de début"
              : `Sélectionnez votre heure de fin`}
          </h3>

          <button
            style={styles.close}
            onClick={onClose}
          >
            Fermer
          </button>

        </div>

        <div style={styles.list}>

          {slots.map((item) => (

            <button
              key={item}
              style={styles.slot}
              onClick={() => {
                onConfirm(item);
                onClose();
              }}
            >

              {item}

            </button>

          ))}

        </div>

      </div>

    </div>

  );

}

const styles:any = {

overlay:{
  position:"fixed",
  inset:0,
  background:"rgba(0,0,0,0.5)",
  display:"flex",
  justifyContent:"flex-end",
  zIndex:9999
},

sheet:{
  background:PALETTE.bg,
  width:"100%",
  maxWidth:520,
  margin:"0 auto",
  paddingTop:20,
  paddingLeft:14,
  paddingRight:14,
  borderTopLeftRadius:24,
  borderTopRightRadius:24,
  height:"55%",
  overflowY:"auto"
},

header:{
  display:"flex",
  flexDirection:"row",
  justifyContent:"space-between",
  marginBottom:14
},

title:{
  color:PALETTE.white,
  fontSize:18,
  fontWeight:800
},

close:{
  background:"none",
  border:"none",
  color:PALETTE.gold,
  fontSize:16,
  fontWeight:700,
  cursor:"pointer"
},

list:{
  display:"flex",
  flexDirection:"column"
},

slot:{
  padding:"18px 0",
  borderBottom:`1px solid ${PALETTE.soft}`,
  background:"transparent",
  border:"none",
  textAlign:"left",
  fontSize:17,
  color:PALETTE.white,
  cursor:"pointer",
  fontWeight:600
}

};