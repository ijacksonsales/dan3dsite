import { fitSize, type TraceResult, type VectorizeOptions } from "./trace";
import type { VectorizeRequest, VectorizeResponse } from "./worker";

// The heavy part (tracing) runs in worker.ts. The page still loads
// imagetracerjs (~50 KB, only on this admin page) to rebuild the SVG
// instantly when a color is hidden, without tracing again.

export {
  buildSvg,
  toHex,
  usableColors,
  COLOR_RANGE,
  type Smoothing,
  type TraceResult,
  type VectorizeOptions,
} from "./trace";

export const ACCEPTED_IMAGE_TYPES = "image/png,image/jpeg,image/webp";

/** Decodes a photo and reduces it to at most MAX_SIDE pixels on the long side. */
export async function readImage(
  file: File,
): Promise<{ image: ImageData; original: { width: number; height: number } }> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error(
      "Não foi possível abrir esta imagem. Use um arquivo PNG ou JPG.",
    );
  }
  const original = { width: bitmap.width, height: bitmap.height };
  const { width, height } = fitSize(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Este navegador não consegue ler a imagem.");
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  return { image: context.getImageData(0, 0, width, height), original };
}

/**
 * Image → trace data, in a Web Worker. One instance per page; dispose() when
 * leaving.
 */
export class Vectorizer {
  private readonly worker: Worker;
  private nextId = 1;
  private readonly pending = new Map<
    number,
    { resolve: (result: TraceResult) => void; reject: (error: Error) => void }
  >();

  constructor() {
    this.worker = new Worker(new URL("./worker.ts", import.meta.url), {
      type: "module",
      name: "vectorize",
    });
    this.worker.addEventListener(
      "message",
      ({ data }: MessageEvent<VectorizeResponse>) => {
        const job = this.pending.get(data.id);
        if (!job) return;
        this.pending.delete(data.id);
        if (data.type === "done") job.resolve(data.result);
        else job.reject(new Error(data.message));
      },
    );
    this.worker.addEventListener("error", (event) => {
      event.preventDefault();
      for (const job of this.pending.values())
        job.reject(
          new Error(
            "Não foi possível iniciar o conversor neste navegador. Atualize a página e tente de novo.",
          ),
        );
      this.pending.clear();
    });
  }

  trace(image: ImageData, options: VectorizeOptions): Promise<TraceResult> {
    const id = this.nextId++;
    // Copy: the page keeps its ImageData to trace again with other options.
    const pixels = image.data.slice().buffer;
    const request: VectorizeRequest = {
      id,
      width: image.width,
      height: image.height,
      pixels,
      options,
    };
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.worker.postMessage(request, [pixels]);
    });
  }

  dispose() {
    this.worker.terminate();
    this.pending.clear();
  }
}
