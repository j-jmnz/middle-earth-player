// The app's one accessibility store: six AccessibilityInfo listeners however many hooks read it, started by the first reader and removed
// with the last, and the phone's current values read when it starts.
import { beforeEach, describe, expect, it, vi } from "vitest";

import { accessibility, subscribeAccessibility } from "./accessibility.ts";

const phone = vi.hoisted(() => ({
  reduceMotion: false,
  screenReader: false,
  boldText: false,
  reduceTransparency: false,
  darker: false,
  highText: false,
  handlers: new Map<string, (enabled: boolean) => void>(),
  added: 0,
  removed: 0,
  os: "ios",
}));
vi.mock("react-native", () => ({
  Platform: {
    get OS() {
      return phone.os;
    },
  },
  AccessibilityInfo: {
    isReduceMotionEnabled: () => Promise.resolve(phone.reduceMotion),
    isScreenReaderEnabled: () => Promise.resolve(phone.screenReader),
    isBoldTextEnabled: () => Promise.resolve(phone.boldText),
    isReduceTransparencyEnabled: () => Promise.resolve(phone.reduceTransparency),
    isDarkerSystemColorsEnabled: () => Promise.resolve(phone.darker),
    isHighTextContrastEnabled: () => Promise.resolve(phone.highText),
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
  phone.boldText = false;
  phone.reduceTransparency = false;
  phone.darker = false;
  phone.highText = false;
  phone.added = 0;
  phone.removed = 0;
  phone.os = "ios";
  phone.handlers.clear();
});

describe("the accessibility store", () => {
  it("never reports a screen reader on the web, where react-native-web says yes whatever is running", async () => {
    phone.os = "web";
    phone.screenReader = true;
    const stop = subscribeAccessibility(() => undefined);
    await settle();
    expect(accessibility().screenReader).toBe(false);
    expect(phone.handlers.has("screenReaderChanged")).toBe(false);
    stop();
  });

  it("opens six listeners for any number of readers, and closes them with the last", () => {
    const stops = [subscribeAccessibility(() => undefined), subscribeAccessibility(() => undefined), subscribeAccessibility(() => undefined)];
    expect(phone.added).toBe(6);
    stops[0]?.();
    stops[1]?.();
    expect(phone.removed).toBe(0);
    stops[2]?.();
    expect(phone.removed).toBe(6);
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

  it("reads Bold Text, Reduce Transparency and Increase Contrast from either platform's source, and follows them", async () => {
    phone.boldText = true;
    phone.highText = true;
    const stop = subscribeAccessibility(() => undefined);
    await settle();
    expect(accessibility()).toMatchObject({ boldText: true, reduceTransparency: false, increaseContrast: true });
    phone.handlers.get("reduceTransparencyChanged")?.(true);
    phone.handlers.get("boldTextChanged")?.(false);
    phone.handlers.get("highTextContrastChanged")?.(false);
    expect(accessibility()).toMatchObject({ boldText: false, reduceTransparency: true, increaseContrast: false });
    phone.handlers.get("darkerSystemColorsChanged")?.(true);
    expect(accessibility().increaseContrast).toBe(true);
    stop();
  });

  it("sets Increase Contrast from both answers on every start, so a stale true does not survive a restart", async () => {
    phone.darker = true;
    let stop = subscribeAccessibility(() => undefined);
    await settle();
    expect(accessibility().increaseContrast).toBe(true);
    stop();
    phone.darker = false;
    stop = subscribeAccessibility(() => undefined);
    await settle();
    expect(accessibility().increaseContrast).toBe(false);
    stop();
  });
});
