import Image from "next/image";
import Link from "next/link";

import { formatCm, formatPrice } from "@/lib/format";
import { publicUrl } from "@/lib/storage";
import type { ProductCardData } from "@/lib/store/queries";

import { PhotoPlaceholder } from "./photo-placeholder";

export function ProductCard({
  product,
  sizes = "(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw",
  priority,
}: {
  product: ProductCardData;
  sizes?: string;
  priority?: boolean;
}) {
  const height = formatCm(product.height_mm);

  return (
    <Link href={`/p/${product.slug}`} className="group block">
      <div className="relative aspect-square overflow-hidden rounded-2xl bg-secondary">
        {product.cover ? (
          <Image
            src={publicUrl("images", product.cover.path)}
            alt={product.cover.alt ?? product.name}
            fill
            sizes={sizes}
            priority={priority}
            className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <PhotoPlaceholder />
        )}
      </div>
      <div className="mt-3 space-y-0.5 px-0.5">
        <h3 className="line-clamp-2 leading-snug font-medium">
          {product.name}
        </h3>
        {height && (
          <p className="text-sm text-muted-foreground">{height} de altura</p>
        )}
        <p className="pt-1 text-[15px] font-medium text-primary">
          {formatPrice(product.price_cents)}
        </p>
      </div>
    </Link>
  );
}

export function ProductGrid({ products }: { products: ProductCardData[] }) {
  return (
    <ul className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
      {products.map((product) => (
        <li key={product.id}>
          <ProductCard product={product} />
        </li>
      ))}
    </ul>
  );
}

/** Swipeable row on phones, regular grid from tablet width up. */
export function ProductRow({ products }: { products: ProductCardData[] }) {
  return (
    <ul className="-mx-4 no-scrollbar flex snap-x snap-mandatory scroll-px-4 gap-4 overflow-x-auto px-4 sm:mx-0 sm:grid sm:grid-cols-3 sm:gap-x-4 sm:gap-y-8 sm:overflow-visible sm:px-0 lg:grid-cols-4">
      {products.map((product) => (
        <li
          key={product.id}
          className="w-[44vw] max-w-60 shrink-0 snap-start sm:w-auto sm:max-w-none"
        >
          <ProductCard
            product={product}
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 44vw"
          />
        </li>
      ))}
    </ul>
  );
}
