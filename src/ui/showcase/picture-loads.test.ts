import { describe, expect, it } from "vitest";

import { holdPicture, pictureSnapshot, subscribePictures } from "./picture-loads.ts";

describe("the showcase's picture count", () => {
  it("is busy while a picture is held and idle once every hold is released, with a new snapshot", () => {
    const before = pictureSnapshot();
    expect(before).toBeGreaterThanOrEqual(0);
    const first = holdPicture("a");
    const second = holdPicture("b");
    expect(pictureSnapshot()).toBe(-1);
    first();
    expect(pictureSnapshot()).toBe(-1);
    second();
    const after = pictureSnapshot();
    expect(after).toBeGreaterThan(before);
  });

  it("ignores a second hold of a held key and a second release, and tells its listeners of each change", () => {
    let heard = 0;
    const stop = subscribePictures(() => {
      heard += 1;
    });
    const release = holdPicture("c");
    const again = holdPicture("c");
    again();
    expect(pictureSnapshot()).toBe(-1);
    release();
    release();
    stop();
    expect(heard).toBe(2);
    expect(pictureSnapshot()).toBeGreaterThanOrEqual(0);
  });
});
