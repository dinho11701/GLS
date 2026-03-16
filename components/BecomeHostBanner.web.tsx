import React from "react";
import { useRouter } from "expo-router";

export default function BecomeHostBannerWeb() {
  const router = useRouter();

  return (
    <div style={styles.wrapper}>
      <p style={styles.text}>Vous avez un service à offrir ?</p>

      <button
        style={styles.btn}
        onClick={() => router.push("/(tabs)/partner/CreateService")}
      >
        Devenez hôte
      </button>
    </div>
  );
}

const styles = {
  wrapper: {
    background: "rgba(255,215,0,0.12)",
    border: "1px solid rgba(255,255,255,0.18)",
    padding: "14px 20px",
    borderRadius: "12px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: "25px",
    marginBottom: "10px",
  },

  text: {
    fontSize: "16px",
    opacity: 0.85,
  },

  btn: {
    background: "#FFD700",
    color: "#0A0F2C",
    padding: "10px 20px",
    borderRadius: "10px",
    border: "none",
    fontWeight: "900",
    cursor: "pointer",
    fontSize: "15px",
    transition: "0.2s",
  },
};
