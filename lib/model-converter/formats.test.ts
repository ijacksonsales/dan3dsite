import { describe, expect, it } from "vitest";

import { parseFilamentColors, parseModelSettings } from "./bambu";
import { DEFAULT_COLOR } from "./colors";
import { ConverterError } from "./errors";
import { computeBounds } from "./measure";
import { parseModel } from "./pipeline";
import {
  asciiStl,
  binaryStl,
  box,
  make3mf,
  meshXml,
  modelXml,
} from "./test-helpers";

const toBuffer = (text: string) =>
  new TextEncoder().encode(text).buffer as ArrayBuffer;

describe("STL", () => {
  it.each([
    ["binary", binaryStl],
    ["ascii", asciiStl],
  ])("reads %s STL in mm with the default color", async (_, write) => {
    const model = await parseModel(
      write(box([0, 0, 0], [10, 20, 150])),
      "anjo.STL",
    );
    expect(model.format).toBe("stl");
    expect(model.unitScale).toBe(0.001);
    expect(model.objects).toEqual([
      { id: "stl", name: "anjo", triangleCount: 12 },
    ]);
    const [part] = model.parts.get("stl")!;
    expect(part.color).toBe(DEFAULT_COLOR);
    expect(computeBounds([part.positions]).max).toEqual([10, 20, 150]);
  });

  it("rejects other formats with a friendly error", async () => {
    await expect(parseModel(toBuffer("x"), "peca.obj")).rejects.toMatchObject({
      code: "unsupported-format",
    });
  });
});

/** Bambu Studio layout: root object with components in 3D/Objects/object_1.model. */
async function bambu3mf(options: { painted?: boolean } = {}) {
  const objectFile = modelXml(`<resources>
  <object id="1" type="model">${meshXml(box([0, 0, 0], [10, 10, 10]), (t) =>
    options.painted && t === 0 ? ' paint_color="4"' : "",
  )}</object>
  <object id="2" type="model">${meshXml(box([0, 0, 10], [10, 10, 30]))}</object>
  <object id="3" type="model">${meshXml(box([0, 0, 0], [50, 50, 50]))}</object>
 </resources>`);
  const root = modelXml(`<resources>
  <object id="4" type="model">
   <components>
    <component p:path="/3D/Objects/object_1.model" objectid="1" transform="1 0 0 0 1 0 0 0 1 0 0 0"/>
    <component p:path="/3D/Objects/object_1.model" objectid="2" transform="1 0 0 0 1 0 0 0 1 0 0 0"/>
    <component p:path="/3D/Objects/object_1.model" objectid="3" transform="1 0 0 0 1 0 0 0 1 0 0 0"/>
   </components>
  </object>
 </resources>
 <build>
  <item objectid="4" transform="1 0 0 0 1 0 0 0 1 128 128 0" printable="1"/>
 </build>`);
  const modelSettings = `<?xml version="1.0" encoding="UTF-8"?>
<config>
  <object id="4">
    <metadata key="name" value="Anjo da guarda"/>
    <metadata key="extruder" value="1"/>
    <part id="1" subtype="normal_part"><metadata key="name" value="Base"/></part>
    <part id="2" subtype="normal_part">
      <metadata key="name" value="Asas"/>
      <metadata key="extruder" value="2"/>
    </part>
    <part id="3" subtype="modifier_part"><metadata key="name" value="Modificador"/></part>
  </object>
  <plate>
    <metadata key="plater_id" value="1"/>
    <metadata key="plater_name" value=""/>
    <model_instance>
      <metadata key="object_id" value="4"/>
      <metadata key="instance_id" value="0"/>
    </model_instance>
  </plate>
</config>`;
  return make3mf({
    "3D/3dmodel.model": root,
    "3D/Objects/object_1.model": objectFile,
    "Metadata/model_settings.config": modelSettings,
    "Metadata/project_settings.config": JSON.stringify({
      filament_colour: ["#FF0000", "#00FF00FF"],
    }),
  });
}

