import { useEffect, useState } from "react";

type PendingReview = {
  reservationId: string;
  serviceId: string;
  serviceName?: string;
};

export function usePendingReview(
  token: string | null,
  showReviewModal: (reservationId: string) => void
) {
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!token || checked) return;

    const fetchPendingReview = async () => {
      try {
        const resp = await fetch(
          "/api/v1/customers/reviews/pending",
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (!resp.ok) return;

        const data = await resp.json();
        const item: PendingReview | undefined = data?.items?.[0];

        if (item?.reservationId) {
          showReviewModal(item.reservationId);
        }

        setChecked(true);
      } catch (err) {
        console.error("[PENDING REVIEW]", err);
        setChecked(true);
      }
    };

    fetchPendingReview();
  }, [token, checked, showReviewModal]);
}