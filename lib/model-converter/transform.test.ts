import { describe, expect, it } from "vitest";

import { computeBounds, dimensionsFromBounds } from "./measure";
import { box } from "./test-helpers";
import {
  applyAffine,
  composeAffine,
  isMirroring,
  parseAffine,
  rescaleToHeight,
  seat,
  toGltfSpace,
  type Affine,
} from "./transform";

const boxPositions = (
  min: [number, number, number],
  max: [number, number, number],
) => new Float32Array(box(min, max).positions);

function expectBounds(
  positions: Float32Array,
  min: [number, number, number],
  max: [number, number, number],
) {
  const bounds = computeBounds([positions]);
  for (let axis = 0; axis < 3; axis++) {
    expect(bounds.min[axis]).toBeCloseTo(min[axis], 6);
    expect(bounds.max[axis]).toBeCloseTo(max[axis], 6);
  }
}

describe("toGltfSpace (scale + axis)", () => {
  it("floor: mm → m and Z-up → Y-up, so the printed height becomes Y", () => {
    // 40 mm wide (X), 20 mm deep (Y), 150 mm tall (Z), as in the slicer.
    const positions = boxPositions([10, 30, 0], [50, 50, 150]);
    toGltfSpace([positions], 0.001, "floor");
    // Y = slicer Z; Z = −slicer Y.
    expectBounds(positions, [0.01, 0, -0.05], [0.05, 0.15, -0.03]);
  });

  it("wall: no rotation, slicer +Z (top of a plaque printed flat) faces the room", () => {
    // Plaque 100 × 150 mm, 5 mm thick, lying on the bed.
    const positions = boxPositions([0, 0, 0], [100, 150, 5]);
    toGltfSpace([positions], 0.001, "wall");
    expectBounds(positions, [0, 0, 0], [0.1, 0.15, 0.005]);
  });

  it("respects other units (3MF in inches)", () => {
    const positions = boxPositions([0, 0, 0], [1, 1, 2]);
    toGltfSpace([positions], 0.0254, "floor");
    expect(dimensionsFromBounds(computeBounds([positions])).heightMm).toBe(
      50.8,
    );
  });
});

describe("seat", () => {
  it("floor: centers X/Z and puts the bottom at y = 0, across all parts", () => {
    const a = boxPositions([1, -2, 3], [2, 5, 4]);
    const b = boxPositions([4, 0, -1], [6, 1, 0]);
    const before = dimensionsFromBounds(computeBounds([a, b]));
    seat([a, b], "floor");
    const bounds = computeBounds([a, b]);
    expect(bounds.min[1]).toBeCloseTo(0, 6);
    expect(bounds.min[0] + bounds.max[0]).toBeCloseTo(0, 6);
    expect(bounds.min[2] + bounds.max[2]).toBeCloseTo(0, 6);
    expect(dimensionsFromBounds(bounds)).toEqual(before);
  });

  it("wall: centers X/Y and puts the back at z = 0", () => {
    const positions = boxPositions([10, 20, 30], [20, 60, 35]);
    seat([positions], "wall");
    expectBounds(positions, [-5, -20, 0], [5, 20, 5]);
  });
});

describe("rescaleToHeight", () => {
  it("scales uniformly to the real height and keeps the model seated", () => {
    const positions = boxPositions([-0.01, 0, -0.02], [0.01, 0.1, 0.02]);
    rescaleToHeight([positions], 152);
    const dims = dimensionsFromBounds(computeBounds([positions]));
    expect(dims).toEqual({ heightMm: 152, widthMm: 30.4, depthMm: 60.8 });
    expect(computeBounds([positions]).min[1]).toBeCloseTo(0, 6);
  });
});

describe("3MF affine transforms", () => {
  const translate = (x: number, y: number, z: number): Affine => [
    1,
    0,
    0,
    0,
    1,
    0,
    0,
    0,
    1,
    x,
    y,
    z,
  ];
  const rotateZ90: Affine = [0, 1, 0, -1, 0, 0, 0, 0, 1, 0, 0, 0];

  it("parses the 12-number form and falls back to identity", () => {
    expect(parseAffine("1 0 0 0 1 0 0 0 1 5 6 7")[9]).toBe(5);
    expect(parseAffine("garbage")).toEqual(parseAffine(undefined));
  });

  it("composeAffine(a, b) equals applying a, then b", () => {
    const point = new Float32Array([1, 0, 0]);
    applyAffine(point, composeAffine(rotateZ90, translate(10, 0, 0)));
    expect(Array.from(point)).toEqual([10, 1, 0]);
  });

  it("detects mirroring", () => {
    expect(isMirroring([-1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0])).toBe(true);
    expect(isMirroring(rotateZ90)).toBe(false);
  });
});
