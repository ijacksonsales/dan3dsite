import { createClient } from "@/lib/supabase/server";

// Phase 0 "hello" page: proves the Worker can read the sample product from Supabase.
// Replaced by the real store home in phase 2.

const formatCm = (mm: number | null) =>
  mm == null
    ? "—"
    : `${(mm / 10).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} cm`;

const formatPrice = (cents: number | null) =>
  cents == null
    ? "Sob consulta"
    : (cents / 100).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
      });

export default async function Home() {
  const supabase = await createClient();
  const { data: product, error } = await supabase
    .from("products")
    .select(
      "name, slug, price_cents, height_mm, width_mm, depth_mm, categories(name)",
    )
    .eq("status", "published")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">
        Olá! Aqui é a DAN3D.
      </h1>

      {error ? (
        <p className="rounded-lg border border-destructive/40 p-4 text-destructive">
          Não foi possível ler o catálogo agora.
        </p>
      ) : product ? (
        <section className="rounded-xl border p-5">
          <p className="text-sm text-muted-foreground">
            {product.categories?.name}
          </p>
          <h2 className="text-xl font-medium">{product.name}</h2>
          <p className="mt-2 text-lg">{formatPrice(product.price_cents)}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Altura {formatCm(product.height_mm)} · Largura{" "}
            {formatCm(product.width_mm)} · Profundidade{" "}
            {formatCm(product.depth_mm)}
          </p>
        </section>
      ) : (
        <p className="text-muted-foreground">Nenhuma peça publicada ainda.</p>
      )}
    </main>
  );
}
