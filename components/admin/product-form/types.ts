import type { ArPlacement, ConvertMeta } from "@/lib/model-converter";
import type { ProductStatus } from "@/types/database";

/** What the server hands the form (an existing product, or blanks). */
export interface ProductFormInitial {
  name: string;
  slug: string;
  description: string | null;
  category_id: string | null;
  price_cents: number | null;
  height_mm: number | null;
  width_mm: number | null;
  depth_mm: number | null;
  made_to_order: boolean;
  ar_placement: ArPlacement;
  status: ProductStatus;
  model_path: string | null;
  model_source_path: string | null;
  model_usdz_path: string | null;
  poster_path: string | null;
  images: { id: string; path: string; alt: string | null }[];
}

export type PhotoItem =
  | { key: string; kind: "saved"; id: string; path: string }
  | { key: string; kind: "new"; file: File; previewUrl: string };

/** A freshly converted model, not uploaded yet. */
export interface ConvertedModel {
  glb: Uint8Array;
  /** blob: URL of `glb` for the preview. */
  url: string;
  meta: ConvertMeta;
  placement: ArPlacement;
  /** Original STL/3MF; null when it is the one already saved. */
  newSource: File | null;
}

export type ModelValue =
  | { kind: "none" }
  | {
      kind: "saved";
      path: string;
      sourcePath: string | null;
      usdzPath: string | null;
    }
  | { kind: "converted"; model: ConvertedModel };

export type PosterChoice = "model" | "cover";
