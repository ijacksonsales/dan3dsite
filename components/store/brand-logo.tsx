import Image from "next/image";

import { cn } from "@/lib/utils";

/** Horizontal lockup: the D symbol next to the DAN3D wordmark (docs/brand/). */
export function BrandLogo({
  tone = "dark",
  className,
  priority,
}: {
  tone?: "dark" | "light";
  className?: string;
  priority?: boolean;
}) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <Image
        src={`/brand/symbol-${tone}.png`}
        alt=""
        width={31}
        height={32}
        priority={priority}
      />
      <Image
        src={`/brand/wordmark-${tone}.png`}
        alt="DAN3D"
        width={108}
        height={16}
        priority={priority}
      />
    </span>
  );
}
