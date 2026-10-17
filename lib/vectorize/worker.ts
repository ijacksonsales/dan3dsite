import { vectorize, type TraceResult, type VectorizeOptions } from "./trace";

/** Web Worker entry: tracing runs here so the tablet UI never freezes. */

export interface VectorizeRequest {
  id: number;
  width: number;
  height: number;
  pixels: ArrayBuffer;
  options: VectorizeOptions;
}

export type VectorizeResponse =
  | { id: number; type: "done"; result: TraceResult }
  | { id: number; type: "error"; message: string };

interface WorkerScope {
  postMessage(message: VectorizeResponse): void;
  addEventListener(
    type: "message",
    listener: (event: MessageEvent<VectorizeRequest>) => void,
  ): void;
}

const scope = self as unknown as WorkerScope;

scope.addEventListener("message", ({ data: request }) => {
  try {
    const image = {
      width: request.width,
      height: request.height,
      data: new Uint8ClampedArray(request.pixels),
      colorSpace: "srgb",
    } as ImageData;
    scope.postMessage({
      id: request.id,
      type: "done",
      result: vectorize(image, request.options),
    });
  } catch (error) {
    console.error(error);
    scope.postMessage({
      id: request.id,
      type: "error",
      message:
        "Não foi possível converter esta imagem. Tente com menos cores ou outra imagem.",
    });
  }
});
