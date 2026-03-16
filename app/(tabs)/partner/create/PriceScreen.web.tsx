// ✔️ VERSION FINALE CORRIGÉE — PriceScreen.web.tsx

import React, { useMemo, useState, useCallback, useEffect } from "react";
import { useRouter, useLocalSearchParams } from "expo-router";
import * as Localization from "expo-localization";

/* --------------------------- PALETTE --------------------------- */
const PALETTE = {
  primary: "#0A0F2C",
  white: "#FFFFFF",
  cream: "#F9FAFB",
  textDark: "#0B1220",
  placeholder: "rgba(11,18,32,0.45)",
  border: "rgba(11,18,32,0.18)",
  gold: "#FFD700",
  peach: "#EF8A73",
};

/* --------------------------- DEVISES PAR PAYS --------------------------- */
const REGION_TO_CURRENCY: Record<string, string> = {
  CA: "CAD",
  US: "USD",
  FR: "EUR",
  BE: "EUR",
  CH: "CHF",
  DE: "EUR",
  ES: "EUR",
  IT: "EUR",
  PT: "EUR",
  NL: "EUR",
  LU: "EUR",
  IE: "EUR",
  GB: "GBP",
  AU: "AUD",
  NZ: "NZD",
  JP: "JPY",
  CN: "CNY",
  SN: "XOF",
  CI: "XOF",
  ML: "XOF",
  BF: "XOF",
  TG: "XOF",
  BJ: "XOF",
  NE: "XOF",
  GW: "XOF",
  CM: "XAF",
  GA: "XAF",
  CG: "XAF",
  TD: "XAF",
  CF: "XAF",
  GQ: "XAF",
  MA: "MAD",
  DZ: "DZD",
  TN: "TND",
  ZA: "ZAR",
  BR: "BRL",
  MX: "MXN",
  IN: "INR",
};

function suggestCurrency(): string {
  const region = Localization.region?.toUpperCase() ?? "";
  return REGION_TO_CURRENCY[region] ?? "USD";
}

