import type {
  WorkerRequest,
  WorkerRequestBody,
  WorkerResponse,
} from "./protocol";
import type {
  ConvertOptions,
  ConvertResult,
  ConvertStage,
  ModelInfo,
  ProgressCallback,
} from "./types";

export type * from "./types";
// Keep this file light: it is imported by pages, so it must not pull in
// the pipeline (three, gltf-transform, jszip), which only runs in worker.ts.
export { MAX_TRIANGLES } from "./constants";

/** For `<input type="file" accept>`. */
export const ACCEPTED_FILE_TYPES = ".stl,.3mf";

/** Stage names for progress messages (pt-BR, no jargon). */
export const STAGE_LABELS: Record<ConvertStage, string> = {
  read: "Abrindo o arquivo",
  parse: "Lendo a peça",
  transform: "Ajustando tamanho e posição",
  simplify: "Deixando leve para o celular",
  compress: "Finalizando o modelo 3D",
};

export class ModelConverterError extends Error {
  constructor(
    message: string,
    readonly code?: string,
  ) {
    super(message);
    this.name = "ModelConverterError";
  }
}

interface Pending {
  resolve: (response: WorkerResponse) => void;
  reject: (error: Error) => void;
  onProgress?: ProgressCallback;
}

/**
 * Browser-side STL/3MF → GLB converter, backed by a Web Worker.
 *
 * ```ts
 * const converter = new ModelConverter();
 * const info = await converter.open(file, onProgress);
 * const { glb, meta } = await converter.convert({ placement: "floor" }, onProgress);
 * converter.dispose();
 * ```
 */
export class ModelConverter {
  private readonly worker: Worker;
  private readonly pending = new Map<number, Pending>();
  private nextId = 1;

  constructor() {
    this.worker = new Worker(new URL("./worker.ts", import.meta.url), {
      type: "module",
      name: "model-converter",
    });
    this.worker.addEventListener(
      "message",
      ({ data }: MessageEvent<WorkerResponse>) => this.handle(data),
    );
    this.worker.addEventListener("error", (event) => {
      event.preventDefault();
      this.failAll(
        "Não foi possível iniciar o conversor neste navegador. Atualize a página e tente de novo.",
      );
    });
  }

  /** Reads the file and lists its pieces/plates. */
  async open(file: File, onProgress?: ProgressCallback): Promise<ModelInfo> {
    onProgress?.("read", 0);
    const buffer = await file.arrayBuffer();
    onProgress?.("read", 1);
    const response = await this.request(
      { type: "open", buffer, fileName: file.name },
      onProgress,
      [buffer],
    );
    if (response.type !== "opened") throw new ModelConverterError("unexpected");
    return response.info;
  }

  /** Converts the opened file. Can be called again with other options. */
  async convert(
    options: ConvertOptions = {},
    onProgress?: ProgressCallback,
  ): Promise<ConvertResult> {
    const response = await this.request(
      { type: "convert", options },
      onProgress,
    );
    if (response.type !== "converted")
      throw new ModelConverterError("unexpected");
    return response.result;
  }

  /** Frees the worker and the file in memory. */
  dispose(): void {
    this.worker.terminate();
    this.failAll("O conversor foi fechado.");
  }

  private request(
    message: WorkerRequestBody,
    onProgress?: ProgressCallback,
    transfer: Transferable[] = [],
  ): Promise<WorkerResponse> {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject, onProgress });
      const request: WorkerRequest = { ...message, id };
      this.worker.postMessage(request, transfer);
    });
  }

  private handle(response: WorkerResponse): void {
    const pending = this.pending.get(response.id);
    if (!pending) return;
    if (response.type === "progress") {
      pending.onProgress?.(response.stage, response.progress);
      return;
    }
    this.pending.delete(response.id);
    if (response.type === "error")
      pending.reject(new ModelConverterError(response.message, response.code));
    else pending.resolve(response);
  }

  private failAll(message: string): void {
    for (const pending of this.pending.values())
      pending.reject(new ModelConverterError(message));
    this.pending.clear();
  }
}
