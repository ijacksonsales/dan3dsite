import Image from "next/image";

import { cn } from "@/lib/utils";

/** Beige tile with the brand symbol, shown when a piece has no photo yet. */
export function PhotoPlaceholder({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "grid h-full w-full place-items-center bg-secondary",
        className,
      )}
    >
      <Image
        src="/brand/symbol-dark.png"
        alt=""
        width={62}
        height={64}
        className="opacity-15"
      />
    </div>
  );
}
