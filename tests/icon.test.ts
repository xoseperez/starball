import { describe, expect, it } from "vitest";

import { BG_COLOR, PALETTE, WHITE } from "../src/config";
import { hexColor, ICON_FILES, renderIcon, webManifest } from "../src/icon";

const SIZE = 128;

function pixel(rgba: Uint8Array, size: number, x: number, y: number): number[] {
  const i = (Math.floor(y * size) * size + Math.floor(x * size)) * 4;
  return [...rgba.subarray(i, i + 4)];
}

describe("renderIcon", () => {
  const square = renderIcon(SIZE, false);
  const rounded = renderIcon(SIZE, true);

  it("returns one RGBA pixel per cell", () => {
    expect(square.length).toBe(SIZE * SIZE * 4);
  });

  it("fills a full-bleed icon edge to edge with the space color", () => {
    expect(pixel(square, SIZE, 0, 0)).toEqual([...BG_COLOR, 255]);
    expect(pixel(square, SIZE, 0.999, 0.999)).toEqual([...BG_COLOR, 255]);
  });

  it("makes the corners of the rounded icon transparent and keeps its middle opaque", () => {
    expect(pixel(rounded, SIZE, 0, 0)[3]).toBe(0);
    expect(pixel(rounded, SIZE, 0.999, 0)[3]).toBe(0);
    expect(pixel(rounded, SIZE, 0.5, 0.999)[3]).toBe(255);
  });

  it("draws the star core and the goal center in palette colors", () => {
    expect(pixel(square, SIZE, 0.44, 0.62).slice(0, 3)).toEqual([...PALETTE[7]]);
    expect(pixel(square, SIZE, 0.72, 0.32).slice(0, 3)).toEqual([...WHITE]);
  });

  it("renders the same picture with and without rounded corners", () => {
    expect(pixel(rounded, SIZE, 0.44, 0.62)).toEqual(pixel(square, SIZE, 0.44, 0.62));
  });
});

describe("webManifest", () => {
  const manifest = webManifest() as {
    icons: { src: string; sizes: string; purpose: string }[];
    theme_color: string;
    background_color: string;
    start_url: string;
  };

  it("lists every icon that has a purpose, with its size", () => {
    const listed = ICON_FILES.filter((f) => f.purpose !== undefined);
    expect(manifest.icons.map((i) => i.src)).toEqual(listed.map((f) => f.file));
    for (const icon of manifest.icons) {
      const file = listed.find((f) => f.file === icon.src)!;
      expect(icon.sizes).toBe(`${file.size}x${file.size}`);
      expect(icon.purpose).toBe(file.purpose);
    }
  });

  it("offers a maskable icon and standard 192 and 512 icons", () => {
    expect(manifest.icons.some((i) => i.purpose === "maskable")).toBe(true);
    const any = manifest.icons.filter((i) => i.purpose === "any").map((i) => i.sizes);
    expect(any).toEqual(expect.arrayContaining(["192x192", "512x512"]));
  });

  it("uses the game's space color and starts at the page it is served from", () => {
    expect(hexColor(BG_COLOR)).toBe("#222034");
    expect(manifest.theme_color).toBe("#222034");
    expect(manifest.background_color).toBe("#222034");
    expect(manifest.start_url).toBe("./");
  });
});
