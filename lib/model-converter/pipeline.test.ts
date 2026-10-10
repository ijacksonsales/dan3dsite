import { WebIO, type Document } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { getBounds } from "@gltf-transform/functions";
import { MeshoptDecoder } from "meshoptimizer";
import { describe, expect, it } from "vitest";

import { hexToLinearRgb } from "./colors";
import { convertModel, parseModel } from "./pipeline";
import {
  binaryStl,
  box,
  make3mf,
  meshXml,
  modelXml,
  sphere,
} from "./test-helpers";

async function readGlb(glb: Uint8Array): Promise<Document> {
  await MeshoptDecoder.ready;
  return new WebIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ "meshopt.decoder": MeshoptDecoder })
    .readBinary(glb);
}

function boundsOf(document: Document) {
  return getBounds(document.getRoot().listScenes()[0]);
}

// Reference piece: 40 × 20 mm footprint, 150 mm tall, off-center on the bed.
const referenceStl = () => binaryStl(box([100, 90, 0], [140, 110, 150]));

describe("convertModel", () => {
  it("STL 150 mm tall → GLB 0.150 m tall, standing on y = 0, centered", async () => {
    const model = await parseModel(referenceStl(), "referencia.stl");
    const { glb, meta } = await convertModel(model);

    expect(meta).toMatchObject({
      heightMm: 150,
      widthMm: 40,
      depthMm: 20,
      triangleCount: 12,
      fileSizeBytes: glb.byteLength,
      warnings: [],
    });

    const document = await readGlb(glb);
    const { min, max } = boundsOf(document);
    // Quantization (meshopt) keeps sub-millimeter precision.
    expect(max[1] - min[1]).toBeCloseTo(0.15, 4);
    expect(min[1]).toBeCloseTo(0, 4);
    expect(min[0] + max[0]).toBeCloseTo(0, 4);
    expect(min[2] + max[2]).toBeCloseTo(0, 4);
    const usedExtensions = document
      .getRoot()
      .listExtensionsUsed()
      .map((e) => e.extensionName);
    expect(usedExtensions).toContain("EXT_meshopt_compression");
  });

  it("can skip compression (plain GLB)", async () => {
    const model = await parseModel(referenceStl(), "referencia.stl");
    const { glb } = await convertModel(model, { compress: false });
    const document = await readGlb(glb);
    expect(document.getRoot().listExtensionsUsed()).toEqual([]);
    expect(boundsOf(document).max[1]).toBeCloseTo(0.15, 6);
  });

  it("rescales to the real height and does not change the parsed model", async () => {
    const model = await parseModel(referenceStl(), "referencia.stl");
    const { meta } = await convertModel(model, { targetHeightMm: 152 });
    expect(meta.heightMm).toBe(152);
    expect(meta.widthMm).toBeCloseTo(40.5, 1);
    // Second conversion starts from the original geometry.
    expect((await convertModel(model)).meta.heightMm).toBe(150);
  });

  it("wall placement: back at z = 0, plaque thickness becomes depth", async () => {
    const model = await parseModel(
      binaryStl(box([0, 0, 0], [100, 150, 5])),
      "placa.stl",
    );
    const { glb, meta } = await convertModel(model, { placement: "wall" });
    expect(meta).toMatchObject({ heightMm: 150, widthMm: 100, depthMm: 5 });
    const { min } = boundsOf(await readGlb(glb));
    expect(min[2]).toBeCloseTo(0, 4);
  });

  it("simplifies dense models to the triangle budget and warns", async () => {
    const dense = sphere(50, 200, 100); // ~39,800 triangles
    const model = await parseModel(binaryStl(dense), "bola.stl");
    const { meta } = await convertModel(model, { maxTriangles: 5_000 });
    expect(meta.triangleCount).toBeLessThanOrEqual(5_000);
    expect(meta.triangleCount).toBeGreaterThan(1_000);
    expect(meta.heightMm).toBeCloseTo(100, 0);
    expect(meta.warnings.map((w) => w.code)).toEqual(["simplified"]);
  });

  it("keeps one material per filament color, with smooth normals", async () => {
    const buffer = await make3mf({
      "3D/3dmodel.model": modelXml(`<resources>
  <object id="1" type="model">${meshXml(box([0, 0, 0], [10, 10, 10]))}</object>
  <object id="2" type="model">${meshXml(box([0, 0, 10], [10, 10, 20]))}</object>
  <object id="3" type="model"><components>
   <component objectid="1"/><component objectid="2"/>
  </components></object>
 </resources>
 <build><item objectid="3"/></build>`),
      "Metadata/model_settings.config": `<config><object id="3">
  <metadata key="extruder" value="1"/>
  <part id="2" subtype="normal_part"><metadata key="extruder" value="2"/></part>
</object></config>`,
      "Metadata/project_settings.config": JSON.stringify({
        filament_colour: ["#FFFFFF", "#1E90FF"],
      }),
    });
    const model = await parseModel(buffer, "duas-cores.3mf");
    const document = await readGlb((await convertModel(model)).glb);

    const materials = document.getRoot().listMaterials();
    expect(materials).toHaveLength(2);
    const blue = materials.find((m) => m.getName() === "#1e90ff")!;
    const [r, g, b] = blue.getBaseColorFactor();
    const expected = hexToLinearRgb("#1e90ff");
    expect(r).toBeCloseTo(expected[0], 3);
    expect(g).toBeCloseTo(expected[1], 3);
    expect(b).toBeCloseTo(expected[2], 3);
    expect(blue.getRoughnessFactor()).toBeCloseTo(0.6);
    expect(blue.getMetallicFactor()).toBe(0);

    for (const primitive of document.getRoot().listMeshes()[0].listPrimitives())
      expect(primitive.getAttribute("NORMAL")).not.toBeNull();
  });

  it("rejects unknown object ids", async () => {
    const model = await parseModel(referenceStl(), "referencia.stl");
    await expect(
      convertModel(model, { objectIds: ["nope"] }),
    ).rejects.toMatchObject({ code: "unknown-object" });
  });
});
