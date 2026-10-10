"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

export interface BannerSlide {
  id: string;
  title: string | null;
  subtitle: string | null;
  desktopSrc: string;
  mobileSrc: string;
  href: string | null;
}

const AUTOPLAY_MS = 6000;

/**
 * Swipeable banners with native CSS scroll-snap (no carousel library).
 * Autoplay stops for good once the visitor touches it, and never runs with
 * "reduce motion" on.
 */
export function BannerCarousel({ slides }: { slides: BannerSlide[] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [interacted, setInteracted] = useState(false);

  const goTo = useCallback((index: number) => {
    const track = trackRef.current;
    if (!track) return;
    track.scrollTo({ left: index * track.clientWidth, behavior: "smooth" });
  }, []);

  // Which slide is visible.
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
  }, [slides.length]);

  useEffect(() => {
    if (interacted || slides.length < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setTimeout(
      () => goTo((active + 1) % slides.length),
      AUTOPLAY_MS,
    );
    return () => window.clearTimeout(timer);
  }, [active, interacted, slides.length, goTo]);

  if (slides.length === 0) return null;

  return (
    <section
      aria-roledescription="carrossel"
      aria-label="Destaques da loja"
      className="relative mx-auto w-full max-w-6xl sm:px-4 sm:pt-4"
    >
      <div
        ref={trackRef}
        onPointerDown={() => setInteracted(true)}
        onWheel={() => setInteracted(true)}
        className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto sm:rounded-3xl"
      >
        {slides.map((slide, index) => (
          <div
            key={slide.id}
            data-index={index}
            aria-roledescription="slide"
            aria-label={`${index + 1} de ${slides.length}`}
            className="relative w-full shrink-0 snap-start"
          >
            <Slide slide={slide} eager={index === 0} />
          </div>
        ))}
      </div>

      {slides.length > 1 && (
        <div className="absolute inset-x-0 bottom-2 flex justify-center sm:bottom-3">
          {slides.map((slide, index) => (
            <button
              key={slide.id}
              type="button"
              aria-label={`Mostrar banner ${index + 1}`}
              aria-current={index === active}
              onClick={() => {
                setInteracted(true);
                goTo(index);
              }}
              className="grid size-12 place-items-center"
            >
              <span
                className={cn(
                  "h-1.5 rounded-full bg-sand transition-all",
                  index === active ? "w-6" : "w-1.5 opacity-60",
                )}
              />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

function Slide({ slide, eager }: { slide: BannerSlide; eager: boolean }) {
  const content = (
    <>
      {/* Art direction (mobile/desktop crops) needs <picture>; files are already
          compressed in the admin, so next/image would add nothing here. */}
      <picture>
        <source media="(min-width: 768px)" srcSet={slide.desktopSrc} />
        <img
          src={slide.mobileSrc}
          alt={slide.title ?? ""}
          loading={eager ? "eager" : "lazy"}
          fetchPriority={eager ? "high" : "auto"}
          decoding={eager ? "sync" : "async"}
          className="aspect-[4/5] max-h-[72svh] w-full object-cover md:aspect-[5/2] md:max-h-none"
        />
      </picture>
      {(slide.title || slide.subtitle) && (
        <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-espresso/85 via-espresso/30 to-transparent p-6 pb-14 text-sand md:justify-center md:bg-gradient-to-r md:from-espresso/80 md:via-espresso/40 md:p-12 md:pb-12">
          <div className="max-w-md">
            {slide.title && (
              <h2 className="font-heading text-3xl leading-tight tracking-wide text-balance md:text-4xl">
                {slide.title}
              </h2>
            )}
            {slide.subtitle && (
              <p className="mt-3 text-base text-pretty text-sand/85">
                {slide.subtitle}
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );

  if (!slide.href) return content;
  const isInternal = slide.href.startsWith("/");
  return isInternal ? (
    <Link href={slide.href} className="block">
      {content}
    </Link>
  ) : (
    <a
      href={slide.href}
      target="_blank"
      rel="noopener noreferrer"
      className="block"
    >
      {content}
    </a>
  );
}
