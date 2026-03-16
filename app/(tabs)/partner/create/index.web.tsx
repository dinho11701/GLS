// app/(tabs)/partner/create/index.web.tsx
import React, { useEffect, useState } from "react";
import { useRouter, useLocalSearchParams } from "expo-router";

/* -------------------------------------------------------
   PALETTE
------------------------------------------------------- */
const PALETTE = {
  primary: "#0A0F2C",
  white: "#FFFFFF",
  cream: "#F9FAFB",
  textDark: "#0B1220",
  border: "rgba(11,18,32,0.18)",
};

/* -------------------------------------------------------
   ITEM COMPONENT (WEB)
------------------------------------------------------- */
function Item({ title, to }: { title: string; to: string }) {
  const router = useRouter();
  return (
    <div onClick={() => router.push(to)} style={styles.item}>
      <p style={styles.itemText}>{title}</p>
    </div>
  );
}

/* -------------------------------------------------------
   MAIN PAGE
------------------------------------------------------- */
export default function PartnerCreateHomeWeb() {
  const router = useRouter();
  const params = useLocalSearchParams();

  // ⭐ Récupère l'id si on vient en mode édition
  const serviceId = params?.id ?? "";

  const [allowed, setAllowed] = useState<null | boolean>(null);

  /* --------- CHECK ROLE --------- */
  useEffect(() => {
    const role = localStorage.getItem("userRole") || undefined;

    if (role === "host" || role === "partner") {
      setAllowed(true);
    } else {
      setAllowed(false);
      router.replace("/(tabs)");
    }
  }, []);

  if (allowed === null) {
    return (
      <div style={styles.loaderPage}>
        <div className="loader" />
      </div>
    );
  }

  if (!allowed) return null;

  /* -------------------------------------------------------
     RENDER
  ------------------------------------------------------- */
  return (
    <div style={styles.page}>
      <div style={styles.wrapper}>
        <h1 style={styles.title}>Espace partenaire</h1>
        <p style={styles.subtitle}>Créer / éditer votre offre</p>

        <div style={styles.card}>
          <Item
            title="Infos de base"
            to={`/(tabs)/partner/create/InfosBaseScreen?from=review&id=${serviceId}`}
          />
          <Item
            title="Tarification"
            to={`/(tabs)/partner/create/PriceScreen?from=review&id=${serviceId}`}
          />
          <Item
            title="Photos"
            to={`/(tabs)/partner/create/PictureScreen?from=review&id=${serviceId}`}
          />
          <Item
            title="Disponibilités"
            to={`/(tabs)/partner/create/AvailabilityScreen?from=review&id=${serviceId}`}
          />
          <Item
            title="Récapitulatif"
            to={`/(tabs)/partner/create/ReviewScreen?id=${serviceId}`}
          />
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------
   STYLES WEB
------------------------------------------------------- */
const styles = {
  page: {
    backgroundColor: PALETTE.cream,
    minHeight: "100vh",
    padding: "20px",
    fontFamily: "sans-serif",
  },

  wrapper: {
    maxWidth: 600,
    margin: "0 auto",
  },

  title: {
    fontSize: 26,
    fontWeight: "900",
    color: PALETTE.textDark,
    marginBottom: 4,
  },

  subtitle: {
    color: "rgba(11,18,32,0.7)",
    marginBottom: 14,
    fontWeight: "700",
  },

  card: {
    backgroundColor: PALETTE.white,
    borderRadius: 16,
    border: `1.5px solid ${PALETTE.border}`,
    overflow: "hidden",
  },

  item: {
    padding: "16px 14px",
    borderBottom: `1px solid ${PALETTE.border}`,
    cursor: "pointer",
    transition: "background 0.2s",
  },

  itemText: {
    color: PALETTE.primary,
    fontWeight: "800",
    margin: 0,
  },

  loaderPage: {
    minHeight: "100vh",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
  },
};
