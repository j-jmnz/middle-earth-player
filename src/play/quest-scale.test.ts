import { describe, expect, it } from "vitest";

import { meterFractions, scaleLabel, scaleMarker, stagingWord, type QuestScale } from "./quest-scale.ts";
import { dockReadout, type Readout } from "./readout.ts";

describe("scaleMarker", () => {
  it("says Ahead in green when willpower beats the threat, Short in red when it falls short, Even otherwise", () => {
    expect(scaleMarker(2)).toEqual({ value: "+2", word: "Ahead", tone: "ok" });
    expect(scaleMarker(-1)).toEqual({ value: "−1", word: "Short", tone: "danger" });
    expect(scaleMarker(0)).toEqual({ value: "0", word: "Even", tone: "muted" });
  });
});

describe("scaleLabel", () => {
  const live: QuestScale = { threat: 4, willpower: 6, delta: 2, live: true, seat: null };

  it("says the threat in staging, the willpower committed and how far ahead, short or even", () => {
    expect(scaleLabel(live)).toBe("threat in staging 4, willpower committed 6, 2 ahead");
    expect(scaleLabel({ ...live, willpower: 1, delta: -3 })).toBe("threat in staging 4, willpower committed 1, 3 short");
    expect(scaleLabel({ ...live, willpower: 4, delta: 0 })).toBe("threat in staging 4, willpower committed 4, even");
  });

  it("names the seat once stages are separate, and says only the threat outside the Quest phase", () => {
    expect(scaleLabel({ ...live, seat: 1 })).toBe("Player 2's threat in staging 4, willpower committed 6, 2 ahead");
    expect(scaleLabel({ ...live, live: false })).toBe("Quest scale, for the Quest phase. threat in staging 4");
    expect(scaleLabel({ ...live, live: false, seat: 0 })).toBe("Quest scale, for the Quest phase. Player 1's threat in staging 4");
  });

  it("labels the threat bar with the seat once stages are separate", () => {
    expect(stagingWord(live)).toBe("staging");
    expect(stagingWord({ ...live, seat: 1 })).toBe("P2 staging");
  });
});

describe("dockReadout", () => {
  const quest: Readout = { kind: "quest", stats: [{ icon: "willpower", value: 1, word: "Willpower" }, { icon: "threat", value: 4, word: "Threat" }], result: "Threat +3 if nothing changes; threat reaches 50: the game is lost" };

  it("keeps the quest readout's result line and drops its numbers while the meter shows", () => {
    expect(dockReadout(quest, true)).toEqual({ ...quest, stats: [] });
    expect(dockReadout({ ...quest, result: "Staging reveals 1 card next. Ready after this: 2" }, true)?.result).toBe("Staging reveals 1 card next. Ready after this: 2");
  });

  it("draws nothing when the meter shows and the readout has no result", () => {
    expect(dockReadout({ ...quest, result: null }, true)).toBeNull();
  });

  it("leaves a quest readout whole when the meter is not showing, and every other readout whole", () => {
    expect(dockReadout(quest, false)).toBe(quest);
    const attack: Readout = { kind: "attack", stats: quest.stats, result: "2 damage" };
    expect(dockReadout(attack, true)).toBe(attack);
    expect(dockReadout(null, true)).toBeNull();
  });
});

const meter = (threat: number, willpower: number, live = true): QuestScale => ({ threat, willpower, delta: willpower - threat, live, seat: null });

describe("meterFractions", () => {
  it("sizes both bars over the larger value, and the threat line at the threat's height", () => {
    expect(meterFractions(meter(4, 8))).toEqual({ threat: 0.5, willpower: 1, line: 0.5 });
    expect(meterFractions(meter(6, 3))).toEqual({ threat: 1, willpower: 0.5, line: 1 });
  });

  it("draws two zeros empty and rests the willpower bar outside the Quest phase", () => {
    expect(meterFractions(meter(0, 0))).toEqual({ threat: 0, willpower: 0, line: 0 });
    expect(meterFractions(meter(4, 8, false))).toEqual({ threat: 0.5, willpower: 0, line: 0.5 });
  });
});