function formatMoney(locale: string, currency: string, value: number) {
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${value} ${currency}`;
  }
}

/* ===============================================================
                        PRICE SCREEN WEB — FINAL
================================================================ */
export default function PriceScreenWeb() {
  const router = useRouter();
  const params = useLocalSearchParams<{ from?: string; id?: string }>();

  /* --------------------------- ID PERSISTANT --------------------------- */
  let serviceId = params.id ?? null;
  if (serviceId) localStorage.setItem("edit_service_id", serviceId);
  else serviceId = localStorage.getItem("edit_service_id");

  const returnToReview = params.from === "review";
  const locale = Localization.locale ?? "en-US";

  /* --------------------------- STATE --------------------------- */
  const [currency, setCurrency] = useState<string>(suggestCurrency());
  const [price, setPrice] = useState<string>("");
  const [travelFee, setTravelFee] = useState<string>("");

  /* --------------------------- LOAD DRAFT --------------------------- */
  useEffect(() => {
    try {
      const raw = localStorage.getItem("draft_service_step2_price");
      if (!raw) return;

      const d = JSON.parse(raw);
      if (d.price !== undefined) setPrice(String(d.price));
      if (d.travelFee !== undefined) setTravelFee(String(d.travelFee));
      if (d.currency) setCurrency(String(d.currency).toUpperCase());
    } catch {}
  }, []);

  /* --------------------------- VALIDATION --------------------------- */
  const valid = useMemo(() => {
    const p = Number(price.replace(",", "."));
    if (!price.trim() || isNaN(p) || p <= 0) return false;

    if (travelFee.trim()) {
      const t = Number(travelFee.replace(",", "."));
      if (isNaN(t) || t < 0) return false;
    }

    return /^[A-Z]{3}$/.test(currency.trim());
  }, [price, travelFee, currency]);

  const pricePreview = useMemo(() => {
    const p = Number(price.replace(",", "."));
    if (isNaN(p) || p <= 0) return "";
    return formatMoney(locale, currency, p);
  }, [price, currency, locale]);

  const travelPreview = useMemo(() => {
    if (!travelFee.trim()) return "";
    const v = Number(travelFee.replace(",", "."));
    if (isNaN(v) || v < 0) return "";
    return formatMoney(locale, currency, v);
  }, [travelFee, currency, locale]);

  /* --------------------------- ACTIONS --------------------------- */
  const handleBack = useCallback(() => {
    if (returnToReview) {
      router.replace(
        `/(tabs)/partner/create/ReviewScreen?id=${serviceId}&from=review&t=${Date.now()}`
      );
    } else {
      router.back();
    }
  }, [returnToReview, serviceId]);

  const saveAndNext = useCallback(() => {
    if (!valid) return;

    const draft = {
      price: Number(price.replace(",", ".")),
      travelFee: travelFee.trim()
        ? Number(travelFee.replace(",", "."))
        : undefined,
      currency: currency.toUpperCase(),
      locale,
      id: serviceId,
    };

    try {
      localStorage.setItem("draft_service_step2_price", JSON.stringify(draft));

      if (returnToReview) {
        router.replace(
          `/(tabs)/partner/create/ReviewScreen?id=${serviceId}&from=review&t=${Date.now()}`
        );
      } else {
        router.push(
          `/(tabs)/partner/create/PictureScreen?id=${serviceId}`
        );
      }
    } catch {
      alert("Erreur lors de l'enregistrement.");
    }
  }, [valid, price, travelFee, currency, returnToReview, serviceId, locale]);

  /* --------------------------- RENDER --------------------------- */
  return (
    <div style={styles.page}>
      {/* HEADER */}
      <div style={styles.header}>
        <button style={styles.backBtn} onClick={handleBack}>
          ⟵
        </button>
        <h1 style={styles.headerTitle}>
          {serviceId ? "Modifier l’offre" : "Créer (Pro)"}
        </h1>
        <div style={{ width: 26 }} />
      </div>

      {/* STEP BAR */}
      <div style={styles.stepBar}>
        <p style={styles.stepTitle}>Étape 2/4 : Tarification</p>
        <div style={styles.progressTrack}>
          <div style={{ ...styles.progressFill, width: "50%" }} />
        </div>
      </div>

      {/* FORM */}
      <div style={styles.form}>
        <FieldLabel label="Prix" />
        <Input value={price} placeholder="Ex : 120" onChange={setPrice} />
        {pricePreview && (
          <p style={styles.preview}>Aperçu : {pricePreview}</p>
        )}

        <FieldLabel label="Frais de déplacement (optionnel)" />
        <Input
          value={travelFee}
          placeholder="Ex : 15"
          onChange={setTravelFee}
        />
        {travelPreview && (
          <p style={styles.preview}>Aperçu : {travelPreview}</p>
        )}

        <FieldLabel label="Devise (3 lettres)" />
        <Input
          value={currency}
          placeholder={suggestCurrency()}
          onChange={(v) => setCurrency(v.toUpperCase().slice(0, 3))}
        />

        <button
          onClick={saveAndNext}
          disabled={!valid}
          style={{
            ...styles.cta,
            opacity: valid ? 1 : 0.5,
            cursor: valid ? "pointer" : "not-allowed",
          }}
        >
          {returnToReview
            ? "Mettre à jour et revenir au récap"
            : "Continuer"}
        </button>
      </div>
    </div>
  );
}

/* --------------------------- SMALL COMPONENTS --------------------------- */

function FieldLabel({ label }: { label: string }) {
  return <p style={styles.fieldLabel}>{label}</p>;
}

function Input({
  value,
  placeholder,
  onChange,
}: {
  value: string;
  placeholder: string;
  onChange: (v: string) => void;
}) {
  return (
    <input
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      style={styles.input}
    />
  );
}

/* --------------------------- STYLES --------------------------- */

const styles = {
  page: {
    backgroundColor: PALETTE.cream,
    minHeight: "100vh",
    fontFamily: "sans-serif",
  },
  header: {
    display: "flex",
    alignItems: "center",
    padding: 16,
    borderBottom: `1px solid ${PALETTE.border}`,
  },
  backBtn: {
    fontSize: 24,
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
    margin: 0,
    color: PALETTE.primary,
  },
  stepBar: {
    padding: 16,
    borderBottom: `1px solid ${PALETTE.border}`,
  },
  stepTitle: {
    fontSize: 16,
    fontWeight: "900",
    marginBottom: 8,
  },
  progressTrack: {
    height: 8,
    backgroundColor: "#E6E9EF",
    borderRadius: 999,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: PALETTE.gold,
  },
  form: {
    padding: 20,
  },
  fieldLabel: {
    marginTop: 16,
    marginBottom: 6,
    fontWeight: "800",
    color: PALETTE.textDark,
  },
  input: {
    width: "100%",
    padding: "12px",
    borderRadius: 10,
    border: `1.5px solid ${PALETTE.border}`,
    fontSize: 15,
  },
  preview: {
    marginTop: 6,
    color: "rgba(11,18,32,0.7)",
    fontWeight: "700",
  },
  cta: {
    marginTop: 24,
    width: "100%",
    padding: "14px",
    borderRadius: 15,
    border: "none",
    backgroundColor: PALETTE.peach,
    color: "white",
    fontSize: 16,
    fontWeight: "900",
  },
};