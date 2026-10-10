import { computeBounds, isEmptyBounds } from "./measure";
import type { ArPlacement } from "./types";

/**
 * 3MF affine transform: "m00 m01 m02 m10 m11 m12 m20 m21 m22 m30 m31 m32".
 * Row-vector convention: [x y z 1] · M, so the last three are the translation.
 */
export type Affine = [
  number, number, number,
  number, number, number,
  number, number, number,
  number, number, number,
]; // prettier-ignore

export const IDENTITY: Affine = [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0];

export function parseAffine(value: string | undefined): Affine {
  if (!value) return IDENTITY;
  const numbers = value.trim().split(/\s+/).map(Number);
  if (numbers.length !== 12 || numbers.some((n) => !Number.isFinite(n)))
    return IDENTITY;
  return numbers as Affine;
}

/** Transform that applies `first`, then `second`. */
export function composeAffine(first: Affine, second: Affine): Affine {
  const out = new Array<number>(12);
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 3; col++) {
      let sum = row === 3 ? second[9 + col] : 0;
      for (let k = 0; k < 3; k++)
        sum += first[row * 3 + k] * second[k * 3 + col];
      out[row * 3 + col] = sum;
    }
  }
  return out as Affine;
}

/** Mirroring transforms flip the triangle winding. */
export function isMirroring(m: Affine): boolean {
  const det =
    m[0] * (m[4] * m[8] - m[5] * m[7]) -
    m[1] * (m[3] * m[8] - m[5] * m[6]) +
    m[2] * (m[3] * m[7] - m[4] * m[6]);
  return det < 0;
}

export function applyAffine(positions: Float32Array, m: Affine): void {
  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i];
    const y = positions[i + 1];
    const z = positions[i + 2];
    positions[i] = x * m[0] + y * m[3] + z * m[6] + m[9];
    positions[i + 1] = x * m[1] + y * m[4] + z * m[7] + m[10];
    positions[i + 2] = x * m[2] + y * m[5] + z * m[8] + m[11];
  }
}

/**
 * Source (slicer, Z-up, source units) → glTF (Y-up, meters).
 *
 * - `floor`: rotate −90° around X, so the slicer's up (+Z) becomes +Y and the
 *   piece stands the way it is printed.
 * - `wall`: no rotation. Wall pieces (plaques, reliefs) are printed lying on
 *   their back, so the slicer's +Z is the front (glTF +Z, facing the room) and
 *   the slicer's +Y is the top of the piece. See docs/decisions.md.
 */
export function toGltfSpace(
  positionArrays: Float32Array[],
  unitScale: number,
  placement: ArPlacement,
): void {
  for (const positions of positionArrays) {
    for (let i = 0; i < positions.length; i += 3) {
      const x = positions[i] * unitScale;
      const y = positions[i + 1] * unitScale;
      const z = positions[i + 2] * unitScale;
      positions[i] = x;
      if (placement === "floor") {
        positions[i + 1] = z;
        positions[i + 2] = -y;
      } else {
        positions[i + 1] = y;
        positions[i + 2] = z;
      }
    }
  }
}

/**
 * Moves the model so AR places it correctly (glTF space):
 * - `floor`: centered on X/Z, bottom at y = 0 (no sinking or floating).
 * - `wall`: centered on X/Y, back at z = 0 (flat against the wall).
 */
export function seat(
  positionArrays: Float32Array[],
  placement: ArPlacement,
): void {
  const bounds = computeBounds(positionArrays);
  if (isEmptyBounds(bounds)) return;
  const center = (axis: number) => (bounds.min[axis] + bounds.max[axis]) / 2;
  const offset =
    placement === "floor"
      ? [center(0), bounds.min[1], center(2)]
      : [center(0), center(1), bounds.min[2]];
  for (const positions of positionArrays) {
    for (let i = 0; i < positions.length; i += 3) {
      positions[i] -= offset[0];
      positions[i + 1] -= offset[1];
      positions[i + 2] -= offset[2];
    }
  }
}

/**
 * Uniform rescale so the model's height (Y) matches the real piece. Scales
 * around the origin, so a seated model stays seated.
 */
export function rescaleToHeight(
  positionArrays: Float32Array[],
  targetHeightMm: number,
): void {
  const bounds = computeBounds(positionArrays);
  const heightM = bounds.max[1] - bounds.min[1];
  if (!(heightM > 0) || !(targetHeightMm > 0)) return;
  const factor = targetHeightMm / 1000 / heightM;
  for (const positions of positionArrays) {
    for (let i = 0; i < positions.length; i++) positions[i] *= factor;
  }
}
