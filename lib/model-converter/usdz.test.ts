import JSZip from "jszip";
import { describe, expect, it } from "vitest";

import { convertModel, parseModel } from "./pipeline";
import { binaryStl, box } from "./test-helpers";
import { glbToUsdz } from "./usdz";

async function usda(usdz: Uint8Array) {
  const zip = await JSZip.loadAsync(usdz);
  return zip.file("model.usda")!.async("string");
}

/** Vertical extent in meters: geometry points × the node transform. */
async function heightRange(usdz: Uint8Array): Promise<[number, number]> {
  const zip = await JSZip.loadAsync(usdz);
  const [geometryFile] = zip.file(/^geometries\//);
  const geometry = await geometryFile.async("string");
  const points = geometry.match(/point3f\[\] points = \[(.*?)\]/)![1];
  const ys = [...points.matchAll(/\(([^,]+), ([^,]+), ([^)]+)\)/g)].map(
    (match) => Number(match[2]),
  );
  // Rows of the 4×4 matrix: uniform scale on the diagonal, translation last.
  const rows = [
    ...(await usda(usdz))
      .match(/matrix4d xformOp:transform = \((.*)\)/)![1]
      .matchAll(/\(([^)]*)\)/g),
  ].map((row) => row[1].split(",").map(Number));
  const [scaleY, offsetY] = [rows[1][1], rows[3][1]];
  return [
    Math.min(...ys) * scaleY + offsetY,
    Math.max(...ys) * scaleY + offsetY,
  ];
}

describe("glbToUsdz", () => {
  it("exports the compressed GLB with a floor anchor", async () => {
    const model = await parseModel(
      binaryStl(box([0, 0, 0], [40, 20, 150])),
      "peca.stl",
    );
    const { glb } = await convertModel(model, { placement: "floor" });
    const text = await usda(await glbToUsdz(glb, "floor"));

    expect(text).toContain(
      'preliminary:planeAnchoring:alignment = "horizontal"',
    );
    expect(text).toContain("metersPerUnit = 1");
    const [bottom, top] = await heightRange(await glbToUsdz(glb, "floor"));
    expect(bottom).toBeCloseTo(0, 4);
    expect(top).toBeCloseTo(0.15, 4);
  });

  it("leaves wall pieces without an anchor", async () => {
    const model = await parseModel(
      binaryStl(box([0, 0, 0], [200, 200, 25])),
      "placa.stl",
    );
    const { glb } = await convertModel(model, { placement: "wall" });
    const text = await usda(await glbToUsdz(glb, "wall"));

    expect(text).not.toContain("preliminary:anchoring");
  });
});