describe("3MF (Bambu Studio)", () => {
  it("follows p:path components and colors parts by filament", async () => {
    const model = await parseModel(await bambu3mf(), "anjo.3mf");
    expect(model.format).toBe("3mf");
    expect(model.unitScale).toBe(0.001);
    expect(model.objects).toEqual([
      { id: "0", name: "Anjo da guarda", triangleCount: 24, plate: 1 },
    ]);
    expect(model.plates).toEqual([
      { id: 1, name: "Placa 1", objectIds: ["0"] },
    ]);

    const parts = model.parts.get("0")!;
    // The modifier volume (part 3) is not part of the print.
    expect(parts.map((p) => [p.name, p.color])).toEqual([
      ["Base", "#ff0000"], // inherits the object's filament 1
      ["Asas", "#00ff00"], // own filament 2, alpha dropped
    ]);
    // Build item transform (bed position) is applied.
    const bounds = computeBounds(parts.map((p) => p.positions));
    expect(bounds.min).toEqual([128, 128, 0]);
    expect(bounds.max).toEqual([138, 138, 30]);
    expect(model.warnings).toEqual([]);
  });

  it("warns when the piece uses brush painting", async () => {
    const model = await parseModel(
      await bambu3mf({ painted: true }),
      "anjo.3mf",
    );
    expect(model.warnings.map((w) => w.code)).toEqual(["painted"]);
  });

  it("lists plates and converts the first one by default", async () => {
    const buffer = await make3mf({
      "3D/3dmodel.model": modelXml(`<resources>
  <object id="1" type="model">${meshXml(box([0, 0, 0], [1, 1, 1]))}</object>
  <object id="2" type="model">${meshXml(box([0, 0, 0], [2, 2, 2]))}</object>
 </resources>
 <build><item objectid="1"/><item objectid="2"/><item objectid="1"/></build>`),
      "Metadata/model_settings.config": `<config>
  <object id="1"><metadata key="name" value="Menino"/></object>
  <object id="2"><metadata key="name" value="Menina"/></object>
  <plate><metadata key="plater_id" value="1"/>
    <model_instance><metadata key="object_id" value="1"/><metadata key="instance_id" value="0"/></model_instance>
    <model_instance><metadata key="object_id" value="2"/><metadata key="instance_id" value="0"/></model_instance>
  </plate>
  <plate><metadata key="plater_id" value="2"/><metadata key="plater_name" value="Extra"/>
    <model_instance><metadata key="object_id" value="1"/><metadata key="instance_id" value="1"/></model_instance>
  </plate>
</config>`,
    });
    const model = await parseModel(buffer, "presepio.3mf");
    expect(model.plates).toEqual([
      { id: 1, name: "Placa 1", objectIds: ["0", "1"] },
      { id: 2, name: "Extra", objectIds: ["2"] },
    ]);
    expect(model.defaultObjectIds).toEqual(["0", "1"]);
    // No project_settings: default color.
    expect(model.parts.get("0")![0].color).toBe(DEFAULT_COLOR);
  });

  it("reads plain 3MF: inline mesh, unit and base material colors", async () => {
    const buffer = await make3mf({
      "3D/3dmodel.model": modelXml(
        `<resources>
  <basematerials id="5"><base name="Azul" displaycolor="#0000FFFF"/></basematerials>
  <object id="1" type="model" pid="5" pindex="0">${meshXml(box([0, 0, 0], [1, 1, 2]))}</object>
 </resources>
 <build><item objectid="1" transform="-1 0 0 0 1 0 0 0 1 0 0 0"/></build>`,
        "centimeter",
      ),
    });
    const model = await parseModel(buffer, "vaso.3mf");
    expect(model.unitScale).toBe(0.01);
    expect(model.objects[0].name).toBe("vaso");
    const [part] = model.parts.get("0")!;
    expect(part.color).toBe("#0000ff");
    // Mirrored item: winding flipped so faces still point outwards.
    expect(Array.from(part.indices.slice(0, 3))).toEqual([0, 1, 2]);
  });

  it("fails with a friendly error on a broken file", async () => {
    const error = await parseModel(toBuffer("not a zip"), "x.3mf").catch(
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(ConverterError);
    expect((error as ConverterError).message).toMatch(/Não consegui ler/);
  });
});

describe("Bambu settings", () => {
  it("parses filament colors defensively", () => {
    expect(
      parseFilamentColors('{"filament_colour":["#AbCdEf","bad"]}'),
    ).toEqual(["#abcdef", ""]);
    expect(parseFilamentColors("{")).toEqual([]);
  });

  it("skips plates without an id", () => {
    expect(
      parseModelSettings("<config><plate></plate></config>").plates,
    ).toEqual([]);
  });
});
