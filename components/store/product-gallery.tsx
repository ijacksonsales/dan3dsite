"use client";

import { ChevronLeftIcon, ChevronRightIcon, XIcon } from "lucide-react";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

import { PhotoPlaceholder } from "./photo-placeholder";
import { ZoomableImage } from "./zoomable-image";

export interface GalleryImage {
  src: string;
  alt: string;
}

/** Swipeable photos; tapping one opens it full screen with zoom. */
export function ProductGallery({
  images,
  productName,
}: {
  images: GalleryImage[];
  productName: string;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries)
          if (entry.isIntersecting)
            setActive(Number((entry.target as HTMLElement).dataset.index));
      },
      { root: track, threshold: 0.6 },
    );
    for (const child of track.children) observer.observe(child);
    return () => observer.disconnect();
  }, [images.length]);

  const scrollTo = (index: number) => {
    const track = trackRef.current;
    track?.scrollTo({ left: index * track.clientWidth, behavior: "smooth" });
  };

  if (images.length === 0)
    return (
      <div className="aspect-square overflow-hidden rounded-3xl">
        <PhotoPlaceholder />
      </div>
    );

  return (
    <div>
      <div className="relative">
        <div
          ref={trackRef}
          className="no-scrollbar flex aspect-square snap-x snap-mandatory overflow-x-auto rounded-3xl bg-secondary"
        >
          {images.map((image, index) => (
            <button
              key={image.src}
              type="button"
              data-index={index}
              onClick={() => setViewerIndex(index)}
              aria-label={`Ampliar foto ${index + 1} de ${images.length}`}
              className="relative h-full w-full shrink-0 cursor-zoom-in snap-start"
            >
              <Image
                src={image.src}
                alt={image.alt}
                fill
                sizes="(min-width: 1024px) 50vw, 100vw"
                priority={index === 0}
                className="object-cover"
              />
            </button>
          ))}
        </div>
        {images.length > 1 && (
          <span className="absolute right-3 bottom-3 rounded-full bg-espresso/70 px-2.5 py-1 text-xs text-sand">
            {active + 1}/{images.length}
          </span>
        )}
      </div>

      {images.length > 1 && (
        <ul className="-mx-1 mt-2 no-scrollbar flex gap-2 overflow-x-auto p-1">
          {images.map((image, index) => (
            <li key={image.src} className="shrink-0">
              <button
                type="button"
                onClick={() => scrollTo(index)}
                aria-label={`Ver foto ${index + 1}`}
                aria-current={index === active}
                className={cn(
                  "relative block size-16 overflow-hidden rounded-xl ring-2 transition",
                  index === active
                    ? "ring-primary"
                    : "opacity-70 ring-transparent hover:opacity-100",
                )}
              >
                <Image
                  src={image.src}
                  alt=""
                  fill
                  sizes="64px"
                  className="object-cover"
                />
              </button>
            </li>
          ))}
        </ul>
      )}

      <Dialog
        open={viewerIndex !== null}
        onOpenChange={(open) => !open && setViewerIndex(null)}
      >
        {viewerIndex !== null && (
          <PhotoViewer
            images={images}
            index={viewerIndex}
            title={productName}
            onIndexChange={(index) => {
              setViewerIndex(index);
              scrollTo(index);
            }}
          />
        )}
      </Dialog>
    </div>
  );
}

function PhotoViewer({
  images,
  index,
  title,
  onIndexChange,
}: {
  images: GalleryImage[];
  index: number;
  title: string;
  onIndexChange: (index: number) => void;
}) {
  const count = images.length;
  const go = (direction: 1 | -1) =>
    onIndexChange((index + direction + count) % count);
  const image = images[index];

  return (
    <DialogContent
      showCloseButton={false}
      onKeyDown={(event) => {
        if (event.key === "ArrowRight") go(1);
        if (event.key === "ArrowLeft") go(-1);
      }}
      className="top-0 left-0 flex h-dvh w-screen max-w-none translate-x-0 translate-y-0 flex-col gap-0 rounded-none bg-espresso p-0 text-sand ring-0 sm:max-w-none"
    >
      <div className="flex h-16 shrink-0 items-center justify-between px-2">
        <DialogTitle className="truncate px-3 text-sm font-normal text-sand/80">
          {title} · {index + 1}/{count}
        </DialogTitle>
        <DialogClose
          aria-label="Fechar"
          className="grid size-12 place-items-center rounded-full hover:bg-sand/10"
        >
          <XIcon className="size-6" />
        </DialogClose>
      </div>

      <div className="relative min-h-0 flex-1">
        <ZoomableImage
          key={image.src}
          src={image.src}
          alt={image.alt}
          onSwipe={count > 1 ? go : () => {}}
        />
        {count > 1 && (
          <>
            <button
              type="button"
              onClick={() => go(-1)}
              aria-label="Foto anterior"
              className="absolute top-1/2 left-2 hidden size-12 -translate-y-1/2 place-items-center rounded-full bg-espresso/60 hover:bg-espresso sm:grid"
            >
              <ChevronLeftIcon className="size-6" />
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              aria-label="Próxima foto"
              className="absolute top-1/2 right-2 hidden size-12 -translate-y-1/2 place-items-center rounded-full bg-espresso/60 hover:bg-espresso sm:grid"
            >
              <ChevronRightIcon className="size-6" />
            </button>
          </>
        )}
      </div>

      <p className="shrink-0 px-4 py-4 text-center text-xs text-sand/60">
        Junte ou afaste dois dedos para ampliar · toque duas vezes para zoom
      </p>
    </DialogContent>
  );
}
