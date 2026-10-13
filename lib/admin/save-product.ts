import type {
  ModelValue,
  PhotoItem,
  PosterChoice,
  ProductFormInitial,
} from "@/components/admin/product-form/types";
import type { ArPlacement } from "@/lib/model-converter";
import { createClient } from "@/lib/supabase/client";
import type { ProductStatus } from "@/types/database";

export interface ProductValues {
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
}

export interface SaveProductInput {
  productId: string;
  isNew: boolean;
  initial: ProductFormInitial;
  values: ProductValues;
  photos: PhotoItem[];
  model: ModelValue;
  posterChoice: PosterChoice;
  /** Snapshot of the 3D preview for the poster; null if it is not ready. */
  capturePoster: () => Promise<Blob | null>;
  onStep: (message: string) => void;
}

export type SaveProductResult =
  { ok: true; warnings: string[] } | { ok: false; message: string };

class SaveError extends Error {}

const NETWORK_HINT = "Confira a internet e toque em salvar de novo.";
const YEAR = "31536000";

/**
 * Saves a product the way PLAN.md §4 asks: files go straight from the browser
 * to Storage under new timestamped names, then the row is written, and only
 * then the files it no longer uses are deleted (never overwrite a path).
 */
export async function saveProduct(
  input: SaveProductInput,
): Promise<SaveProductResult> {
  try {
    return await save(input);
  } catch (error) {
    if (error instanceof SaveError)
      return { ok: false, message: error.message };
    console.error(error);
    return { ok: false, message: `Algo deu errado ao salvar. ${NETWORK_HINT}` };
  }
}

