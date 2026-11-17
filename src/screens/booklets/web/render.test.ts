// The web reader's page cache (render.ts): pdf.js lets go of each page once it is drawn, and the drawn pages kept stay within the pixel budget.
import { afterEach, describe, expect, it, vi } from "vitest";

import { PIXEL_BUDGET } from "./reader-math";
import { PageRenderer } from "./render";

type FakeCanvas = { width: number; height: number; style: Record<string, string>; getContext: () => { drawImage: () => void } };

function fakeCanvas(): FakeCanvas {
  return { width: 0, height: 0, style: {}, getContext: () => ({ drawImage: () => undefined }) };
}

// A document of `pages` square pages; `side` is each page's size at scale 1, so a draw's pixels follow from the area and zoom.
function fakeDoc(pages: number, side: number) {
  const cleanups: number[] = [];
  const doc = {
    numPages: pages,
    loadingTask: { destroy: () => Promise.resolve() },
    getPage: (page: number) =>
      Promise.resolve({
        getViewport: ({ scale }: { scale: number }) => ({ width: side * scale, height: side * scale }),
        render: () => ({ promise: Promise.resolve(), cancel: () => undefined }),
        cleanup: () => {
          cleanups.push(page);
          return true;
        },
      }),
  };
  return { doc, cleanups };
}

const made: FakeCanvas[] = [];

afterEach(() => {
  made.length = 0;
  vi.unstubAllGlobals();
});

function stubDocument(): void {
  vi.stubGlobal("document", {
    createElement: () => {
      const canvas = fakeCanvas();
      made.push(canvas);
      return canvas;
    },
  });
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("PageRenderer", () => {
  it("lets pdf.js free each page it has drawn", async () => {
    stubDocument();
    const { doc, cleanups } = fakeDoc(3, 100);
    const renderer = new PageRenderer(doc as never);
    await renderer.show(2, { width: 100, height: 100 }, 1, 1, fakeCanvas() as never);
    await settle();
    expect(cleanups.sort()).toEqual([1, 2, 3]);
  });

  it("keeps the drawn pages within the pixel budget, newest first, and always the one shown", async () => {
    stubDocument();
    // Each page fills the budget at this zoom, so only two fit.
    const side = Math.sqrt(PIXEL_BUDGET);
    const { doc } = fakeDoc(6, side);
    const renderer = new PageRenderer(doc as never);
    const area = { width: side, height: side };
    for (const page of [1, 2, 3, 4]) {
      await renderer.show(page, area, 1, 1, fakeCanvas() as never);
      await settle();
    }
    const kept = made.filter((canvas) => canvas.width > 0);
    expect(kept.length).toBeLessThanOrEqual(2);
    expect(kept.reduce((sum, canvas) => sum + canvas.width * canvas.height, 0)).toBeLessThanOrEqual(2 * PIXEL_BUDGET);
  });
});
