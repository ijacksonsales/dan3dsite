"use client";

import type { ModelViewerElement } from "@google/model-viewer";
import { BoxIcon, CheckIcon, LoaderCircleIcon, RulerIcon } from "lucide-react";
import { useEffect, useRef, useState, type Ref } from "react";

import { Alert, TextInput } from "@/components/admin/form";
import { ModelViewer } from "@/components/model-viewer";
import { formatCmInput, parseCmInput } from "@/lib/admin/product-form";
import {
  ACCEPTED_FILE_TYPES,
  ModelConverter,
  STAGE_LABELS,
  type ArPlacement,
  type ConvertStage,
  type ModelInfo,
} from "@/lib/model-converter";
import { sameIds, selectionChoices } from "@/lib/model-converter/choices";
import { publicUrl } from "@/lib/storage";
import { cn } from "@/lib/utils";

import type { ModelValue } from "./types";

const PLACEMENTS: { value: ArPlacement; label: string; hint: string }[] = [
  {
    value: "floor",
    label: "Peça no chão ou mesa",
    hint: "Imagens, enfeites, peças que ficam em pé",
  },
  {
    value: "wall",
    label: "Peça na parede",
    hint: "Placas, quadros, relevos",
  },
];

export function ModelSection({
  productName,
  placement,
  onPlacementChange,
  model,
  onModelChange,
  viewerRef,
  onBusyChange,
}: {
  productName: string;
  placement: ArPlacement;
  onPlacementChange: (placement: ArPlacement) => void;
  model: ModelValue;
  onModelChange: (model: ModelValue) => void;
  viewerRef: Ref<ModelViewerElement>;
  onBusyChange: (busy: boolean) => void;
}) {
  const converterRef = useRef<ModelConverter | null>(null);
  // The original file of the opened model, when it is a new upload.
  const newSourceRef = useRef<File | null>(null);
  const [info, setInfo] = useState<ModelInfo>();
  const [objectIds, setObjectIds] = useState<string[]>([]);
  const [targetHeightMm, setTargetHeightMm] = useState<number>();
  const [progress, setProgress] = useState<{
    stage: ConvertStage;
    value: number;
  }>();
  const [error, setError] = useState<string>();
  const [heightCheck, setHeightCheck] = useState<"ask" | "ok" | "editing">(
    "ok",
  );
  const [heightInput, setHeightInput] = useState("");

  const busy = progress !== undefined;
  useEffect(() => onBusyChange(busy), [busy, onBusyChange]);
  useEffect(() => () => converterRef.current?.dispose(), []);

  const converted = model.kind === "converted" ? model.model : null;
  useEffect(
    () => () => {
      if (converted) URL.revokeObjectURL(converted.url);
    },
    [converted],
  );

  const onProgress = (stage: ConvertStage, value: number) =>
    setProgress({ stage, value });

  async function convert(options: {
    ids?: string[];
    placement?: ArPlacement;
    heightMm?: number;
  }) {
    const converter = converterRef.current;
    if (!converter) return false;
    setError(undefined);
    try {
      const { glb, meta } = await converter.convert(
        {
          objectIds: options.ids ?? objectIds,
          placement: options.placement ?? placement,
          targetHeightMm: options.heightMm,
        },
        onProgress,
      );
      const url = URL.createObjectURL(
        new Blob([glb as Uint8Array<ArrayBuffer>], {
          type: "model/gltf-binary",
        }),
      );
      onModelChange({
        kind: "converted",
        model: {
          glb,
          url,
          meta,
          placement: options.placement ?? placement,
          newSource: newSourceRef.current,
        },
      });
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return false;
    } finally {
      setProgress(undefined);
    }
  }

  async function open(
    file: File,
    isNewSource: boolean,
    nextPlacement = placement,
  ) {
    converterRef.current?.dispose();
    converterRef.current = new ModelConverter();
    newSourceRef.current = isNewSource ? file : null;
    setInfo(undefined);
    setError(undefined);
    setTargetHeightMm(undefined);
    try {
      const opened = await converterRef.current.open(file, onProgress);
      setInfo(opened);
      setObjectIds(opened.defaultObjectIds);
      const ok = await convert({
        ids: opened.defaultObjectIds,
        placement: nextPlacement,
      });
      if (ok && isNewSource) setHeightCheck("ask");
      return ok;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setProgress(undefined);
      return false;
    }
  }

  async function changePlacement(next: ArPlacement) {
    if (next === placement || busy) return;
    onPlacementChange(next);
    // The piece stands differently on a wall: convert again from the file.
    if (converterRef.current && info) {
      await convert({ placement: next, heightMm: targetHeightMm });
    } else if (model.kind === "saved" && model.sourcePath) {
      setProgress({ stage: "read", value: 0 });
      try {
        const response = await fetch(publicUrl("models", model.sourcePath));
        if (!response.ok) throw new Error(String(response.status));
        const name = model.sourcePath.split("/").pop() ?? "modelo.stl";
        await open(new File([await response.blob()], name), false, next);
      } catch {
        setProgress(undefined);
        setError(
          "Não foi possível abrir o arquivo guardado. Envie o arquivo do modelo de novo.",
        );
      }
    }
  }

  async function applyHeight() {
    const parsed = parseCmInput(heightInput);
    if (!parsed.ok || parsed.value == null) {
      setError("Digite a altura em cm, por exemplo 15,2.");
      return;
    }
    setTargetHeightMm(parsed.value);
    if (await convert({ heightMm: parsed.value })) setHeightCheck("ok");
  }

  const choices = info ? selectionChoices(info) : [];
  const previewSrc =
    model.kind === "converted"
      ? model.model.url
      : model.kind === "saved"
        ? publicUrl("models", model.path)
        : null;
  const savedNeedsNewFile =
    model.kind === "saved" && !model.sourcePath && !info;

  return (
    <div className="space-y-6">
      <fieldset className="space-y-3">
        <legend className="mb-3 text-base font-medium">
          Como a peça fica no espaço?
        </legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {PLACEMENTS.map((option) => (
            <label
              key={option.value}
              className={cn(
                "flex min-h-16 cursor-pointer items-center gap-3 rounded-2xl border-2 bg-card px-4 py-3 has-[:disabled]:cursor-default has-[:disabled]:opacity-60",
                placement === option.value ? "border-primary" : "border-border",
              )}
            >
              <input
                type="radio"
                name="ar_placement"
                className="size-5 accent-primary"
                checked={placement === option.value}
                disabled={
                  busy || (savedNeedsNewFile && placement !== option.value)
                }
                onChange={() => changePlacement(option.value)}
              />
              <span>
                <span className="block text-base font-medium">
                  {option.label}
                </span>
                <span className="block text-sm text-muted-foreground">
                  {option.hint}
                </span>
              </span>
            </label>
          ))}
        </div>
        {savedNeedsNewFile && (
          <p className="text-sm text-muted-foreground">
            Para mudar entre chão e parede, envie o arquivo do modelo de novo.
          </p>
        )}
      </fieldset>

      {previewSrc && (
        <div className="space-y-3">
          <div className="relative aspect-square w-full overflow-hidden rounded-2xl border border-border bg-secondary sm:aspect-[4/3]">
            <ModelViewer
              key={previewSrc}
              ref={viewerRef}
              src={previewSrc}
              iosSrc={
                model.kind === "saved" && model.usdzPath
                  ? publicUrl("models", model.usdzPath)
                  : undefined
              }
              alt={`Prévia 3D de ${productName || "nova peça"}`}
              loading="eager"
              placement={placement}
              arLabel="Testar no meu espaço"
              className="bg-secondary"
            />
          </div>
          {converted && (
            <SizeCheck
              heightMm={converted.meta.heightMm}
              widthMm={converted.meta.widthMm}
              state={heightCheck}
              heightInput={heightInput}
              onHeightInput={setHeightInput}
              onConfirm={() => setHeightCheck("ok")}
              onEdit={() => {
                setHeightInput(formatCmInput(converted.meta.heightMm));
                setHeightCheck("editing");
              }}
              onApply={applyHeight}
              busy={busy}
            />
          )}
          {converted?.meta.warnings.map((warning) => (
            <p
              key={warning.code}
              className="rounded-xl bg-amber-50 px-4 py-3 text-base text-amber-900"
            >
              {warning.message}
            </p>
          ))}
        </div>
      )}

      {info && choices.length > 1 && (
        <fieldset className="space-y-2">
          <legend className="mb-2 text-base font-medium">
            O arquivo tem mais de uma peça. Qual mostrar?
          </legend>
          {choices.map((choice) => (
            <label
              key={choice.key}
              className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-border bg-card px-4"
            >
              <input
                type="radio"
                name="piece"
                className="size-5 accent-primary"
                checked={sameIds(choice.objectIds, objectIds)}
                disabled={busy}
                onChange={() => {
                  setObjectIds(choice.objectIds);
                  setTargetHeightMm(undefined);
                  convert({ ids: choice.objectIds }).then(
                    (ok) => ok && setHeightCheck("ask"),
                  );
                }}
              />
              {choice.label}
            </label>
          ))}
        </fieldset>
      )}

      {progress && (
        <div role="status" className="space-y-2 rounded-2xl bg-secondary p-4">
          <p className="flex items-center gap-2 text-base">
            <LoaderCircleIcon className="size-5 animate-spin" />
            {STAGE_LABELS[progress.stage]}…
          </p>
          <div className="h-3 overflow-hidden rounded-full bg-background">
            <div
              className="h-full bg-primary transition-[width]"
              style={{ width: `${Math.round(progress.value * 100)}%` }}
            />
          </div>
          <p className="text-sm text-muted-foreground">
            Arquivos grandes podem levar alguns segundos. Não feche esta tela.
          </p>
        </div>
      )}

      {error && <Alert>{error}</Alert>}

      <div className="flex flex-col gap-3 sm:flex-row">
        <label className="flex min-h-14 flex-1 cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-input bg-card px-4 text-center text-base font-medium hover:bg-muted has-[:disabled]:cursor-default has-[:disabled]:opacity-50">
          <BoxIcon className="size-5" />
          {model.kind === "none"
            ? "Escolher o arquivo do modelo 3D (STL ou 3MF)"
            : "Trocar o modelo 3D"}
          <input
            type="file"
            accept={ACCEPTED_FILE_TYPES}
            className="sr-only"
            disabled={busy}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) open(file, true);
            }}
          />
        </label>
        {model.kind !== "none" && (
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              converterRef.current?.dispose();
              converterRef.current = null;
              setInfo(undefined);
              onModelChange({ kind: "none" });
            }}
            className="min-h-14 rounded-2xl px-4 text-base font-medium text-destructive hover:bg-destructive/10 disabled:opacity-50"
          >
            Tirar o modelo 3D
          </button>
        )}
      </div>
    </div>
  );
}