async function save({
  productId: id,
  isNew,
  initial,
  values,
  photos,
  model,
  posterChoice,
  capturePoster,
  onStep,
}: SaveProductInput): Promise<SaveProductResult> {
  const supabase = createClient();
  const warnings: string[] = [];
  const timestamp = Date.now();

  async function upload(
    bucket: "images" | "models",
    path: string,
    body: Blob | Uint8Array,
    contentType: string,
    what: string,
  ) {
    const { error } = await supabase.storage
      .from(bucket)
      .upload(path, body, { contentType, cacheControl: YEAR, upsert: false });
    if (error)
      throw new SaveError(`Não foi possível enviar ${what}. ${NETWORK_HINT}`);
  }

  onStep("Conferindo o endereço…");
  const { data: sameSlug, error: slugError } = await supabase
    .from("products")
    .select("id")
    .eq("slug", values.slug)
    .neq("id", id)
    .limit(1);
  if (slugError)
    throw new SaveError(`Não foi possível salvar. ${NETWORK_HINT}`);
  if (sameSlug.length)
    throw new SaveError(
      "Já existe outro produto com esse endereço. Mude o endereço em “Informações”.",
    );

  // 1. Photos, in their final order.
  const images: { id?: string; path: string }[] = [];
  const newPhotos = photos.filter((photo) => photo.kind === "new").length;
  let sent = 0;
  for (const [index, photo] of photos.entries()) {
    if (photo.kind === "saved") {
      images.push({ id: photo.id, path: photo.path });
      continue;
    }
    sent++;
    onStep(`Enviando foto ${sent} de ${newPhotos}…`);
    const path = `${id}/${timestamp}-${index + 1}.webp`;
    await upload("images", path, photo.file, "image/webp", "a foto");
    images.push({ path });
  }

  // 2. 3D model (GLB), the original file and the iPhone file (USDZ).
  let modelPath: string | null = null;
  let sourcePath: string | null = null;
  let usdzPath: string | null = null;
  if (model.kind === "saved") {
    modelPath = model.path;
    sourcePath = model.sourcePath;
    usdzPath = model.usdzPath;
  } else if (model.kind === "converted") {
    const converted = model.model;
    onStep("Enviando o modelo 3D…");
    modelPath = `${id}/${timestamp}.glb`;
    await upload(
      "models",
      modelPath,
      converted.glb,
      "model/gltf-binary",
      "o modelo 3D",
    );

    if (converted.newSource) {
      onStep("Guardando o arquivo original…");
      const extension = converted.newSource.name
        .split(".")
        .pop()
        ?.toLowerCase();
      sourcePath = `${id}/source/${timestamp}.${extension}`;
      await upload(
        "models",
        sourcePath,
        converted.newSource,
        "application/octet-stream",
        "o arquivo original",
      );
    } else {
      sourcePath = initial.model_source_path;
    }

    onStep("Preparando o 3D para iPhone…");
    try {
      const { glbToUsdz } = await import("@/lib/model-converter/usdz");
      const usdz = await glbToUsdz(converted.glb, converted.placement);
      usdzPath = `${id}/${timestamp}.usdz`;
      await upload(
        "models",
        usdzPath,
        usdz,
        "model/vnd.usdz+zip",
        "o 3D para iPhone",
      );
    } catch (error) {
      if (error instanceof SaveError) throw error;
      console.error(error);
      usdzPath = null;
      warnings.push(
        "Não deu para preparar o arquivo do iPhone; ele será gerado na hora, no celular do cliente.",
      );
    }
  }

  // 3. Poster: still image shown while the 3D loads.
  const coverPath = images[0]?.path ?? null;
  const initialPosterIsPhoto = initial.images.some(
    (image) => image.path === initial.poster_path,
  );
  let posterPath: string | null = null;
  if (modelPath) {
    const keepPoster =
      posterChoice === "model" &&
      model.kind === "saved" &&
      initial.poster_path != null &&
      !initialPosterIsPhoto;
    if (keepPoster) posterPath = initial.poster_path;
    else if (posterChoice === "model") {
      onStep("Criando a imagem de espera…");
      const blob = await capturePoster();
      if (blob) {
        posterPath = `${id}/${timestamp}-poster.webp`;
        await upload(
          "images",
          posterPath,
          blob,
          "image/webp",
          "a imagem de espera",
        );
      } else {
        posterPath = coverPath;
      }
    } else {
      posterPath = coverPath;
    }
  }

  // 4. The product row.
  onStep("Salvando as informações…");
  const row = {
    ...values,
    model_path: modelPath,
    model_source_path: sourcePath,
    model_usdz_path: usdzPath,
    poster_path: posterPath,
  };
  const { data: written, error: rowError } = isNew
    ? await supabase
        .from("products")
        .insert({ id, ...row })
        .select("id")
    : await supabase.from("products").update(row).eq("id", id).select("id");
  if (rowError?.code === "23505")
    throw new SaveError(
      "Já existe outro produto com esse endereço. Mude o endereço em “Informações”.",
    );
  if (rowError || !written?.length)
    throw new SaveError(`Não foi possível salvar. ${NETWORK_HINT}`);

  // 5. Photo rows: removed, reordered, new.
  const keptIds = new Set(images.flatMap((image) => image.id ?? []));
  const removedIds = initial.images
    .filter((image) => !keptIds.has(image.id))
    .map((image) => image.id);
  const results = await Promise.all([
    removedIds.length
      ? supabase.from("product_images").delete().in("id", removedIds)
      : null,
    ...images.map((image, sortOrder) =>
      image.id
        ? supabase
            .from("product_images")
            .update({ sort_order: sortOrder })
            .eq("id", image.id)
        : supabase.from("product_images").insert({
            product_id: id,
            path: image.path,
            alt: values.name,
            sort_order: sortOrder,
          }),
    ),
  ]);
  if (results.some((result) => result?.error))
    throw new SaveError(
      `O produto foi salvo, mas as fotos não ficaram certas. ${NETWORK_HINT}`,
    );

  // 6. Files nothing points to anymore (best effort: a leftover file is harmless).
  onStep("Limpando arquivos antigos…");
  const usedImages = new Set([
    ...images.map((image) => image.path),
    posterPath,
  ]);
  const usedModels = new Set([modelPath, sourcePath, usdzPath]);
  const oldImages = [
    ...initial.images.map((image) => image.path),
    initial.poster_path,
  ].filter((path): path is string => !!path && !usedImages.has(path));
  const oldModels = [
    initial.model_path,
    initial.model_source_path,
    initial.model_usdz_path,
  ].filter((path): path is string => !!path && !usedModels.has(path));
  await Promise.all([
    oldImages.length ? supabase.storage.from("images").remove(oldImages) : null,
    oldModels.length ? supabase.storage.from("models").remove(oldModels) : null,
  ]);

  return { ok: true, warnings };
}
