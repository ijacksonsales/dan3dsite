"use client";

import type { ModelViewerElement } from "@google/model-viewer";
import { CalculatorIcon, LoaderCircleIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";

import {
  Field,
  StickyActions,
  TextArea,
  TextInput,
  inputClassName,
  primaryButtonClassName,
} from "@/components/admin/form";
import { useToast } from "@/components/admin/toast";
import {
  formatCmInput,
  formatPriceInput,
  parseCmInput,
  parsePriceInput,
} from "@/lib/admin/product-form";
import { saveProduct } from "@/lib/admin/save-product";
import type { ArPlacement } from "@/lib/model-converter";
import { SITE_URL } from "@/lib/site";
import { isValidSlug, slugify } from "@/lib/slug";
import { cn } from "@/lib/utils";
import type { ProductStatus } from "@/types/database";

import { ModelSection } from "./model-section";
import { PhotoSection } from "./photo-section";
import type {
  ModelValue,
  PhotoItem,
  PosterChoice,
  ProductFormInitial,
} from "./types";

/** Text fields kept in the browser so a closed app doesn't lose typing. */
interface Draft {
  id: string;
  name: string;
  slug: string;
  slugTouched: boolean;
  categoryId: string;
  description: string;
  price: string;
  madeToOrder: boolean;
  height: string;
  width: string;
  depth: string;
  placement: ArPlacement;
}

const draftKey = (isNew: boolean, id: string) =>
  `dan3d:product-draft:${isNew ? "new" : id}`;

function readDraftRaw(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function parseDraft(raw: string | null): Draft | null {
  try {
    return raw ? (JSON.parse(raw) as Draft) : null;
  } catch {
    return null;
  }
}

const subscribeNothing = () => () => {};

function clearDraft(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {}
}

export function ProductForm({
  productId: initialId,
  isNew,
  initial,
  categories,
}: {
  productId: string;
  isNew: boolean;
  initial: ProductFormInitial;
  categories: { id: string; name: string }[];
}) {
  const router = useRouter();
  const toast = useToast();
  const viewerRef = useRef<ModelViewerElement>(null);

  const [id, setId] = useState(initialId);
  const [name, setName] = useState(initial.name);
  const [slug, setSlug] = useState(initial.slug);
  const [slugTouched, setSlugTouched] = useState(!isNew);
  const [categoryId, setCategoryId] = useState(initial.category_id ?? "");
  const [description, setDescription] = useState(initial.description ?? "");
  const [price, setPrice] = useState(formatPriceInput(initial.price_cents));
  const [madeToOrder, setMadeToOrder] = useState(initial.made_to_order);
  const [height, setHeight] = useState(formatCmInput(initial.height_mm));
  const [width, setWidth] = useState(formatCmInput(initial.width_mm));
  const [depth, setDepth] = useState(formatCmInput(initial.depth_mm));
  const [placement, setPlacement] = useState(initial.ar_placement);
  const [photos, setPhotos] = useState<PhotoItem[]>(() =>
    initial.images.map((image) => ({
      key: image.id,
      kind: "saved",
      id: image.id,
      path: image.path,
    })),
  );
  const [model, setModel] = useState<ModelValue>(() =>
    initial.model_path
      ? {
          kind: "saved",
          path: initial.model_path,
          sourcePath: initial.model_source_path,
          usdzPath: initial.model_usdz_path,
        }
      : { kind: "none" },
  );
  const [posterChoice, setPosterChoice] = useState<PosterChoice>(
    initial.images.some((image) => image.path === initial.poster_path)
      ? "cover"
      : "model",
  );

  const [dirty, setDirty] = useState(false);
  const [modelBusy, setModelBusy] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [draftDismissed, setDraftDismissed] = useState(false);

  const key = draftKey(isNew, initialId);
  const touch = () => {
    setDirty(true);
    setSaveError(null);
  };

  // Offer to restore text typed before the app was closed. Read on the
  // client only (null on the server), and hidden once editing starts.
  const storedDraft = parseDraft(
    useSyncExternalStore(
      subscribeNothing,
      () => readDraftRaw(key),
      () => null,
    ),
  );
  const draftOffer =
    !draftDismissed && !dirty && storedDraft ? storedDraft : null;

  // Keep the draft current while editing.
  useEffect(() => {
    if (!dirty) return;
    const timeout = setTimeout(() => {
      const draft: Draft = {
        id,
        name,
        slug,
        slugTouched,
        categoryId,
        description,
        price,
        madeToOrder,
        height,
        width,
        depth,
        placement,
      };
      try {
        localStorage.setItem(key, JSON.stringify(draft));
      } catch {}
    }, 500);
    return () => clearTimeout(timeout);
  }, [
    dirty,
    key,
    id,
    name,
    slug,
    slugTouched,
    categoryId,
    description,
    price,
    madeToOrder,
    height,
    width,
    depth,
    placement,
  ]);

  // Warn before leaving with unsaved changes (closing the tab, reloading).
  useEffect(() => {
    if (!dirty || saving) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    addEventListener("beforeunload", warn);
    return () => removeEventListener("beforeunload", warn);
  }, [dirty, saving]);

  function restoreDraft(draft: Draft) {
    if (isNew) setId(draft.id);
    setName(draft.name);
    setSlug(draft.slug);
    setSlugTouched(draft.slugTouched);
    setCategoryId(draft.categoryId);
    setDescription(draft.description);
    setPrice(draft.price);
    setMadeToOrder(draft.madeToOrder);
    setHeight(draft.height);
    setWidth(draft.width);
    setDepth(draft.depth);
    setPlacement(draft.placement);
    setDraftDismissed(true);
    setDirty(true);
  }

  const onModelChange = useCallback((next: ModelValue) => {
    setModel(next);
    setDirty(true);
    setSaveError(null);
    // Measures come from the converted model (mm → cm in the form).
    if (next.kind === "converted") {
      setHeight(formatCmInput(next.model.meta.heightMm));
      setWidth(formatCmInput(next.model.meta.widthMm));
      setDepth(formatCmInput(next.model.meta.depthMm));
    }
  }, []);

  const parsedPrice = parsePriceInput(price);
  const parsedDims = [height, width, depth].map(parseCmInput);
  const errors = {
    name: name.trim() ? null : "Digite o nome da peça.",
    slug: isValidSlug(slug)
      ? null
      : "Use só letras minúsculas sem acento, números e hífens.",
    price: parsedPrice.ok ? null : parsedPrice.error,
    dims: parsedDims.some((dim) => !dim.ok)
      ? "Digite as medidas em cm, por exemplo 15,2."
      : null,
  };

  async function submit(status: ProductStatus) {
    if (Object.values(errors).some(Boolean) || !parsedPrice.ok) {
      setShowErrors(true);
      setSaveError("Confira os campos marcados em vermelho.");
      return;
    }
    if (status === "published" && photos.length === 0) {
      setSaveError("Para publicar, coloque pelo menos uma foto.");
      return;
    }
    const [heightMm, widthMm, depthMm] = parsedDims.map((dim) =>
      dim.ok ? dim.value : null,
    );

    setSaving("Salvando…");
    setSaveError(null);
    const result = await saveProduct({
      productId: id,
      isNew,
      initial,
      values: {
        name: name.trim(),
        slug,
        description: description.trim() || null,
        category_id: categoryId || null,
        price_cents: parsedPrice.value,
        height_mm: heightMm,
        width_mm: widthMm,
        depth_mm: depthMm,
        made_to_order: madeToOrder,
        ar_placement: placement,
        status,
      },
      photos,
      model,
      posterChoice,
      capturePoster: async () => {
        const viewer = viewerRef.current;
        if (!viewer?.loaded) return null;
        try {
          return await viewer.toBlob({
            mimeType: "image/webp",
            qualityArgument: 0.85,
          });
        } catch {
          return null;
        }
      },
      onStep: setSaving,
    });

    if (!result.ok) {
      setSaving(null);
      setSaveError(result.message);
      return;
    }
    clearDraft(key);
    setDirty(false);
    for (const warning of result.warnings) toast(warning, "error");
    toast(
      status === "published"
        ? "Produto salvo e publicado na loja."
        : "Rascunho salvo. Ele ainda não aparece na loja.",
    );
    if (isNew) router.replace(`/admin/produtos/${id}`);
    else router.refresh();
    setSaving(null);
  }

  const busy = saving !== null || modelBusy;
  const hasModel = model.kind !== "none";

  return (
    <div className="space-y-10">
      {draftOffer && (
        <div className="space-y-3 rounded-2xl border-2 border-primary/40 bg-card p-4">
          <p className="text-base">
            Você tinha um cadastro desta peça que não foi salvo. Quer recuperar
            o que já tinha digitado? (Fotos e modelo 3D precisam ser escolhidos
            de novo.)
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => restoreDraft(draftOffer)}
              className="min-h-12 flex-1 rounded-full bg-primary px-5 text-base font-medium text-primary-foreground"
            >
              Recuperar
            </button>
            <button
              type="button"
              onClick={() => {
                clearDraft(key);
                setDraftDismissed(true);
              }}
              className="min-h-12 flex-1 rounded-full border border-input bg-card px-5 text-base font-medium hover:bg-muted"
            >
              Começar do zero
            </button>
          </div>
        </div>
      )}

      <Section number={1} title="Fotos">
        <PhotoSection
          photos={photos}
          onChange={(next) => {
            setPhotos(next);
            touch();
          }}
        />
      </Section>

      <Section number={2} title="Informações">
        <Field
          label="Nome da peça"
          htmlFor="name"
          error={showErrors ? errors.name : null}
        >
          <TextInput
            id="name"
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              if (!slugTouched) setSlug(slugify(event.target.value));
              touch();
            }}
            placeholder="Ex.: Nossa Senhora Aparecida"
            aria-invalid={showErrors && !!errors.name}
          />
        </Field>

        <Field
          label="Endereço na loja"
          htmlFor="slug"
          error={showErrors ? errors.slug : null}
          hint={
            isNew
              ? "Preenchido sozinho a partir do nome."
              : "Se mudar, links já compartilhados desta peça deixam de funcionar."
          }
        >
          <div className="flex min-h-12 items-center overflow-hidden rounded-xl border border-input bg-card focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/40">
            <span className="shrink-0 pl-4 text-base text-muted-foreground">
              {new URL(SITE_URL).host}/p/
            </span>
            <input
              id="slug"
              value={slug}
              onChange={(event) => {
                setSlugTouched(true);
                setSlug(event.target.value.toLowerCase());
                touch();
              }}
              onBlur={() => setSlug((value) => slugify(value))}
              autoCapitalize="none"
              spellCheck={false}
              aria-invalid={showErrors && !!errors.slug}
              className="min-h-12 min-w-0 flex-1 bg-transparent pr-4 text-base outline-none"
            />
          </div>
        </Field>

        <Field label="Categoria" htmlFor="category">
          <select
            id="category"
            value={categoryId}
            onChange={(event) => {
              setCategoryId(event.target.value);
              touch();
            }}
            className={inputClassName}
          >
            <option value="">Sem categoria</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </Field>

        <Field
          label="Descrição"
          htmlFor="description"
          hint="Material, cores, acabamento, cuidados. Aparece na página da peça."
        >
          <TextArea
            id="description"
            value={description}
            onChange={(event) => {
              setDescription(event.target.value);
              touch();
            }}
            rows={5}
          />
        </Field>

        <Field
          label="Preço (R$)"
          htmlFor="price"
          error={showErrors ? errors.price : null}
          hint="Deixe vazio para mostrar “Sob consulta”."
        >
          <TextInput
            id="price"
            inputMode="decimal"
            value={price}
            onChange={(event) => {
              setPrice(event.target.value);
              touch();
            }}
            onBlur={() => {
              if (parsedPrice.ok) setPrice(formatPriceInput(parsedPrice.value));
            }}
            placeholder="89,90"
            aria-invalid={showErrors && !!errors.price}
          />
          {!isNew && (
            <Link
              href={`/admin/calculadora?produto=${id}`}
              className="inline-flex min-h-12 items-center gap-2 rounded-full text-base font-medium text-primary underline-offset-4 hover:underline"
            >
              <CalculatorIcon className="size-5" />
              Calcular preço
            </Link>
          )}
        </Field>

        <label className="flex min-h-12 cursor-pointer items-center gap-3 text-base">
          <input
            type="checkbox"
            checked={madeToOrder}
            onChange={(event) => {
              setMadeToOrder(event.target.checked);
              touch();
            }}
            className="size-6 accent-primary"
          />
          Feita sob encomenda
        </label>
      </Section>

      <Section
        number={3}
        title="Modelo 3D"
        description="Com o modelo, o cliente vê a peça girando e em tamanho real no próprio espaço."
      >
        <ModelSection
          productName={name}
          placement={placement}
          onPlacementChange={(next) => {
            setPlacement(next);
            touch();
          }}
          model={model}
          onModelChange={onModelChange}
          viewerRef={viewerRef}
          onBusyChange={setModelBusy}
        />
      </Section>

      <Section
        number={4}
        title="Medidas da peça"
        description={
          hasModel
            ? "Preenchidas pelo modelo 3D. Para mudar a altura, use “Corrigir a altura” acima."
            : "Opcional. Aparecem na página e na mensagem do WhatsApp."
        }
      >
        <div className="grid grid-cols-3 gap-3">
          {(
            [
              ["height", "Altura", height, setHeight],
              ["width", "Largura", width, setWidth],
              ["depth", "Profund.", depth, setDepth],
            ] as const
          ).map(([fieldId, label, value, setValue]) => (
            <Field key={fieldId} label={`${label} (cm)`} htmlFor={fieldId}>
              <TextInput
                id={fieldId}
                inputMode="decimal"
                value={value}
                readOnly={hasModel}
                onChange={(event) => {
                  setValue(event.target.value);
                  touch();
                }}
                className={cn(hasModel && "bg-muted text-muted-foreground")}
              />
            </Field>
          ))}
        </div>
        {showErrors && errors.dims && (
          <p className="text-sm text-destructive">{errors.dims}</p>
        )}
      </Section>

      {hasModel && (
        <Section
          number={5}
          title="Imagem de espera"
          description="Aparece no lugar do 3D enquanto ele carrega no celular do cliente."
        >
          <fieldset className="grid gap-3 sm:grid-cols-2">
            <legend className="sr-only">Imagem de espera</legend>
            {(
              [
                [
                  "model",
                  "Imagem do modelo 3D",
                  "Como aparece na prévia acima",
                ],
                ["cover", "Foto de capa", "A primeira foto da peça"],
              ] as const
            ).map(([value, label, hint]) => (
              <label
                key={value}
                className={cn(
                  "flex min-h-16 cursor-pointer items-center gap-3 rounded-2xl border-2 bg-card px-4 py-3",
                  posterChoice === value ? "border-primary" : "border-border",
                )}
              >
                <input
                  type="radio"
                  name="poster"
                  className="size-5 accent-primary"
                  checked={posterChoice === value}
                  onChange={() => {
                    setPosterChoice(value);
                    touch();
                  }}
                />
                <span>
                  <span className="block text-base font-medium">{label}</span>
                  <span className="block text-sm text-muted-foreground">
                    {hint}
                  </span>
                </span>
              </label>
            ))}
          </fieldset>
        </Section>
      )}

      <StickyActions>
        {(saving || saveError) && (
          <p
            role={saveError ? "alert" : "status"}
            className={cn(
              "flex min-w-0 flex-1 items-center gap-2 text-base",
              saveError ? "text-destructive" : "text-muted-foreground",
            )}
          >
            {saving && (
              <LoaderCircleIcon className="size-5 shrink-0 animate-spin" />
            )}
            {saving ?? saveError}
          </p>
        )}
        <div className="flex gap-3 sm:ml-auto">
          <button
            type="button"
            onClick={() => submit("draft")}
            disabled={busy}
            className="inline-flex min-h-12 flex-1 items-center justify-center rounded-full border border-input bg-card px-5 text-base font-medium hover:bg-muted disabled:opacity-60 sm:flex-none"
          >
            {initial.status === "published"
              ? "Tirar da loja"
              : "Salvar rascunho"}
          </button>
          <button
            type="button"
            onClick={() => submit("published")}
            disabled={busy}
            className={cn(
              primaryButtonClassName,
              "flex-1 sm:w-auto sm:min-w-44 sm:flex-none",
            )}
          >
            {initial.status === "published" ? "Salvar" : "Publicar"}
          </button>
        </div>
      </StickyActions>
    </div>
  );
}

function Section({
  number,
  title,
  description,
  children,
}: {
  number: number;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={`section-${number}`} className="space-y-5">
      <div className="space-y-1">
        <h2
          id={`section-${number}`}
          className="flex items-center gap-3 font-heading text-xl font-medium"
        >
          <span className="grid size-8 place-items-center rounded-full bg-primary text-base text-primary-foreground">
            {number}
          </span>
          {title}
        </h2>
        {description && (
          <p className="text-base text-muted-foreground">{description}</p>
        )}
      </div>
      {children}
    </section>
  );
}
