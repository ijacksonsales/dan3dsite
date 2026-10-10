/** Light beige, close to a natural PLA print (STL has no colors). */
export const DEFAULT_COLOR = "#e8dcc8";

/**
 * `#rrggbb` (sRGB) → linear RGB, as glTF `baseColorFactor` expects.
 * Invalid input falls back to the default color.
 */
export function hexToLinearRgb(hex: string): [number, number, number] {
  const match =
    /^#?([0-9a-f]{6})$/i.exec(hex) ?? /^#?([0-9a-f]{6})$/i.exec(DEFAULT_COLOR)!;
  const value = parseInt(match[1], 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255].map((c) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
}
