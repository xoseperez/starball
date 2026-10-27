import { describe, expect, it } from "vitest";

import { crc32, encodePng } from "../src/png";

const ascii = (s: string) => new Uint8Array([...s].map((c) => c.charCodeAt(0)));

function readChunks(png: Uint8Array): { type: string; data: Uint8Array; crc: number }[] {
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  const chunks = [];
  let at = 8;
  while (at < png.length) {
    const length = view.getUint32(at);
    const type = String.fromCharCode(...png.subarray(at + 4, at + 8));
    const data = png.subarray(at + 8, at + 8 + length);
    const crc = view.getUint32(at + 8 + length);
    chunks.push({ type, data, crc });
    at += 12 + length;
  }
  return chunks;
}

describe("crc32", () => {
  it("matches the standard check values", () => {
    expect(crc32(ascii("123456789"))).toBe(0xcbf43926);
    expect(crc32(ascii("IEND"))).toBe(0xae426082);
  });
});

describe("encodePng", () => {
  const rgba = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
  const png = encodePng(2, 2, rgba, (raw) => raw);
  const chunks = readChunks(png);

  it("starts with the PNG signature", () => {
    expect([...png.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  });

  it("writes IHDR, IDAT and IEND in order with valid checksums", () => {
    expect(chunks.map((c) => c.type)).toEqual(["IHDR", "IDAT", "IEND"]);
    for (const c of chunks) {
      const typed = new Uint8Array([...ascii(c.type), ...c.data]);
      expect(c.crc, c.type).toBe(crc32(typed));
    }
  });

  it("describes an 8-bit RGBA image of the given size", () => {
    const header = new DataView(chunks[0].data.buffer, chunks[0].data.byteOffset, 13);
    expect(header.getUint32(0)).toBe(2);
    expect(header.getUint32(4)).toBe(2);
    expect([...chunks[0].data.subarray(8)]).toEqual([8, 6, 0, 0, 0]);
  });

  it("hands the compressor one unfiltered row per scanline", () => {
    expect([...chunks[1].data]).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 0, 9, 10, 11, 12, 13, 14, 15, 16]);
  });
});
