import JSZip from "jszip";

import {
  MODEL_SETTINGS_PATH,
  normalizeHexColor,
  parseFilamentColors,
  parseModelSettings,
  PROJECT_SETTINGS_PATH,
  type BambuSettings,
} from "./bambu";
import { ConverterError } from "./errors";
import { DEFAULT_COLOR } from "./colors";
import {
  applyAffine,
  composeAffine,
  IDENTITY,
  isMirroring,
  parseAffine,
  type Affine,
} from "./transform";
import type {
  ConverterWarning,
  MeshPart,
  ModelObjectInfo,
  ModelPlateInfo,
  ParsedModel,
} from "./types";

/**
 * 3MF reader. The three.js ThreeMFLoader does not follow the production
 * extension (`p:path` components in `3D/Objects/*.model`) that Bambu Studio
 * uses, so this is a small dedicated parser (PLAN.md §5, phase 1).
 *
 * Mesh data is read with a regex tokenizer instead of a DOM/XML tree: model
 * files can be hundreds of MB of XML, and a tree would need several times that
 * in memory on the tablet.
 */

const ROOT_MODEL_FALLBACK = "3D/3dmodel.model";

const UNIT_TO_METERS: Record<string, number> = {
  micron: 0.000001,
  millimeter: 0.001,
  centimeter: 0.01,
  inch: 0.0254,
  foot: 0.3048,
  meter: 1,
};

const PAINTED_WARNING: ConverterWarning = {
  code: "painted",
  message:
    "Esta peça usa pintura com pincel. No 3D ela aparece com as cores dos filamentos, sem os detalhes pintados.",
};

interface MeshData {
  positions: Float32Array<ArrayBuffer>;
  indices: Uint32Array<ArrayBuffer>;
}

interface ComponentRef {
  objectId: string;
  path?: string;
  transform: Affine;
}

interface ObjectDef {
  id: string;
  name?: string;
  type?: string;
  pid?: string;
  pindex?: number;
  mesh?: MeshData;
  components: ComponentRef[];
}

interface BuildItem {
  objectId: string;
  transform: Affine;
  printable: boolean;
}

interface ModelFile {
  unit?: string;
  objects: Map<string, ObjectDef>;
  build: BuildItem[];
  /** Material/color group id → colors by index. */
  colorGroups: Map<string, string[]>;
  painted: boolean;
}

export async function parse3mf(
  buffer: ArrayBuffer,
  fileName: string,
  onProgress?: (progress: number) => void,
): Promise<ParsedModel> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(buffer);
  } catch (cause) {
    throw new ConverterError("invalid-file", { cause });
  }

  const rootPath = await findRootModelPath(zip);
  const rootText = await readText(zip, rootPath);
  if (rootText == null) throw new ConverterError("invalid-file");

  const files = new Map<string, ModelFile>();
  const root = parseModelXml(rootText);
  files.set(rootPath, root);
  onProgress?.(0.3);

  // Load every model file referenced through the production extension.
  const pending = new Set<string>();
  for (const object of root.objects.values())
    for (const component of object.components)
      if (component.path) pending.add(normalizePath(component.path));
  let loaded = 0;
  for (const path of pending) {
    if (files.has(path)) continue;
    const text = await readText(zip, path);
    if (text == null) throw new ConverterError("invalid-file");
    files.set(path, parseModelXml(text));
    loaded++;
    onProgress?.(0.3 + (0.6 * loaded) / pending.size);
  }

  const bambu = await readBambuSettings(zip);
  const warnings: ConverterWarning[] = [];

  const unit = root.unit ?? "millimeter";
  let unitScale = UNIT_TO_METERS[unit];
  if (unitScale == null) {
    unitScale = 0.001;
    warnings.push({
      code: "unknown-unit",
      message:
        "O arquivo usa uma unidade de medida desconhecida. Considerei milímetros: confira as medidas.",
    });
  }

  if ([...files.values()].some((file) => file.painted))
    warnings.push(PAINTED_WARNING);

  const result = resolveBuild(root, rootPath, files, bambu, fileName);
  onProgress?.(1);
  if (result.objects.length === 0) throw new ConverterError("empty-model");

  return { format: "3mf", unitScale, warnings, ...result };
}

