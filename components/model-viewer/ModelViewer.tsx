"use client";

import type { ModelViewerElement } from "@google/model-viewer";
import { useEffect, useRef, useState, type Ref } from "react";

import { cn } from "@/lib/utils";

export type ArPlacement = "floor" | "wall";

/** `ar-status` event values from model-viewer. */
export type ArStatus =
  "not-presenting" | "session-started" | "object-placed" | "failed";

let loader: Promise<unknown> | undefined;

/** Loads the web component once, in the browser only (PLAN.md §6.5). */
function loadModelViewer() {
  loader ??= import("@google/model-viewer").then(({ ModelViewerElement }) => {
    // Needed for EXT_meshopt_compression; see public/model-viewer/meshopt-decoder.js.
    (
      ModelViewerElement as unknown as { meshoptDecoderLocation: string }
    ).meshoptDecoderLocation = "/model-viewer/meshopt-decoder.js";
  });
  return loader;
}

export interface ModelViewerProps {
  src: string;
  alt: string;
  poster?: string;
  placement?: ArPlacement;
  /** Text of the AR button. */
  arLabel?: string;
  className?: string;
  onArStatus?: (status: ArStatus) => void;
  /**
   * Runs instead of opening AR when the AR button is tapped; call `openAr`
   * to continue (e.g. after a short guidance screen). Call it from a tap
   * handler: iOS only opens Quick Look from a user gesture.
   */
  beforeAr?: (openAr: () => void) => void;
  ref?: Ref<ModelViewerElement>;
}

/**
 * 3D viewer with real-size AR (Android: WebXR / Scene Viewer, iPhone: Quick
 * Look). `ar-scale="fixed"` keeps the real size: the customer cannot resize it.
 */
export function ModelViewer({
  src,
  alt,
  poster,
  placement = "floor",
  arLabel = "Ver no meu espaço",
  className,
  onArStatus,
  beforeAr,
  ref,
}: ModelViewerProps) {
  const elementRef = useRef<ModelViewerElement | null>(null);
  const arButtonRef = useRef<HTMLButtonElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    loadModelViewer().then(() => active && setReady(true));
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const element = elementRef.current;
    if (!element || !onArStatus) return;
    const listener = (event: Event) =>
      onArStatus((event as CustomEvent<{ status: ArStatus }>).detail.status);
    element.addEventListener("ar-status", listener);
    return () => element.removeEventListener("ar-status", listener);
  }, [onArStatus, ready]);

  // model-viewer opens AR from a click listener inside its shadow DOM, which
  // runs before React's delegated handlers. A native listener on the slotted
  // button sees the click first and can stop it from reaching that listener.
  useEffect(() => {
    const button = arButtonRef.current;
    if (!button || !beforeAr) return;
    const listener = (event: MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      beforeAr(() => void elementRef.current?.activateAR());
    };
    button.addEventListener("click", listener);
    return () => button.removeEventListener("click", listener);
  }, [beforeAr, ready]);

  return (
    <model-viewer
      ref={(element: ModelViewerElement | null) => {
        elementRef.current = element;
        if (typeof ref === "function") ref(element);
        else if (ref) ref.current = element;
      }}
      src={ready ? src : undefined}
      alt={alt}
      poster={poster}
      loading="lazy"
      camera-controls
      touch-action="pan-y"
      shadow-intensity="1"
      ar
      ar-modes="webxr scene-viewer quick-look"
      ar-scale="fixed"
      ar-placement={placement}
      className={cn("block h-full w-full bg-muted", className)}
    >
      <button
        ref={arButtonRef}
        slot="ar-button"
        type="button"
        className="absolute right-3 bottom-3 min-h-12 rounded-full bg-primary px-5 text-base font-medium text-primary-foreground shadow-md"
      >
        {arLabel}
      </button>
    </model-viewer>
  );
}
