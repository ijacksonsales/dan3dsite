"use client";

import {
  DownloadIcon,
  ImageUpIcon,
  LoaderCircleIcon,
  MinusIcon,
  PlusIcon,
  Share2Icon,
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

import {
  Alert,
  StickyActions,
  primaryButtonClassName,
} from "@/components/admin/form";
import {
  ACCEPTED_IMAGE_TYPES,
  COLOR_RANGE,
  Vectorizer,
  buildSvg,
  readImage,
  toHex,
  usableColors,
  type Smoothing,
  type TraceResult,
} from "@/lib/vectorize";
import { cn } from "@/lib/utils";

const SPECKS = [
  { value: 0, label: "Nenhuma" },
  { value: 8, label: "Pequenas" },
  { value: 32, label: "Médias" },
  { value: 128, label: "Grandes" },
];

const SMOOTHING: { value: Smoothing; label: string }[] = [
  { value: 0, label: "Pouco" },
  { value: 1, label: "Médio" },
  { value: 2, label: "Muito" },
];

interface Settings {
  colors: number;
  smoothing: Smoothing;
  ignoreSpecks: number;
}

/** Checkerboard behind previews, so transparent areas are visible. */
const CHECKERBOARD =
  "bg-[repeating-conic-gradient(var(--muted)_0_25%,transparent_0_50%)] bg-[length:20px_20px]";

function formatBytes(bytes: number) {
  return bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / 1024 / 1024).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MB`;
}

export function SvgTool() {
  const vectorizer = useRef<Vectorizer | null>(null);
  const image = useRef<ImageData | null>(null);
  const job = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const [fileName, setFileName] = useState<string | null>(null);
  const [originalUrl, setOriginalUrl] = useState<string | null>(null);
  const [settings, setSettings] = useState<Settings>({
    colors: 4,
    smoothing: 1,
    ignoreSpecks: 8,
  });
  const [removeBackground, setRemoveBackground] = useState(true);
  const [result, setResult] = useState<TraceResult | null>(null);
  const [hidden, setHidden] = useState<Set<number>>(new Set());
  const [tracing, setTracing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [canShare, setCanShare] = useState(false);

  useEffect(() => {
    // Feature check after mount: navigator only exists in the browser.
    const probe = new File([""], "x.svg", { type: "image/svg+xml" });
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time browser capability check
    setCanShare(!!navigator.canShare?.({ files: [probe] }));
    return () => {
      clearTimeout(timer.current);
      vectorizer.current?.dispose();
    };
  }, []);

  useEffect(
    () => () => {
      if (originalUrl) URL.revokeObjectURL(originalUrl);
    },
    [originalUrl],
  );

  async function trace(next: Settings) {
    if (!image.current) return;
    const id = ++job.current;
    setTracing(true);
    setError(null);
    vectorizer.current ??= new Vectorizer();
    try {
      const traced = await vectorizer.current.trace(image.current, next);
      if (id !== job.current) return; // a newer change already started
      setResult(traced);
      setHidden(new Set());
    } catch (traceError) {
      if (id !== job.current) return;
      setError(
        traceError instanceof Error
          ? traceError.message
          : "Não foi possível converter esta imagem.",
      );
    } finally {
      if (id === job.current) setTracing(false);
    }
  }

  function change(next: Partial<Settings>) {
    const merged = { ...settings, ...next };
    setSettings(merged);
    // Wait for the taps to stop before tracing again.
    clearTimeout(timer.current);
    timer.current = setTimeout(() => trace(merged), 350);
  }

  async function pickFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    try {
      const read = await readImage(file);
      image.current = read.image;
      setFileName(file.name.replace(/\.[^.]+$/, "") || "desenho");
      setOriginalUrl(URL.createObjectURL(file));
      setResult(null);
      trace(settings);
    } catch (readError) {
      setError(
        readError instanceof Error
          ? readError.message
          : "Não foi possível abrir esta imagem.",
      );
    }
  }

  const colors = result ? usableColors(result.trace) : [];
  const background = removeBackground
    ? (result?.backgroundIndex ?? null)
    : null;
  const visible = colors.filter(
    (index) => index !== background && !hidden.has(index),
  );
  const svg = result ? buildSvg(result.trace, visible) : null;
  const svgSize = svg ? new Blob([svg]).size : 0;

  function svgFile() {
    return new File([svg!], `${fileName ?? "desenho"}.svg`, {
      type: "image/svg+xml",
    });
  }

  function download() {
    if (!svg) return;
    const url = URL.createObjectURL(svgFile());
    const link = document.createElement("a");
    link.href = url;
    link.download = `${fileName ?? "desenho"}.svg`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function share() {
    if (!svg) return;
    try {
      await navigator.share({ files: [svgFile()] });
    } catch {
      // Closing the share sheet throws too; nothing to do.
    }
  }

  return (
    <div className="space-y-8">
      <label
        className={cn(
          "flex min-h-14 cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed px-6 text-base font-medium hover:bg-muted",
          originalUrl ? "border-border" : "border-primary py-8",
        )}
      >
        <ImageUpIcon className="size-6" />
        {originalUrl ? "Trocar imagem" : "Escolher imagem (PNG ou JPG)"}
        <input
          type="file"
          accept={ACCEPTED_IMAGE_TYPES}
          onChange={(event) => {
            pickFile(event.target.files?.[0]);
            event.target.value = "";
          }}
          className="sr-only"
        />
      </label>

      {error && <Alert>{error}</Alert>}

      {originalUrl && (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Preview title="Original">
              {/* eslint-disable-next-line @next/next/no-img-element -- local object URL */}
              <img
                src={originalUrl}
                alt="Imagem original"
                className="size-full object-contain"
              />
            </Preview>
            <Preview
              title={
                svg
                  ? `SVG · ${visible.length} ${visible.length === 1 ? "cor" : "cores"} · ${formatBytes(svgSize)}`
                  : "SVG"
              }
            >
              {svg && (
                // eslint-disable-next-line @next/next/no-img-element -- generated SVG, shown as an image (never injected as markup)
                <img
                  src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`}
                  alt="Resultado em SVG"
                  className={cn(
                    "size-full object-contain transition-opacity",
                    tracing && "opacity-40",
                  )}
                />
              )}
              {tracing && (
                <span className="absolute inset-0 grid place-items-center">
                  <span className="inline-flex items-center gap-2 rounded-full bg-card px-4 py-2 text-base shadow-sm">
                    <LoaderCircleIcon className="size-5 animate-spin" />
                    Convertendo…
                  </span>
                </span>
              )}
            </Preview>
          </div>

          <Setting
            title="Número de cores"
            hint="Menos cores deixam o desenho mais limpo. Para um relevo de uma cor só, use 2."
          >
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  change({
                    colors: Math.max(COLOR_RANGE.min, settings.colors - 1),
                  })
                }
                disabled={settings.colors <= COLOR_RANGE.min}
                aria-label="Menos cores"
                className="grid size-12 place-items-center rounded-full border border-input bg-card hover:bg-muted disabled:opacity-40"
              >
                <MinusIcon className="size-5" />
              </button>
              <span
                className="w-12 text-center text-xl font-medium tabular-nums"
                aria-live="polite"
              >
                {settings.colors}
              </span>
              <button
                type="button"
                onClick={() =>
                  change({
                    colors: Math.min(COLOR_RANGE.max, settings.colors + 1),
                  })
                }
                disabled={settings.colors >= COLOR_RANGE.max}
                aria-label="Mais cores"
                className="grid size-12 place-items-center rounded-full border border-input bg-card hover:bg-muted disabled:opacity-40"
              >
                <PlusIcon className="size-5" />
              </button>
            </div>
          </Setting>

          <Setting
            title="Suavizar contornos"
            hint="Mais suave tira serrilhados de fotos e JPG, mas perde detalhes finos."
          >
            <Segmented
              name="smoothing"
              options={SMOOTHING}
              value={settings.smoothing}
              onChange={(smoothing) => change({ smoothing })}
            />
          </Setting>

          <Setting
            title="Ignorar manchas"
            hint="Some com pontinhos soltos, comuns em fotos e imagens comprimidas."
          >
            <Segmented
              name="specks"
              options={SPECKS}
              value={settings.ignoreSpecks}
              onChange={(ignoreSpecks) => change({ ignoreSpecks })}
            />
          </Setting>

          {result && colors.length > 0 && (
            <Setting
              title="Cores do desenho"
              hint="Toque numa cor para tirar ou devolver ao desenho."
            >
              <label className="flex min-h-12 cursor-pointer items-center gap-3 text-base">
                <input
                  type="checkbox"
                  checked={removeBackground}
                  onChange={(event) =>
                    setRemoveBackground(event.target.checked)
                  }
                  className="size-6 accent-primary"
                />
                Remover o fundo
                {result.backgroundIndex != null && (
                  <span
                    className="size-6 rounded-md border border-border"
                    style={{
                      background: toHex(
                        result.trace.palette[result.backgroundIndex],
                      ),
                    }}
                    aria-hidden
                  />
                )}
              </label>
              <ul className="flex flex-wrap gap-3">
                {colors.map((index) => {
                  const hex = toHex(result.trace.palette[index]);
                  const isBackground = index === background;
                  const shown = !isBackground && !hidden.has(index);
                  return (
                    <li key={index}>
                      <button
                        type="button"
                        disabled={isBackground}
                        aria-pressed={shown}
                        aria-label={`Cor ${hex}${isBackground ? " (fundo removido)" : shown ? ", no desenho" : ", fora do desenho"}`}
                        onClick={() =>
                          setHidden((current) => {
                            const next = new Set(current);
                            if (next.has(index)) next.delete(index);
                            else next.add(index);
                            return next;
                          })
                        }
                        className={cn(
                          "relative grid size-14 place-items-center rounded-xl border-2 disabled:cursor-not-allowed",
                          shown ? "border-primary" : "border-border opacity-40",
                        )}
                      >
                        <span
                          className="size-10 rounded-lg border border-black/10"
                          style={{ background: hex }}
                        />
                        {!shown && (
                          <span
                            className="absolute inset-x-1 top-1/2 h-0.5 -rotate-45 bg-foreground"
                            aria-hidden
                          />
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </Setting>
          )}
        </>
      )}

      {svg && (
        <StickyActions>
          {canShare && (
            <button
              type="button"
              onClick={share}
              disabled={tracing || visible.length === 0}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-input bg-card px-6 text-base font-medium hover:bg-muted disabled:opacity-60 sm:flex-1"
            >
              <Share2Icon className="size-5" />
              Compartilhar
            </button>
          )}
          <button
            type="button"
            onClick={download}
            disabled={tracing || visible.length === 0}
            className={`${primaryButtonClassName} sm:flex-1`}
          >
            <DownloadIcon className="size-5" />
            Baixar SVG
          </button>
        </StickyActions>
      )}
    </div>
  );
}

function Preview({ title, children }: { title: string; children: ReactNode }) {
  return (
    <figure className="space-y-2">
      <figcaption className="text-base font-medium">{title}</figcaption>
      <div
        className={cn(
          "relative flex aspect-square items-center justify-center overflow-hidden rounded-2xl border border-border p-3",
          CHECKERBOARD,
        )}
      >
        {children}
      </div>
    </figure>
  );
}

function Setting({
  title,
  hint,
  children,
}: {
  title: string;
  hint: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="space-y-1">
        <h2 className="font-heading text-xl font-medium">{title}</h2>
        <p className="text-base text-muted-foreground">{hint}</p>
      </div>
      {children}
    </section>
  );
}

function Segmented<T extends number>({
  name,
  options,
  value,
  onChange,
}: {
  name: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup">
      {options.map((option) => (
        <label
          key={option.value}
          className={cn(
            "inline-flex min-h-12 cursor-pointer items-center rounded-full border px-5 text-base font-medium",
            option.value === value
              ? "border-primary bg-primary text-primary-foreground"
              : "border-input bg-card hover:bg-muted",
          )}
        >
          <input
            type="radio"
            name={name}
            checked={option.value === value}
            onChange={() => onChange(option.value)}
            className="sr-only"
          />
          {option.label}
        </label>
      ))}
    </div>
  );
}
