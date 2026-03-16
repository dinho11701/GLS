import React from "react";

type Props = {
  onZoomIn: () => void;
  onZoomOut: () => void;
};

export default function MapZoomControlsWeb({ onZoomIn, onZoomOut }: Props) {
  return (
    <div style={styles.container}>
      <button style={styles.button} onClick={onZoomIn}>+</button>
      <button style={styles.button} onClick={onZoomOut}>−</button>
    </div>
  );
}

const styles: any = {
  container: {
    position: "absolute",
    right: 16,
    top: 120,
    display: "flex",
    flexDirection: "column",
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 12,
    overflow: "hidden",
    zIndex: 1000,
  },
  button: {
    padding: "12px",
    fontSize: "18px",
    fontWeight: "bold",
    color: "white",
    background: "transparent",
    border: "none",
    cursor: "pointer",
  },
};