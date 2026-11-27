// The web app's test controls (src/ui/web/render-scale.ts): which drawing scale and whether the frame meter, from the address and the stored choice.
import { describe, expect, it } from "vitest";

import { blendsOff, chosenScale, errorLine, logText, meterChosen, meterLine, picturesHidden, picturesLine, secondLine, secondOf, summaryLine, type Second } from "./render-scale.ts";

describe("the web app's drawing scale", () => {
  it("takes the address's scale before the stored one", () => {
    expect(chosenScale("?scale=1", null, 2)).toBe(1);
    expect(chosenScale("?scale=1.5", "1", 2)).toBe(1.5);
    expect(chosenScale("", "1", 2)).toBe(1);
    expect(chosenScale("", null, 2)).toBeNull();
  });

  it("keeps the device's own for a scale that is off, too small, not under the device's, or no number", () => {
    expect(chosenScale("?scale=0", "1", 2)).toBeNull();
    expect(chosenScale("?scale=0.5", null, 2)).toBeNull();
    expect(chosenScale("?scale=2", null, 2)).toBeNull();
    expect(chosenScale("?scale=1", null, 1)).toBeNull();
    expect(chosenScale("?scale=fast", null, 2)).toBeNull();
  });

  it("shows the meter when asked, and the address turns a stored one off", () => {
    expect(meterChosen("?fps=1", null)).toBe(true);
    expect(meterChosen("", "1")).toBe(true);
    expect(meterChosen("?fps=0", "1")).toBe(false);
    expect(meterChosen("", null)).toBe(false);
  });

  it("says the frame rate, the worst frame and the scale", () => {
    expect(meterLine([16, 16, 18, 50], 2)).toBe("40 fps  worst 50 ms  x2");
    expect(meterLine([], 1.5)).toBe("-- fps  x1.5");
  });

  it("says an error's name, message and first frames without the site's address", () => {
    const error = new Error("The object is in an invalid state.");
    error.name = "InvalidStateError";
    error.stack = "f@https://site.example/_expo/static/js/web/entry-abc.js:1:2\ng@https://site.example/_expo/static/js/web/table-def.js:3:4";
    expect(errorLine(error)).toBe("InvalidStateError: The object is in an invalid state.\nf@entry-abc.js:1:2\ng@table-def.js:3:4");
    expect(errorLine("plain")).toBe("plain");
  });

  it("keeps a second as its rate, its longest frame, its slow frames, its late time and its rounded work", () => {
    expect(secondOf([16, 16, 18, 50], { raf: [12.4, 4], tex: [140.5, 6] })).toEqual({ fps: 40, worst: 50, slow: 1, late: 35, work: { raf: [12, 4], tex: [141, 6] } });
    expect(secondOf([])).toEqual({ fps: 0, worst: 0, slow: 0, late: 0, work: {} });
  });

  it("sums the log up by its slowest second, and lists each second with the work it had, in one order", () => {
    const log: Second[] = [
      { fps: 60, worst: 18, slow: 0, late: 2, work: { raf: [40, 60] } },
      { fps: 24, worst: 90, slow: 7, late: 610, work: { shader: [400, 3], raf: [30, 24], tap: [0, 1] } },
      { fps: 48, worst: 40, slow: 2, late: 200, work: {} },
    ];
    expect(summaryLine(log)).toBe("last 3 s: lowest 24 fps  mean 44  worst 90 ms  slow frames 9");
    expect(summaryLine([])).toBe("no log yet");
    expect(secondLine(log[1]!)).toBe("24 fps  worst 90 ms  late 610  raf 30/24  tap 0/1  shader 400/3");
    expect(secondLine({ fps: 20, worst: 70, slow: 9, late: 700, work: { sched: [640, 90], raf: [3, 20], "ev.pointermove": [120, 60] } })).toBe("20 fps  worst 70 ms  late 700  raf 3/20  ev.pointermove 120/60  sched 640/90");
    expect(logText(log, 1.5).split("\n")).toEqual([
      "x1.5  last 3 s: lowest 24 fps  mean 44  worst 90 ms  slow frames 9",
      " 1  60 fps  worst 18 ms  late 2  raf 40/60",
      " 2  24 fps  worst 90 ms  late 610  raf 30/24  tap 0/1  shader 400/3",
      " 3  48 fps  worst 40 ms  late 200",
    ]);
  });
});

describe("the pictures control", () => {
  it("leaves the pictures out for pics=0, and keeps the stored choice when the address has none", () => {
    expect(picturesHidden("?pics=0", null)).toBe(true);
    expect(picturesHidden("?pics=1", "1")).toBe(false);
    expect(picturesHidden("", "1")).toBe(true);
    expect(picturesHidden("", null)).toBe(false);
  });
  it("counts the loaded pictures and their megapixels", () => {
    expect(picturesLine([{ naturalWidth: 879, naturalHeight: 1200 }, { naturalWidth: 1542, naturalHeight: 473 }, { naturalWidth: 0, naturalHeight: 0 }])).toBe("pics 2 2 MP");
    expect(picturesLine([])).toBe("pics 0 0 MP");
  });
});

describe("the blends control", () => {
  it("turns the blends off for blend=0, and keeps the stored choice when the address has none", () => {
    expect(blendsOff("?blend=0", null)).toBe(true);
    expect(blendsOff("?blend=1", "1")).toBe(false);
    expect(blendsOff("", "1")).toBe(true);
    expect(blendsOff("", null)).toBe(false);
  });
});
