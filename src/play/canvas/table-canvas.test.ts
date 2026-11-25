// The web table's gate (table-canvas.tsx): a table that mounts while CanvasKit is idle starts the load itself, once, because the splash may be gone before its frame.
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.resetModules();
  vi.doUnmock("react");
});

describe("TableCanvas gate", () => {
  it("starts the CanvasKit load on mount when the status is idle", async () => {
    vi.resetModules();
    const effects: (() => unknown)[] = [];
    const actual = await vi.importActual<typeof import("react")>("react");
    vi.doMock("react", () => ({
      ...actual,
      useEffect: (effect: () => unknown) => void effects.push(effect),
      useSyncExternalStore: (_subscribe: unknown, snapshot: () => unknown) => snapshot(),
    }));
    const loadCanvasKit = vi.fn(async () => undefined);
    vi.doMock("react-native", () => ({ Platform: { OS: "web" } }));
    vi.doMock("../../ui/skia/skia-web-load.ts", () => ({ loadCanvasKit }));
    // The app's JSX runtime wraps react-native, which node cannot parse; the gate's elements need no rendering here.
    for (const runtime of ["nativewind/jsx-dev-runtime", "nativewind/jsx-runtime"]) vi.doMock(runtime, () => ({ jsx: () => null, jsxs: () => null, jsxDEV: () => null, Fragment: Symbol.for("fragment") }));
    vi.doMock("./reader-table.tsx", () => ({ ReaderTable: () => null }));
    vi.doMock("./row-feet-probe.tsx", () => ({ RowFeetProbe: () => null }));
    vi.doMock("./table-keys.ts", () => ({ relayKeys: () => () => undefined }));
    vi.doMock("./table-canvas.native.tsx", () => ({ TableCanvas: () => null }));
    const kit = await import("../../ui/skia/skia-web.ts");
    const { TableCanvas } = await import("./table-canvas.tsx");
    expect(kit.useCanvasKit()).toBe("idle");
    // The memo wrapper's inner function is the gate; render it once as React would, then run the effects it asked for.
    const gate = (TableCanvas as unknown as { type: (props: object) => unknown }).type;
    gate({});
    effects.forEach((effect) => effect());
    effects.forEach((effect) => effect());
    await vi.waitFor(() => expect(loadCanvasKit).toHaveBeenCalledTimes(1));
    expect(kit.useCanvasKit()).not.toBe("idle");
  });
});
