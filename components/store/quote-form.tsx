"use client";

import {
  CheckCircle2Icon,
  ImagePlusIcon,
  LoaderCircleIcon,
  MinusIcon,
  PlusIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import Link from "next/link";
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";

import { Field, TextArea, TextInput } from "@/components/admin/form";
import { compressImage } from "@/lib/images/compress";
import {
  MAX_QUANTITY,
  MAX_QUOTE_ITEMS,
  MAX_QUOTE_PHOTOS,
  emptyQuoteItem,
  quoteNoticeMessage,
  validateQuoteForm,
  type QuoteDraftItem,
  type QuoteFormErrors,
  type QuotePayload,
} from "@/lib/quotes/form";
import { quotePhotoPath } from "@/lib/quotes/status";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { whatsappLink } from "@/lib/whatsapp";
import type { Json } from "@/types/database";

import { WhatsAppIcon } from "./icons";

/** Code raised by submit_quote_request() when the hourly limit is hit. */
const TOO_MANY_REQUESTS = "P0429";

interface Photo {
  key: string;
  file: File;
  preview: string;
}

interface Sent {
  number: number;
  payload: QuotePayload;
  failedPhotos: number;
}

let nextKey = 0;
const newKey = () => `quote-${++nextKey}`;

const buttonClassName =
  "flex min-h-12 w-full items-center justify-center gap-2.5 rounded-full px-6 text-base font-medium transition-colors disabled:opacity-60";

export function QuoteForm({
  today,
  storeWhatsApp,
  reference,
}: {
  today: string;
  storeWhatsApp: string | null;
  /** Product page the visitor came from ("Quer algo diferente?"). */
  reference: { id: string; name: string } | null;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [items, setItems] = useState(() => [
    { key: newKey(), ...emptyQuoteItem() },
  ]);
  const [neededBy, setNeededBy] = useState("");
  const [notes, setNotes] = useState("");
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [productId, setProductId] = useState(reference?.id ?? null);
  // Hidden field only bots fill in.
  const [website, setWebsite] = useState("");

  const [errors, setErrors] = useState<QuoteFormErrors | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [sent, setSent] = useState<Sent | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const sending = status !== null;

  // Free the photo previews when leaving the page.
  const photosRef = useRef(photos);
  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);
  useEffect(
    () => () =>
      photosRef.current.forEach(({ preview }) => URL.revokeObjectURL(preview)),
    [],
  );

  function updateItem(key: string, change: Partial<QuoteDraftItem>) {
    setItems((current) =>
      current.map((item) => (item.key === key ? { ...item, ...change } : item)),
    );
  }

  /** From the latest state, so quick taps never get lost. */
  function changeQuantity(key: string, delta: number) {
    setItems((current) =>
      current.map((item) =>
        item.key === key
          ? {
              ...item,
              quantity: Math.min(
                MAX_QUANTITY,
                Math.max(1, item.quantity + delta),
              ),
            }
          : item,
      ),
    );
  }

  function addPhotos(files: FileList | null) {
    if (!files) return;
    const room = MAX_QUOTE_PHOTOS - photos.length;
    const added = [...files]
      .filter((file) => file.type.startsWith("image/"))
      .slice(0, room)
      .map((file) => ({
        key: newKey(),
        file,
        preview: URL.createObjectURL(file),
      }));
    setPhotos((current) => [...current, ...added]);
  }

  function removePhoto(key: string) {
    setPhotos((current) => {
      const photo = current.find((item) => item.key === key);
      if (photo) URL.revokeObjectURL(photo.preview);
      return current.filter((item) => item.key !== key);
    });
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending) return;
    const result = validateQuoteForm(
      { name, phone, city, items, neededBy, notes },
      today,
    );
    if (!result.ok) {
      setErrors(result.errors);
      setSubmitError("Confira os campos marcados em vermelho.");
      return;
    }
    setErrors(null);
    setSubmitError(null);
    const { payload } = result;

    if (website) {
      // A bot: pretend it worked, send nothing.
      setSent({ number: 0, payload, failedPhotos: 0 });
      return;
    }

    setStatus("Enviando…");
    const supabase = createClient();
    const { data, error } = await supabase.rpc("submit_quote_request", {
      p_name: payload.name,
      p_phone: payload.phone,
      p_city: payload.city,
      p_items: payload.items as unknown as Json,
      p_needed_by: payload.neededBy,
      p_notes: payload.notes,
      p_product_id: productId,
    });
    const request = data?.[0];
    if (error || !request) {
      setStatus(null);
      setSubmitError(
        error?.code === TOO_MANY_REQUESTS
          ? "Você já mandou alguns pedidos agora há pouco. Espere um pouco ou fale com a gente pelo WhatsApp."
          : "Não foi possível enviar. Confira a internet e tente de novo.",
      );
      return;
    }

    // The request is saved; photos that fail can still go by WhatsApp.
    let failedPhotos = 0;
    for (const [index, photo] of photos.entries()) {
      setStatus(`Enviando fotos (${index + 1} de ${photos.length})…`);
      try {
        const file = await compressImage(photo.file);
        const { error: uploadError } = await supabase.storage
          .from("quotes")
          .upload(quotePhotoPath(request.id, index), file, {
            contentType: "image/webp",
          });
        if (uploadError) failedPhotos++;
      } catch {
        failedPhotos++;
      }
    }

    setStatus(null);
    setSent({ number: request.number, payload, failedPhotos });
    window.scrollTo({ top: 0 });
  }

  if (sent) {
    return <SentMessage sent={sent} storeWhatsApp={storeWhatsApp} />;
  }

  return (
    <form onSubmit={onSubmit} noValidate className="mt-10 space-y-10">
      <FormSection title="Seus dados">
        <Field label="Nome" htmlFor="quote-name" error={errors?.name}>
          <TextInput
            id="quote-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoComplete="name"
            maxLength={100}
            aria-invalid={!!errors?.name}
          />
        </Field>
        <Field
          label="WhatsApp"
          htmlFor="quote-phone"
          hint="Com DDD. É por ele que a gente responde."
          error={errors?.phone}
        >
          <TextInput
            id="quote-phone"
            type="tel"
            inputMode="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            autoComplete="tel-national"
            placeholder="(81) 98649-2071"
            aria-invalid={!!errors?.phone}
          />
        </Field>
        <Field
          label="Cidade (opcional)"
          htmlFor="quote-city"
          hint="Ajuda a calcular o frete."
        >
          <TextInput
            id="quote-city"
            value={city}
            onChange={(event) => setCity(event.target.value)}
            autoComplete="address-level2"
            maxLength={100}
          />
        </Field>
      </FormSection>

      <FormSection title="Peças">
        {reference && productId && (
          <p className="flex min-h-12 items-center gap-3 rounded-2xl bg-secondary py-2 pr-2 pl-4 text-base">
            <span className="min-w-0 flex-1">
              Referência: <strong>{reference.name}</strong>
            </span>
            <button
              type="button"
              onClick={() => setProductId(null)}
              aria-label="Tirar a peça de referência"
              className="grid size-12 shrink-0 place-items-center rounded-full hover:bg-background"
            >
              <XIcon className="size-5" />
            </button>
          </p>
        )}
        <ol className="space-y-4">
          {items.map((item, index) => (
            <li
              key={item.key}
              className="space-y-4 rounded-2xl bg-card p-4 ring-1 ring-border"
            >
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-medium">Peça {index + 1}</h3>
                {items.length > 1 && (
                  <button
                    type="button"
                    onClick={() =>
                      setItems((current) =>
                        current.filter(({ key }) => key !== item.key),
                      )
                    }
                    className="-mr-2 inline-flex min-h-12 items-center gap-2 rounded-full px-3 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground"
                  >
                    <Trash2Icon className="size-4" />
                    Tirar
                  </button>
                )}
              </div>
              <Field
                label="O que é a peça?"
                htmlFor={`${item.key}-description`}
                hint="Ex.: anjo da guarda para batizado, com o nome Laura."
                error={errors?.items[index]?.description}
              >
                <TextArea
                  id={`${item.key}-description`}
                  value={item.description}
                  onChange={(event) =>
                    updateItem(item.key, { description: event.target.value })
                  }
                  rows={3}
                  className="min-h-24"
                  aria-invalid={!!errors?.items[index]?.description}
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field
                  label="Altura (cm)"
                  htmlFor={`${item.key}-height`}
                  error={errors?.items[index]?.height}
                >
                  <TextInput
                    id={`${item.key}-height`}
                    inputMode="decimal"
                    value={item.height}
                    onChange={(event) =>
                      updateItem(item.key, { height: event.target.value })
                    }
                    placeholder="Opcional"
                    aria-invalid={!!errors?.items[index]?.height}
                  />
                </Field>
                <Field
                  label="Largura (cm)"
                  htmlFor={`${item.key}-width`}
                  error={errors?.items[index]?.width}
                >
                  <TextInput
                    id={`${item.key}-width`}
                    inputMode="decimal"
                    value={item.width}
                    onChange={(event) =>
                      updateItem(item.key, { width: event.target.value })
                    }
                    placeholder="Opcional"
                    aria-invalid={!!errors?.items[index]?.width}
                  />
                </Field>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-base font-medium" id={`${item.key}-qty`}>
                  Quantidade
                </span>
                <div
                  className="flex items-center gap-1"
                  role="group"
                  aria-labelledby={`${item.key}-qty`}
                >
                  <button
                    type="button"
                    onClick={() => changeQuantity(item.key, -1)}
                    disabled={item.quantity <= 1}
                    aria-label="Menos uma"
                    className="grid size-12 place-items-center rounded-full border border-input bg-background disabled:opacity-40"
                  >
                    <MinusIcon className="size-5" />
                  </button>
                  <span
                    className="w-10 text-center text-lg font-medium tabular-nums"
                    aria-live="polite"
                  >
                    {item.quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => changeQuantity(item.key, 1)}
                    aria-label="Mais uma"
                    className="grid size-12 place-items-center rounded-full border border-input bg-background"
                  >
                    <PlusIcon className="size-5" />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ol>
        {items.length < MAX_QUOTE_ITEMS && (
          <button
            type="button"
            onClick={() =>
              setItems((current) => [
                ...current,
                { key: newKey(), ...emptyQuoteItem() },
              ])
            }
            className={cn(
              buttonClassName,
              "border border-input bg-card hover:bg-secondary",
            )}
          >
            <PlusIcon className="size-5" />
            Adicionar outra peça
          </button>
        )}
      </FormSection>

      <FormSection title="Fotos de referência (opcional)">
        <p className="-mt-2 text-sm text-muted-foreground">
          Uma foto, um desenho ou um print de algo parecido ajuda muito. Até{" "}
          {MAX_QUOTE_PHOTOS} fotos.
        </p>
        {photos.length > 0 && (
          <ul className="grid grid-cols-3 gap-3 sm:grid-cols-5">
            {photos.map((photo, index) => (
              <li key={photo.key} className="relative">
                {/* Local preview (blob URL), not a remote image. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.preview}
                  alt={`Foto ${index + 1}`}
                  className="aspect-square w-full rounded-xl object-cover ring-1 ring-border"
                />
                <button
                  type="button"
                  onClick={() => removePhoto(photo.key)}
                  aria-label={`Tirar a foto ${index + 1}`}
                  className="absolute -top-2 -right-2 grid size-10 place-items-center rounded-full bg-espresso text-sand shadow"
                >
                  <XIcon className="size-5" />
                </button>
              </li>
            ))}
          </ul>
        )}
        {photos.length < MAX_QUOTE_PHOTOS && (
          <>
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              multiple
              className="sr-only"
              tabIndex={-1}
              aria-hidden
              onChange={(event) => {
                addPhotos(event.target.files);
                event.target.value = "";
              }}
            />
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              className={cn(
                buttonClassName,
                "border border-dashed border-input bg-card hover:bg-secondary",
              )}
            >
              <ImagePlusIcon className="size-5" />
              {photos.length ? "Adicionar mais fotos" : "Escolher fotos"}
            </button>
          </>
        )}
      </FormSection>

      <FormSection title="Mais detalhes">
        <Field
          label="Para quando você precisa? (opcional)"
          htmlFor="quote-needed-by"
          error={errors?.neededBy}
        >
          <TextInput
            id="quote-needed-by"
            type="date"
            min={today}
            value={neededBy}
            onChange={(event) => setNeededBy(event.target.value)}
            aria-invalid={!!errors?.neededBy}
          />
        </Field>
        <Field
          label="Observações (opcional)"
          htmlFor="quote-notes"
          hint="Cores, tema da festa, nome ou frase para gravar…"
          error={errors?.notes}
        >
          <TextArea
            id="quote-notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={4}
            aria-invalid={!!errors?.notes}
          />
        </Field>
        {/* Honeypot: hidden from people, filled in by bots. */}
        <div
          aria-hidden
          className="absolute -left-[9999px] h-px w-px overflow-hidden"
        >
          <label htmlFor="quote-website">Site</label>
          <input
            id="quote-website"
            tabIndex={-1}
            autoComplete="off"
            value={website}
            onChange={(event) => setWebsite(event.target.value)}
          />
        </div>
        <p className="text-sm text-muted-foreground">
          Seus dados e fotos só são usados para responder este orçamento.
        </p>
      </FormSection>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-md">
        <div className="mx-auto max-w-2xl space-y-2">
          {submitError && (
            <p role="alert" className="text-center text-sm text-destructive">
              {submitError}
            </p>
          )}
          <button
            type="submit"
            disabled={sending}
            className={cn(
              buttonClassName,
              "bg-primary text-primary-foreground shadow-sm hover:bg-espresso",
            )}
          >
            {sending && <LoaderCircleIcon className="size-5 animate-spin" />}
            {status ?? "Enviar pedido de orçamento"}
          </button>
        </div>
      </div>
    </form>
  );
}

function FormSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-4">
      <h2 className="font-heading text-xl tracking-wide">{title}</h2>
      {children}
    </section>
  );
}

function SentMessage({
  sent,
  storeWhatsApp,
}: {
  sent: Sent;
  storeWhatsApp: string | null;
}) {
  const href = storeWhatsApp
    ? whatsappLink(
        storeWhatsApp,
        quoteNoticeMessage({ ...sent.payload, number: sent.number }),
      )
    : null;

  return (
    <div className="mt-10 space-y-6 rounded-2xl bg-card p-6 text-center ring-1 ring-border">
      <CheckCircle2Icon className="mx-auto size-12 text-primary" />
      <div className="space-y-2">
        <h2 className="font-heading text-2xl tracking-wide">
          Pedido de orçamento enviado!
        </h2>
        {sent.number > 0 && (
          <p className="text-lg">
            Número <strong>{sent.number}</strong>
          </p>
        )}
        <p className="text-pretty text-muted-foreground">
          {href
            ? "Para a gente ver mais rápido, avise pelo WhatsApp. A mensagem já vai pronta."
            : "A gente responde pelo WhatsApp que você informou."}
        </p>
        {sent.failedPhotos > 0 && (
          <p className="rounded-xl bg-secondary px-4 py-3 text-sm">
            {sent.failedPhotos === 1
              ? "Uma foto não foi enviada."
              : `${sent.failedPhotos} fotos não foram enviadas.`}{" "}
            Mande pelo WhatsApp, por favor.
          </p>
        )}
      </div>
      {href && (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            buttonClassName,
            "bg-primary text-primary-foreground shadow-sm hover:bg-espresso",
          )}
        >
          <WhatsAppIcon className="size-5" />
          Avisar a DAN3D no WhatsApp
        </a>
      )}
      <Link
        href="/"
        className={cn(
          buttonClassName,
          "border border-input hover:bg-secondary",
        )}
      >
        Voltar para a loja
      </Link>
    </div>
  );
}
