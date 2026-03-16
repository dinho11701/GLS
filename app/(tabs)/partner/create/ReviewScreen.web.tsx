// ⛔️ NOTE IMPORTANTE : VERSION FINALE — REVIEW + PUBLICATION FONCTIONNELLES

import React, { useEffect, useMemo, useState } from "react";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import ScrollDownButton from "../../../../components/ScrollDownButton.web";

/* -------------------------------------------------------
   PALETTE
------------------------------------------------------- */
const PALETTE = {
  primary: "#0A0F2C",
  white: "#FFFFFF",
  cream: "#F9FAFB",
  textDark: "#0B1220",
  coral: "#FF6B6B",
  gold: "#FFD700",
  peach: "#EF8A73",
  border: "rgba(11,18,32,0.18)",
};

const API_BASE = (
  process.env.EXPO_PUBLIC_API_BASE ?? "http://127.0.0.1:5055/api/v1"
).replace(/\/+$/, "");

/* ------------------- UTILS ------------------- */
function load(key: string) {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "null");
  } catch {
    return null;
  }
}

export default function ReviewScreenWeb() {
  const router = useRouter();
  
  const DAY_LABELS_ISO = ["", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];



  const params = useLocalSearchParams<{ id?: string; from?: string }>();

  /* -------------------------------------------------------
     MODE STRICT
  ------------------------------------------------------- */
  const serviceId =
    typeof params.id === "string" &&
    params.id !== "null" &&
    params.id.trim().length > 0
      ? params.id
      : null;

  const isEditMode = Boolean(serviceId);

  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);

  const [s1, setS1] = useState<any>(null);
  const [s2, setS2] = useState<any>(null);
  const [s3, setS3] = useState<any>(null);
  const [s4, setS4] = useState<any>(null);

  /* -------------------------------------------------------
     LOAD DATA
  ------------------------------------------------------- */
  useEffect(() => {
    async function init() {
      // 🔁 Retour depuis un écran d’édition → drafts
      if (params.from === "review") {
        setS1(load("draft_service_step1"));
        setS2(load("draft_service_step2_price"));
        setS3(load("draft_service_step3_pictures"));
        setS4(load("draft_service_step4_availability"));
console.log(
  "🟡 [ReviewScreen] s4.availability.days (APRES load) =",
  load("draft_service_step4_availability")?.availability?.days
);
        setLoading(false);
        return;
      }

      // ✏️ Édition directe → API
      if (isEditMode && serviceId) {
        const token = localStorage.getItem("idToken");
        const resp = await fetch(`${API_BASE}/partners/services/${serviceId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        const data = await resp.json();
        if (resp.ok && data?.item) {
          const svc = data.item;

          setS1({
            Service: svc.Service,
            Categorie: svc.Categorie,
            Description: svc.Description,
          });

          setS2({
            price: svc.Fee,
            currency: svc?.Pricing?.currency || "CAD",
          });

          setS3({
            images: svc.Pictures || [],
            gallery: [],
          });

          setS4({
            availability: {
              ...svc.Availability,
              days: (svc.Availability?.days || []).map((d: number) => d - 1),
            },
          });

          setLoading(false);
          return;
        }
      }

      // 🆕 Création → drafts
      setS1(load("draft_service_step1"));
      setS2(load("draft_service_step2_price"));
      setS3(load("draft_service_step3_pictures"));
      setS4(load("draft_service_step4_availability"));
console.log(
  "🟡 [ReviewScreen] s4.availability.days (APRES load) =",
  load("draft_service_step4_availability")?.availability?.days
);
      setLoading(false);
    }

    init();
  }, [params.from, isEditMode, serviceId]);

  /* -------------------------------------------------------
     PICTURES
  ------------------------------------------------------- */
  const allPictures = useMemo(() => {
    if (!s3) return [];
    return [...(s3.images ?? []), ...(s3.gallery ?? [])].filter((x) => x?.uri);
  }, [s3]);

  /* -------------------------------------------------------
     VALIDATION
  ------------------------------------------------------- */
  const isValid =
    s1?.Service &&
    s1?.Categorie &&
    s1?.Description &&
    Number(s2?.price) > 0;

  /* -------------------------------------------------------
     PUBLISH
  ------------------------------------------------------- */
  const publish = async () => {
    if (!isValid || publishing) return;

    setPublishing(true);
console.log(
  "🟠 [ReviewScreen] s4.availability.days AVANT payload =",
  s4?.availability?.days
);

    try {
      const payload = {
        Service: s1.Service,
        Categorie: s1.Categorie,
        Description: s1.Description,
        Activity_Secteur: s1.Categorie,
        Fee: Number(s2.price),
        Pricing: {
          currency: (s2.currency || "CAD").toUpperCase(),
        },
        Pictures: allPictures.map((p: any) => ({ uri: p.uri })),
        Availability: s4?.availability
          ? {
              ...s4.availability,
              days: s4.availability.days,
            }
          : null,
      };

console.log(
  "🔵 [ReviewScreen] payload.Availability.days =",
  payload.Availability?.days
);

      const url = isEditMode
        ? `${API_BASE}/partners/services/${serviceId}`
        : `${API_BASE}/partners/services`;

      const method = isEditMode ? "PUT" : "POST";
      const token = localStorage.getItem("idToken");

      const resp = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const text = await resp.text();
      let data: any = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {}

      if (!resp.ok) {
        alert(data.error || "Erreur lors de la publication");
        return;
      }

      // 🧹 cleanup
      localStorage.removeItem("draft_service_step1");
      localStorage.removeItem("draft_service_step2_price");
      localStorage.removeItem("draft_service_step3_pictures");
      localStorage.removeItem("draft_service_step4_availability");

      alert(isEditMode ? "Service mis à jour !" : "Offre publiée !");
      router.replace("/partner/services");
    } catch (e: any) {
      alert(e?.message || "Erreur serveur");
    } finally {
      setPublishing(false);
    }
  };

  /* -------------------------------------------------------
     RENDER
  ------------------------------------------------------- */
  if (loading) {
    return (
      <div style={styles.loading}>
        <p>Chargement…</p>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <h1 style={styles.title}>Récapitulatif</h1>

      <Section
        title="Infos de base"
        onEdit={() =>
          router.replace(
            `/(tabs)/partner/create/InfosBaseScreen?from=review&id=${serviceId ?? ""}`
          )
        }
      >
        <Row label="Titre" value={s1?.Service} />
        <Row label="Catégorie" value={s1?.Categorie} />
        <Row label="Description" value={s1?.Description} multiline />
      </Section>

      <Section
        title="Tarification"
        onEdit={() =>
          router.replace(
            `/(tabs)/partner/create/PriceScreen?from=review&id=${serviceId ?? ""}`
          )
        }
      >
        <Row
          label="Prix"
          value={
            s2?.price
              ? `${s2.price} ${(s2?.currency || "CAD").toUpperCase()}`
              : "—"
          }
        />
      </Section>

      <Section
        title="Photos"
        onEdit={() =>
          router.replace(
            `/(tabs)/partner/create/PictureScreen?from=review&id=${serviceId ?? ""}`
          )
        }
      >
        {allPictures.length ? (
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {allPictures.map((img: any, i: number) => (
              <img
                key={i}
                src={img.uri}
                style={{ width: 100, height: 100, borderRadius: 8 }}
              />
            ))}
          </div>
        ) : (
          <p>Aucune photo.</p>
        )}
      </Section>

      <Section
        title="Disponibilités"
        onEdit={() =>
          router.replace(
            `/(tabs)/partner/create/AvailabilityScreen?from=review&id=${serviceId ?? ""}`
          )
        }
      >
        <Row
          label="Jours"
          value={(s4?.availability?.days || [])
            .map((d: number) => DAY_LABELS_ISO[d])
            .join(" • ")}
        />
        <Row
          label="Heures"
          value={
            s4?.availability
              ? `${s4.availability.startTime} → ${s4.availability.endTime}`
              : "—"
          }
        />
      </Section>

      <button
        style={styles.publishBtn}
        disabled={!isValid || publishing}
        onClick={publish}
      >
        {publishing
          ? isEditMode
            ? "Mise à jour…"
            : "Publication…"
          : isEditMode
          ? "Mettre à jour le service"
          : "Publier l’offre"}
      </button>

      <ScrollDownButton />
    </div>
  );
}

/* -------------------------------------------------------
   UI
------------------------------------------------------- */
function Section({ title, children, onEdit }: any) {
  return (
    <div style={styles.card}>
      <div style={styles.cardHeader}>
        <h2 style={styles.cardTitle}>{title}</h2>
        <button style={styles.editBtn} onClick={onEdit}>
          <Ionicons name="create-outline" size={16} />
          Modifier
        </button>
      </div>
      {children}
    </div>
  );
}

function Row({ label, value, multiline }: any) {
  return (
    <div style={{ marginBottom: 12 }}>
      <strong>{label} :</strong>
      <p style={{ whiteSpace: multiline ? "pre-wrap" : "normal" }}>
        {value || "—"}
      </p>
    </div>
  );
}

/* -------------------------------------------------------
   STYLES (INCHANGÉS)
------------------------------------------------------- */
const styles = {
  loading: {
    height: "100vh",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    background: PALETTE.cream,
  },
  page: {
    padding: 30,
    backgroundColor: PALETTE.cream,
    minHeight: "100vh",
    color: PALETTE.textDark,
  },
  title: {
    fontSize: 28,
    fontWeight: "900",
    marginBottom: 20,
  },
  card: {
    backgroundColor: PALETTE.white,
    borderRadius: 16,
    padding: 20,
    border: `1px solid ${PALETTE.border}`,
    marginBottom: 20,
  },
  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: 10,
    alignItems: "center",
  },
  cardTitle: { fontWeight: "900", fontSize: 18 },
  editBtn: {
    background: PALETTE.cream,
    border: `1px solid ${PALETTE.border}`,
    padding: "6px 12px",
    borderRadius: 20,
    cursor: "pointer",
    fontWeight: 800,
    display: "flex",
    alignItems: "center",
    gap: 6,
  },
  publishBtn: {
    backgroundColor: PALETTE.peach,
    padding: "14px 20px",
    borderRadius: 10,
    color: "white",
    fontWeight: "900",
    fontSize: 16,
    border: "none",
    cursor: "pointer",
    marginTop: 20,
  },
};