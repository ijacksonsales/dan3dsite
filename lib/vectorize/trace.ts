import ImageTracer, {
  type TraceColor,
  type TraceData,
  type TraceOptions,
} from "imagetracerjs";

// JPG/PNG → SVG (PLAN.md §5, phase 9). Pure functions over ImageData and
// imagetracerjs' trace data, so they run in the Web Worker and in tests.

export type Smoothing = 0 | 1 | 2;

export interface VectorizeOptions {
  /** How many colors the drawing keeps (2–12). */
  colors: number;
  /** 0 = sharp, 2 = very smooth (less detail, cleaner curves). */
  smoothing: Smoothing;
  /** Specks smaller than this many pixels are dropped. */
  ignoreSpecks: number;
}

export interface TraceResult {
  trace: TraceData;
  /** Palette index of the background (color around the border), or null. */
  backgroundIndex: number | null;
}

export const COLOR_RANGE = { min: 2, max: 12 } as const;
/** Larger images are reduced first: tracing time grows with the area. */
export const MAX_SIDE = 1000;

const SMOOTHING: Record<Smoothing, TraceOptions> = {
  0: { blurradius: 0, ltres: 1, qtres: 1 },
  1: { blurradius: 2, blurdelta: 64, ltres: 2, qtres: 2 },
  2: { blurradius: 4, blurdelta: 128, ltres: 4, qtres: 4 },
};

export function traceOptions(options: VectorizeOptions): TraceOptions {
  const colors = Math.min(
    COLOR_RANGE.max,
    Math.max(COLOR_RANGE.min, Math.round(options.colors)),
  );
  return {
    numberofcolors: colors,
    // Deterministic palette from the image, refined a few times.
    colorsampling: 2,
    colorquantcycles: 3,
    mincolorratio: 0,
    pathomit: Math.max(0, Math.round(options.ignoreSpecks)),
    rightangleenhance: true,
    roundcoords: 1,
    ...SMOOTHING[options.smoothing],
  };
}

/** Width and height that fit inside MAX_SIDE, keeping the proportion. */
export function fitSize(width: number, height: number, max = MAX_SIDE) {
  const scale = Math.min(1, max / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/** Most common opaque color along the image border (ignores transparency). */
export function borderColor(image: ImageData): TraceColor | null {
  const { width, height, data } = image;
  const counts = new Map<number, { color: TraceColor; count: number }>();
  const add = (x: number, y: number) => {
    const i = (y * width + x) * 4;
    if (data[i + 3] < 128) return;
    // Bucket close shades together (JPG noise).
    const key =
      ((data[i] >> 4) << 8) | ((data[i + 1] >> 4) << 4) | (data[i + 2] >> 4);
    const entry = counts.get(key);
    if (entry) entry.count++;
    else
      counts.set(key, {
        color: { r: data[i], g: data[i + 1], b: data[i + 2], a: 255 },
        count: 1,
      });
  };
  for (let x = 0; x < width; x++) {
    add(x, 0);
    add(x, height - 1);
  }
  for (let y = 1; y < height - 1; y++) {
    add(0, y);
    add(width - 1, y);
  }
  let best: { color: TraceColor; count: number } | null = null;
  for (const entry of counts.values())
    if (!best || entry.count > best.count) best = entry;
  return best?.color ?? null;
}

const distance = (a: TraceColor, b: TraceColor) =>
  (a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2;

/** Index of the opaque palette color closest to `color`. */
export function nearestColor(
  palette: TraceColor[],
  color: TraceColor,
): number | null {
  let best: number | null = null;
  palette.forEach((candidate, index) => {
    if (candidate.a < 128) return;
    if (
      best === null ||
      distance(candidate, color) < distance(palette[best], color)
    )
      best = index;
  });
  return best;
}

/** Palette colors that end up in the drawing: opaque and with shapes. */
export function usableColors(trace: TraceData): number[] {
  return trace.palette.flatMap((color, index) =>
    color.a >= 128 && trace.layers[index]?.length ? [index] : [],
  );
}

export function vectorize(
  image: ImageData,
  options: VectorizeOptions,
): TraceResult {
  const trace = ImageTracer.imagedataToTracedata(image, traceOptions(options));
  const border = borderColor(image);
  return {
    trace,
    backgroundIndex: border ? nearestColor(trace.palette, border) : null,
  };
}

/**
 * The SVG file, keeping only the `visible` colors. Shapes are filled with no
 * outline (cleaner when imported into Bambu Studio) and sized in pixels of
 * the traced image, with a viewBox so it scales freely.
 */
export function buildSvg(trace: TraceData, visible: number[]): string {
  const keep = new Set(visible);
  const filtered: TraceData = {
    ...trace,
    palette: trace.palette.map((color, index) =>
      keep.has(index) ? color : { ...color, a: 0 },
    ),
    layers: trace.layers.map((layer, index) => (keep.has(index) ? layer : [])),
  };
  const svg = ImageTracer.getsvgstring(filtered, {
    viewbox: true,
    strokewidth: 0,
    roundcoords: 1,
    desc: false,
  });
  return svg
    .replace(
      /^<svg viewBox="0 0 (\S+) (\S+)" version="1\.1" xmlns="http:\/\/www\.w3\.org\/2000\/svg"[^>]*>/,
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 $1 $2" width="$1" height="$2">',
    )
    .replace(/ stroke="[^"]*" stroke-width="0"/g, "")
    .replace(/ opacity="1"/g, "");
}

/** "rgb(…)" → "#rrggbb" for swatches and labels. */
export function toHex({ r, g, b }: TraceColor): string {
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}
