import type { ModelDimensions } from "./types";

export interface Bounds {
  min: [number, number, number];
  max: [number, number, number];
}

/** Axis-aligned bounding box over several position arrays (xyz triplets). */
export function computeBounds(positionArrays: Iterable<Float32Array>): Bounds {
  const min: [number, number, number] = [Infinity, Infinity, Infinity];
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  for (const positions of positionArrays) {
    for (let i = 0; i < positions.length; i += 3) {
      for (let axis = 0; axis < 3; axis++) {
        const value = positions[i + axis];
        if (value < min[axis]) min[axis] = value;
        if (value > max[axis]) max[axis] = value;
      }
    }
  }
  return { min, max };
}

export function isEmptyBounds(bounds: Bounds): boolean {
  return !Number.isFinite(bounds.min[0]);
}

/**
 * Real-world size of a glTF model (meters, Y-up) in millimeters, rounded to
 * 0.1 mm. Height is Y, width is X, depth is Z.
 */
export function dimensionsFromBounds(bounds: Bounds): ModelDimensions {
  const mm = (axis: number) =>
    Math.round((bounds.max[axis] - bounds.min[axis]) * 10_000) / 10;
  return { widthMm: mm(0), heightMm: mm(1), depthMm: mm(2) };
}
