import { ConverterError } from "./errors";
import { convertModel, parseModel } from "./pipeline";
import type { WorkerRequest, WorkerResponse } from "./protocol";
import type { ConvertStage, ModelInfo, ParsedModel } from "./types";

/**
 * Web Worker entry: parsing and conversion run here so the tablet UI never
 * freezes. The parsed model stays in memory so the admin can convert again
 * (other piece, placement or height) without reading the file again.
 */

interface WorkerScope {
  postMessage(message: WorkerResponse, transfer?: Transferable[]): void;
  addEventListener(
    type: "message",
    listener: (event: MessageEvent<WorkerRequest>) => void,
  ): void;
}

const scope = self as unknown as WorkerScope;
let model: ParsedModel | undefined;

const GENERIC_ERROR =
  "Algo deu errado ao preparar o modelo 3D. Tente de novo; se continuar, exporte o arquivo outra vez do fatiador.";

scope.addEventListener("message", async ({ data: request }) => {
  const { id } = request;
  const onProgress = (stage: ConvertStage, progress: number) =>
    scope.postMessage({ id, type: "progress", stage, progress });

  try {
    if (request.type === "open") {
      model = undefined; // release the previous file first
      model = await parseModel(request.buffer, request.fileName, onProgress);
      const info: ModelInfo = {
        format: model.format,
        unitScale: model.unitScale,
        objects: model.objects,
        plates: model.plates,
        defaultObjectIds: model.defaultObjectIds,
        warnings: model.warnings,
      };
      scope.postMessage({ id, type: "opened", info });
    } else {
      if (!model) throw new ConverterError("empty-model");
      const result = await convertModel(model, request.options, onProgress);
      scope.postMessage({ id, type: "converted", result }, [
        result.glb.buffer as ArrayBuffer,
      ]);
    }
  } catch (error) {
    console.error("[model-converter]", error);
    scope.postMessage({
      id,
      type: "error",
      ...(error instanceof ConverterError
        ? { message: error.message, code: error.code }
        : { message: GENERIC_ERROR }),
    });
  }
});
