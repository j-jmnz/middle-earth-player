import { describe, expect, it } from "vitest";

import { createImageCache } from "./backdrop-image.ts";

type Image = { key: string; disposed: boolean };

function setup(idleKept: number) {
  const rendered: string[] = [];
  const images: Image[] = [];
  const cache = createImageCache<Image>(
    (key) => {
      rendered.push(key);
      const image = { key, disposed: false };
      images.push(image);
      return Promise.resolve(image);
    },
    (image) => {
      image.disposed = true;
    },
    idleKept,
  );
  return { cache, rendered, images };
}

describe("the backdrop image cache", () => {
  it("renders a key once for every screen that shows it", async () => {
    const { cache, rendered } = setup(2);
    const one = cache.lease("dark|moon", "dark");
    const two = cache.lease("dark|moon", "dark");
    expect(rendered).toEqual(["dark|moon"]);
    expect(await one.image).toBe(await two.image);
  });

  it("keeps an image after its last screen leaves, up to the idle limit, longest idle first out", async () => {
    const { cache, images } = setup(1);
    for (const key of ["a", "b"]) {
      const lease = cache.lease(key, "dark");
      await lease.image;
      lease.release();
    }
    expect(images.map((image) => [image.key, image.disposed])).toEqual([
      ["a", true],
      ["b", false],
    ]);
    expect(cache.size()).toBe(1);
  });

  it("does not release an image a screen still shows", async () => {
    const { cache, images } = setup(0);
    const shown = cache.lease("a", "dark");
    await shown.image;
    const other = cache.lease("b", "dark");
    await other.image;
    other.release();
    expect(images.find((image) => image.key === "a")?.disposed).toBe(false);
    expect(images.find((image) => image.key === "b")?.disposed).toBe(true);
  });

  it("releases an image of another theme or size as soon as nothing shows it", async () => {
    const { cache, images } = setup(4);
    const dark = cache.lease("dark|moon", "dark|400x800");
    await dark.image;
    const light = cache.lease("light|moon", "light|400x800");
    await light.image;
    // The dark image is still shown: it goes when its screen leaves, not before.
    expect(images[0]?.disposed).toBe(false);
    dark.release();
    expect(images[0]?.disposed).toBe(true);
    expect(images[1]?.disposed).toBe(false);
    // An idle image of the old group goes at the change itself.
    light.release();
    const resized = cache.lease("light|moon|big", "light|800x400");
    await resized.image;
    expect(images[1]?.disposed).toBe(true);
  });

  it("releases an image whose render finishes after the entry was dropped", async () => {
    const late: { resolve: (image: Image) => void }[] = [];
    const disposed: string[] = [];
    const cache = createImageCache<Image>(
      (key) => new Promise((resolve) => late.push({ resolve: () => resolve({ key, disposed: false }) })),
      (image) => disposed.push(image.key),
      0,
    );
    const lease = cache.lease("a", "dark");
    lease.release();
    expect(cache.size()).toBe(0);
    late[0]?.resolve({ key: "a", disposed: false });
    expect(await lease.image).toBeNull();
    expect(disposed).toEqual(["a"]);
  });

  it("settles to null when the render fails, and a second release changes nothing", async () => {
    const cache = createImageCache<Image>(() => Promise.reject(new Error("no surface")), () => undefined, 1);
    const lease = cache.lease("a", "dark");
    expect(await lease.image).toBeNull();
    lease.release();
    lease.release();
    expect(cache.size()).toBe(1);
  });
});
