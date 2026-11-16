// The web's reader gate (screen-reader.canvaskit.ts): a screen reader the desktop shell reports, Table as a list on Always, or a development build forcing it; never with none.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_SETTINGS, tableSettings } from "../table-settings.ts";
import { useReaderMode, useScreenReader } from "./screen-reader.canvaskit.ts";

const web = vi.hoisted(() => ({ screenReader: false }));

vi.mock("react-native", () => ({
  Platform: { OS: "web" },
  AccessibilityInfo: { isReduceMotionEnabled: () => Promise.resolve(false), isScreenReaderEnabled: () => Promise.resolve(true), addEventListener: () => ({ remove: () => undefined }) },
}));
// No renderer runs in node: the store hook answers with the snapshot, which the mocked store gives from `web`.
vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  useSyncExternalStore: (_subscribe: unknown, snapshot: () => boolean) => snapshot(),
}));
vi.mock("./accessibility.canvaskit.ts", () => ({ accessibility: () => ({ screenReader: web.screenReader }), subscribeAccessibility: () => () => undefined }));

beforeEach(() => {
  web.screenReader = false;
  tableSettings.getState().hydrate(DEFAULT_SETTINGS);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("useReaderMode on the web", () => {
  it("is false with the default setting and no reader", () => {
    expect(useReaderMode()).toBe(false);
  });

  it("is true when Table as a list is Always, and the real reader still says no", () => {
    tableSettings.getState().update({ tableAsList: "always" });
    expect(useReaderMode()).toBe(true);
    expect(useScreenReader()).toBe(false);
  });

  it("is true when the platform reports a screen reader (the store holds it false until the desktop shell sets it)", () => {
    web.screenReader = true;
    expect(useScreenReader()).toBe(true);
    expect(useReaderMode()).toBe(true);
  });

  it("is true in a development build with EXPO_PUBLIC_FORCE_READER set, and false in a release build", () => {
    vi.stubEnv("EXPO_PUBLIC_FORCE_READER", "1");
    vi.stubGlobal("__DEV__", true);
    expect(useReaderMode()).toBe(true);
    vi.stubGlobal("__DEV__", false);
    expect(useReaderMode()).toBe(false);
  });
});
