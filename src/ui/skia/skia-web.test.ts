// The web's CanvasKit start (ui/skia/skia-web.ts): the load begins on the next frame, and a cleanup that comes first starts it instead of dropping it.
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

async function setup() {
  vi.resetModules();
  const frames = new Map<number, () => void>();
  let next = 1;
  vi.stubGlobal("requestAnimationFrame", (callback: () => void) => {
    frames.set(next, callback);
    return next++;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
  const loadCanvasKit = vi.fn(async () => undefined);
  vi.doMock("react-native", () => ({ Platform: { OS: "web" } }));
  vi.doMock("./skia-web-load.ts", () => ({ loadCanvasKit }));
  const module = await import("./skia-web.ts");
  return { module, frames, loadCanvasKit };
}

describe("startCanvasKitOnFrame", () => {
  it("waits for the frame", async () => {
    const { module, frames, loadCanvasKit } = await setup();
    module.startCanvasKitOnFrame();
    expect(frames.size).toBe(1);
    await Promise.resolve();
    expect(loadCanvasKit).not.toHaveBeenCalled();
    for (const run of [...frames.values()]) run();
    await vi.waitFor(() => expect(loadCanvasKit).toHaveBeenCalledTimes(1));
  });

  it("starts the load when the cleanup runs before any frame", async () => {
    const { module, frames, loadCanvasKit } = await setup();
    const stop = module.startCanvasKitOnFrame();
    stop();
    expect(frames.size).toBe(0);
    await vi.waitFor(() => expect(loadCanvasKit).toHaveBeenCalledTimes(1));
  });
});
