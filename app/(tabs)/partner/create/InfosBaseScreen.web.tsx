// ✔️ VERSION FINALE CORRIGÉE — InfoBaseScreen.web.tsx
// ⚠️ COMPORTEMENT CORRIGÉ — UX ÉDITION / UI & STYLES INCHANGÉS

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useLocalSearchParams } from "expo-router";

const PALETTE = {
  primary: "#0A0F2C",
  white: "#FFFFFF",
  cream: "#F9FAFB",
  textDark: "#0B1220",
  placeholder: "rgba(11,18,32,0.45)",
  coral: "#FF6B6B",
  gold: "#FFD700",
  peach: "#EF8A73",
  border: "rgba(11,18,32,0.18)",
};

const RECOMMENDED_DESC_MIN = 20;

const API_BASE = (
  process.env.EXPO_PUBLIC_API_BASE ?? "http://127.0.0.1:5055/api/v1"
).replace(/\/+$/, "");

export default function InfoBaseScreenWeb() {
  const router = useRouter();
  const params = useLocalSearchParams<{ from?: string; id?: string }>();

  /* -------------------------------------------------------
     MODE STRICT — ID VIA URL UNIQUEMENT
  ------------------------------------------------------- */
  const serviceId =
    typeof params.id === "string" &&
    params.id !== "null" &&
    params.id.trim().length > 0
      ? params.id
      : null;

  const isEditMode = Boolean(serviceId);
  const returnToReview = params.from === "review" && isEditMode;

  const [title, setTitle] = useState("");
  const [categorie, setCategorie] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);

  /* -------------------------------------------------------
     CLEANUP EN MODE CRÉATION
  ------------------------------------------------------- */
  useEffect(() => {
    if (!isEditMode) {
      localStorage.removeItem("edit_service_id");
    }
  }, [isEditMode]);

  /* -------------------------------------------------------
     HYDRATATION DES DRAFTS DEPUIS L’API (UNE SEULE FOIS)
     👉 UX ÉDITION PROPRE
  ------------------------------------------------------- */
  useEffect(() => {
  if (!isEditMode) return;

  // ⛔️ Déjà hydraté → rien à faire
  if (localStorage.getItem("draft_service_step1")) return;

  setLoading(true);

  (async () => {
    try {
      const token = localStorage.getItem("idToken");
      const resp = await fetch(
        `${API_BASE}/partners/services/${serviceId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const data = await resp.json();
      if (!resp.ok || !data?.item) return;

      const svc = data.item;

      // ✅ STEP 1
      localStorage.setItem(
        "draft_service_step1",
        JSON.stringify({
          Service: svc.Service ?? "",
          Categorie: svc.Categorie ?? svc.Activity_Secteur ?? "",
          Description: svc.Description ?? "",
        })
      );

      // ✅ STEP 2
      localStorage.setItem(
        "draft_service_step2_price",
        JSON.stringify({
          price: svc.Fee ?? "",
          currency: svc?.Pricing?.currency ?? "CAD",
        })
      );

      // ✅ STEP 3
      localStorage.setItem(
        "draft_service_step3_pictures",
        JSON.stringify({
          images: svc.Pictures ?? [],
          gallery: [],
        })
      );

      // ✅ STEP 4
      localStorage.setItem(
        "draft_service_step4_availability",
        JSON.stringify({
          availability: {
            ...svc.Availability,
            days: (svc.Availability?.days || []).map((d: number) => d - 1),
          },
        })
      );
    } catch (e) {
      console.error("HYDRATE ALL DRAFTS ERROR", e);
    } finally {
      setLoading(false);
    }
  })();
}, [isEditMode, serviceId]);

  /* -------------------------------------------------------
     LOAD DRAFT (SOURCE DE VÉRITÉ)
  ------------------------------------------------------- */
  useEffect(() => {
    try {
      const raw = localStorage.getItem("draft_service_step1");
      if (!raw) return;

      const d = JSON.parse(raw);
      setTitle(d?.Service ?? "");
      setCategorie(d?.Categorie ?? "");
      setDescription(d?.Description ?? "");
    } catch {}
  }, []);

  /* -------------------------------------------------------
     VALIDATION
  ------------------------------------------------------- */
  const canContinue = useMemo(
    () =>
      title.trim().length >= 3 &&
      categorie.trim().length >= 2 &&
      description.trim().length >= 1,
    [title, categorie, description]
  );

  /* -------------------------------------------------------
     SAVE + NAVIGATION
  ------------------------------------------------------- */
  const handleContinue = useCallback(() => {
    if (!canContinue) return;

    localStorage.setItem(
      "draft_service_step1",
      JSON.stringify({
        Service: title.trim(),
        Categorie: categorie.trim(),
        Description: description.trim(),
      })
    );

    if (returnToReview) {
      router.replace(
        `/(tabs)/partner/create/ReviewScreen?id=${serviceId}&from=review&t=${Date.now()}`
      );
    } else {
      router.push(
        `/(tabs)/partner/create/PriceScreen?id=${serviceId ?? ""}`
      );
    }
  }, [
    canContinue,
    title,
    categorie,
    description,
    returnToReview,
    serviceId,
    router,
  ]);

  const handleBack = useCallback(() => {
    if (returnToReview) {
      router.replace(
        `/(tabs)/partner/create/ReviewScreen?id=${serviceId}&from=review&t=${Date.now()}`
      );
    } else {
      router.back();
    }
  }, [returnToReview, serviceId, router]);

  const descLen = description.trim().length;
  const showHint = descLen > 0 && descLen < RECOMMENDED_DESC_MIN;

  /* -------------------------------------------------------
     RENDER
  ------------------------------------------------------- */
  if (loading) {
    return (
      <div style={styles.page}>
        <p style={{ textAlign: "center", padding: 30 }}>Chargement…</p>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <button style={styles.backBtn} onClick={handleBack}>
          ⟵
        </button>
        <h1 style={styles.headerTitle}>
          {isEditMode ? "Modifier l’offre" : "Créer (Pro)"}
        </h1>
        <div style={{ width: 24 }} />
      </div>

      <div style={styles.stepBar}>
        <p style={styles.stepTitle}>Étape 1/4 : Infos de base</p>
        <div style={styles.progressTrack}>
          <div style={styles.progressFill} />
        </div>
      </div>

      <div style={styles.form}>
        <FieldLabel label="Titre de l’offre" />
        <Input
          placeholder="Ex : Maintenance bornes EV"
          value={title}
          onChange={setTitle}
        />

        <FieldLabel label="Catégorie" />
        <Input
          placeholder="Ex : Coiffure, Plomberie, Location…"
          value={categorie}
          onChange={setCategorie}
        />

        <FieldLabel label="Description" />
        <Textarea
          placeholder="Décris ton offre…"
          value={description}
          onChange={setDescription}
        />

        {showHint && (
          <p style={styles.hint}>
            Astuce : une description ≥ {RECOMMENDED_DESC_MIN} caractères améliore
            la conversion ({descLen}/{RECOMMENDED_DESC_MIN}).
          </p>
        )}

        <button
          onClick={handleContinue}
          disabled={!canContinue}
          style={{
            ...styles.continueBtn,
            opacity: canContinue ? 1 : 0.5,
            cursor: canContinue ? "pointer" : "not-allowed",
          }}
        >
          {returnToReview ? "Mettre à jour et revenir" : "Continuer"}
        </button>
      </div>
    </div>
  );
}

/* ----------------------------- COMPONENTS ----------------------------- */

function FieldLabel({ label }: { label: string }) {
  return <p style={styles.fieldLabel}>{label}</p>;
}

function Input({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <input
      style={styles.input}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

function Textarea({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <textarea
      style={styles.textarea}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

/* ----------------------------- STYLES ----------------------------- */
const styles = {
  page: {
    backgroundColor: PALETTE.cream,
    minHeight: "100vh",
    fontFamily: "sans-serif",
  },
  header: {
    display: "flex",
    alignItems: "center",
    padding: "16px",
    borderBottom: `1px solid ${PALETTE.border}`,
  },
  backBtn: {
    fontSize: 22,
    fontWeight: "900",
    background: "none",
    border: "none",
    cursor: "pointer",
    color: PALETTE.primary,
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 24,
    fontWeight: "900",
    color: PALETTE.primary,
    margin: 0,
  },
  stepBar: {
    padding: "16px",
    borderBottom: `1px solid ${PALETTE.border}`,
  },
  stepTitle: {
    fontWeight: "900",
    marginBottom: 8,
  },
  progressTrack: {
    height: 8,
    backgroundColor: "#E6E9EF",
    borderRadius: 999,
  },
  progressFill: {
    width: "25%",
    height: "100%",
    backgroundColor: PALETTE.gold,
  },
  form: { padding: 20 },
  fieldLabel: {
    marginTop: 14,
    marginBottom: 6,
    fontWeight: "800",
  },
  input: {
    width: "100%",
    padding: "12px",
    borderRadius: 10,
    border: `1.5px solid ${PALETTE.border}`,
    fontSize: 15,
  },
  textarea: {
    width: "100%",
    height: 120,
    padding: "12px",
    borderRadius: 10,
    border: `1.5px solid ${PALETTE.border}`,
    fontSize: 15,
    resize: "vertical",
  },
  hint: {
    marginTop: 6,
    color: "rgba(11,18,32,0.7)",
    fontWeight: "600",
  },
  continueBtn: {
    marginTop: 24,
    width: "100%",
    backgroundColor: PALETTE.peach,
    padding: "14px",
    borderRadius: 14,
    border: "none",
    fontSize: 16,
    fontWeight: "900",
    color: "white",
  },
};