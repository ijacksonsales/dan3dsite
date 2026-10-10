"use client";

import dynamic from "next/dynamic";

export type { ArPlacement, ArStatus, ModelViewerProps } from "./ModelViewer";

/**
 * Client-only entry point. `ssr: false` keeps model-viewer (and the three.js
 * it bundles) out of the server Worker bundle (PLAN.md §6, items 5 and 10).
 */
export const ModelViewer = dynamic(
  () => import("./ModelViewer").then((module) => module.ModelViewer),
  {
    ssr: false,
    loading: () => <div className="h-full w-full animate-pulse bg-muted" />,
  },
);
