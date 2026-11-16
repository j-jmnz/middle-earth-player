import { describe, expect, it } from "vitest";

import { hex, looksLikePdf } from "./pdf-check";

const bytesOf = (text: string) => new TextEncoder().encode(text);

describe("looksLikePdf", () => {
  it("accepts the header at the start and within the first 1024 bytes", () => {
    expect(looksLikePdf(bytesOf("%PDF-1.7\n%âãÏÓ"))).toBe(true);
    expect(looksLikePdf(bytesOf(`${"x".repeat(1019)}%PDF-`))).toBe(true);
  });

  it("refuses a file that holds no header there, an image, a text file and an empty one", () => {
    expect(looksLikePdf(bytesOf(`${"x".repeat(1020)}%PDF-`))).toBe(false);
    expect(looksLikePdf(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe(false);
    expect(looksLikePdf(bytesOf("PDF-1.7 is a version"))).toBe(false);
    expect(looksLikePdf(new Uint8Array())).toBe(false);
    expect(looksLikePdf(bytesOf("%PDF"))).toBe(false);
  });
});

describe("hex", () => {
  it("writes a digest as lower-case pairs", () => {
    expect(hex(new Uint8Array([0, 15, 16, 255]).buffer)).toBe("000f10ff");
  });
});
