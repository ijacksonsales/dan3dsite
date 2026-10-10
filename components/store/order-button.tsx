"use client";

import { trackEvent } from "@/lib/events";
import { cn } from "@/lib/utils";

import { WhatsAppIcon } from "./icons";

/** "Encomendar pelo WhatsApp": opens the chat with the message filled in. */
export function OrderButton({
  href,
  productId,
  className,
}: {
  href: string | null;
  productId: string;
  className?: string;
}) {
  const base =
    "flex min-h-12 w-full items-center justify-center gap-2.5 rounded-full px-6 text-base font-medium";

  if (!href)
    return (
      <p
        className={cn(
          base,
          "cursor-not-allowed bg-secondary text-muted-foreground",
          className,
        )}
      >
        WhatsApp em breve
      </p>
    );

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => trackEvent("whatsapp_click", productId)}
      className={cn(
        base,
        "bg-primary text-primary-foreground shadow-sm transition-colors hover:bg-espresso",
        className,
      )}
    >
      <WhatsAppIcon className="size-5" />
      Encomendar pelo WhatsApp
    </a>
  );
}
