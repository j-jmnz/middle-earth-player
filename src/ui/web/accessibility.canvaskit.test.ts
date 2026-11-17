// The web's accessibility store (accessibility.canvaskit.ts): the phone's store as it is, with the desktop shell's screen-reader flag on top when the preload is there.
import { afterEach, describe, expect, it, vi } from "vitest";

import { DESKTOP_API } from "../../../desktop/identity.ts";
import { accessibility, subscribeAccessibility } from "./accessibility.canvaskit.ts";

const base = vi.hoisted(() => ({ state: { reduceMotion: false, screenReader: false, boldText: false, reduceTransparency: false, increaseContrast: false }, listeners: new Set<() => void>() }));
vi.mock("../accessibility", () => ({
  accessibility: () => base.state,
  subscribeAccessibility: (listener: () => void) => {
    base.listeners.add(listener);
    return () => base.listeners.delete(listener);
  },
}));

type Api = { enabled: boolean; listeners: Set<(enabled: boolean) => void> };
function installShell(): Api {
  const api: Api = { enabled: false, listeners: new Set() };
  (globalThis as Record<string, unknown>)[DESKTOP_API] = {
    accessibilitySupportEnabled: () => api.enabled,
    onAccessibilitySupportChanged: (listener: (enabled: boolean) => void) => {
      api.listeners.add(listener);
      return () => api.listeners.delete(listener);
    },
  };
  return api;
}

afterEach(() => {
  delete (globalThis as Record<string, unknown>)[DESKTOP_API];
  base.listeners.clear();
  base.state = { ...base.state, screenReader: false };
});

describe("accessibility on the web", () => {
  it("is the desktop shell's object name", () => {
    expect(DESKTOP_API).toBe("middleEarthDesktop");
  });

  it("is the phone's store, the same object, in a browser with no shell", () => {
    expect(accessibility()).toBe(base.state);
    const stop = subscribeAccessibility(() => undefined);
    expect(base.listeners.size).toBe(1);
    stop();
    expect(base.listeners.size).toBe(0);
  });

  it("keeps the flag off when the store says a screen reader is on, which react-native-web does whatever is running", () => {
    base.state = { ...base.state, screenReader: true };
    const off = accessibility();
    expect(off).toEqual({ ...base.state, screenReader: false });
    expect(accessibility()).toBe(off);
    const shell = installShell();
    expect(accessibility()).toBe(off);
    shell.enabled = true;
    expect(accessibility()).toBe(base.state);
  });

  it("keeps the flag off while the shell says no, and turns it on when the shell says yes, as one stable object", () => {
    const shell = installShell();
    expect(accessibility()).toBe(base.state);
    shell.enabled = true;
    const on = accessibility();
    expect(on).toEqual({ ...base.state, screenReader: true });
    expect(accessibility()).toBe(on);
    base.state = { ...base.state, reduceMotion: true };
    const changed = accessibility();
    expect(changed).not.toBe(on);
    expect(changed).toMatchObject({ reduceMotion: true, screenReader: true });
    shell.enabled = false;
    expect(accessibility()).toBe(base.state);
  });

  it("tells a listener when the shell's flag changes, and stops listening with the last reader", () => {
    const shell = installShell();
    const calls: number[] = [];
    const stop = subscribeAccessibility(() => calls.push(1));
    for (const listener of [...shell.listeners]) listener(true);
    expect(calls).toEqual([1]);
    stop();
    expect(shell.listeners.size).toBe(0);
    expect(base.listeners.size).toBe(0);
  });

  it("ignores an object that is not the shell's", () => {
    (globalThis as Record<string, unknown>)[DESKTOP_API] = { accessibilitySupportEnabled: () => true };
    expect(accessibility()).toBe(base.state);
  });
});
