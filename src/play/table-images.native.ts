// Card pictures for the table canvas. Skia decodes the cached file and the table keeps a copy drawn at the largest size the canvas
// draws that card (table-pictures.ts: a hand card at the scrub's lifted size, any other at its slot's), downscaled with linear
// filtering in halving steps so a 1200 px scan becomes a small card without aliasing; the full decode is released at once. A copy
// is decoded again only when it is too small for where its card now is, or far larger than it needs. An image whose card leaves the
// table is released too (docs/architecture.md, Images). Nothing here downloads: a missing file stays missing and the canvas draws
// the name.
import { FilterMode, MipmapMode, Skia, type SkImage } from "@shopify/react-native-skia";
import { useEffect, useRef, useState } from "react";
import { Image as RNImage, PixelRatio } from "react-native";

import type { PictureSource } from "./table-canvas-types.ts";
import { coverPixels, redecode, type Box } from "./table-pictures.ts";

function uriOf(source: PictureSource): string | null {
  if (typeof source !== "number") return source.uri;
  return RNImage.resolveAssetSource(source)?.uri ?? null;
}

// Draws `image` into a surface `w` x `h` with linear filtering, and releases `image`.
function redraw(image: SkImage, w: number, h: number): SkImage {
  const surface = Skia.Surface.Make(w, h);
  if (!surface) return image;
  surface.getCanvas().drawImageRectOptions(image, Skia.XYWHRect(0, 0, image.width(), image.height()), Skia.XYWHRect(0, 0, w, h), FilterMode.Linear, MipmapMode.None);
  const next = surface.makeImageSnapshot();
  surface.dispose();
  image.dispose();
  return next;
}

// The decoded file brought down to cover `box` on screen, keeping its shape: halved while it is more than twice the size (each
// linear step then averages every pixel it drops), then drawn to the size.
function atSize(full: SkImage, box: Box): SkImage {
  const target = coverPixels({ w: full.width(), h: full.height() }, box, PixelRatio.get());
  let image = full;
  while (image.width() >= 2 * target.w && image.height() >= 2 * target.h) image = redraw(image, Math.round(image.width() / 2), Math.round(image.height() / 2));
  return image.width() === target.w && image.height() === target.h ? image : redraw(image, target.w, target.h);
}

async function decode(source: PictureSource, box: Box): Promise<SkImage | null> {
  const uri = uriOf(source);
  if (!uri) return null;
  try {
    const data = await Skia.Data.fromURI(uri);
    const full = Skia.Image.MakeImageFromEncoded(data);
    data.dispose();
    return full ? atSize(full, box) : null;
  } catch {
    // A file that does not decode is drawn as its name, like one still downloading.
    return null;
  }
}

const keyOf = (boxes: ReadonlyMap<string, Box>) => [...boxes].map(([code, box]) => `${code}:${Math.round(box.w)}x${Math.round(box.h)}`).join(",");

/**
 * The images for the codes on the table, each decoded to cover its box (points). `revision` changes when the image cache gains a
 * file, so a code that had no picture is tried again. Codes that leave the map are released; a code whose box outgrows its copy
 * (or shrinks far under it) is decoded again, and its old copy drawn until the new one is ready.
 */
export function useTableImages(boxes: ReadonlyMap<string, Box>, picture: (code: string) => PictureSource | null, revision: number): ReadonlyMap<string, SkImage> {
  const held = useRef(new Map<string, { image: SkImage; box: Box }>());
  const loading = useRef(new Map<string, Box>());
  const wantedNow = useRef<ReadonlyMap<string, Box>>(new Map());
  const [images, setImages] = useState<ReadonlyMap<string, SkImage>>(() => new Map());
  const key = keyOf(boxes);

  useEffect(() => {
    wantedNow.current = boxes;
    const publish = () => setImages(new Map([...held.current].map(([code, copy]) => [code, copy.image])));
    let changed = false;
    for (const [code, copy] of held.current) {
      if (boxes.has(code)) continue;
      copy.image.dispose();
      held.current.delete(code);
      changed = true;
    }
    if (changed) publish();
    for (const [code, box] of boxes) {
      if (!redecode(held.current.get(code)?.box, box)) continue;
      const pending = loading.current.get(code);
      if (pending && !redecode(pending, box)) continue;
      const source = picture(code);
      if (!source) continue;
      loading.current.set(code, box);
      void decode(source, box).then((image) => {
        if (loading.current.get(code) === box) loading.current.delete(code);
        if (!image) return;
        const wanted = wantedNow.current.get(code);
        // Released when its card left the table, or when a later decode for a larger box is on its way.
        if (!wanted || redecode(box, wanted) || (loading.current.has(code) && loading.current.get(code) !== box)) {
          image.dispose();
          return;
        }
        held.current.get(code)?.image.dispose();
        held.current.set(code, { image, box });
        publish();
      });
    }
    // `boxes` is read through `key`; `picture` is read again when the cache revision moves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, revision]);

  useEffect(() => {
    const owned = held.current;
    return () => {
      wantedNow.current = new Map();
      for (const copy of owned.values()) copy.image.dispose();
      owned.clear();
    };
  }, []);

  return images;
}
