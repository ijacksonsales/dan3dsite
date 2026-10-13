"use client";

import {
  CameraIcon,
  ImagePlusIcon,
  LoaderCircleIcon,
  XIcon,
} from "lucide-react";
import Image from "next/image";
import { useState } from "react";

import { SortableList } from "@/components/admin/sortable-list";
import { useToast } from "@/components/admin/toast";
import { publicUrl } from "@/lib/storage";

import type { PhotoItem } from "./types";

const pickerClassName =
  "flex min-h-14 flex-1 cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-input bg-card px-4 text-base font-medium hover:bg-muted has-[:disabled]:cursor-default has-[:disabled]:opacity-50";

export function PhotoSection({
  photos,
  onChange,
}: {
  photos: PhotoItem[];
  onChange: (photos: PhotoItem[]) => void;
}) {
  const toast = useToast();
  const [compressing, setCompressing] = useState<{
    done: number;
    total: number;
  }>();

  async function addFiles(fileList: FileList | null) {
    const files = [...(fileList ?? [])].filter((file) =>
      file.type.startsWith("image/"),
    );
    if (!files.length) return;
    const { compressImage } = await import("@/lib/images/compress");
    const added: PhotoItem[] = [];
    let failed = 0;
    setCompressing({ done: 0, total: files.length });
    for (const [index, file] of files.entries()) {
      try {
        const compressed = await compressImage(file);
        added.push({
          key: crypto.randomUUID(),
          kind: "new",
          file: compressed,
          previewUrl: URL.createObjectURL(compressed),
        });
      } catch (error) {
        console.error(error);
        failed++;
      }
      setCompressing({ done: index + 1, total: files.length });
    }
    setCompressing(undefined);
    onChange([...photos, ...added]);
    if (failed)
      toast(
        failed === 1
          ? "Uma foto não abriu. Tente outra ou tire a foto de novo."
          : `${failed} fotos não abriram. Tente outras ou tire de novo.`,
        "error",
      );
  }

  function remove(key: string) {
    const photo = photos.find((item) => item.key === key);
    if (photo?.kind === "new") URL.revokeObjectURL(photo.previewUrl);
    onChange(photos.filter((item) => item.key !== key));
  }

  const busy = compressing !== undefined;

  return (
    <div className="space-y-4">
      {photos.length > 0 && (
        <SortableList
          items={photos.map((photo) => ({ ...photo, id: photo.key }))}
          getLabel={(photo) =>
            `Foto ${photos.findIndex((item) => item.key === photo.key) + 1}`
          }
          onReorder={(items) =>
            onChange(
              items.map((item) =>
                photos.find((photo) => photo.key === item.id)!,
              ),
            )
          }
          renderItem={(photo, handle) => {
            const index = photos.findIndex((item) => item.key === photo.key);
            return (
              <div className="flex items-center gap-2 rounded-2xl border border-border bg-card p-2">
                {handle}
                <Image
                  src={
                    photo.kind === "saved"
                      ? publicUrl("images", photo.path)
                      : photo.previewUrl
                  }
                  alt=""
                  width={80}
                  height={80}
                  className="size-20 shrink-0 rounded-xl object-cover"
                />
                <span className="min-w-0 flex-1 text-base">
                  {index === 0 ? (
                    <strong className="font-medium">Capa</strong>
                  ) : (
                    `Foto ${index + 1}`
                  )}
                  {photo.kind === "new" && (
                    <span className="block text-sm text-muted-foreground">
                      Nova, ainda não salva
                    </span>
                  )}
                </span>
                <button
                  type="button"
                  onClick={() => remove(photo.key)}
                  aria-label={`Tirar a foto ${index + 1}`}
                  className="grid size-12 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                >
                  <XIcon className="size-5" />
                </button>
              </div>
            );
          }}
        />
      )}

      {busy ? (
        <p
          role="status"
          className="flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-secondary text-base"
        >
          <LoaderCircleIcon className="size-5 animate-spin" />
          Preparando foto {Math.min(
            compressing.done + 1,
            compressing.total,
          )} de {compressing.total}…
        </p>
      ) : (
        <div className="flex flex-col gap-3 sm:flex-row">
          <label className={pickerClassName}>
            <ImagePlusIcon className="size-5" />
            Escolher da galeria
            <input
              type="file"
              accept="image/*"
              multiple
              className="sr-only"
              onChange={(event) => {
                addFiles(event.target.files);
                event.target.value = "";
              }}
            />
          </label>
          <label className={pickerClassName}>
            <CameraIcon className="size-5" />
            Tirar foto
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only"
              onChange={(event) => {
                addFiles(event.target.files);
                event.target.value = "";
              }}
            />
          </label>
        </div>
      )}

      <p className="text-sm text-muted-foreground">
        A primeira foto é a capa. Arraste pelo ⋮⋮ para mudar a ordem.
      </p>
    </div>
  );
}