function SizeCheck({
  heightMm,
  widthMm,
  state,
  heightInput,
  onHeightInput,
  onConfirm,
  onEdit,
  onApply,
  busy,
}: {
  heightMm: number;
  widthMm: number;
  state: "ask" | "ok" | "editing";
  heightInput: string;
  onHeightInput: (value: string) => void;
  onConfirm: () => void;
  onEdit: () => void;
  onApply: () => void;
  busy: boolean;
}) {
  const sizes = (
    <>
      Altura detectada: <strong>{formatCmInput(heightMm)} cm</strong> · Largura:{" "}
      {formatCmInput(widthMm)} cm
    </>
  );

  if (state === "editing")
    return (
      <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
        <label htmlFor="real-height" className="block text-base font-medium">
          Altura real da peça impressa (cm)
        </label>
        <p className="text-sm text-muted-foreground">
          Meça com a fita métrica. A largura e a profundidade se ajustam juntas.
        </p>
        <div className="flex gap-2">
          <TextInput
            id="real-height"
            inputMode="decimal"
            value={heightInput}
            onChange={(event) => onHeightInput(event.target.value)}
            placeholder="15,2"
            autoFocus
          />
          <button
            type="button"
            onClick={onApply}
            disabled={busy}
            className="min-h-12 shrink-0 rounded-xl bg-primary px-5 text-base font-medium text-primary-foreground disabled:opacity-60"
          >
            Aplicar
          </button>
        </div>
      </div>
    );

  if (state === "ask")
    return (
      <div className="space-y-3 rounded-2xl border-2 border-primary/40 bg-card p-4">
        <p className="text-base">{sizes} — confere com a peça?</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={onConfirm}
            className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full bg-primary px-5 text-base font-medium text-primary-foreground"
          >
            <CheckIcon className="size-5" />
            Sim, confere
          </button>
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full border border-input bg-card px-5 text-base font-medium hover:bg-muted"
          >
            <RulerIcon className="size-5" />
            Não, corrigir a altura
          </button>
        </div>
      </div>
    );

  return (
    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-base">
      <span>{sizes}</span>
      <button
        type="button"
        onClick={onEdit}
        className="min-h-12 rounded-full px-3 font-medium text-primary underline-offset-4 hover:underline"
      >
        Corrigir a altura
      </button>
    </p>
  );
}
