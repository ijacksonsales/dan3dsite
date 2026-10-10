import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";

import { DEFAULT_COLOR } from "./colors";
import { ConverterError } from "./errors";
import type { ParsedModel } from "./types";

const STL_OBJECT_ID = "stl";

/** STL has no unit; it is assumed to be in millimeters (PLAN.md §5, phase 1). */
export function parseStl(buffer: ArrayBuffer, fileName: string): ParsedModel {
  let positions: Float32Array<ArrayBuffer>;
  try {
    const geometry = new STLLoader().parse(buffer);
    positions = geometry.getAttribute("position")
      .array as Float32Array<ArrayBuffer>;
  } catch (cause) {
    throw new ConverterError("invalid-file", { cause });
  }

  const triangleCount = positions.length / 9;
  if (!(triangleCount >= 1) || positions.some((v) => !Number.isFinite(v)))
    throw new ConverterError(
      triangleCount >= 1 ? "invalid-file" : "empty-model",
    );

  // Triangle soup: one index per vertex; `weld` merges duplicates later.
  const indices = new Uint32Array(positions.length / 3);
  for (let i = 0; i < indices.length; i++) indices[i] = i;

  const name = fileName.replace(/\.stl$/i, "");
  return {
    format: "stl",
    unitScale: 0.001,
    objects: [{ id: STL_OBJECT_ID, name, triangleCount }],
    plates: [],
    defaultObjectIds: [STL_OBJECT_ID],
    warnings: [],
    parts: new Map([
      [STL_OBJECT_ID, [{ name, color: DEFAULT_COLOR, positions, indices }]],
    ]),
  };
}
