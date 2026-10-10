import { LARGE_FILE_BYTES, MAX_TRIANGLES } from "./constants";
import { ConverterError } from "./errors";
import {
  buildDocument,
  computeNormals,
  countTriangles,
  measureDocument,
  weldAndSimplify,
  writeGlb,
} from "./optimize";
import { parseStl } from "./stl";
import { parse3mf } from "./threemf";
import { rescaleToHeight, seat, toGltfSpace } from "./transform";
import type {
  ConvertOptions,
  ConvertResult,
  ConverterWarning,
  ParsedModel,
  ProgressCallback,
} from "./types";

/** Reads an STL or 3MF file. Pure: runs in a Web Worker or in tests. */
export async function parseModel(
  buffer: ArrayBuffer,
  fileName: string,
  onProgress?: ProgressCallback,
): Promise<ParsedModel> {
  const extension = fileName.toLowerCase().split(".").pop();
  onProgress?.("parse", 0);
  let model: ParsedModel;
  if (extension === "stl") model = parseStl(buffer, fileName);
  else if (extension === "3mf")
    model = await parse3mf(buffer, fileName, (p) => onProgress?.("parse", p));
  else throw new ConverterError("unsupported-format");
  onProgress?.("parse", 1);
  return model;
}

/**
 * Converts the chosen objects to a GLB ready for AR: meters, Y-up, seated,
 * simplified to the triangle budget and compressed. `model` is not modified,
 * so it can be converted again with other options.
 */
export async function convertModel(
  model: ParsedModel,
  options: ConvertOptions = {},
  onProgress?: ProgressCallback,
): Promise<ConvertResult> {
  const {
    objectIds = model.defaultObjectIds,
    placement = "floor",
    targetHeightMm,
    maxTriangles = MAX_TRIANGLES,
    compress = true,
  } = options;

  onProgress?.("transform", 0);
  const parts = objectIds.flatMap((id) => {
    const objectParts = model.parts.get(id);
    if (!objectParts) throw new ConverterError("unknown-object");
    return objectParts.map((part) => ({
      ...part,
      positions: part.positions.slice(),
    }));
  });
  if (parts.length === 0) throw new ConverterError("empty-model");

  const positionArrays = parts.map((part) => part.positions);
  toGltfSpace(positionArrays, model.unitScale, placement);
  seat(positionArrays, placement);
  if (targetHeightMm) rescaleToHeight(positionArrays, targetHeightMm);
  onProgress?.("transform", 1);

  const name =
    model.objects.find((object) => object.id === objectIds[0])?.name ?? "";
  const document = buildDocument(parts, name);
  parts.length = 0; // the document owns the data now

  onProgress?.("simplify", 0);
  const simplified = await weldAndSimplify(document, maxTriangles, (p) =>
    onProgress?.("simplify", p),
  );
  computeNormals(document);
  const dimensions = measureDocument(document);
  const triangleCount = countTriangles(document);
  onProgress?.("simplify", 1);

  onProgress?.("compress", 0);
  const glb = await writeGlb(document, compress);
  onProgress?.("compress", 1);

  const warnings: ConverterWarning[] = [...model.warnings];
  if (simplified)
    warnings.push({
      code: "simplified",
      message:
        "O modelo tinha detalhes demais para abrir rápido no celular e foi simplificado. Confira se a aparência ficou boa.",
    });
  if (glb.byteLength > LARGE_FILE_BYTES)
    warnings.push({
      code: "large-file",
      message:
        "O modelo 3D ficou pesado e pode demorar para abrir no celular dos clientes.",
    });

  return {
    glb,
    meta: {
      ...dimensions,
      triangleCount,
      fileSizeBytes: glb.byteLength,
      warnings,
    },
  };
}
