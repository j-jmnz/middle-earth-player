// The reader gate: a screen reader on, or Table as a list on Always, on any platform; never with neither.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useReaderMode, useScreenReader } from "./screen-reader.ts";
import { DEFAULT_SETTINGS, tableSettings } from "./table-settings.ts";

const phone = vi.hoisted(() => ({ os: "ios", screenReader: false }));

vi.mock("react-native", () => ({
  Platform: {
    get OS() {
      return phone.os;
    },
  },
  AccessibilityInfo: {
    isReduceMotionEnabled: () => Promise.resolve(false),
    isScreenReaderEnabled: () => Promise.resolve(phone.screenReader),
    addEventListener: () => ({ remove: () => undefined }),
  },
}));
// No renderer runs in node: the store hook answers with the snapshot, which the mocked store gives from `phone`.
vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  useSyncExternalStore: (_subscribe: unknown, snapshot: () => boolean) => snapshot(),
}));
vi.mock("./accessibility.ts", () => ({ accessibility: () => ({ screenReader: phone.screenReader }), subscribeAccessibility: () => () => undefined }));

beforeEach(() => {
  phone.os = "ios";
  phone.screenReader = false;
  tableSettings.getState().hydrate(DEFAULT_SETTINGS);
});

describe("useReaderMode with Table as a list", () => {
  it("is true on a phone with no reader on when the setting is Always, and the real reader still says no", () => {
    tableSettings.getState().update({ tableAsList: "always" });
    expect(useReaderMode()).toBe(true);
    phone.os = "android";
    expect(useReaderMode()).toBe(true);
    expect(useScreenReader()).toBe(false);
  });

  it("is false with the default, and true on the web (browser and desktop) when the setting is Always", () => {
    expect(useReaderMode()).toBe(false);
    phone.os = "web";
    expect(useReaderMode()).toBe(false);
    tableSettings.getState().update({ tableAsList: "always" });
    expect(useReaderMode()).toBe(true);
  });
});

describe("useReaderMode", () => {
  it("is false with no screen reader on", () => {
    expect(useReaderMode()).toBe(false);
    phone.os = "android";
    expect(useReaderMode()).toBe(false);
  });

  it("is true on iOS and Android with a screen reader on", () => {
    phone.screenReader = true;
    expect(useReaderMode()).toBe(true);
    phone.os = "android";
    expect(useReaderMode()).toBe(true);
  });

  it("is true on the web when the platform reports a screen reader (the store holds it false until the desktop shell sets it: accessibility.ts)", () => {
    phone.os = "web";
    phone.screenReader = true;
    expect(useScreenReader()).toBe(true);
    expect(useReaderMode()).toBe(true);
  });
});

// The development override Maestro's reader flow uses (.maestro/features/screen-reader.yaml): it needs a development build and the variable.
describe("useReaderMode with EXPO_PUBLIC_FORCE_READER", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("is true on a phone in a development build with the variable set to 1, with no screen reader on", () => {
    vi.stubGlobal("__DEV__", true);
    vi.stubEnv("EXPO_PUBLIC_FORCE_READER", "1");
    expect(useReaderMode()).toBe(true);
    phone.os = "android";
    expect(useReaderMode()).toBe(true);
    // The plain hook still answers what the phone's reader says.
    expect(useScreenReader()).toBe(false);
  });

  it("is false in a release build, whatever the variable says", () => {
    vi.stubGlobal("__DEV__", false);
    vi.stubEnv("EXPO_PUBLIC_FORCE_READER", "1");
    expect(useReaderMode()).toBe(false);
  });

  it("is false when the variable is not 1, and when the build has no __DEV__ at all", () => {
    vi.stubGlobal("__DEV__", true);
    vi.stubEnv("EXPO_PUBLIC_FORCE_READER", "0");
    expect(useReaderMode()).toBe(false);
    vi.stubEnv("EXPO_PUBLIC_FORCE_READER", "");
    expect(useReaderMode()).toBe(false);
    vi.unstubAllGlobals();
    vi.stubEnv("EXPO_PUBLIC_FORCE_READER", "1");
    expect(useReaderMode()).toBe(false);
  });

  it("is true on the web in a development build with the variable set", () => {
    vi.stubGlobal("__DEV__", true);
    vi.stubEnv("EXPO_PUBLIC_FORCE_READER", "1");
    phone.os = "web";
    expect(useReaderMode()).toBe(true);
  });
});
