"use client";

import {
  ImagePlusIcon,
  LoaderCircleIcon,
  MonitorIcon,
  SmartphoneIcon,
  Trash2Icon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import {
  Alert,
  Field,
  StickyActions,
  TextInput,
  inputClassName,
  primaryButtonClassName,
} from "@/components/admin/form";
import { useToast } from "@/components/admin/toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  buildBannerLink,
  endsAtFromInput,
  endsAtToInput,
  parseBannerLink,
  startsAtFromInput,
  startsAtToInput,
  type BannerLink,
} from "@/lib/admin/banners";
import { publicUrl } from "@/lib/storage";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export interface BannerFormInitial {
  title: string | null;
  subtitle: string | null;
  image_desktop_path: string | null;
  image_mobile_path: string | null;
  link_url: string | null;
  starts_at: string | null;
  ends_at: string | null;
  active: boolean;
}

type ImageValue =
  | { kind: "saved"; path: string }
  | { kind: "new"; file: File; previewUrl: string }
  | null;

const imageSrc = (image: ImageValue) =>
  image?.kind === "saved"
    ? publicUrl("images", image.path)
    : image?.kind === "new"
      ? image.previewUrl
      : null;

const NETWORK_HINT = "Confira a internet e tente de novo.";

export function BannerForm({
  bannerId,
  isNew,
  initial,
  nextSortOrder,
  products,
  categories,
}: {
  bannerId: string;
  isNew: boolean;
  initial: BannerFormInitial;
  nextSortOrder: number;
  products: { slug: string; name: string }[];
  categories: { slug: string; name: string }[];
}) {
  const router = useRouter();
  const toast = useToast();
  const saved = (path: string | null): ImageValue =>
    path ? { kind: "saved", path } : null;

  const [mobile, setMobile] = useState(saved(initial.image_mobile_path));
  const [desktop, setDesktop] = useState(saved(initial.image_desktop_path));
  const [title, setTitle] = useState(initial.title ?? "");
  const [subtitle, setSubtitle] = useState(initial.subtitle ?? "");
  const [link, setLink] = useState<BannerLink>(
    parseBannerLink(initial.link_url),
  );
  const [startsOn, setStartsOn] = useState(startsAtToInput(initial.starts_at));
  const [endsOn, setEndsOn] = useState(endsAtToInput(initial.ends_at));
  const [active, setActive] = useState(initial.active);
  const [preview, setPreview] = useState<"mobile" | "desktop">("mobile");
  const [showErrors, setShowErrors] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const builtLink = buildBannerLink(link);
  const errors = {
    desktop: desktop ? null : "Escolha a imagem larga (computador e tablet).",
    link: builtLink.ok ? null : builtLink.error,
    dates:
      startsOn && endsOn && endsOn < startsOn
        ? "O último dia precisa ser depois do primeiro."
        : null,
  };

  async function save() {
    if (Object.values(errors).some(Boolean) || !builtLink.ok || !desktop) {
      setShowErrors(true);
      setError("Confira os campos marcados em vermelho.");
      return;
    }
    setError(null);
    const supabase = createClient();
    const timestamp = Date.now();

    async function uploadIfNew(image: ImageValue, name: string, what: string) {
      if (image?.kind !== "new") return image?.path ?? null;
      setSaving(`Enviando ${what}…`);
      const path = `banners/${bannerId}/${timestamp}-${name}.webp`;
      const { error: uploadError } = await supabase.storage
        .from("images")
        .upload(path, image.file, {
          contentType: "image/webp",
          cacheControl: "31536000",
          upsert: false,
        });
      if (uploadError)
        throw new Error(`Não foi possível enviar ${what}. ${NETWORK_HINT}`);
      return path;
    }

    try {
      const desktopPath = (await uploadIfNew(
        desktop,
        "desktop",
        "a imagem larga",
      ))!;
      const mobilePath = await uploadIfNew(
        mobile,
        "mobile",
        "a imagem do celular",
      );

      setSaving("Salvando…");
      const row = {
        title: title.trim() || null,
        subtitle: subtitle.trim() || null,
        image_desktop_path: desktopPath,
        image_mobile_path: mobilePath,
        link_url: builtLink.value,
        starts_at: startsAtFromInput(startsOn),
        ends_at: endsAtFromInput(endsOn),
        active,
      };
      const { data, error: rowError } = isNew
        ? await supabase
            .from("banners")
            .insert({ id: bannerId, sort_order: nextSortOrder, ...row })
            .select("id")
        : await supabase
            .from("banners")
            .update(row)
            .eq("id", bannerId)
            .select("id");
      if (rowError || !data?.length)
        throw new Error(`Não foi possível salvar. ${NETWORK_HINT}`);

      // Old images nothing points to anymore (best effort).
      const unused = [
        initial.image_desktop_path,
        initial.image_mobile_path,
      ].filter(
        (path): path is string =>
          !!path && path !== desktopPath && path !== mobilePath,
      );
      if (unused.length) await supabase.storage.from("images").remove(unused);
    } catch (e) {
      setSaving(null);
      setError(
        e instanceof Error
          ? e.message
          : `Não foi possível salvar. ${NETWORK_HINT}`,
      );
      return;
    }

    toast(isNew ? "Banner criado." : "Banner salvo.");
    router.replace("/admin/banners");
    router.refresh();
  }

  async function remove() {
    setSaving("Excluindo…");
    const supabase = createClient();
    const { data, error: deleteError } = await supabase
      .from("banners")
      .delete()
      .eq("id", bannerId)
      .select("id");
    if (deleteError || !data?.length) {
      setSaving(null);
      setConfirmDelete(false);
      setError(`Não foi possível excluir. ${NETWORK_HINT}`);
      return;
    }
    const files = [
      initial.image_desktop_path,
      initial.image_mobile_path,
    ].filter((path): path is string => !!path);
    if (files.length) await supabase.storage.from("images").remove(files);
    toast("Banner excluído.");
    router.replace("/admin/banners");
    router.refresh();
  }

  const busy = saving !== null;

  return (
    <div className="space-y-8">
      <BannerImageField
        id="image-mobile"
        label="Imagem para celular"
        hint="Em pé, proporção 4:5 (ex.: 1600 × 2000). Se ficar vazia, o celular usa a imagem larga, cortada."
        aspect="aspect-[4/5] max-w-xs"
        value={mobile}
        onChange={setMobile}
        optional
      />
      <BannerImageField
        id="image-desktop"
        label="Imagem para computador e tablet deitado"
        hint="Larga, proporção 5:2 (ex.: 2000 × 800). O texto aparece do lado esquerdo."
        aspect="aspect-[5/2]"
        value={desktop}
        onChange={setDesktop}
        error={showErrors ? errors.desktop : null}
      />

      <Field label="Título (opcional)" htmlFor="title">
        <TextInput
          id="title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Ex.: Presépios para o Natal"
        />
      </Field>
      <Field label="Texto menor (opcional)" htmlFor="subtitle">
        <TextInput
          id="subtitle"
          value={subtitle}
          onChange={(event) => setSubtitle(event.target.value)}
          placeholder="Ex.: Encomende até 10 de dezembro"
        />
      </Field>

      <LinkField
        link={link}
        onChange={setLink}
        products={products}
        categories={categories}
        error={showErrors ? errors.link : null}
      />

      <fieldset className="space-y-3">
        <legend className="mb-1 text-base font-medium">
          Período (opcional)
        </legend>
        <p className="text-sm text-muted-foreground">
          Para banners de data especial: ele entra e sai da loja sozinho.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Primeiro dia" htmlFor="starts-on">
            <TextInput
              id="starts-on"
              type="date"
              value={startsOn}
              onChange={(event) => setStartsOn(event.target.value)}
            />
          </Field>
          <Field label="Último dia" htmlFor="ends-on">
            <TextInput
              id="ends-on"
              type="date"
              value={endsOn}
              min={startsOn || undefined}
              onChange={(event) => setEndsOn(event.target.value)}
            />
          </Field>
        </div>
        {showErrors && errors.dates && (
          <p className="text-sm text-destructive">{errors.dates}</p>
        )}
      </fieldset>

      <label className="flex min-h-14 cursor-pointer items-center justify-between gap-4 rounded-2xl border border-border bg-card px-4">
        <span className="text-base font-medium">Mostrar na loja</span>
        <input
          type="checkbox"
          role="switch"
          checked={active}
          onChange={(event) => setActive(event.target.checked)}
          className="peer sr-only"
        />
        <span
          aria-hidden
          className="relative h-7 w-12 shrink-0 rounded-full bg-input transition-colors peer-checked:bg-emerald-600 peer-focus-visible:ring-3 peer-focus-visible:ring-ring/50 after:absolute after:top-1 after:left-1 after:size-5 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:after:translate-x-5"
        />
      </label>

      <section aria-labelledby="preview-title" className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 id="preview-title" className="font-heading text-xl font-medium">
            Prévia
          </h2>
          <div
            role="group"
            aria-label="Tamanho da prévia"
            className="flex rounded-xl bg-secondary p-1"
          >
            {(
              [
                ["mobile", "Celular", SmartphoneIcon],
                ["desktop", "Computador", MonitorIcon],
              ] as const
            ).map(([value, label, Icon]) => (
              <button
                key={value}
                type="button"
                aria-pressed={preview === value}
                onClick={() => setPreview(value)}
                className={cn(
                  "flex min-h-11 items-center gap-2 rounded-lg px-3 text-base font-medium",
                  preview === value
                    ? "bg-card shadow-sm"
                    : "text-muted-foreground",
                )}
              >
                <Icon className="size-4" />
                {label}
              </button>
            ))}
          </div>
        </div>
        <BannerPreview
          mode={preview}
          src={imageSrc(preview === "mobile" ? (mobile ?? desktop) : desktop)}
          title={title.trim()}
          subtitle={subtitle.trim()}
        />
      </section>

      {!isNew && (
        <button
          type="button"
          onClick={() => setConfirmDelete(true)}
          disabled={busy}
          className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full px-6 text-base font-medium text-destructive hover:bg-destructive/10"
        >
          <Trash2Icon className="size-5" />
          Excluir banner
        </button>
      )}

      {error && !busy && <Alert>{error}</Alert>}

      <StickyActions>
        {saving && (
          <p
            role="status"
            className="flex flex-1 items-center gap-2 text-base text-muted-foreground"
          >
            <LoaderCircleIcon className="size-5 animate-spin" />
            {saving}
          </p>
        )}
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className={`${primaryButtonClassName} sm:ml-auto sm:w-auto sm:min-w-48`}
        >
          {isNew ? "Criar banner" : "Salvar"}
        </button>
      </StickyActions>

      <Dialog
        open={confirmDelete}
        onOpenChange={(open) => !busy && setConfirmDelete(open)}
      >
        <DialogContent className="gap-6 p-6 text-base sm:max-w-md">
          <DialogHeader className="pr-10">
            <DialogTitle className="font-heading text-xl font-medium">
              Excluir este banner?
            </DialogTitle>
            <DialogDescription className="text-base">
              Ele sai da loja e as imagens são apagadas. Isso não pode ser
              desfeito. Para só tirar da loja por um tempo, desligue “Mostrar na
              loja”.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 sm:flex-row-reverse">
            <button
              type="button"
              onClick={remove}
              disabled={busy}
              className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full bg-destructive px-6 font-medium text-white disabled:opacity-60"
            >
              {busy && <LoaderCircleIcon className="size-5 animate-spin" />}
              Excluir
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              disabled={busy}
              className="inline-flex min-h-12 flex-1 items-center justify-center rounded-full border border-input bg-card px-6 font-medium hover:bg-muted"
            >
              Cancelar
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function BannerImageField({
  id,
  label,
  hint,
  aspect,
  value,
  onChange,
  optional,
  error,
}: {
  id: string;
  label: string;
  hint: string;
  aspect: string;
  value: ImageValue;
  onChange: (value: ImageValue) => void;
  optional?: boolean;
  error?: string | null;
}) {
  const toast = useToast();
  const [compressing, setCompressing] = useState(false);
  const src = imageSrc(value);

  useEffect(
    () => () => {
      if (value?.kind === "new") URL.revokeObjectURL(value.previewUrl);
    },
    [value],
  );

  async function pick(file: File | undefined) {
    if (!file) return;
    setCompressing(true);
    try {
      const { compressImage } = await import("@/lib/images/compress");
      const compressed = await compressImage(file);
      onChange({
        kind: "new",
        file: compressed,
        previewUrl: URL.createObjectURL(compressed),
      });
    } catch (e) {
      console.error(e);
      toast("Essa imagem não abriu. Tente outra.", "error");
    } finally {
      setCompressing(false);
    }
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="text-base font-medium">{label}</p>
        <p className="text-sm text-muted-foreground">{hint}</p>
      </div>
      {src && (
        // eslint-disable-next-line @next/next/no-img-element -- blob: previews
        <img
          src={src}
          alt=""
          className={cn(
            "w-full rounded-2xl border border-border object-cover",
            aspect,
          )}
        />
      )}
      <div className="flex gap-3">
        <label
          htmlFor={id}
          className={cn(
            "flex min-h-14 flex-1 cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-dashed bg-card px-4 text-base font-medium hover:bg-muted",
            error ? "border-destructive" : "border-input",
            compressing && "pointer-events-none opacity-60",
          )}
        >
          {compressing ? (
            <LoaderCircleIcon className="size-5 animate-spin" />
          ) : (
            <ImagePlusIcon className="size-5" />
          )}
          {compressing
            ? "Preparando…"
            : src
              ? "Trocar imagem"
              : "Escolher imagem"}
        </label>
        <input
          id={id}
          type="file"
          accept="image/*"
          className="sr-only"
          disabled={compressing}
          onChange={(event) => {
            pick(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
        {optional && src && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="min-h-14 rounded-2xl px-4 text-base font-medium text-destructive hover:bg-destructive/10"
          >
            Tirar
          </button>
        )}
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

function LinkField({
  link,
  onChange,
  products,
  categories,
  error,
}: {
  link: BannerLink;
  onChange: (link: BannerLink) => void;
  products: { slug: string; name: string }[];
  categories: { slug: string; name: string }[];
  error?: string | null;
}) {
  const options: { kind: BannerLink["kind"]; label: string }[] = [
    { kind: "none", label: "Nenhum" },
    { kind: "product", label: "Uma peça" },
    { kind: "category", label: "Uma categoria" },
    { kind: "url", label: "Outro endereço" },
  ];

  return (
    <fieldset className="space-y-3">
      <legend className="mb-1 text-base font-medium">
        Ao tocar no banner, abrir…
      </legend>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {options.map((option) => (
          <label
            key={option.kind}
            className={cn(
              "flex min-h-12 cursor-pointer items-center justify-center rounded-xl border-2 bg-card px-3 text-center text-base",
              link.kind === option.kind
                ? "border-primary font-medium"
                : "border-border",
            )}
          >
            <input
              type="radio"
              name="link-kind"
              className="sr-only"
              checked={link.kind === option.kind}
              onChange={() =>
                onChange(
                  option.kind === "url"
                    ? { kind: "url", url: "" }
                    : option.kind === "none"
                      ? { kind: "none" }
                      : { kind: option.kind, slug: "" },
                )
              }
            />
            {option.label}
          </label>
        ))}
      </div>

      {(link.kind === "product" || link.kind === "category") && (
        <select
          aria-label={link.kind === "product" ? "Peça" : "Categoria"}
          value={link.slug}
          onChange={(event) => onChange({ ...link, slug: event.target.value })}
          className={inputClassName}
          aria-invalid={!!error}
        >
          <option value="">
            {link.kind === "product" ? "Escolha a peça" : "Escolha a categoria"}
          </option>
          {(link.kind === "product" ? products : categories).map((item) => (
            <option key={item.slug} value={item.slug}>
              {item.name}
            </option>
          ))}
        </select>
      )}
      {link.kind === "url" && (
        <TextInput
          aria-label="Endereço"
          type="url"
          inputMode="url"
          autoCapitalize="none"
          value={link.url}
          onChange={(event) =>
            onChange({ kind: "url", url: event.target.value })
          }
          placeholder="https://instagram.com/…"
          aria-invalid={!!error}
        />
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </fieldset>
  );
}

/**
 * How the slide looks in the store. Mirrors the markup of
 * components/store/banner-carousel.tsx, but with the layout chosen by the
 * toggle instead of the screen width.
 */
function BannerPreview({
  mode,
  src,
  title,
  subtitle,
}: {
  mode: "mobile" | "desktop";
  src: string | null;
  title: string;
  subtitle: string;
}) {
  const mobile = mode === "mobile";
  return (
    <div
      className={cn(
        "relative mx-auto overflow-hidden rounded-3xl bg-secondary",
        mobile ? "aspect-[4/5] max-w-xs" : "aspect-[5/2] w-full",
      )}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- blob: previews
        <img src={src} alt="" className="size-full object-cover" />
      ) : (
        <p className="grid size-full place-items-center p-6 text-center text-muted-foreground">
          Escolha uma imagem para ver a prévia.
        </p>
      )}
      {src && (title || subtitle) && (
        <div
          className={cn(
            "absolute inset-0 flex flex-col text-sand",
            mobile
              ? "justify-end bg-gradient-to-t from-espresso/85 via-espresso/30 to-transparent p-5 pb-8"
              : "justify-center bg-gradient-to-r from-espresso/80 via-espresso/40 to-transparent p-[5%]",
          )}
        >
          <div className="max-w-[60%] min-w-48">
            {title && (
              <p
                className={cn(
                  "font-heading leading-tight tracking-wide text-balance",
                  mobile ? "text-2xl" : "text-[clamp(1rem,3.5vw,2.25rem)]",
                )}
              >
                {title}
              </p>
            )}
            {subtitle && (
              <p className="mt-2 text-sm text-pretty text-sand/85">
                {subtitle}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
