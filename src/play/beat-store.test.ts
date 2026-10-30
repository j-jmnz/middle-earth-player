import { describe, expect, it } from "vitest";

import { beatIds, createBeats, setBeat } from "./beat-store.ts";

describe("the banner's beat", () => {
  it("rings the cards of the line and none once it is cleared", () => {
    const beats = createBeats();
    expect(beatIds(beats.getState().key).size).toBe(0);
    setBeat(beats, ["a", "b"]);
    expect([...beatIds(beats.getState().key)]).toEqual(["a", "b"]);
    setBeat(beats, []);
    expect(beats.getState().key).toBe("");
  });

  it("tells a subscriber only when the cards change", () => {
    const beats = createBeats();
    let told = 0;
    beats.subscribe(() => (told += 1));
    setBeat(beats, ["a"]);
    setBeat(beats, ["a"]);
    setBeat(beats, ["b"]);
    expect(told).toBe(2);
  });
});