async function findRootModelPath(zip: JSZip): Promise<string> {
  const rels = await readText(zip, "_rels/.rels");
  if (rels) {
    for (const tag of rels.match(/<Relationship\b[^>]*>/g) ?? []) {
      const attrs = parseAttributes(tag);
      if (attrs.Type?.endsWith("/3dmodel") && attrs.Target)
        return normalizePath(attrs.Target);
    }
  }
  return ROOT_MODEL_FALLBACK;
}

async function readText(zip: JSZip, path: string): Promise<string | null> {
  const entry =
    zip.file(path) ??
    // Some exporters differ in case; zip paths are case-sensitive.
    zip.file(new RegExp(`^${escapeRegExp(path)}$`, "i"))[0];
  if (!entry) return null;
  // JSZip's own UTF-8 decoding is pure JS and very slow on big model files in
  // the browser; the native TextDecoder is many times faster.
  return utf8.decode(await entry.async("uint8array"));
}

async function readBambuSettings(
  zip: JSZip,
): Promise<BambuSettings | undefined> {
  const modelSettings = await readText(zip, MODEL_SETTINGS_PATH);
  if (!modelSettings) return undefined;
  const projectSettings = await readText(zip, PROJECT_SETTINGS_PATH);
  return {
    ...parseModelSettings(modelSettings),
    filamentColors: projectSettings ? parseFilamentColors(projectSettings) : [],
  };
}

const utf8 = new TextDecoder();

const normalizePath = (path: string) => path.replace(/^\/+/, "");

const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// --- XML tokenizer -----------------------------------------------------------

const TAG_PATTERN = /<(\/?)([A-Za-z_][\w:.-]*)([^>]*)>/g;
const ATTRIBUTE_PATTERN = /([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;

/** Attributes by local name (namespace prefixes such as `p:` are dropped). */
function parseAttributes(tag: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  ATTRIBUTE_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = ATTRIBUTE_PATTERN.exec(tag))) {
    const name = match[1].slice(match[1].indexOf(":") + 1);
    attrs[name] = match[2] ?? match[3];
  }
  return attrs;
}

const localName = (name: string) => name.slice(name.indexOf(":") + 1);

class GrowableFloat32 {
  array = new Float32Array(3 * 1024);
  length = 0;
  push3(a: number, b: number, c: number) {
    if (this.length + 3 > this.array.length) this.grow();
    this.array[this.length++] = a;
    this.array[this.length++] = b;
    this.array[this.length++] = c;
  }
  private grow() {
    const next = new Float32Array(this.array.length * 2);
    next.set(this.array);
    this.array = next;
  }
  toArray() {
    return this.array.slice(0, this.length);
  }
}

class GrowableUint32 {
  array = new Uint32Array(3 * 1024);
  length = 0;
  push3(a: number, b: number, c: number) {
    if (this.length + 3 > this.array.length) this.grow();
    this.array[this.length++] = a;
    this.array[this.length++] = b;
    this.array[this.length++] = c;
  }
  private grow() {
    const next = new Uint32Array(this.array.length * 2);
    next.set(this.array);
    this.array = next;
  }
  toArray() {
    return this.array.slice(0, this.length);
  }
}

