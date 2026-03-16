import React, { useState } from "react";

const API_BASE = "http://127.0.0.1:5055/api/v1";

export default function SupportModal({ visible, onClose }) {
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  if (!visible) return null;

  const sendSupport = async () => {
    console.log("🔥 WEB sendSupport triggered");

    if (message.length < 10) {
      alert("Message trop court");
      return;
    }

    try {
      setLoading(true);

      const token = localStorage.getItem("authToken");

      console.log("🟡 WEB TOKEN:", token);

      if (!token) {
        alert("Non authentifié");
        return;
      }

      const res = await fetch(`${API_BASE}/partners/support/contact`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ message }),
      });

      console.log("🟢 WEB STATUS:", res.status);

      const data = await res.json();

      console.log("🟢 WEB DATA:", data);

      if (data.ok) {
        alert("Message envoyé ✅");
        setMessage("");
        onClose();
      } else {
        alert(data.error || "Erreur envoi");
      }
    } catch (err) {
      console.log("🔥 WEB FETCH ERROR:", err);
      alert("Erreur réseau");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        <h2 style={{ marginBottom: 20 }}>Support partenaire</h2>

        <textarea
          placeholder="Décrivez votre problème..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          style={inputStyle}
        />

        <button
          style={{
            ...buttonStyle,
            opacity: loading ? 0.6 : 1,
            cursor: loading ? "not-allowed" : "pointer",
          }}
          onClick={sendSupport}
          disabled={loading}
        >
          {loading ? "Envoi..." : "Envoyer"}
        </button>

        <button onClick={onClose} style={closeBtnStyle}>
          Fermer
        </button>
      </div>
    </div>
  );
}

const overlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  backgroundColor: "rgba(0,0,0,0.5)",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  zIndex: 9999,
};

const modalStyle: React.CSSProperties = {
  background: "white",
  padding: 30,
  borderRadius: 12,
  width: "90%",
  maxWidth: 450,
  boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: 12,
  marginBottom: 15,
  borderRadius: 8,
  border: "1px solid #ddd",
  minHeight: 120,
  resize: "none",
};

const buttonStyle: React.CSSProperties = {
  background: "#FF6B6B",
  color: "white",
  padding: 12,
  border: "none",
  borderRadius: 8,
  width: "100%",
  fontWeight: 600,
};

const closeBtnStyle: React.CSSProperties = {
  marginTop: 15,
  background: "transparent",
  border: "none",
  color: "#555",
  cursor: "pointer",
};