// Card pictures for the web table canvas: the phone's table-images.native.ts (metro.config.js serves this file in its place on the web platform), the
// same queue order, sizes, parking and release, with two changes: the browser decodes each picture and brings it down to its card's size off the
// main thread (createImageBitmap), where the phone's way, a decode in CanvasKit's wasm and halving steps on CPU surfaces, held the main thread for
// 40 to 50 ms a picture, more than a frame; and so a few decodes run at once instead of one per frame. scripts/checks/web-copies.test.ts holds the copy to the phone's file (docs/architecture.md, Images).
import { Skia, type SkImage } from "@shopify/react-native-skia";
import { useEffect, useEffectEvent, useState } from "react";
import { Image as RNImage, PixelRatio } from "react-native";

import { encodedSize } from "../../ui/skia/encoded-size.ts";
import type { PictureSource } from "./table-canvas-types.ts";
import { boxesKey, coverPixels, pixelBoxes, redecode, SLACK, type Box } from "./table-pictures.ts";

function uriOf(source: PictureSource): string | null {
  if (typeof source !== "number") return source.uri;
  return RNImage.resolveAssetSource(source)?.uri ?? null;
}

// The file decoded by the browser at the size that covers `box` (pixels), keeping its shape: createImageBitmap decodes and resizes it off the main
// thread, with the filter that matches the phone's halving steps (resizeQuality "medium"), and CanvasKit takes the bitmap as an image it uploads
// to each canvas that draws it. A file whose header does not give its size is decoded whole first, then resized from that bitmap.
async function decode(source: PictureSource, box: Box): Promise<SkImage | null> {
  const uri = uriOf(source);
  if (!uri) return null;
  try {
    const response = await fetch(uri);
    if (!response.ok) return null;
    const blob = await response.blob();
    const declared = encodedSize(new Uint8Array(await blob.arrayBuffer()));
    const whole = declared ? null : await createImageBitmap(blob);
    const size = declared ?? { w: whole?.width ?? 0, h: whole?.height ?? 0 };
    const target = coverPixels(size, box, 1);
    const options: ImageBitmapOptions = { resizeWidth: target.w, resizeHeight: target.h, resizeQuality: "medium" };
    const bitmap = await (whole ? createImageBitmap(whole, options) : createImageBitmap(blob, options));
    whole?.close();
    return Skia.Image.MakeImageFromNativeBuffer(bitmap);
  } catch {
    // A file that does not decode is drawn as its name, like one still downloading.
    return null;
  }
}

// How many decodes run at once. The browser decodes on threads of its own, so the main thread only starts each and takes its bitmap, and a
// few side by side fill a table of twenty cards in a few frames, where one at a time waited out each decode.
const AT_ONCE = 4;

// How many copies of codes the table no longer draws are kept, the ones it drew last: in two-handed play the table turns to the other
// seat on every pass, and turned back its cards are drawn at once instead of as their names while they decode again. Enough for one seat's
// zones (three heroes with their attachments and allies, a full hand). A hand card's copy at 3x is under 1 MB and a play-area card's a
// fifth of that, so this holds up to about 10 MB more than the table shows (the 16 MB test counts only what it shows).
export const PARKED = 20;

// The copies a closed or new table holds: one object, so a state set to it again is no change.
const NONE: ReadonlyMap<string, SkImage> = new Map();

// A picture waiting for its turn to decode.
type Job = { source: PictureSource; box: Box };

/**
 * The decoded copies of the table's pictures, and the queue that makes them. Plain state outside React: the hook below owns one, tells
 * it what the table wants, and hands the canvas the copies it announces.
 *
 * Up to AT_ONCE decodes run at a time, each started as soon as one ends: the browser decodes off the main thread, so a draw of several
 * cards does not stall the frames after it.
 * A code with no copy yet goes before one that has a copy and wants a new size (the first is drawn as its name, the second already shows
 * a picture); within each the order is the table's own (the map's: the quest, staging, the engaged enemies, the play area, the piles,
 * then the hand, and cards that are leaving last). Finished copies are announced once a frame, however many finished in it.
 */
class Pictures {
  private held = new Map<string, { image: SkImage; box: Box }>();
  private loading = new Map<string, Box>();
  private queue = new Map<string, Job>();
  private wanted: ReadonlyMap<string, Box> = new Map();
  // How much smaller than wanted a copy may be and stay (redecode): half a point, in the pixels the boxes are in.
  private slack = SLACK;
  private running = 0;
  // Copies replaced or released, disposed only once the map without them is drawn: until then the canvas may still draw them.
  private retired: SkImage[] = [];
  // The frame waiting to announce what has finished.
  private announcing: number | null = null;

  private readonly announce: (images: ReadonlyMap<string, SkImage>) => void;

  constructor(announce: (images: ReadonlyMap<string, SkImage>) => void) {
    this.announce = announce;
  }

