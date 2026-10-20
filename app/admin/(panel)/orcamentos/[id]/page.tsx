import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/admin/page-header";
import { formatWhatsApp } from "@/lib/admin/settings";
import { formatDay, storeToday } from "@/lib/dates";
import { parseQuoteItems, quoteItemSize } from "@/lib/quotes/form";
import { QUOTE_STATUS_LABEL } from "@/lib/quotes/status";
import { createClient } from "@/lib/supabase/server";

import { QuoteActions } from "./quote-actions";

export const metadata: Metadata = { title: "Pedido de orçamento" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Signed photo links last long enough for one visit to the page. */
const PHOTO_URL_SECONDS = 60 * 60;

export default async function QuoteRequestPage({
  params,
}: PageProps<"/admin/orcamentos/[id]">) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const supabase = await createClient();
  const [{ data: request, error }, { data: settings }, { data: files }] =
    await Promise.all([
      supabase
        .from("quote_requests")
        .select(
          "id, number, name, phone, city, items, needed_by, notes, status, created_at, photos_removed, products(name, slug), orders(id, number)",
        )
        .eq("id", id)
        .maybeSingle(),
      supabase.from("settings").select("store_name").eq("id", 1).maybeSingle(),
      supabase.storage
        .from("quotes")
        .list(id, { sortBy: { column: "name", order: "asc" } }),
    ]);
  if (error) throw error;
  if (!request) notFound();

  const paths = (files ?? [])
    .filter((file) => file.name.endsWith(".webp"))
    .map((file) => `${id}/${file.name}`);
  const { data: signed } = paths.length
    ? await supabase.storage
        .from("quotes")
        .createSignedUrls(paths, PHOTO_URL_SECONDS)
    : { data: [] };
  const photos = (signed ?? []).flatMap((item) =>
    item.signedUrl ? [item.signedUrl] : [],
  );

  const items = parseQuoteItems(request.items);
  const sentDay = storeToday(new Date(request.created_at));

  return (
    <>
      <PageHeader
        title={`Pedido de orçamento nº ${request.number}`}
        backHref="/admin/orcamentos"
        backLabel="Orçamentos do site"
      >
        <p className="text-base text-muted-foreground">
          {QUOTE_STATUS_LABEL[request.status]} · enviado em {formatDay(sentDay)}
        </p>
      </PageHeader>

      <div className="mb-8 space-y-8">
        <section className="space-y-3">
          <h2 className="font-heading text-xl font-medium">Cliente</h2>
          <dl className="divide-y divide-border rounded-2xl border border-border bg-card text-base">
            <Row label="Nome" value={request.name} />
            <Row label="WhatsApp" value={formatWhatsApp(request.phone)} />
            {request.city && <Row label="Cidade" value={request.city} />}
            {request.needed_by && (
              <Row label="Precisa para" value={formatDay(request.needed_by)} />
            )}
          </dl>
        </section>

        <section className="space-y-3">
          <h2 className="font-heading text-xl font-medium">Peças</h2>
          {request.products && (
            <p className="rounded-xl bg-secondary px-4 py-3 text-base">
              Veio da página da peça{" "}
              <Link
                href={`/p/${request.products.slug}`}
                target="_blank"
                className="font-medium text-primary underline underline-offset-4"
              >
                {request.products.name}
              </Link>
            </p>
          )}
          <ol className="space-y-3">
            {items.map((item, index) => {
              const size = quoteItemSize(item);
              return (
                <li
                  key={index}
                  className="rounded-2xl border border-border bg-card p-4"
                >
                  <p className="text-sm text-muted-foreground">
                    Peça {index + 1} · {item.quantity}{" "}
                    {item.quantity === 1 ? "unidade" : "unidades"}
                  </p>
                  <p className="mt-1 text-lg whitespace-pre-line">
                    {item.description}
                  </p>
                  {size && (
                    <p className="mt-1 text-base text-muted-foreground">
                      {size}
                    </p>
                  )}
                </li>
              );
            })}
          </ol>
        </section>

        {request.notes && (
          <section className="space-y-3">
            <h2 className="font-heading text-xl font-medium">Observações</h2>
            <p className="rounded-2xl border border-border bg-card p-4 text-base whitespace-pre-line">
              {request.notes}
            </p>
          </section>
        )}

        <section className="space-y-3">
          <h2 className="font-heading text-xl font-medium">
            Fotos de referência
          </h2>
          {photos.length > 0 ? (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {photos.map((src, index) => (
                <li key={src}>
                  <a
                    href={src}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Abrir a foto ${index + 1}`}
                  >
                    {/* Signed URL of a private file; served as is. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={src}
                      alt={`Foto de referência ${index + 1}`}
                      className="aspect-square w-full rounded-xl object-cover ring-1 ring-border"
                    />
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-base text-muted-foreground">
              {request.photos_removed
                ? "As fotos foram apagadas depois de 30 dias no arquivo."
                : "O cliente não mandou fotos."}
            </p>
          )}
          {photos.length > 0 && (
            <p className="text-sm text-muted-foreground">
              Toque numa foto para abrir em tamanho grande.
            </p>
          )}
        </section>
      </div>

      <QuoteActions
        request={{
          id: request.id,
          number: request.number,
          name: request.name,
          phone: request.phone,
          status: request.status,
          order: request.orders,
        }}
        storeName={settings?.store_name ?? "DAN3D"}
      />
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 px-4 py-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right break-words">{value}</dd>
    </div>
  );
}
