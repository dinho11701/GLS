import React from "react";
import { useRouter } from "expo-router";

type Service = {
  id: string;
  title: string;
  fee: number;
  currency?: string;
  instances?: number;
  instances_left?: number;
};

type Props = {
  service: Service;
};

export default function ServiceCard({ service }: Props) {

  const router = useRouter();

  const currency = service.currency ?? "CAD";

  const price =
    currency === "CAD"
      ? `${service.fee}$`
      : `${service.fee} ${currency}`;

  const instancesLeft =
    service.instances_left ?? service.instances ?? 1;

  const disabled = instancesLeft <= 0;

  return (

    <div
      style={{
        ...styles.card,
        ...(disabled ? styles.cardDisabled : {})
      }}
      onClick={() => {
        if (disabled) return;

        router.push({
          pathname: "/(tabs)/services/DetailServiceScreen",
          params: { id: service.id },
        });
      }}
    >

      <div style={styles.title}>
        {service.title}
      </div>

      <div style={styles.price}>
        {price}
      </div>

      <div style={styles.instancesRow}>
        <span style={styles.icon}>👥</span>

        <span style={styles.instancesText}>
          {instancesLeft > 1
            ? `${instancesLeft} places disponibles`
            : instancesLeft === 1
            ? "1 place disponible"
            : "Complet"}
        </span>
      </div>

    </div>

  );
}

const styles:any = {

  card:{
    background:"rgba(255,255,255,0.1)",
    padding:"20px",
    borderRadius:"12px",
    border:"1px solid rgba(255,255,255,0.2)",
    cursor:"pointer",
    width:"48%",
    marginBottom:"12px"
  },

  cardDisabled:{
    opacity:0.35,
    cursor:"default"
  },

  title:{
    color:"#fff",
    fontWeight:700,
    fontSize:"16px"
  },

  price:{
    marginTop:"8px",
    color:"#FFD700",
    fontWeight:800,
    fontSize:"15px"
  },

  instancesRow:{
    display:"flex",
    alignItems:"center",
    marginTop:"6px"
  },

  icon:{
    fontSize:"14px",
    marginRight:"6px"
  },

  instancesText:{
    color:"#ccc",
    fontSize:"13px"
  }

};