  /**
   * Decodes what the table wants now (`boxes` in pixels at `ratio` pixels a point), and releases what it no longer shows beyond the
   * PARKED it showed last. A code whose copy already fits its box drops any decode queued or running for another size.
   */
  want(boxes: ReadonlyMap<string, Box>, picture: (code: string) => PictureSource | null, ratio: number): void {
    this.wanted = boxes;
    this.slack = SLACK * ratio;
    let changed = false;
    // The held codes are in the order they were last wanted, oldest first: one wanted now moves to the end.
    for (const code of boxes.keys()) {
      const copy = this.held.get(code);
      if (!copy) continue;
      this.held.delete(code);
      this.held.set(code, copy);
    }
    let parked = [...this.held.keys()].filter((code) => !boxes.has(code)).length;
    for (const [code, copy] of this.held) {
      if (parked <= PARKED) break;
      if (boxes.has(code)) continue;
      this.retired.push(copy.image);
      this.held.delete(code);
      parked -= 1;
      changed = true;
    }
    for (const code of this.queue.keys()) {
      if (boxes.has(code)) continue;
      this.queue.delete(code);
      this.loading.delete(code);
    }
    if (changed) this.announceSoon();
    for (const [code, box] of boxes) {
      if (!redecode(this.held.get(code)?.box, box, this.slack)) {
        // The copy held fits: a decode queued for another size (a quick High, Low, High) is dropped, and one already running is
        // disposed when it ends (keep).
        this.queue.delete(code);
        this.loading.delete(code);
        continue;
      }
      const pending = this.loading.get(code);
      if (pending && !redecode(pending, box, this.slack)) continue;
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

  /**
   * Stops the frames, drops the queue and releases every copy; a decode still running is released when it ends. It announces the
   * empty map before it disposes, so a state set from the announcements never holds a disposed copy (a screen hidden by Activity runs
   * this cleanup, and shown again it draws only what it decodes again).
   */
  close(): void {
    this.wanted = new Map();
    this.queue.clear();
    this.loading.clear();
    if (this.announcing != null) cancelAnimationFrame(this.announcing);
    this.announcing = null;
    this.announce(NONE);
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

  // Starts the next jobs while fewer than AT_ONCE decodes run; each that ends starts the next.
  private pump(): void {
    while (this.running < AT_ONCE) {
      const next = this.next();
      if (!next) return;
      const [code, job] = next;
      this.queue.delete(code);
      // The box the code wants now, not the one it was queued for; a code that left the table is not decoded.
      const wanted = this.wanted.get(code);
      if (!wanted) {
        this.loading.delete(code);
        continue;
      }
      const box = redecode(job.box, wanted, this.slack) ? wanted : job.box;
      this.running += 1;
      void decode(job.source, box).then((image) => {
        this.running -= 1;
        if (this.loading.get(code) === job.box) this.loading.delete(code);
        this.keep(code, box, image);
        this.pump();
      });
    }
  }

  // A decoded copy: kept for its code, or released when its card left the table or a later decode for a larger box is on its way.
  private keep(code: string, box: Box, image: SkImage | null): void {
    if (!image) return;
    const wanted = this.wanted.get(code);
    if (!wanted || redecode(box, wanted, this.slack) || this.loading.has(code) || this.queue.has(code)) {
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
 * The images for the codes on the table, each decoded to cover its box (points) at `ratio` pixels a point (the phone's when absent;
 * the table passes less on Low card pictures, the spotlight the phone's). `revision` changes when the image cache gains a
 * file, so a code that had no picture is tried again. Codes that leave the map are released; a code whose box outgrows its copy
 * (or shrinks far under it) is decoded again, and its old copy drawn until the new one is ready. The decodes are queued, as many in a
 * frame as fit its budget, and the canvas gets the finished ones once a frame (`Pictures`).
 */
export function useTableImages(boxes: ReadonlyMap<string, Box>, picture: (code: string) => PictureSource | null, revision: number, ratio?: number): ReadonlyMap<string, SkImage> {
  const [images, setImages] = useState<ReadonlyMap<string, SkImage>>(NONE);
  const [pictures] = useState(() => new Pictures((next) => setImages(next)));
  // The boxes in pixels at the ratio the copies are kept at (the phone's, or less on Low); the key holds the ratio, so a change of ratio runs `want`.
  const kept = ratio ?? PixelRatio.get();
  const wanted = pixelBoxes(boxes, kept);
  const key = boxesKey(boxes, kept);

  useEffect(() => {
    pictures.disposeRetired();
  }, [images, pictures]);

  // Tells the pictures what the table wants now. It runs when the boxes' key or the cache revision changes, and reads the latest boxes and `picture`.
  const decodeWanted = useEffectEvent(() => pictures.want(wanted, picture, kept));
  useEffect(() => {
    decodeWanted();
  }, [key, revision]);

  // The cleanup of a screen hidden by Activity runs this too: `close` announces the empty map before it disposes the copies.
  useEffect(() => () => pictures.close(), [pictures]);

  return images;
}
