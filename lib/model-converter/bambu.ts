import { XMLParser } from "fast-xml-parser";

/**
 * Bambu Studio project metadata inside a 3MF:
 * - `Metadata/project_settings.config` (JSON): `filament_colour`, one hex per filament.
 * - `Metadata/model_settings.config` (XML): object/part names, the filament
 *   (`extruder`, 1-based) of each object and part, part subtypes and plates.
 *
 * Part ids match the `objectid` of the components of the object in the 3MF
 * model, so a part's color is `filament_colour[extruder - 1]`. A part without
 * its own extruder inherits the object's.
 */

export interface BambuPart {
  name?: string;
  extruder?: number;
  /** `normal_part` is the visible print; modifiers and blockers are not. */
  subtype?: string;
}

export interface BambuObject {
  name?: string;
  extruder?: number;
  parts: Map<string, BambuPart>;
}

export interface BambuPlate {
  id: number;
  name?: string;
  /** (3MF object id, instance index) pairs placed on this plate. */
  instances: { objectId: string; instanceId: number }[];
}

export interface BambuSettings {
  objects: Map<string, BambuObject>;
  plates: BambuPlate[];
  filamentColors: string[];
}

export const MODEL_SETTINGS_PATH = "Metadata/model_settings.config";
export const PROJECT_SETTINGS_PATH = "Metadata/project_settings.config";

type XmlNode = Record<string, unknown>;

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  parseAttributeValue: false,
  isArray: (name) =>
    ["object", "part", "plate", "model_instance", "metadata"].includes(name),
});

const asArray = (value: unknown): XmlNode[] =>
  Array.isArray(value) ? (value as XmlNode[]) : [];

function metadataOf(node: XmlNode): Map<string, string> {
  const map = new Map<string, string>();
  for (const entry of asArray(node.metadata)) {
    if (typeof entry.key === "string" && entry.value != null)
      map.set(entry.key, String(entry.value));
  }
  return map;
}

function parseExtruder(value: string | undefined): number | undefined {
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 ? n : undefined;
}

export function parseModelSettings(
  xml: string,
): Omit<BambuSettings, "filamentColors"> {
  const root = xmlParser.parse(xml) as XmlNode;
  const config = (root.config ?? {}) as XmlNode;

  const objects = new Map<string, BambuObject>();
  for (const objectNode of asArray(config.object)) {
    const meta = metadataOf(objectNode);
    const parts = new Map<string, BambuPart>();
    for (const partNode of asArray(objectNode.part)) {
      const partMeta = metadataOf(partNode);
      parts.set(String(partNode.id), {
        name: partMeta.get("name"),
        extruder: parseExtruder(partMeta.get("extruder")),
        subtype:
          typeof partNode.subtype === "string" ? partNode.subtype : undefined,
      });
    }
    objects.set(String(objectNode.id), {
      name: meta.get("name"),
      extruder: parseExtruder(meta.get("extruder")),
      parts,
    });
  }

  const plates: BambuPlate[] = [];
  for (const plateNode of asArray(config.plate)) {
    const meta = metadataOf(plateNode);
    const id = Number(meta.get("plater_id"));
    if (!Number.isInteger(id)) continue;
    const instances = asArray(plateNode.model_instance).flatMap((instance) => {
      const instanceMeta = metadataOf(instance);
      const objectId = instanceMeta.get("object_id");
      if (!objectId) return [];
      return [
        { objectId, instanceId: Number(instanceMeta.get("instance_id") ?? 0) },
      ];
    });
    plates.push({ id, name: meta.get("plater_name") || undefined, instances });
  }
  plates.sort((a, b) => a.id - b.id);

  return { objects, plates };
}

/** `#RRGGBB` or `#RRGGBBAA` → lowercase `#rrggbb`; anything else → undefined. */
export function normalizeHexColor(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const match = /^#?([0-9a-f]{6})(?:[0-9a-f]{2})?$/i.exec(value.trim());
  return match ? `#${match[1].toLowerCase()}` : undefined;
}

export function parseFilamentColors(json: string): string[] {
  try {
    const settings = JSON.parse(json) as { filament_colour?: unknown };
    if (!Array.isArray(settings.filament_colour)) return [];
    return settings.filament_colour.map(
      (color) => normalizeHexColor(color) ?? "",
    );
  } catch {
    return [];
  }
}
