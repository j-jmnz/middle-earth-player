// Card pictures for the table canvas. Skia decodes the cached file and the table keeps a copy drawn at the largest size the canvas
// draws that card (table-pictures.ts: a hand card at the scrub's lifted size, any other at its slot's) in pixels at the ratio the
// Card pictures setting gives (the phone's on High, half of it on Low; the spotlight keeps the phone's), downscaled with linear
// filtering in halving steps so a 1200 px scan becomes a small card without aliasing; the full decode is released at once. A copy
// is decoded again only when it is too small for where its card now is, or far larger than it needs. An image whose card leaves the
// table is released too, except the PARKED codes it stopped drawing last, so a seat the table turns back to (two-handed play, a peek)
// is drawn at once (docs/architecture.md, Images). Nothing here downloads: a missing file stays missing and the canvas draws the name.
// The decodes run one at a time, as many in a frame as fit in about FRAME_BUDGET ms (one at least), and the canvas is told of
// the finished ones once a frame, so a draw of several cards does not stall the frames after it, a table of twenty cards fills in a few
// frames, and the canvas does not record its scene once for each picture.
import { FilterMode, MipmapMode, Skia, type SkImage } from "@shopify/react-native-skia";
import { useEffect, useEffectEvent, useState } from "react";
import { PixelRatio, Platform } from "react-native";

import { assetUri } from "./asset-uri.ts";
import type { PictureSource } from "./table-canvas-types.ts";
import { boxesKey, coverPixels, pixelBoxes, redecode, SLACK, type Box } from "./table-pictures.ts";

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

// The decoded file brought down to cover `box` (pixels), keeping its shape: halved while it is more than twice the size (each
// linear step then averages every pixel it drops), then drawn to the size.
function atSize(full: SkImage, box: Box): SkImage {
  const target = coverPixels({ w: full.width(), h: full.height() }, box, 1);
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
  const uri = assetUri(source);
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

// How long a frame may spend decoding before the rest wait for the next frame (ms): the work that blocks the JS thread is the
// decode and the downscale, and a 60 Hz frame is 16 ms.
const FRAME_BUDGET = 6;

// The web frees an image the moment it is disposed (CanvasKit's memory is not reference counted), and the Skia scene that drew it is replaced a few
// tasks after the React commit that dropped it, so a released copy is freed after this long (ms), not at once. The phone frees at once.
const WEB_RELEASE_MS = 500;

// Frees copies the committed canvas no longer draws.
function release(images: readonly SkImage[]): void {
  if (images.length === 0) return;
  if (Platform.OS !== "web") {
    for (const image of images) image.dispose();
    return;
  }
  setTimeout(() => {
    for (const image of images) image.dispose();
  }, WEB_RELEASE_MS);
}

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
 * The decodes run one at a time, and the next starts at once while the frame has used under FRAME_BUDGET ms (one decode at least),
 * else a frame later, so a draw of several cards does not stall the frames after it.
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

  /**
   * Disposes the copies the canvas has stopped drawing: called once the map `shown` is committed. A copy retired after that map was announced
   * (a decode finished in between) is still in it, and waits for the commit of the next map, which every retirement announces: on the web a
   * disposed image frees its memory at once, and a scene that still draws it throws.
   */
  disposeRetired(shown: ReadonlyMap<string, SkImage>): void {
    const drawn = new Set(shown.values());
    const done = this.retired.filter((image) => !drawn.has(image));
    this.retired = this.retired.filter((image) => drawn.has(image));
    release(done);
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
    if (this.pumping != null) cancelAnimationFrame(this.pumping);
    this.announcing = null;
    this.pumping = null;
    this.announce(NONE);
    release([...this.held.values()].map((copy) => copy.image));
    this.held.clear();
    this.disposeRetired(NONE);
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

  // Decodes the next job, then the one after it while the frame (begun at `began`, ms) has budget left, else a frame later.
  private pump(began: number = performance.now()): void {
    if (this.busy) return;
    const next = this.next();
    if (!next) return;
    const [code, job] = next;
    this.queue.delete(code);
    // The box the code wants now, not the one it was queued for; a code that left the table is not decoded.
    const wanted = this.wanted.get(code);
    if (!wanted) {
      this.loading.delete(code);
      this.pump(began);
      return;
    }
    const box = redecode(job.box, wanted, this.slack) ? wanted : job.box;
    this.busy = true;
    void decode(job.source, box).then((image) => {
      this.busy = false;
      if (this.loading.get(code) === job.box) this.loading.delete(code);
      this.keep(code, box, image);
      if (performance.now() - began < FRAME_BUDGET) {
        this.pump(began);
        return;
      }
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
    pictures.disposeRetired(images);
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
