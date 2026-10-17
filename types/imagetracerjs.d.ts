// Minimal types for the parts of imagetracerjs used by lib/vectorize.
declare module "imagetracerjs" {
  export interface TraceColor {
    r: number;
    g: number;
    b: number;
    a: number;
  }

  export interface TraceData {
    width: number;
    height: number;
    palette: TraceColor[];
    /** One list of paths per palette color. */
    layers: unknown[][];
  }

  export interface TraceOptions {
    ltres?: number;
    qtres?: number;
    pathomit?: number;
    rightangleenhance?: boolean;
    colorsampling?: 0 | 1 | 2;
    numberofcolors?: number;
    mincolorratio?: number;
    colorquantcycles?: number;
    layering?: 0 | 1;
    strokewidth?: number;
    linefilter?: boolean;
    scale?: number;
    roundcoords?: number;
    viewbox?: boolean;
    desc?: boolean;
    blurradius?: number;
    blurdelta?: number;
  }

  interface ImageTracer {
    imagedataToTracedata(
      imageData: ImageData,
      options?: TraceOptions,
    ): TraceData;
    getsvgstring(traceData: TraceData, options?: TraceOptions): string;
  }

  const tracer: ImageTracer;
  export default tracer;
}
