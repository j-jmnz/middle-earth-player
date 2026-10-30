import { describe, expect, it } from "vitest";

import { scaleMarker } from "./quest-scale.ts";
import { dockReadout, type Readout } from "./readout.ts";

describe("scaleMarker", () => {
  it("says Ahead in green when willpower beats the threat, Short in red when it falls short, Even otherwise", () => {
    expect(scaleMarker(2)).toEqual({ value: "+2", word: "Ahead", tone: "ok" });
    expect(scaleMarker(-1)).toEqual({ value: "−1", word: "Short", tone: "danger" });
    expect(scaleMarker(0)).toEqual({ value: "0", word: "Even", tone: "muted" });
  });
});

describe("dockReadout", () => {
  const quest: Readout = { kind: "quest", stats: [{ icon: "willpower", value: 1, word: "Willpower" }, { icon: "threat", value: 4, word: "Threat" }], result: "Threat +3 if nothing changes; threat reaches 50: the game is lost" };

  it("keeps the quest readout's result line and drops its numbers while the scale shows", () => {
    expect(dockReadout(quest, true)).toEqual({ ...quest, stats: [] });
    expect(dockReadout({ ...quest, result: "Staging reveals 1 card next. Ready after this: 2" }, true)?.result).toBe("Staging reveals 1 card next. Ready after this: 2");
  });

  it("draws nothing when the scale shows and the readout has no result", () => {
    expect(dockReadout({ ...quest, result: null }, true)).toBeNull();
  });

  it("leaves a quest readout whole when the scale is not showing, and every other readout whole", () => {
    expect(dockReadout(quest, false)).toBe(quest);
    const attack: Readout = { kind: "attack", stats: quest.stats, result: "2 damage" };
    expect(dockReadout(attack, true)).toBe(attack);
    expect(dockReadout(null, true)).toBeNull();
  });
});
