"use client";

import { useEffect, useRef } from "react";

import { trackEvent } from "@/lib/events";

/** Records one `product_view` per page view. */
export function ViewTracker({ productId }: { productId: string }) {
  const sent = useRef<string | null>(null);
  useEffect(() => {
    if (sent.current === productId) return;
    sent.current = productId;
    trackEvent("product_view", productId);
  }, [productId]);
  return null;
}
