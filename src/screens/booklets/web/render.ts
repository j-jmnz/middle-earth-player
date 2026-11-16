// Draws a booklet's pages for the web reader (reader.tsx). One renderer holds one open document: it draws the page asked for into an off-screen
// canvas and copies it onto the visible one when it is done, so the old page stays up until the new one is ready, and it warms the next page and
// the one before while the player reads. Plain functions and a class, outside the React Compiler's reach: a render is a long-lived task with
// cancellation, not a render of a component.
import type { PDFDocumentProxy, PDFPageProxy, RenderTask } from "pdfjs-dist";

import { fitScale, pixelScale } from "./reader-math";

export type Area = { width: number; height: number };
export type Drawn = { cssWidth: number; cssHeight: number };

type Entry = { canvas: HTMLCanvasElement; drawn: Drawn };

// The pages kept drawn: the one shown and its neighbours, with room for the one being left.
const KEPT = 5;

function isCancel(error: unknown): boolean {
  return error instanceof Error && error.name === "RenderingCancelledException";
}

export class PageRenderer {
  private readonly cache = new Map<string, Entry>();
  private task: RenderTask | null = null;
  // Bumped by every show and by dispose: a draw that finds it changed has been replaced and drops its result.
  private generation = 0;

  private readonly doc: PDFDocumentProxy;

  constructor(doc: PDFDocumentProxy) {
    this.doc = doc;
  }

  get pageCount(): number {
    return this.doc.numPages;
  }

  private keyOf(page: number, area: Area, zoom: number, ratio: number): string {
    return `${page}:${Math.round(area.width)}x${Math.round(area.height)}:${zoom.toFixed(3)}:${ratio}`;
  }

  private keep(key: string, entry: Entry): void {
    this.cache.delete(key);
    this.cache.set(key, entry);
    for (const [oldest, old] of this.cache) {
      if (this.cache.size <= KEPT) break;
      old.canvas.width = 0;
      old.canvas.height = 0;
      this.cache.delete(oldest);
    }
  }

  // Draws one page off screen at the zoom; null when it was replaced or failed meanwhile.
  private async draw(page: number, area: Area, zoom: number, ratio: number, generation: number): Promise<Entry | null> {
    const key = this.keyOf(page, area, zoom, ratio);
    const cached = this.cache.get(key);
    if (cached) {
      this.keep(key, cached);
      return cached;
    }
    const proxy: PDFPageProxy = await this.doc.getPage(page);
    if (generation !== this.generation) return null;
    const base = proxy.getViewport({ scale: 1 });
    const css = fitScale(area.width, area.height, base.width, base.height) * zoom;
    const viewport = proxy.getViewport({ scale: pixelScale(base.width, base.height, css, ratio) });
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.floor(viewport.width));
    canvas.height = Math.max(1, Math.floor(viewport.height));
    const task = proxy.render({ canvas, viewport });
    this.task = task;
    try {
      await task.promise;
    } catch (error: unknown) {
      if (isCancel(error)) return null;
      throw error;
    } finally {
      if (this.task === task) this.task = null;
    }
    if (generation !== this.generation) return null;
    const entry: Entry = { canvas, drawn: { cssWidth: base.width * css, cssHeight: base.height * css } };
    this.keep(key, entry);
    return entry;
  }

  /** Shows `page` on `target`; resolves with the drawn size, or null when a later call or dispose replaced this one. A failure rejects. */
  async show(page: number, area: Area, zoom: number, ratio: number, target: HTMLCanvasElement): Promise<Drawn | null> {
    this.generation += 1;
    const generation = this.generation;
    this.task?.cancel();
    const entry = await this.draw(page, area, zoom, ratio, generation);
    if (!entry || generation !== this.generation) return null;
    target.width = entry.canvas.width;
    target.height = entry.canvas.height;
    target.style.width = `${Math.round(entry.drawn.cssWidth)}px`;
    target.style.height = `${Math.round(entry.drawn.cssHeight)}px`;
    target.getContext("2d")?.drawImage(entry.canvas, 0, 0);
    void this.warm(page, area, zoom, ratio, generation);
    return entry.drawn;
  }

  // The neighbours, one after the other and only while nothing newer was asked for. A failure here is the neighbour's: it is drawn again when shown.
  private async warm(page: number, area: Area, zoom: number, ratio: number, generation: number): Promise<void> {
    for (const next of [page + 1, page - 1]) {
      if (next < 1 || next > this.doc.numPages || generation !== this.generation) continue;
      await this.draw(next, area, zoom, ratio, generation).catch(() => null);
    }
  }

  dispose(): void {
    this.generation += 1;
    this.task?.cancel();
    this.task = null;
    for (const entry of this.cache.values()) {
      entry.canvas.width = 0;
      entry.canvas.height = 0;
    }
    this.cache.clear();
    void this.doc.loadingTask.destroy().catch(() => undefined);
  }
}

/** Shows a page and reports when it is drawn or failed; the returned function drops a result that arrives after the view moved on. */
export function showPage(renderer: PageRenderer, page: number, area: Area, zoom: number, target: HTMLCanvasElement, onDrawn: () => void, onError: (error: unknown) => void): () => void {
  let live = true;
  renderer.show(page, area, zoom, window.devicePixelRatio || 1, target).then(
    (drawn) => {
      if (live && drawn) onDrawn();
    },
    (error: unknown) => {
      if (live) onError(error);
    },
  );
  return () => {
    live = false;
  };
}
