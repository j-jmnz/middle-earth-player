// The size a picture file declares, read from its header (src/ui/skia/encoded-size.ts), against sharp's encodings.
import sharp from "sharp";
import { describe, expect, it } from "vitest";

import { encodedSize } from "./encoded-size.ts";

const picture = (w: number, h: number) => sharp({ create: { width: w, height: h, channels: 3, background: { r: 90, g: 120, b: 60 } } });

describe("encodedSize", () => {
  it("reads a baseline and a progressive JPEG, with an EXIF segment before the frame", async () => {
    expect(encodedSize(new Uint8Array(await picture(879, 1200).jpeg({ quality: 85, mozjpeg: true }).toBuffer()))).toEqual({ w: 879, h: 1200 });
    expect(encodedSize(new Uint8Array(await picture(1200, 879).jpeg({ progressive: true }).toBuffer()))).toEqual({ w: 1200, h: 879 });
    expect(encodedSize(new Uint8Array(await picture(300, 420).withMetadata({ exif: { IFD0: { Copyright: "x" } } }).jpeg().toBuffer()))).toEqual({ w: 300, h: 420 });
  });

  it("reads a PNG", async () => {
    expect(encodedSize(new Uint8Array(await picture(640, 480).png().toBuffer()))).toEqual({ w: 640, h: 480 });
  });

  it("answers null for another file or a cut header", async () => {
    expect(encodedSize(new TextEncoder().encode("not a picture"))).toBeNull();
    expect(encodedSize(new Uint8Array(await picture(64, 64).webp().toBuffer()))).toBeNull();
    expect(encodedSize(new Uint8Array((await picture(64, 64).jpeg().toBuffer()).subarray(0, 6)))).toBeNull();
  });
});
