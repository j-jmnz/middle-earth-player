import { afterEach, describe, expect, it, vi } from "vitest";

// The phone's release build fetches no card picture; a development build and the web build do (docs/brief.md, Card images).
async function nativeGate(dev: boolean) {
  vi.resetModules();
  vi.stubGlobal("__DEV__", dev);
  return import("./remote.native");
}

describe("remote pictures", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
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

  it("lets the web build, which bundles no pictures, show the remote file", async () => {
    const web = await import("./remote");
    expect(web.REMOTE_PICTURES).toBe(true);
    expect(web.remotePictureUrl("/bundles/cards/01001.png")).toBe("https://ringsdb.com/bundles/cards/01001.png");
  });
});