export function parseModelXml(xml: string): ModelFile {
  const file: ModelFile = {
    objects: new Map(),
    build: [],
    colorGroups: new Map(),
    painted: false,
  };

  let object: ObjectDef | undefined;
  let vertices: GrowableFloat32 | undefined;
  let triangles: GrowableUint32 | undefined;
  let vertexCount = 0;
  let colorGroup: string[] | undefined;

  TAG_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = TAG_PATTERN.exec(xml))) {
    const closing = match[1] === "/";
    const name = localName(match[2]);
    const rawAttrs = match[3];

    if (closing) {
      if (name === "mesh" && object && vertices && triangles) {
        object.mesh = {
          positions: vertices.toArray(),
          indices: triangles.toArray(),
        };
        vertices = triangles = undefined;
      } else if (name === "object") {
        object = undefined;
      } else if (name === "basematerials" || name === "colorgroup") {
        colorGroup = undefined;
      }
      continue;
    }

    switch (name) {
      case "vertex": {
        if (!vertices) break;
        const attrs = parseAttributes(rawAttrs);
        vertices.push3(Number(attrs.x), Number(attrs.y), Number(attrs.z));
        vertexCount++;
        break;
      }
      case "triangle": {
        if (!triangles) break;
        if (!file.painted && /\b(paint_color|mmu_segmentation)=/.test(rawAttrs))
          file.painted = true;
        const attrs = parseAttributes(rawAttrs);
        const a = Number(attrs.v1);
        const b = Number(attrs.v2);
        const c = Number(attrs.v3);
        if (a < vertexCount && b < vertexCount && c < vertexCount)
          triangles.push3(a, b, c);
        break;
      }
      case "model": {
        const attrs = parseAttributes(rawAttrs);
        if (attrs.unit) file.unit = attrs.unit.toLowerCase();
        break;
      }
      case "object": {
        const attrs = parseAttributes(rawAttrs);
        object = {
          id: attrs.id,
          name: attrs.name,
          type: attrs.type,
          pid: attrs.pid,
          pindex: attrs.pindex != null ? Number(attrs.pindex) : undefined,
          components: [],
        };
        file.objects.set(object.id, object);
        break;
      }
      case "mesh":
        if (object) {
          vertices = new GrowableFloat32();
          triangles = new GrowableUint32();
          vertexCount = 0;
        }
        break;
      case "component": {
        if (!object) break;
        const attrs = parseAttributes(rawAttrs);
        object.components.push({
          objectId: attrs.objectid,
          path: attrs.path,
          transform: parseAffine(attrs.transform),
        });
        break;
      }
      case "item": {
        const attrs = parseAttributes(rawAttrs);
        file.build.push({
          objectId: attrs.objectid,
          transform: parseAffine(attrs.transform),
          printable: attrs.printable !== "0",
        });
        break;
      }
      case "basematerials":
      case "colorgroup": {
        const attrs = parseAttributes(rawAttrs);
        colorGroup = [];
        file.colorGroups.set(attrs.id, colorGroup);
        break;
      }
      case "base":
      case "color": {
        if (!colorGroup) break;
        const attrs = parseAttributes(rawAttrs);
        colorGroup.push(
          normalizeHexColor(attrs.displaycolor ?? attrs.color) ?? DEFAULT_COLOR,
        );
        break;
      }
    }
  }
  return file;
}

// --- Build resolution ----------------------------------------------------------

interface Leaf {
  mesh: MeshData;
  transform: Affine;
  /** Component object id, for the Bambu part lookup. */
  partId?: string;
  /** Color from 3MF materials, used when there is no Bambu filament. */
  materialColor?: string;
}

