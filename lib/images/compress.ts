import imageCompression from "browser-image-compression";

/**
 * Camera/gallery photo → WebP, at most 2000 px on the longer side, ~85%
 * quality (PLAN.md §5, phase 3). With `images.unoptimized`, the store serves
 * exactly this file, so it must be compressed before upload. Browser only.
 */
export async function compressImage(
  file: File,
  onProgress?: (percent: number) => void,
): Promise<File> {
  const compressed = await imageCompression(file, {
    maxWidthOrHeight: 2000,
    fileType: "image/webp",
    initialQuality: 0.85,
    maxSizeMB: 1.5,
    useWebWorker: true,
    onProgress,
  });
  const name = file.name.replace(/\.[^.]+$/, "") + ".webp";
  return new File([compressed], name, { type: "image/webp" });
}
