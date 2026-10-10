import type {
  ConvertOptions,
  ConvertResult,
  ConvertStage,
  ModelInfo,
} from "./types";

/** Messages between the page and the converter Web Worker. */

export type WorkerRequestBody =
  | { type: "open"; buffer: ArrayBuffer; fileName: string }
  | { type: "convert"; options: ConvertOptions };

export type WorkerRequest = WorkerRequestBody & { id: number };

export type WorkerResponse =
  | { id: number; type: "progress"; stage: ConvertStage; progress: number }
  | { id: number; type: "opened"; info: ModelInfo }
  | { id: number; type: "converted"; result: ConvertResult }
  | { id: number; type: "error"; message: string; code?: string };
