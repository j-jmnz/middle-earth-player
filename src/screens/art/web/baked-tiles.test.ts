// The web backdrop's baked tiles (baked-tiles.ts): one bake for each texture and size, null until it is done, and the SVG itself when the page cannot bake.
import { describe, expect, it } from "vitest";

import { tileStore } from "./baked-tiles.ts";

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("the web backdrop's baked tiles", () => {
  it("bakes a tile once, gives null until it is done, and tells its listeners", async () => {
    const bakes: string[] = [];
    const store = tileStore(async (svg, width, height) => {
      bakes.push(`${svg} ${width}x${height}`);
      return "blob:tile";
    });
    let told = 0;
    const stop = store.subscribe(() => void (told += 1));
    expect(store.read("<svg/>", 900, 900)).toBeNull();
    expect(store.read("<svg/>", 900, 900)).toBeNull();
    await settle();
    expect(store.read("<svg/>", 900, 900)).toBe('url("blob:tile")');
    expect(bakes).toEqual(["<svg/> 900x900"]);
    expect(told).toBe(1);
    // Another size is another tile.
    expect(store.read("<svg/>", 450, 450)).toBeNull();
    stop();
    await settle();
    expect(bakes).toHaveLength(2);
    expect(told).toBe(1);
  });

  it("uses the SVG itself when the page cannot bake it", async () => {
    const store = tileStore(() => Promise.reject(new Error("tainted")));
    store.read("<svg a='1'/>", 10, 10);
    await settle();
    expect(store.read("<svg a='1'/>", 10, 10)).toBe(`url("data:image/svg+xml,${encodeURIComponent("<svg a='1'/>")}")`);
  });
});
