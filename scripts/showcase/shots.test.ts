import { readdirSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { orientationOf, SHOTS, turnFor } from "./shots.ts";

const FLOWS = path.resolve(import.meta.dirname, "..", "..", ".maestro", "showcase");
const shot = (id: string) => SHOTS.find((item) => item.id === id) ?? SHOTS[0]!;

describe("the showcase's shots", () => {
  it("are one flow each in .maestro/showcase, every one taken on both devices", () => {
    expect(SHOTS.map((item) => `${item.id}.yaml`).sort()).toEqual(readdirSync(FLOWS).sort());
    for (const item of SHOTS) expect(item.devices, item.id).toEqual(["iphone", "ipad"]);
  });

  it("lie landscape on the iPad, and on the iPhone only at the table", () => {
    expect(orientationOf("table-board", "iphone")).toBe("landscape");
    expect(orientationOf("table-board", "ipad")).toBe("landscape");
    expect(orientationOf("deck", "ipad")).toBe("landscape");
    expect(orientationOf("deck", "iphone")).toBe("portrait");
  });

  it("turn a capture that came out the other way a quarter turn, and leave one that did not", () => {
    expect(turnFor(shot("deck"), "iphone", 1206, 2622, false)).toBe(0);
    expect(turnFor(shot("deck"), "ipad", 2752, 2064, false)).toBe(0);
    expect(turnFor(shot("deck"), "ipad", 2064, 2752, false)).toBe(90);
    expect(turnFor(shot("table-board"), "iphone", 1206, 2622, true)).toBe(270);
  });
});
