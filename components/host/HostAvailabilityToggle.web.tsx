import React from "react";

type Props = {
  isActive: boolean;
  onToggle: () => void;
};

export default function HostAvailabilityToggle({
  isActive,
  onToggle,
}: Props) {
  return (
    <div style={styles.container}>
      <span style={styles.label}>
        {isActive ? "Disponible" : "Indisponible"}
      </span>

      <label style={styles.switch}>
        <input
          type="checkbox"
          checked={isActive}
          onChange={onToggle}
          style={{ display: "none" }}
        />

        <span
          style={{
            ...styles.slider,
            background: isActive ? "#FF6B6B" : "#ccc",
          }}
        >
          <span
            style={{
              ...styles.circle,
              transform: isActive
                ? "translateX(22px)"
                : "translateX(0px)",
            }}
          />
        </span>
      </label>
    </div>
  );
}

const styles: any = {

  container:{
    position:"absolute",
    bottom:40,
    left:20,
    right:20,
    background:"#fff",
    padding:16,
    borderRadius:16,
    display:"flex",
    justifyContent:"space-between",
    alignItems:"center",
    flexDirection:"row",
    boxShadow:"0 6px 18px rgba(0,0,0,0.2)",
    zIndex:999
  },

  label:{
    fontWeight:700
  },

  switch:{
    position:"relative",
    width:46,
    height:24,
    cursor:"pointer"
  },

  slider:{
    position:"absolute",
    top:0,
    left:0,
    right:0,
    bottom:0,
    borderRadius:20,
    transition:"background 0.25s",
    display:"flex",
    alignItems:"center"
  },

  circle:{
    width:20,
    height:20,
    borderRadius:"50%",
    background:"#fff",
    transition:"transform 0.25s",
    marginLeft:2
  }

};