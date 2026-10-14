import { ImageIcon } from "lucide-react";
import Image from "next/image";

import { publicUrl } from "@/lib/storage";
import { cn } from "@/lib/utils";

/** Square cover photo of a product, or a placeholder when it has none. */
export function ProductThumb({
  path,
  size = 64,
  className,
}: {
  path: string | null;
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center overflow-hidden rounded-xl bg-secondary text-muted-foreground",
        className,
      )}
      style={{ width: size, height: size }}
    >
      {path ? (
        <Image
          src={publicUrl("images", path)}
          alt=""
          width={size}
          height={size}
          className="size-full object-cover"
        />
      ) : (
        <ImageIcon className="size-6" aria-label="Sem foto" />
      )}
    </span>
  );
}
