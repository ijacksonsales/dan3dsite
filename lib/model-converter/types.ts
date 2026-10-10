/**
 * Shared types for the browser-side STL/3MF → GLB converter.
 *
 * Units: input files are read in their own unit (STL is assumed to be mm,
 * 3MF declares it); everything after `parse` is in **meters**, glTF Y-up.
 */

export type ArPlacement = "floor" | "wall";

export type SourceFormat = "stl" | "3mf";

/** One mesh with a single color. Indexed triangles, positions in source units. */
export interface MeshPart {
  name: string;
  /** sRGB hex, `#rrggbb`. */
  color: string;
  positions: Float32Array<ArrayBuffer>;
  indices: Uint32Array<ArrayBuffer>;
}

/** A selectable thing inside the file (a 3MF build item; an STL is one object). */
export interface ModelObjectInfo {
  id: string;
  name: string;
  triangleCount: number;
  /** Bambu Studio plate number, when the file has plates. */
  plate?: number;
}

export interface ModelPlateInfo {
  id: number;
  name: string;
  objectIds: string[];
}

export interface ConverterWarning {
  code: "painted" | "simplified" | "large-file" | "unknown-unit";
  /** Shown to the admin as is (pt-BR, no jargon). */
  message: string;
}

/** Result of reading a file, before any conversion. */
export interface ParsedModel {
  format: SourceFormat;
  /** Meters per source unit (0.001 for millimeters). */
  unitScale: number;
  objects: ModelObjectInfo[];
  plates: ModelPlateInfo[];
  /** Object ids converted when the caller does not choose. */
  defaultObjectIds: string[];
  warnings: ConverterWarning[];
  /** Parts per object id (already in the object's build position). */
  parts: Map<string, MeshPart[]>;
}

export type ModelInfo = Omit<ParsedModel, "parts">;

export interface ConvertOptions {
  /** Which objects to convert; defaults to `ParsedModel.defaultObjectIds`. */
  objectIds?: string[];
  placement?: ArPlacement;
  /** Real height of the printed piece; rescales uniformly when set. */
  targetHeightMm?: number;
  /** Triangle budget for the whole model. */
  maxTriangles?: number;
  /** EXT_meshopt_compression + quantization. */
  compress?: boolean;
}

export interface ModelDimensions {
  heightMm: number;
  widthMm: number;
  depthMm: number;
}

export interface ConvertMeta extends ModelDimensions {
  triangleCount: number;
  fileSizeBytes: number;
  warnings: ConverterWarning[];
}

export interface ConvertResult {
  glb: Uint8Array;
  meta: ConvertMeta;
}

export type ConvertStage =
  "read" | "parse" | "transform" | "simplify" | "compress";

/** `progress` is 0–1 within the stage. */
export type ProgressCallback = (stage: ConvertStage, progress: number) => void;
