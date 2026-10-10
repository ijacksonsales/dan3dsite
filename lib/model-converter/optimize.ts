import { Document, Logger, WebIO, type Primitive } from "@gltf-transform/core";
import {
  EXTMeshoptCompression,
  KHRMeshQuantization,
} from "@gltf-transform/extensions";
import { getBounds, meshopt, simplify, weld } from "@gltf-transform/functions";
import { MeshoptEncoder, MeshoptSimplifier } from "meshoptimizer";

import { hexToLinearRgb } from "./colors";
import { dimensionsFromBounds } from "./measure";
import { creasedNormals } from "./normals";
import type { MeshPart, ModelDimensions } from "./types";

/** Close to matte PLA. */
const ROUGHNESS = 0.6;
const METALNESS = 0;

/**
 * Simplification error limits tried in order (fraction of the mesh size).
 * The first is invisible on a printed piece; later ones are only reached by
 * very dense models that are still over budget.
 */
const SIMPLIFY_ERROR_STEPS = [0.001, 0.005, 0.02, 0.1];

/** Builds a glTF document: one primitive (and material) per color. */
export function buildDocument(parts: MeshPart[], name: string): Document {
  const document = new Document().setLogger(new Logger(Logger.Verbosity.WARN));
  const buffer = document.createBuffer();
  const mesh = document.createMesh(name);

  const byColor = new Map<string, MeshPart[]>();
  for (const part of parts) {
    const group = byColor.get(part.color) ?? [];
    group.push(part);
    byColor.set(part.color, group);
  }

  for (const [color, group] of byColor) {
    const { positions, indices } = mergeParts(group);
    const material = document
      .createMaterial(color)
      .setBaseColorFactor([...hexToLinearRgb(color), 1])
      .setRoughnessFactor(ROUGHNESS)
      .setMetallicFactor(METALNESS);
    const primitive = document
      .createPrimitive()
      .setMaterial(material)
      .setAttribute(
        "POSITION",
        document
          .createAccessor()
          .setType("VEC3")
          .setArray(positions)
          .setBuffer(buffer),
      )
      .setIndices(
        document
          .createAccessor()
          .setType("SCALAR")
          .setArray(indices)
          .setBuffer(buffer),
      );
    mesh.addPrimitive(primitive);
  }

  const node = document.createNode(name).setMesh(mesh);
  document.createScene(name).addChild(node);
  return document;
}

function mergeParts(parts: MeshPart[]): {
  positions: Float32Array<ArrayBuffer>;
  indices: Uint32Array<ArrayBuffer>;
} {
  if (parts.length === 1) return parts[0];
  let positionCount = 0;
  let indexCount = 0;
  for (const part of parts) {
    positionCount += part.positions.length;
    indexCount += part.indices.length;
  }
  const positions = new Float32Array(positionCount);
  const indices = new Uint32Array(indexCount);
  let positionOffset = 0;
  let indexOffset = 0;
  for (const part of parts) {
    positions.set(part.positions, positionOffset);
    const base = positionOffset / 3;
    for (let i = 0; i < part.indices.length; i++)
      indices[indexOffset + i] = part.indices[i] + base;
    positionOffset += part.positions.length;
    indexOffset += part.indices.length;
  }
  return { positions, indices };
}

export function countTriangles(document: Document): number {
  let count = 0;
  for (const mesh of document.getRoot().listMeshes())
    for (const primitive of mesh.listPrimitives())
      count += (primitive.getIndices()?.getCount() ?? 0) / 3;
  return count;
}

/**
 * Merges duplicate vertices, then simplifies until the model fits the
 * triangle budget. Returns whether any simplification happened.
 */
export async function weldAndSimplify(
  document: Document,
  maxTriangles: number,
  onProgress?: (progress: number) => void,
): Promise<boolean> {
  await document.transform(weld());
  onProgress?.(0.2);
  if (countTriangles(document) <= maxTriangles) return false;

  await MeshoptSimplifier.ready;
  for (const [step, error] of SIMPLIFY_ERROR_STEPS.entries()) {
    const current = countTriangles(document);
    if (current <= maxTriangles) break;
    await document.transform(
      simplify({
        simplifier: MeshoptSimplifier,
        ratio: maxTriangles / current,
        error,
      }),
    );
    onProgress?.(0.2 + (0.8 * (step + 1)) / SIMPLIFY_ERROR_STEPS.length);
  }
  return true;
}

/**
 * Vertex normals with crease angle (see normals.ts). glTF viewers fall back to
 * flat shading without normals, and the USDZ that model-viewer builds for iOS
 * needs them. Splitting crease vertices replaces positions and indices too.
 */
export function computeNormals(document: Document): void {
  for (const mesh of document.getRoot().listMeshes())
    for (const primitive of mesh.listPrimitives())
      setNormals(document, primitive);
}

function setNormals(document: Document, primitive: Primitive): void {
  const positionAccessor = primitive.getAttribute("POSITION");
  const indexAccessor = primitive.getIndices();
  if (!positionAccessor || !indexAccessor) return;
  const result = creasedNormals({
    positions: positionAccessor.getArray() as Float32Array<ArrayBuffer>,
    indices: Uint32Array.from(indexAccessor.getArray()!),
  });
  const buffer = positionAccessor.getBuffer();
  const accessor = (
    type: "VEC3" | "SCALAR",
    array: Float32Array<ArrayBuffer> | Uint32Array<ArrayBuffer>,
  ) =>
    document.createAccessor().setType(type).setArray(array).setBuffer(buffer);

  primitive.getAttribute("NORMAL")?.dispose();
  primitive.setAttribute("POSITION", accessor("VEC3", result.positions));
  primitive.setAttribute("NORMAL", accessor("VEC3", result.normals));
  primitive.setIndices(accessor("SCALAR", result.indices));
  positionAccessor.dispose();
  indexAccessor.dispose();
}

export function measureDocument(document: Document): ModelDimensions {
  const scene = document.getRoot().listScenes()[0];
  const { min, max } = getBounds(scene);
  return dimensionsFromBounds({
    min: [min[0], min[1], min[2]],
    max: [max[0], max[1], max[2]],
  });
}

/** Writes the GLB, with EXT_meshopt_compression + quantization when asked. */
export async function writeGlb(
  document: Document,
  compress: boolean,
): Promise<Uint8Array> {
  const io = new WebIO();
  if (compress) {
    await MeshoptEncoder.ready;
    await document.transform(
      meshopt({ encoder: MeshoptEncoder, level: "medium" }),
    );
    io.registerExtensions([
      EXTMeshoptCompression,
      KHRMeshQuantization,
    ]).registerDependencies({ "meshopt.encoder": MeshoptEncoder });
  }
  return io.writeBinary(document);
}
