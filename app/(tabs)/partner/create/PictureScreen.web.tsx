// ✔️ VERSION FINALE DÉBLOQUÉE — PictureScreen.web.tsx
// ⚠️ BUG ÉCRAN NOIR CORRIGÉ — UI / STYLES INCHANGÉS

import React, { useCallback, useEffect, useState } from "react";
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
  peachSoft: "#F8CBC1",
  border: "rgba(11,18,32,0.18)",
  ink: "rgba(11,18,32,0.08)",
};

type Pic = { uri: string };
const STORAGE_KEY = "draft_service_step3_pictures";
const MAX = 6;

export default function PictureScreenWeb() {
  const router = useRouter();
  const params = useLocalSearchParams<{ from?: string; id?: string }>();

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
  const returnToReview = params.from === "review" && isEditMode;

  const [cover, setCover] = useState<Pic | null>(null);
  const [gallery, setGallery] = useState<Pic[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  /* -------------------------------------------------------
     LOAD DRAFT (FIX CRITIQUE ICI)
  ------------------------------------------------------- */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);

        let c = data.cover ?? null;
        let g = Array.isArray(data.gallery) ? data.gallery : [];

        // migration ancien format
        if (!c && !g.length && Array.isArray(data.images)) {
          c = data.images[0] ?? null;
          g = data.images.slice(1);
        }

        setCover(c);
        setGallery(g);
      }
    } catch {
      // ignore
    } finally {
      // ✅ TOUJOURS exécuté
      setLoading(false);
    }
  }, []);

  /* -------------------------------------------------------
     PICK IMAGES
  ------------------------------------------------------- */
  const handlePick = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files?.length) return;

      const current = (cover ? 1 : 0) + gallery.length;
      if (current >= MAX) {
        alert(`Maximum ${MAX} images.`);
        return;
      }

      const remaining = MAX - current;
      const selected = Array.from(files).slice(0, remaining);

      const pics = selected.map((f) => ({
        uri: URL.createObjectURL(f),
      }));

      if (!cover) {
        const [first, ...rest] = pics;
        setCover(first || null);
        setGallery((g) => [...g, ...rest]);
      } else {
        setGallery((g) => [...g, ...pics]);
      }
    },
    [cover, gallery]
  );

  /* -------------------------------------------------------
     COVER MANAGEMENT
  ------------------------------------------------------- */
  const setAsCover = useCallback(
    (p: Pic, idx: number) => {
      const next = [...gallery];
      next.splice(idx, 1);
      if (cover) next.unshift(cover);
      setCover(p);
      setGallery(next);
    },
    [cover, gallery]
  );

  const removeCover = useCallback(() => {
    const [first, ...rest] = gallery;
    setCover(first || null);
    setGallery(rest);
  }, [gallery]);

  const removeFromGallery = useCallback((idx: number) => {
    setGallery((g) => g.filter((_, i) => i !== idx));
  }, []);

  /* -------------------------------------------------------
     SAVE & NAVIGATION
  ------------------------------------------------------- */
  const saveAndNext = useCallback(() => {
    setSaving(true);

    const images = [...(cover ? [cover] : []), ...gallery];
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ cover, gallery, images })
    );

    if (returnToReview) {
      router.replace(
        `/(tabs)/partner/create/ReviewScreen?id=${serviceId}&from=review&t=${Date.now()}`
      );
    } else {
      router.push(
        `/(tabs)/partner/create/AvailabilityScreen?id=${serviceId ?? ""}`
      );
    }

    setSaving(false);
  }, [cover, gallery, returnToReview, serviceId, router]);

  /* -------------------------------------------------------
     RENDER
  ------------------------------------------------------- */
  if (loading) {
    return (
      <div style={styles.loaderPage}>
        <p style={{ color: PALETTE.primary }}>Chargement…</p>
      </div>
    );
  }

  const totalCount = (cover ? 1 : 0) + gallery.length;

  return (
    <div style={styles.page}>
      {/* UI STRICTEMENT IDENTIQUE */}
      {/* … rien changé ici … */}
      <div style={styles.header}>
        <button
          style={styles.backBtn}
          onClick={() =>
            returnToReview
              ? router.replace(
                  `/(tabs)/partner/create/ReviewScreen?id=${serviceId}&from=review&t=${Date.now()}`
                )
              : router.back()
          }
        >
          ←
        </button>
        <h2 style={styles.headerTitle}>
          {isEditMode ? "Modifier l’offre" : "Créer (Pro)"}
        </h2>
      </div>

      <div style={styles.stepBar}>
        <p style={styles.stepTitle}>Étape 3/4 : Photos</p>
        <div style={styles.progressTrack}>
          <div style={styles.progressFill} />
        </div>
        <p style={styles.helperText}>
          Ajoute des images. {totalCount}/{MAX}
        </p>
      </div>

      <div style={styles.wrapper}>
        <div style={styles.heroCard}>
          {cover ? (
            <>
              <img src={cover.uri} style={styles.heroImage} />
              <div style={styles.heroActions}>
                <label style={styles.heroBtn}>
                  Importer
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    style={{ display: "none" }}
                    onChange={handlePick}
                  />
                </label>
                <button style={styles.removeBtn} onClick={removeCover}>
                  Retirer
                </button>
              </div>
            </>
          ) : (
            <div style={styles.emptyHero}>
              <p style={styles.emptyTitle}>Ajoute ta première photo</p>
              <label style={styles.primaryBtn}>
                Importer
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  style={{ display: "none" }}
                  onChange={handlePick}
                />
              </label>
            </div>
          )}
        </div>

        {gallery.length > 0 && (
          <>
            <h3 style={styles.sectionTitle}>Galerie</h3>
            <div style={styles.grid}>
              {gallery.map((img, i) => (
                <div key={i} style={styles.cell}>
                  <img src={img.uri} style={styles.photo} />
                  <div style={styles.cellActions}>
                    <button
                      style={styles.cellBtn}
                      onClick={() => setAsCover(img, i)}
                    >
                      ★
                    </button>
                    <button
                      style={styles.deleteBtn}
                      onClick={() => removeFromGallery(i)}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        <div style={styles.ctaBar}>
          <button disabled={saving} style={styles.cta} onClick={saveAndNext}>
            {saving ? "Enregistrement…" : "Continuer"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------
   STYLES — INCHANGÉS
------------------------------------------------------- */
const styles: Record<string, any> = {
  page: { background: PALETTE.cream, minHeight: "100vh", paddingBottom: 200 },
  loaderPage: {
    minHeight: "100vh",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: 16,
    borderBottom: `1px solid ${PALETTE.border}`,
  },
  backBtn: { fontSize: 20, background: "none", border: "none", cursor: "pointer" },
  headerTitle: { fontSize: 24, fontWeight: 800, color: PALETTE.primary },
  stepBar: { padding: 16, borderBottom: `1px solid ${PALETTE.border}` },
  stepTitle: { fontWeight: 800 },
  progressTrack: {
    height: 8,
    background: "#E6E9EF",
    borderRadius: 999,
    marginTop: 8,
  },
  progressFill: { width: "75%", height: "100%", background: PALETTE.gold },
  helperText: { marginTop: 8, color: PALETTE.placeholder },
  wrapper: { maxWidth: 650, margin: "0 auto", padding: 16 },
  heroCard: {
    background: PALETTE.white,
    borderRadius: 16,
    border: `1px solid ${PALETTE.ink}`,
    overflow: "hidden",
  },
  heroImage: { width: "100%", aspectRatio: "16/9", objectFit: "cover" },
  heroActions: {
    padding: 16,
    display: "flex",
    gap: 10,
    borderTop: `1px solid ${PALETTE.ink}`,
  },
  heroBtn: {
    padding: "10px 14px",
    border: `1px solid ${PALETTE.ink}`,
    borderRadius: 999,
    cursor: "pointer",
    fontWeight: 800,
  },
  removeBtn: {
    padding: "10px 14px",
    borderRadius: 999,
    background: "#ffeaea",
    border: "1px solid #ffcdcd",
    color: PALETTE.coral,
    fontWeight: 800,
  },
  emptyHero: { padding: 26, textAlign: "center" },
  emptyTitle: { fontWeight: 900, fontSize: 18 },
  primaryBtn: {
    marginTop: 14,
    padding: "10px 16px",
    borderRadius: 999,
    background: PALETTE.peach,
    color: "white",
    cursor: "pointer",
    fontWeight: 800,
  },
  sectionTitle: { marginTop: 18, fontWeight: 900 },
  grid: { display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 },
  cell: { position: "relative", borderRadius: 12, overflow: "hidden" },
  photo: { width: "100%", height: "100%", objectFit: "cover" },
  cellActions: {
    position: "absolute",
    top: 6,
    right: 6,
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  cellBtn: {
    width: 28,
    height: 28,
    borderRadius: "50%",
    background: "rgba(0,0,0,0.5)",
    color: "white",
    border: "none",
  },
  deleteBtn: {
    width: 28,
    height: 28,
    borderRadius: "50%",
    background: "rgba(255,80,80,0.8)",
    color: "white",
    border: "none",
  },
  ctaBar: { marginTop: 30, textAlign: "center" },
  cta: {
    background: PALETTE.peach,
    border: "none",
    borderRadius: 16,
    padding: "14px 30px",
    color: "white",
    fontWeight: 900,
  },
};