import AsyncStorage from "@react-native-async-storage/async-storage";

const API_BASE = process.env.EXPO_PUBLIC_API_BASE;

if (!API_BASE) {
  console.error("❌ EXPO_PUBLIC_API_BASE is not defined");
}

const API_URL = `${API_BASE}/partners/zone`;

/* =========================================
   AUTH HEADER (MYSQL JWT VERSION)
========================================= */
async function getAuthHeader() {
  console.log("🔐 getAuthHeader (MySQL JWT)");

  let token: string | null = null;

  // 🔹 Mobile
  try {
    token = await AsyncStorage.getItem("authToken");
  } catch {}

  // 🔹 Web fallback
  if (!token && typeof window !== "undefined") {
    token = localStorage.getItem("authToken");
  }

  if (!token) {
    console.log("❌ No auth token found");
    throw new Error("not_authenticated");
  }

  console.log("🟢 JWT token found:", token.substring(0, 25) + "...");

  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

/* =========================================
   FETCH ZONE
========================================= */
export async function fetchPartnerZone() {
  try {
    console.log("📥 fetchPartnerZone → START");
    console.log("🌍 GET:", API_URL);

    const headers = await getAuthHeader();

    const res = await fetch(API_URL, {
      method: "GET",
      headers,
    });

    console.log("📡 Response status:", res.status);

    const text = await res.text();
    console.log("📨 Raw response:", text);

    if (!res.ok) {
      throw new Error(`fetch_failed_${res.status}`);
    }

    if (!text) return null;

    const json = JSON.parse(text);

    console.log("✅ fetchPartnerZone SUCCESS:", json);

    return json;
  } catch (err) {
    console.log("❌ fetchPartnerZone ERROR:", err);
    throw err;
  }
}

/* =========================================
   SAVE ZONE
========================================= */
export async function savePartnerZone(data: {
  latitude: number;
  longitude: number;
  radiusKm: number;
  available: boolean;
}) {
  try {
    console.log("💾 savePartnerZone → START");
    console.log("📦 Payload:", data);
    console.log("🌍 POST:", API_URL);

    const headers = await getAuthHeader();

    const body = {
      center: {
        latitude: data.latitude,
        longitude: data.longitude,
      },
      radiusKm: data.radiusKm,
      available: data.available,
    };

    console.log("📤 Sending body:", body);

    const res = await fetch(API_URL, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    console.log("📡 Response status:", res.status);

    const text = await res.text();
    console.log("📨 Raw response:", text);

    if (!res.ok) {
      throw new Error(`save_failed_${res.status}`);
    }

    if (!text) return null;

    const json = JSON.parse(text);

    console.log("✅ savePartnerZone SUCCESS:", json);

    return json;
  } catch (err) {
    console.log("❌ savePartnerZone ERROR:", err);
    throw err;
  }
}