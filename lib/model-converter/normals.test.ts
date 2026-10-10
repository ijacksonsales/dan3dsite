import { describe, expect, it } from "vitest";

import { creasedNormals } from "./normals";
import { box, sphere } from "./test-helpers";

const mesh = (m: { positions: number[]; indices: number[] }) => ({
  positions: new Float32Array(m.positions),
  indices: new Uint32Array(m.indices),
});

describe("creasedNormals", () => {
  it("keeps the edges of a box sharp: each corner splits into 3 vertices", () => {
    const result = creasedNormals(mesh(box([0, 0, 0], [1, 1, 1])));
    expect(result.positions.length / 3).toBe(24);
    expect(result.indices.length).toBe(36);
    // Every normal is axis-aligned (a face normal), never a diagonal blend.
    for (let i = 0; i < result.normals.length; i += 3) {
      const n = Array.from(result.normals.slice(i, i + 3)).map(Math.abs);
      expect(n.sort()).toEqual([0, 0, 1]);
    }
  });

  it("smooths curved surfaces without splitting vertices", () => {
    const source = mesh(sphere(1, 48, 24));
    const result = creasedNormals(source);
    // Only the UV seam duplicates (already separate in the source) remain.
    expect(result.positions.length).toBeLessThanOrEqual(
      source.positions.length,
    );
    // On a sphere the normal points away from the center.
    for (let v = 0; v < result.positions.length; v += 3) {
      const p = result.positions.slice(v, v + 3);
      const n = result.normals.slice(v, v + 3);
      const dot = p[0] * n[0] + p[1] * n[1] + p[2] * n[2];
      expect(dot).toBeGreaterThan(0.95);
    }
  });
});
