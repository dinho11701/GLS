import React from "react";

type Props = {
  value: number;
  onChange: (val: number) => void;
};

const RADIUS_VALUES = [5, 10, 15, 25, 50];

export default function HostRadiusSlider({ value, onChange }: Props) {

  const currentIndex = RADIUS_VALUES.indexOf(value);
  const safeIndex = currentIndex === -1 ? 0 : currentIndex;

  return (

    <div style={styles.container}>

      <div style={styles.label}>
        Rayon d'activité : {RADIUS_VALUES[safeIndex]} km
      </div>

      <input
        type="range"
        min={0}
        max={RADIUS_VALUES.length - 1}
        step={1}
        value={safeIndex}
        onChange={(e) =>
          onChange(RADIUS_VALUES[Number(e.target.value)])
        }
        style={styles.slider}
      />

    </div>

  );

}

const styles:any = {

container:{
  position:"absolute",
  bottom:120,
  left:20,
  right:20,
  background:"#fff",
  padding:16,
  borderRadius:16,
  boxShadow:"0 6px 18px rgba(0,0,0,0.2)",
  zIndex:999
},

label:{
  fontWeight:700,
  marginBottom:8
},

slider:{
  width:"100%",
  cursor:"pointer"
}

};
