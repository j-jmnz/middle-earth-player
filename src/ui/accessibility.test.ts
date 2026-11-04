// The app's one accessibility store: two AccessibilityInfo listeners however many hooks read it, started by the first reader and removed
// with the last, and the phone's current values read when it starts.
import { beforeEach, describe, expect, it, vi } from "vitest";

import { accessibility, subscribeAccessibility } from "./accessibility.ts";

const phone = vi.hoisted(() => ({
  reduceMotion: false,
  screenReader: false,
  handlers: new Map<string, (enabled: boolean) => void>(),
  added: 0,
  removed: 0,
}));
vi.mock("react-native", () => ({
  AccessibilityInfo: {
    isReduceMotionEnabled: () => Promise.resolve(phone.reduceMotion),
    isScreenReaderEnabled: () => Promise.resolve(phone.screenReader),
    addEventListener: (name: string, handler: (enabled: boolean) => void) => {
      phone.handlers.set(name, handler);
      phone.added += 1;
      return {
        remove: () => {
          phone.handlers.delete(name);
          phone.removed += 1;
        },
      };
    },
  },
}));

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  phone.reduceMotion = false;
  phone.screenReader = false;
  phone.added = 0;
  phone.removed = 0;
  phone.handlers.clear();
});

describe("the accessibility store", () => {
  it("opens two listeners for any number of readers, and closes them with the last", () => {
    const stops = [subscribeAccessibility(() => undefined), subscribeAccessibility(() => undefined), subscribeAccessibility(() => undefined)];
    expect(phone.added).toBe(2);
    stops[0]?.();
    stops[1]?.();
    expect(phone.removed).toBe(0);
    stops[2]?.();
    expect(phone.removed).toBe(2);
    expect(phone.handlers.size).toBe(0);
  });

  it("reads the phone's values when it starts, and follows them live", async () => {
    phone.reduceMotion = true;
    const heard: boolean[] = [];
    const stop = subscribeAccessibility(() => heard.push(accessibility().screenReader));
    await settle();
    expect(accessibility().reduceMotion).toBe(true);
    phone.handlers.get("screenReaderChanged")?.(true);
    expect(accessibility().screenReader).toBe(true);
    phone.handlers.get("reduceMotionChanged")?.(false);
    expect(accessibility().reduceMotion).toBe(false);
    expect(heard).toEqual([false, true, true]);
    stop();
  });

  it("tells a reader once for a value that did not change", async () => {
    let told = 0;
    const stop = subscribeAccessibility(() => (told += 1));
    await settle();
    const before = accessibility();
    phone.handlers.get("screenReaderChanged")?.(accessibility().screenReader);
    expect(accessibility()).toBe(before);
    expect(told).toBe(1);
    stop();
  });
});
