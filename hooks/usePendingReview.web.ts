import { useEffect, useRef } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const API_BASE = (
  process.env.EXPO_PUBLIC_API_BASE ?? "http://127.0.0.1:5055/api/v1"
).replace(/\/+$/, "");

export type PendingReviewItem = {
  reservationId: string;
  serviceId: string;
  serviceName?: string;
};

export function usePendingReviewWeb(
  enabled: boolean,
  onPending: (item: PendingReviewItem) => void
) {
  const checkedRef = useRef(false);

  useEffect(() => {
    if (!enabled || checkedRef.current) return;

    const run = async () => {
      try {
        const token =
          (await AsyncStorage.getItem("idToken")) ||
          (typeof window !== "undefined"
            ? localStorage.getItem("idToken")
            : null);

        if (!token) return;

        const resp = await fetch(
          `${API_BASE}/customers/reviews/pending`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (!resp.ok) return;

        const data = await resp.json();
        const item = data?.item;

        if (item?.reservationId) {
          onPending(item);
        }

        checkedRef.current = true;
      } catch (err) {
        console.error("[usePendingReviewWeb]", err);
        checkedRef.current = true;
      }
    };

    run();
  }, [enabled, onPending]);
}