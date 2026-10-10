"use client";

import { useEffect, useRef, useState } from "react";

import { ModelViewer } from "@/components/model-viewer";
import { Button } from "@/components/ui/button";
import {
  ACCEPTED_FILE_TYPES,
  ModelConverter,
  STAGE_LABELS,
  type ArPlacement,
  type ConvertMeta,
  type ConvertStage,
  type ModelInfo,
} from "@/lib/model-converter";

interface Progress {
  stage: ConvertStage;
  value: number;
}

interface Result {
  url: string;
  meta: ConvertMeta;
  placement: ArPlacement;
  seconds: number;
}

const formatCm = (mm: number) =>
  `${(mm / 10).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} cm`;

const formatMb = (bytes: number) =>
  `${(bytes / 1024 / 1024).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} MB`;

export function ConverterTester() {
  const converterRef = useRef<ModelConverter | null>(null);
  const [fileName, setFileName] = useState<string>();
  const [info, setInfo] = useState<ModelInfo>();
  const [objectIds, setObjectIds] = useState<string[]>([]);
  const [placement, setPlacement] = useState<ArPlacement>("floor");
  const [heightCm, setHeightCm] = useState("");
  const [compress, setCompress] = useState(true);
  const [progress, setProgress] = useState<Progress>();
  const [result, setResult] = useState<Result>();
  const [error, setError] = useState<string>();
  const [openSeconds, setOpenSeconds] = useState<number>();

  useEffect(() => () => converterRef.current?.dispose(), []);
  useEffect(() => () => result && URL.revokeObjectURL(result.url), [result]);

  const onProgress = (stage: ConvertStage, value: number) =>
    setProgress({ stage, value });

  async function convert(ids = objectIds) {
    const converter = converterRef.current;
    if (!converter) return;
    setError(undefined);
    const started = performance.now();
    try {
      const targetHeightMm = Number(heightCm.replace(",", ".")) * 10;
      const { glb, meta } = await converter.convert(
        {
          objectIds: ids,
          placement,
          targetHeightMm: targetHeightMm > 0 ? targetHeightMm : undefined,
          compress,
        },
        onProgress,
      );
      const url = URL.createObjectURL(
        new Blob([glb as Uint8Array<ArrayBuffer>], {
          type: "model/gltf-binary",
        }),
      );
      setResult({
        url,
        meta,
        placement,
        seconds: (performance.now() - started) / 1000,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setProgress(undefined);
    }
  }

  async function openFile(file: File) {
    converterRef.current?.dispose();
    converterRef.current = new ModelConverter();
    setFileName(file.name);
    setInfo(undefined);
    setResult(undefined);
    setError(undefined);
    const started = performance.now();
    try {
      const opened = await converterRef.current.open(file, onProgress);
      setOpenSeconds((performance.now() - started) / 1000);
      setInfo(opened);
      setObjectIds(opened.defaultObjectIds);
      await convert(opened.defaultObjectIds);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setProgress(undefined);
    }
  }

  const busy = progress != null;
  const choices = info ? selectionChoices(info) : [];

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 pt-6 pb-32">
      <header>
        <h1 className="text-2xl font-semibold">Teste do conversor 3D</h1>
        <p className="text-muted-foreground">
          Página de teste: o modelo não é salvo em lugar nenhum.
        </p>
      </header>

      <label className="flex min-h-14 cursor-pointer items-center justify-center rounded-xl border-2 border-dashed px-4 text-center text-base font-medium has-[:disabled]:opacity-50">
        {fileName
          ? `Arquivo: ${fileName} (toque para trocar)`
          : "Escolher arquivo STL ou 3MF"}
        <input
          type="file"
          accept={ACCEPTED_FILE_TYPES}
          className="sr-only"
          disabled={busy}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) openFile(file);
          }}
        />
      </label>

      {progress && (
        <div role="status" className="flex flex-col gap-2">
          <p>{STAGE_LABELS[progress.stage]}…</p>
          <div className="h-3 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-primary transition-[width]"
              style={{ width: `${Math.round(progress.value * 100)}%` }}
            />
          </div>
        </div>
      )}

      {error && (
        <p
          role="alert"
          className="rounded-lg border border-destructive/40 p-4 text-destructive"
        >
          {error}
        </p>
      )}

      {info && choices.length > 1 && (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 font-medium">Qual peça mostrar?</legend>
          {choices.map((choice) => (
            <label
              key={choice.key}
              className="flex min-h-12 items-center gap-3 rounded-lg border px-4"
            >
              <input
                type="radio"
                name="piece"
                className="size-5"
                checked={sameIds(choice.objectIds, objectIds)}
                onChange={() => setObjectIds(choice.objectIds)}
              />
              {choice.label}
            </label>
          ))}
        </fieldset>
      )}

      {info && (
        <>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 font-medium">
              Como a peça fica no espaço?
            </legend>
            {(
              [
                ["floor", "Peça no chão ou mesa"],
                ["wall", "Peça na parede"],
              ] as const
            ).map(([value, label]) => (
              <label
                key={value}
                className="flex min-h-12 items-center gap-3 rounded-lg border px-4"
              >
                <input
                  type="radio"
                  name="placement"
                  className="size-5"
                  checked={placement === value}
                  onChange={() => setPlacement(value)}
                />
                {label}
              </label>
            ))}
          </fieldset>

          <label className="flex flex-col gap-2">
            <span className="font-medium">
              Altura real da peça (cm, opcional)
            </span>
            <input
              inputMode="decimal"
              placeholder="ex.: 15,2"
              value={heightCm}
              onChange={(event) => setHeightCm(event.target.value)}
              className="min-h-12 rounded-lg border px-4 text-base"
            />
          </label>

          <label className="flex min-h-12 items-center gap-3">
            <input
              type="checkbox"
              className="size-5"
              checked={compress}
              onChange={(event) => setCompress(event.target.checked)}
            />
            Comprimir o modelo (meshopt)
          </label>
        </>
      )}

      {result && (
        <section className="flex flex-col gap-4">
          <div className="relative aspect-square w-full overflow-hidden rounded-xl border">
            <ModelViewer
              key={result.url}
              src={result.url}
              alt={`Prévia 3D de ${fileName}`}
              placement={result.placement}
              arLabel="Testar no meu espaço"
            />
          </div>
          <p className="text-lg">
            Altura detectada: <strong>{formatCm(result.meta.heightMm)}</strong>{" "}
            · Largura: {formatCm(result.meta.widthMm)} · Profundidade:{" "}
            {formatCm(result.meta.depthMm)}
          </p>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <dt>Triângulos</dt>
            <dd>{result.meta.triangleCount.toLocaleString("pt-BR")}</dd>
            <dt>Tamanho do arquivo</dt>
            <dd>{formatMb(result.meta.fileSizeBytes)}</dd>
            <dt>Tempo para ler</dt>
            <dd>{openSeconds?.toFixed(1)} s</dd>
            <dt>Tempo para converter</dt>
            <dd>{result.seconds.toFixed(1)} s</dd>
          </dl>
          {result.meta.warnings.length > 0 && (
            <ul className="flex flex-col gap-2">
              {result.meta.warnings.map((warning) => (
                <li
                  key={warning.code}
                  className="rounded-lg border border-amber-500/50 bg-amber-50 p-3 text-amber-900 dark:bg-amber-950 dark:text-amber-100"
                >
                  {warning.message}
                </li>
              ))}
            </ul>
          )}
          <Button asChild variant="outline" className="h-12 text-base">
            <a href={result.url} download={fileName?.replace(/\.\w+$/, ".glb")}>
              Baixar modelo 3D (.glb)
            </a>
          </Button>
        </section>
      )}

      {info && (
        <div className="fixed inset-x-0 bottom-0 border-t bg-background/95 p-4 backdrop-blur">
          <Button
            className="mx-auto flex h-12 w-full max-w-2xl text-base"
            disabled={busy || objectIds.length === 0}
            onClick={() => convert()}
          >
            {busy ? "Convertendo…" : "Converter de novo"}
          </Button>
        </div>
      )}
    </main>
  );
}

interface Choice {
  key: string;
  label: string;
  objectIds: string[];
}

/** "Everything" or whole plates first, then single pieces. */
function selectionChoices(info: ModelInfo): Choice[] {
  const count = (n: number) => (n === 1 ? "1 peça" : `${n} peças`);
  const choices: Choice[] = [];
  if (info.plates.length > 1) {
    for (const plate of info.plates)
      choices.push({
        key: `plate-${plate.id}`,
        label: `${plate.name} (${count(plate.objectIds.length)})`,
        objectIds: plate.objectIds,
      });
  } else if (info.objects.length > 1) {
    choices.push({
      key: "all",
      label: `Tudo (${count(info.objects.length)})`,
      objectIds: info.objects.map((object) => object.id),
    });
  }
  for (const object of info.objects)
    choices.push({
      key: `object-${object.id}`,
      label: object.plate
        ? `${object.name} · placa ${object.plate}`
        : object.name,
      objectIds: [object.id],
    });
  return choices;
}

const sameIds = (a: string[], b: string[]) =>
  a.length === b.length && a.every((id, i) => id === b[i]);
