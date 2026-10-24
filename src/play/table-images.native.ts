// Card pictures for the table canvas. Skia decodes the cached file and the table keeps a copy drawn at the card's size on
// screen; the full decode is released at once. An image whose card leaves the table is released too
// (docs/architecture.md, Images). Nothing here downloads: a missing file stays missing and the canvas draws the name.
import { Skia, type SkImage } from "@shopify/react-native-skia";
import { useEffect, useRef, useState } from "react";
import { Image as RNImage, PixelRatio } from "react-native";

import type { PictureSource } from "./table-canvas-types.ts";

function uriOf(source: PictureSource): string | null {
  if (typeof source !== "number") return source.uri;
  return RNImage.resolveAssetSource(source)?.uri ?? null;
}

// Draws the decoded file into a surface the size of the card on screen and keeps that copy.
function atSize(full: SkImage, width: number, height: number): SkImage {
  const scale = PixelRatio.get();
  const w = Math.max(1, Math.round(width * scale));
  const h = Math.max(1, Math.round(height * scale));
  if (full.width() <= w && full.height() <= h) return full;
  const surface = Skia.Surface.Make(w, h);
  if (!surface) return full;
  surface.getCanvas().drawImageRect(full, Skia.XYWHRect(0, 0, full.width(), full.height()), Skia.XYWHRect(0, 0, w, h), Skia.Paint());
  const small = surface.makeImageSnapshot();
  surface.dispose();
  full.dispose();
  return small;
}

async function decode(source: PictureSource, width: number, height: number): Promise<SkImage | null> {
  const uri = uriOf(source);
  if (!uri) return null;
  try {
    const data = await Skia.Data.fromURI(uri);
    const full = Skia.Image.MakeImageFromEncoded(data);
    data.dispose();
    return full ? atSize(full, width, height) : null;
  } catch {
    // A file that does not decode is drawn as its name, like one still downloading.
    return null;
  }
}

/**
 * The images for the codes on the table, decoded at `size`. `revision` changes when the image cache gains a file, so a code
 * that had no picture is tried again. Codes that leave the list are released.
 */
export function useTableImages(
  codes: readonly string[],
  picture: (code: string) => PictureSource | null,
  size: { w: number; h: number },
  revision: number,
): ReadonlyMap<string, SkImage> {
  const held = useRef(new Map<string, SkImage>());
  const loading = useRef(new Set<string>());
  const wantedNow = useRef(new Set<string>());
  const sizeKey = useRef("");
  const [images, setImages] = useState<ReadonlyMap<string, SkImage>>(() => new Map());
  const key = codes.join(",");

  useEffect(() => {
    const wanted = new Set(codes);
    wantedNow.current = wanted;
    const sized = `${size.w}x${size.h}`;
    const resized = sizeKey.current !== sized;
    sizeKey.current = sized;
    let changed = false;
    for (const [code, image] of held.current) {
      if (wanted.has(code) && !resized) continue;
      image.dispose();
      held.current.delete(code);
      changed = true;
    }
    if (changed) setImages(new Map(held.current));
    for (const code of wanted) {
      if (held.current.has(code) || loading.current.has(code)) continue;
      const source = picture(code);
      if (!source) continue;
      loading.current.add(code);
      void decode(source, size.w, size.h).then((image) => {
        loading.current.delete(code);
        if (!image) return;
        if (!wantedNow.current.has(code)) {
          image.dispose();
          return;
        }
        held.current.get(code)?.dispose();
        held.current.set(code, image);
        setImages(new Map(held.current));
      });
    }
    // `codes` is read through `key`; `picture` is read again when the cache revision moves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, revision, size.w, size.h]);

  useEffect(() => {
    const owned = held.current;
    return () => {
      wantedNow.current = new Set();
      for (const image of owned.values()) image.dispose();
      owned.clear();
    };
  }, []);

  return images;
}
