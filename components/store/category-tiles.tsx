import Image from "next/image";
import Link from "next/link";

export function CategoryTiles({
  categories,
}: {
  categories: { id: string; name: string; slug: string }[];
}) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {categories.map((category) => (
        <li key={category.id}>
          <Link
            href={`/c/${category.slug}`}
            className="group relative flex min-h-28 items-end overflow-hidden rounded-2xl bg-primary p-5 text-primary-foreground transition-colors hover:bg-espresso"
          >
            <Image
              src="/brand/symbol-light.png"
              alt=""
              width={93}
              height={96}
              className="absolute -top-3 -right-3 opacity-10 transition-transform duration-500 group-hover:rotate-6"
            />
            <span className="relative font-heading text-lg tracking-wide">
              {category.name}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
