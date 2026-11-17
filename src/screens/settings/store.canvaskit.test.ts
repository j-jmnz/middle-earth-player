// The desktop's settings binding (store.canvaskit.ts): a first launch starts at the step the window suits and stores it; a stored size is kept.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("react-native", () => ({ Dimensions: { get: () => ({ width: 1920, height: 1080 }) } }));

const stored = vi.hoisted(() => ({ written: [] as unknown[], row: null as unknown }));

// The phone's binding, reduced to what this file relies on: it writes every change of the store back.
vi.mock("./store", async () => {
  const { tableSettings } = await import("../../ui/table-settings");
  return {
    readTableSettings: () => ({ uiScale: "medium" }),
    writeTableSettings: () => undefined,
    bindTableSettings: () => tableSettings.subscribe((state) => stored.written.push(state.settings.uiScale)),
  };
});

// The select chain store.canvaskit.ts reads the stored row through.
const user = { select: () => ({ from: () => ({ where: () => ({ get: () => (stored.row === null ? undefined : { value: stored.row }) }) }) }) };

const { bindTableSettings } = await import("./store.canvaskit");

beforeEach(() => {
  stored.written.length = 0;
  vi.stubEnv("EXPO_PUBLIC_DESKTOP", "1");
});

afterEach(() => {
  stored.row = null;
  vi.unstubAllEnvs();
});

describe("bindTableSettings on the desktop", () => {
  it("sets and so stores the window's size on a first launch", () => {
    const unbind = bindTableSettings(user as never, () => undefined);
    expect(stored.written).toEqual(["large"]);
    unbind();
  });

  it("leaves a stored size, and does nothing off the desktop build", () => {
    stored.row = { uiScale: "small" };
    bindTableSettings(user as never, () => undefined)();
    stored.row = null;
    vi.stubEnv("EXPO_PUBLIC_DESKTOP", "0");
    bindTableSettings(user as never, () => undefined)();
    expect(stored.written).toEqual([]);
  });
});
