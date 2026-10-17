"use client";

import dynamic from "next/dynamic";

/**
 * Client-only entry point. `ssr: false` keeps imagetracerjs out of the server
 * Worker bundle (CLAUDE.md: conversion libraries run only in the browser).
 */
export const SvgTool = dynamic(
  () => import("./svg-tool").then((module) => module.SvgTool),
  {
    ssr: false,
    loading: () => <div className="h-14 animate-pulse rounded-2xl bg-muted" />,
  },
);
