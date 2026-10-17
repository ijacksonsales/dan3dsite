import { describe, expect, it } from "vitest";

import {
  borderColor,
  buildSvg,
  fitSize,
  nearestColor,
  toHex,
  traceOptions,
  usableColors,
  vectorize,
} from "./trace";

/** White 40×40 image with a red 20×20 square in the middle. */
function logo(): ImageData {
  const width = 40;
  const height = 40;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const inside = x >= 10 && x < 30 && y >= 10 && y < 30;
      data.set(inside ? [220, 20, 30, 255] : [255, 255, 255, 255], i);
    }
  return { width, height, data, colorSpace: "srgb" } as ImageData;
}

describe("vectorize", () => {
  it("finds the background and the shape", () => {
    const { trace, backgroundIndex } = vectorize(logo(), {
      colors: 2,
      smoothing: 0,
      ignoreSpecks: 0,
    });
    const colors = usableColors(trace);
    expect(colors).toHaveLength(2);
    expect(backgroundIndex).not.toBeNull();
    expect(toHex(trace.palette[backgroundIndex!])).toBe("#ffffff");
    const shape = colors.find((index) => index !== backgroundIndex)!;
    expect(trace.palette[shape].r).toBeGreaterThan(200);
    expect(trace.palette[shape].g).toBeLessThan(50);
  });

  it("builds a clean SVG without the hidden colors", () => {
    const { trace, backgroundIndex } = vectorize(logo(), {
      colors: 2,
      smoothing: 0,
      ignoreSpecks: 0,
    });
    const shape = usableColors(trace).filter((i) => i !== backgroundIndex);
    const svg = buildSvg(trace, shape);
    expect(
      svg.startsWith(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" width="40" height="40">',
      ),
    ).toBe(true);
    expect(svg).toContain("<path");
    expect(svg).not.toContain("rgb(255,255,255)");
    expect(svg).not.toContain("stroke");
    expect(svg.endsWith("</svg>")).toBe(true);

    const full = buildSvg(trace, usableColors(trace));
    expect(full).toContain("rgb(255,255,255)");
  });
});

describe("helpers", () => {
  it("reads the border color, skipping transparent pixels", () => {
    expect(borderColor(logo())).toEqual({ r: 255, g: 255, b: 255, a: 255 });
    const clear = logo();
    clear.data.fill(0);
    expect(borderColor(clear)).toBeNull();
  });

  it("picks the closest opaque palette color", () => {
    const palette = [
      { r: 0, g: 0, b: 0, a: 0 },
      { r: 250, g: 250, b: 250, a: 255 },
      { r: 200, g: 0, b: 0, a: 255 },
    ];
    expect(nearestColor(palette, { r: 255, g: 255, b: 255, a: 255 })).toBe(1);
    expect(nearestColor(palette, { r: 10, g: 0, b: 0, a: 255 })).toBe(2);
    expect(nearestColor([], { r: 0, g: 0, b: 0, a: 255 })).toBeNull();
  });

  it("keeps the proportion when reducing", () => {
    expect(fitSize(4000, 2000)).toEqual({ width: 1000, height: 500 });
    expect(fitSize(300, 200)).toEqual({ width: 300, height: 200 });
  });

  it("clamps the options", () => {
    expect(
      traceOptions({ colors: 50, smoothing: 2, ignoreSpecks: -3 }),
    ).toMatchObject({
      numberofcolors: 12,
      pathomit: 0,
      blurradius: 4,
    });
    expect(
      traceOptions({ colors: 1, smoothing: 0, ignoreSpecks: 8 }).numberofcolors,
    ).toBe(2);
  });
});
