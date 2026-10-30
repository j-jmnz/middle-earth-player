// Card pictures for the table canvas. Skia decodes the cached file and the table keeps a copy drawn at the largest size the canvas
// draws that card (table-pictures.ts: a hand card at the scrub's lifted size, any other at its slot's), downscaled with linear
// filtering in halving steps so a 1200 px scan becomes a small card without aliasing; the full decode is released at once. A copy
// is decoded again only when it is too small for where its card now is, or far larger than it needs. An image whose card leaves the
// table is released too (docs/architecture.md, Images). Nothing here downloads: a missing file stays missing and the canvas draws
// the name. The decodes run one at a time, one for each frame, and the canvas is told of the finished ones once a frame, so a draw of
// several cards does not stall the frames after it and the canvas does not record its scene once for each picture.
import { FilterMode, MipmapMode, Skia, type SkImage } from "@shopify/react-native-skia";
import { useEffect, useEffectEvent, useState } from "react";
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
  while (image.width() >= 2 * target.w && image.height() >= 2 * target.h) {
    const half = redraw(image, Math.round(image.width() / 2), Math.round(image.height() / 2));
    // No surface (memory pressure): keep what there is rather than try again.
    if (half === image) return image;
    image = half;
  }
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

// A picture waiting for its turn to decode.
type Job = { source: PictureSource; box: Box };

/**
 * The decoded copies of the table's pictures, and the queue that makes them. Plain state outside React: the hook below owns one, tells
 * it what the table wants, and hands the canvas the copies it announces.
 *
 * The decodes run one at a time, the next one a frame after the last, so a draw of several cards does not stall the frames after it.
 * A code with no copy yet goes before one that has a copy and wants a new size (the first is drawn as its name, the second already shows
 * a picture); within each the order is the table's own (the map's: the quest, staging, the engaged enemies, the play area, the piles,
 * then the hand, and cards that are leaving last). Finished copies are announced once a frame, however many finished in it.
 */
class Pictures {
  private held = new Map<string, { image: SkImage; box: Box }>();
  private loading = new Map<string, Box>();
  private queue = new Map<string, Job>();
  private wanted: ReadonlyMap<string, Box> = new Map();
  private busy = false;
  // Copies replaced or released, disposed only once the map without them is drawn: until then the canvas may still draw them.
  private retired: SkImage[] = [];
  // The frames waiting: one to announce what has finished, one to start the next decode.
  private announcing: number | null = null;
  private pumping: number | null = null;

  private readonly announce: (images: ReadonlyMap<string, SkImage>) => void;

  constructor(announce: (images: ReadonlyMap<string, SkImage>) => void) {
    this.announce = announce;
  }

  /** Decodes what the table wants now, and releases what it no longer shows. */
  want(boxes: ReadonlyMap<string, Box>, picture: (code: string) => PictureSource | null): void {
    this.wanted = boxes;
    let changed = false;
    for (const [code, copy] of this.held) {
      if (boxes.has(code)) continue;
      this.retired.push(copy.image);
      this.held.delete(code);
      changed = true;
    }
    for (const code of this.queue.keys()) {
      if (boxes.has(code)) continue;
      this.queue.delete(code);
      this.loading.delete(code);
    }
    if (changed) this.announceSoon();
    for (const [code, box] of boxes) {
      if (!redecode(this.held.get(code)?.box, box)) continue;
      const pending = this.loading.get(code);
      if (pending && !redecode(pending, box)) continue;
      const source = picture(code);
      if (!source) continue;
      this.loading.set(code, box);
      this.queue.set(code, { source, box });
    }
    this.pump();
  }

  /** Disposes the copies the canvas has stopped drawing: called once the map without them is committed. */
  disposeRetired(): void {
    const done = this.retired;
    this.retired = [];
    for (const image of done) image.dispose();
  }

  /** Stops the frames, drops the queue and releases every copy; a decode still running is released when it ends. */
  close(): void {
    this.wanted = new Map();
    this.queue.clear();
    this.loading.clear();
    if (this.announcing != null) cancelAnimationFrame(this.announcing);
    if (this.pumping != null) cancelAnimationFrame(this.pumping);
    this.announcing = null;
    this.pumping = null;
    for (const copy of this.held.values()) copy.image.dispose();
    this.held.clear();
    this.disposeRetired();
  }

  private announceSoon(): void {
    if (this.announcing != null) return;
    this.announcing = requestAnimationFrame(() => {
      this.announcing = null;
      this.announce(new Map([...this.held].map(([code, copy]) => [code, copy.image])));
    });
  }

  // The next job: a code with no copy first, else the first queued.
  private next(): [string, Job] | null {
    let first: [string, Job] | null = null;
    for (const entry of this.queue) {
      if (!this.held.has(entry[0])) return entry;
      first ??= entry;
    }
    return first;
  }

  // Decodes the next job, then waits a frame before the one after it.
  private pump(): void {
    if (this.busy) return;
    const next = this.next();
    if (!next) return;
    const [code, job] = next;
    this.queue.delete(code);
    // The box the code wants now, not the one it was queued for; a code that left the table is not decoded.
    const wanted = this.wanted.get(code);
    if (!wanted) {
      this.loading.delete(code);
      this.pump();
      return;
    }
    const box = redecode(job.box, wanted) ? wanted : job.box;
    this.busy = true;
    void decode(job.source, box).then((image) => {
      this.busy = false;
      if (this.loading.get(code) === job.box) this.loading.delete(code);
      this.keep(code, box, image);
      this.pumping = requestAnimationFrame(() => {
        this.pumping = null;
        this.pump();
      });
    });
  }

  // A decoded copy: kept for its code, or released when its card left the table or a later decode for a larger box is on its way.
  private keep(code: string, box: Box, image: SkImage | null): void {
    if (!image) return;
    const wanted = this.wanted.get(code);
    if (!wanted || redecode(box, wanted) || this.loading.has(code) || this.queue.has(code)) {
      image.dispose();
      return;
    }
    const old = this.held.get(code)?.image;
    if (old) this.retired.push(old);
    this.held.set(code, { image, box });
    this.announceSoon();
  }
}

/**
 * The images for the codes on the table, each decoded to cover its box (points). `revision` changes when the image cache gains a
 * file, so a code that had no picture is tried again. Codes that leave the map are released; a code whose box outgrows its copy
 * (or shrinks far under it) is decoded again, and its old copy drawn until the new one is ready. The decodes are queued, one for each
 * frame, and the canvas gets the finished ones once a frame (`Pictures`).
 */
export function useTableImages(boxes: ReadonlyMap<string, Box>, picture: (code: string) => PictureSource | null, revision: number): ReadonlyMap<string, SkImage> {
  const [images, setImages] = useState<ReadonlyMap<string, SkImage>>(() => new Map());
  const [pictures] = useState(() => new Pictures((next) => setImages(next)));
  const key = keyOf(boxes);

  useEffect(() => {
    pictures.disposeRetired();
  }, [images, pictures]);

  // Tells the pictures what the table wants now. It runs when the boxes' key or the cache revision changes, and reads the latest `boxes` and `picture`.
  const decodeWanted = useEffectEvent(() => pictures.want(boxes, picture));
  useEffect(() => {
    decodeWanted();
  }, [key, revision]);

  useEffect(() => () => pictures.close(), [pictures]);

  return images;
}
