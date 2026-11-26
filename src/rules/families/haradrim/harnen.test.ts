// Rules: rr.travel, rr.cannot, rr.in-play-and-out-of-play, hrd.immune-to-player-card-effects (data/rules/entries.json); ledger lines 17039:A:1, 17039:A:2, 17039:A:3, 17039:A:4, 17050:A:1, 17054:B:1. River Harnen: the travel gate of 20 progress on the stage, the Travel text
// that reveals a card for each player and the stage 4B that cannot be defeated while it is in play.
import { describe, expect, it } from "vitest";

import { idOf, opened, run as runInstruction, type Layout } from "../../../../test/harness/scene-kit.ts";
import { pickCandidates } from "../../interpret/pick.ts";
import { restricted, travelBlocked } from "../../interpret/restrictions.ts";
import { spawn } from "../../core/zones.ts";
import { flagged } from "../../core/state.ts";
import { advancedTo, CHIEFTAIN, prepared, raceTable, record } from "./race-kit.ts";

const HARNEN = "17039";
const table = (layout: Layout = {}) => raceTable({ stage: "17050", setAside: [], staging: [HARNEN], ...layout });

describe("17039:A:1 River Harnen is immune to player card effects", () => {
  it("a player card cannot choose it among the locations in the staging area, an encounter card can", () => {
    const made = table({ progress: 20, staging: [HARNEN, "17040"] });
    const state = opened(made).state;
    const harnen = idOf(state, HARNEN);
    const spec = { type: "location", control: "any", staging: true } as const;
    expect(pickCandidates(state, spec, 0, [], idOf(state, "dh1"), made.ctx)).toEqual([idOf(state, "17040")]);
    const encounter = spawn(state, "16052", { zone: "staging" });
    expect(pickCandidates(encounter.state, spec, 0, [], encounter.id, made.ctx)).toContain(harnen);
  });
});

describe("17039:A:2 the players cannot travel to River Harnen unless there are 20 progress on stage 4B", () => {
  it("with fewer than 20 progress the location cannot be traveled to, with 20 or more it can", () => {
    const low = table({ progress: 19 });
    expect(travelBlocked(opened(low).state, low.ctx, idOf(low.state, HARNEN))).toBe(true);
    const full = table({ progress: 20 });
    expect(travelBlocked(opened(full).state, full.ctx, idOf(full.state, HARNEN))).toBe(false);
    const more = table({ progress: 22 });
    expect(travelBlocked(opened(more).state, more.ctx, idOf(more.state, HARNEN))).toBe(false);
  });

  it("only River Harnen is held back: another location in the staging area can be traveled to at once", () => {
    const made = table({ progress: 3, staging: [HARNEN, "17040"] });
    expect(travelBlocked(opened(made).state, made.ctx, idOf(made.state, "17040"))).toBe(false);
  });
});

describe("17039:A:3 Travel: reveal 1 encounter card per player", () => {
  it("one encounter card is revealed for each player still in the game, one after the other", () => {
    const made = table({ seats: 2, progress: 20, deck: ["16065", "16065", "16065"] });
    const done = record(made, opened(made).state, "17039:travel:1", idOf(made.state, HARNEN), "travel");
    expect(done.encounterDeck).toHaveLength(1);
    const solo = table({ seats: 1, progress: 20, deck: ["16065", "16065", "16065"] });
    expect(record(solo, opened(solo).state, "17039:travel:1", idOf(solo.state, HARNEN), "travel").encounterDeck).toHaveLength(2);
  });
});

describe("17039:A:4 stage 4B cannot be defeated while River Harnen is in play", () => {
  it("River Harnen in the staging area or as the active location holds the stage back", () => {
    const made = table({ progress: 20 });
    const state = opened(made).state;
    expect(restricted(state, made.ctx, "advance").some((rule) => rule.sourceId === idOf(state, HARNEN))).toBe(true);
    const active = raceTable({ stage: "17050", setAside: [], active: HARNEN, progress: 20 });
    expect(restricted(opened(active).state, active.ctx, "advance").some((rule) => rule.sourceId === idOf(active.state, HARNEN))).toBe(true);
  });

  it("with River Harnen out of play (explored) nothing holds the stage back", () => {
    const made = table({ progress: 20 });
    const gone = runInstruction(made, opened(made).state, { verb: "Discard", target: { kind: "self" } }, { sourceId: idOf(made.state, HARNEN) });
    expect(restricted(gone, made.ctx, "advance").some((rule) => rule.what === "advance" && gone.cards[rule.sourceId]?.code === HARNEN)).toBe(false);
  });
});

describe("17054:B:1 the Chieftain takes no damage while River Harnen is in the staging area", () => {
  const atFourD = (layout: Layout) => {
    const first = prepared({ stage: "17050", ...layout });
    return { made: first.made, state: opened(first.made, advancedTo(first.made, first.state, 4)).state };
  };

  it("River Harnen in the staging area bars his damage; as the active location, or with the stage not 4D, it does not", () => {
    const staged = atFourD({ staging: [HARNEN] });
    const chieftain = idOf(staged.state, CHIEFTAIN);
    expect(staged.state.orcs?.number).toBe(4);
    expect(flagged(staged.state, chieftain, "cannotTakeDamage")).toBe(true);
    const active = atFourD({ active: HARNEN });
    expect(flagged(active.state, idOf(active.state, CHIEFTAIN), "cannotTakeDamage")).toBe(false);
    const none = atFourD({});
    expect(flagged(none.state, idOf(none.state, CHIEFTAIN), "cannotTakeDamage")).toBe(false);
  });
});
