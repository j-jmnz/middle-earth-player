// The reader gate: a screen reader on a phone, never on the web (whose react-native-web always says yes) and never with no reader.
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useReaderMode, useScreenReader } from "./screen-reader.ts";

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
  useSyncExternalStore: () => phone.screenReader,
}));

beforeEach(() => {
  phone.os = "ios";
  phone.screenReader = false;
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

  it("is false on the web even though the web build reports a screen reader", () => {
    phone.os = "web";
    phone.screenReader = true;
    expect(useScreenReader()).toBe(true);
    expect(useReaderMode()).toBe(false);
  });
});
