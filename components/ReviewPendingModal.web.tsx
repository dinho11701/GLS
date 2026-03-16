import React from "react";
import { useRouter } from "expo-router";
import { createPortal } from "react-dom";

type ReviewItem = {
  reservationId: string;
  serviceId: string;
  serviceName?: string;
};

type Props = {
  item: ReviewItem | null;
  onClose?: () => void;
};

export default function ReviewPendingModalWeb({ item, onClose }: Props) {
  const router = useRouter();

  if (!item) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="review-title"
      style={styles.overlay}
      onClick={onClose}
    >
      <div
        style={styles.card}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ⭐ Icon */}
        <div style={styles.icon}>⭐</div>

        <h2 id="review-title" style={styles.title}>
          Votre avis est important ✨
        </h2>

        <p style={styles.desc}>
          Comment s’est passée votre expérience avec{" "}
          <strong>{item.serviceName}</strong> ?
        </p>

        <button
          style={styles.primaryBtn}
          onClick={() => {
            onClose?.();
            router.push({
              pathname: "/leave-review",
              params: {
                reservationId: item.reservationId,
                serviceId: item.serviceDocId,
                title: item.serviceName,
              },
            });
          }}
        >
          Laisser un avis
        </button>

        <button
          style={styles.secondaryBtn}
          onClick={onClose}
        >
          Plus tard
        </button>
      </div>
    </div>,
    document.body
  );
}

/* =======================
   STYLES (RESPONSIVE)
======================= */
const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: "fixed",
    inset: 0,
    backgroundColor: "rgba(0,0,0,0.55)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9999,
    padding: 16,
  },

  card: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: "24px 22px",
    textAlign: "center",
    boxShadow: "0 12px 40px rgba(0,0,0,0.15)",
  },

  icon: {
    fontSize: 36,
    marginBottom: 6,
  },

  title: {
    fontSize: 20,
    fontWeight: 900,
    color: "#0A0F2C",
    margin: "8px 0",
  },

  desc: {
    fontSize: 15,
    color: "#444",
    marginTop: 6,
    lineHeight: 1.4,
  },

  primaryBtn: {
    marginTop: 22,
    width: "100%",
    backgroundColor: "#EF8A73",
    color: "#fff",
    border: "none",
    padding: "14px 16px",
    borderRadius: 14,
    fontSize: 16,
    fontWeight: 900,
    cursor: "pointer",
  },

  secondaryBtn: {
    marginTop: 12,
    background: "none",
    border: "none",
    color: "#777",
    fontSize: 14,
    cursor: "pointer",
  },
};