function resolveBuild(
  root: ModelFile,
  rootPath: string,
  files: Map<string, ModelFile>,
  bambu: BambuSettings | undefined,
  fileName: string,
): Omit<ParsedModel, "format" | "unitScale" | "warnings"> {
  const objects: ModelObjectInfo[] = [];
  const parts = new Map<string, MeshPart[]>();
  const plateByInstance = new Map<string, number>();
  for (const plate of bambu?.plates ?? [])
    for (const { objectId, instanceId } of plate.instances)
      plateByInstance.set(`${objectId}:${instanceId}`, plate.id);
  const instanceCounter = new Map<string, number>();

  root.build.forEach((item, index) => {
    const object = root.objects.get(item.objectId);
    const instanceId = instanceCounter.get(item.objectId) ?? 0;
    instanceCounter.set(item.objectId, instanceId + 1);
    if (!object || !item.printable || !isModelObject(object)) return;

    const leaves: Leaf[] = [];
    collectLeaves(
      object,
      rootPath,
      item.transform,
      files,
      leaves,
      undefined,
      0,
    );
    const bambuObject = bambu?.objects.get(item.objectId);

    const objectParts: MeshPart[] = [];
    for (const leaf of leaves) {
      const bambuPart = leaf.partId
        ? bambuObject?.parts.get(leaf.partId)
        : undefined;
      if (bambuPart?.subtype && bambuPart.subtype !== "normal_part") continue;
      const extruder = bambuPart?.extruder ?? bambuObject?.extruder;
      const filamentColor = bambu?.filamentColors[(extruder ?? 1) - 1];
      objectParts.push(
        bakeLeaf(leaf, {
          name: bambuPart?.name ?? bambuObject?.name ?? object.name ?? "",
          color: filamentColor || leaf.materialColor || DEFAULT_COLOR,
        }),
      );
    }
    if (objectParts.length === 0) return;

    const id = String(index);
    parts.set(id, objectParts);
    objects.push({
      id,
      name:
        bambuObject?.name ??
        object.name ??
        (root.build.length > 1
          ? `Peça ${objects.length + 1}`
          : fileName.replace(/\.3mf$/i, "")),
      triangleCount: objectParts.reduce((n, p) => n + p.indices.length / 3, 0),
      plate: plateByInstance.get(`${item.objectId}:${instanceId}`),
    });
  });

  const plates: ModelPlateInfo[] = (bambu?.plates ?? [])
    .map((plate) => ({
      id: plate.id,
      name: plate.name ?? `Placa ${plate.id}`,
      objectIds: objects.filter((o) => o.plate === plate.id).map((o) => o.id),
    }))
    .filter((plate) => plate.objectIds.length > 0);

  const defaultObjectIds =
    plates.length > 1 ? plates[0].objectIds : objects.map((o) => o.id);

  return { objects, plates, defaultObjectIds, parts };
}

function isModelObject(object: ObjectDef): boolean {
  return object.type == null || object.type === "model";
}

function collectLeaves(
  object: ObjectDef,
  path: string,
  transform: Affine,
  files: Map<string, ModelFile>,
  out: Leaf[],
  partId: string | undefined,
  depth: number,
): void {
  if (depth > 16) return; // cyclic references in a broken file
  const file = files.get(path);
  if (object.mesh && object.mesh.indices.length > 0) {
    const group = object.pid ? file?.colorGroups.get(object.pid) : undefined;
    out.push({
      mesh: object.mesh,
      transform,
      partId,
      materialColor: group?.[object.pindex ?? 0],
    });
  }
  for (const component of object.components) {
    const componentPath = component.path ? normalizePath(component.path) : path;
    const target = files.get(componentPath)?.objects.get(component.objectId);
    if (!target || !isModelObject(target)) continue;
    collectLeaves(
      target,
      componentPath,
      composeAffine(component.transform, transform),
      files,
      out,
      // Bambu part ids are the first-level component object ids.
      partId ?? component.objectId,
      depth + 1,
    );
  }
}

function bakeLeaf(
  leaf: Leaf,
  info: Pick<MeshPart, "name" | "color">,
): MeshPart {
  const positions = leaf.mesh.positions.slice();
  if (leaf.transform !== IDENTITY) applyAffine(positions, leaf.transform);
  const indices = leaf.mesh.indices.slice();
  if (isMirroring(leaf.transform)) {
    for (let i = 0; i < indices.length; i += 3) {
      const b = indices[i + 1];
      indices[i + 1] = indices[i + 2];
      indices[i + 2] = b;
    }
  }
  return { ...info, positions, indices };
}
