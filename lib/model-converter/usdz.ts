import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { USDZExporter } from "three/examples/jsm/exporters/USDZExporter.js";

import type { ArPlacement } from "./types";

/**
 * GLB → USDZ for iPhone Quick Look, served via `ios-src` so the customer's
 * phone does not convert on tap. Client-only (dynamic import it): pulls in
 * three's loader and exporter.
 *
 * Same export model-viewer does on the fly, which was measured within ±2% on
 * an iPhone (docs/decisions.md): floor pieces anchor to a horizontal plane;
 * wall pieces carry no anchoring, so Quick Look finds the wall itself.
 */
export async function glbToUsdz(
  glb: Uint8Array,
  placement: ArPlacement,
): Promise<Uint8Array> {
  await MeshoptDecoder.ready;
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const buffer = glb.buffer.slice(
    glb.byteOffset,
    glb.byteOffset + glb.byteLength,
  ) as ArrayBuffer;
  const gltf = await loader.parseAsync(buffer, "");
  gltf.scene.updateWorldMatrix(false, true);

  const usdz = await new USDZExporter().parseAsync(
    gltf.scene,
    placement === "wall" ? { includeAnchoringProperties: false } : {},
  );
  return new Uint8Array(usdz);
}
