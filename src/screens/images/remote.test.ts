import { afterEach, describe, expect, it, vi } from "vitest";

// The phone's release build and the desktop build fetch no card picture; a development build and the browser dev build do (docs/brief.md, Card images).
async function nativeGate(dev: boolean) {
  vi.resetModules();
  vi.stubGlobal("__DEV__", dev);
  return import("./remote.native");
}

describe("remote pictures", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("gives a release phone build no URL to fetch", async () => {
    const gate = await nativeGate(false);
    expect(gate.REMOTE_PICTURES).toBe(false);
    expect(gate.remotePictureUrl("/bundles/cards/01001.png")).toBeNull();
    expect(gate.remotePictureUrl("https://s3.amazonaws.com/hallofbeorn-resources/Images/Cards/Core-Set/Aragorn.jpg")).toBeNull();
  });

  it("lets a development phone build download what it did not bundle", async () => {
    const gate = await nativeGate(true);
    expect(gate.remotePictureUrl("/bundles/cards/01001.png")).toBe("https://ringsdb.com/bundles/cards/01001.png");
  });

  it("lets the browser dev build, which bundles no pictures, show the remote file", async () => {
    vi.resetModules();
    vi.stubEnv("EXPO_PUBLIC_DESKTOP", "");
    const web = await import("./remote");
    expect(web.REMOTE_PICTURES).toBe(true);
    expect(web.remotePictureUrl("/bundles/cards/01001.png")).toBe("https://ringsdb.com/bundles/cards/01001.png");
  });

  it("gives the desktop build, which bundles every picture, no URL to fetch", async () => {
    vi.resetModules();
    vi.stubEnv("EXPO_PUBLIC_DESKTOP", "1");
    const desktop = await import("./remote");
    expect(desktop.REMOTE_PICTURES).toBe(false);
    expect(desktop.remotePictureUrl("/bundles/cards/01001.png")).toBeNull();
    expect(desktop.remotePictureUrl("https://s3.amazonaws.com/hallofbeorn-resources/Images/Cards/Core-Set/Aragorn.jpg")).toBeNull();
  });
});
