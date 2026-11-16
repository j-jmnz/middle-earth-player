// Freeing a web image later (web-shims.ts). Pure, so a test reads it.
// An image disposed on the web frees its memory at once (CanvasKit is not reference counted), and the Skia scene that drew it is replaced a few
// tasks after the React commit that dropped it, so a disposed picture was drawn once more ("Cannot pass deleted object"). A disposed image is
// freed after this long (ms).
export const IMAGE_FREE_MS = 500;

/** Calls `dispose` of `image` later through `free`, once; a second call while one waits does nothing. */
export function deferDispose(free: (callback: () => void, ms: number) => unknown, image: { [Symbol.dispose](): void }, waiting: WeakSet<object>): void {
  if (waiting.has(image)) return;
  waiting.add(image);
  free(() => image[Symbol.dispose](), IMAGE_FREE_MS);
}

