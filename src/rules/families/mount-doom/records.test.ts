import { describe, expect, it } from "vitest";

import { AUTHORED_EFFECTS } from "../../../effects/authored/return-of-the-king/mount-doom.ts";
import { AUTHORED_EFFECTS as CAMPAIGN_CARDS } from "../../../effects/authored/return-of-the-king/the-return-of-the-king.ts";
import { doRefresh } from "../../engine/refresh.ts";
import { settle } from "../../engine/machine.ts";
import { runInstruction } from "../../interpret/interpret.ts";
import { pushEffectFrame } from "../../interpret/effect-frames.ts";
import { definePrinted } from "../../core/printed.ts";
import type { EngineStep } from "../../core/intents.ts";
import { revealNow } from "../../windows/frames.ts";
import { spawn } from "../../core/zones.ts";
import { hero, table, treachery, recordsOf } from "../defense/table.ts";
import { STOP } from "./stop.ts";

// Rules: mec113.fortitude-tests, rr.step-7-3, rr.surge, mec113.immune-to-player-card-effects, rr.active-location (data/rules/entries.json); ledger lines 146042:A:1, 146079:A:1, 146079:A:2, 146075:B:2, 146077:A:1, 146076:A:1.
// The records of Mount Doom's cards on a small table: the flags, the campaign card's tokens and the verbs the family and the campaign family add.

const records = [...AUTHORED_EFFECTS, ...CAMPAIGN_CARDS];
const location = (code: string, stats: Partial<Parameters<typeof definePrinted>[0]> = {}) => definePrinted({ code, name: code, type: "location", threat: 1, questPoints: 3, ...stats });

describe("The Tower of Barad-dûr (146042:A:1)", () => {
  function refreshed(staged: boolean) {
    const tower = definePrinted({ code: "146042", name: "The Tower of Barad-dûr", type: "objective" });
    const base = table({ cards: [hero("a"), tower], effects: recordsOf(records, "146042"), heroes: [{ code: "a" }], staging: staged ? [{ code: "146042" }] : [] });
    const state = settle({ ...base.state, window: null }, base.ctx, []);
    return { before: state.seats[0]?.threat ?? 0, after: doRefresh(state, base.ctx, []).seats[0]?.threat ?? 0 };
  }

  it("keeps the players from raising their threat at the end of the refresh phase while it is in the staging area", () => {
    const { before, after } = refreshed(true);
    expect(after).toBe(before);
  });

  it("leaves the raise of the refresh phase alone when it is not in play", () => {
    const { before, after } = refreshed(false);
    expect(after).toBe(before + 1);
  });
});

describe("Mount Doom's campaign card (146079:A:1, 146079:A:2)", () => {
  const doom = () => {
    const base = table({ cards: [hero("a"), definePrinted({ code: "146079", name: "Mount Doom", type: "campaign" })], effects: recordsOf(records, "146079"), heroes: [{ code: "a" }] });
    const placed = spawn(base.state, "146079", { zone: "campaign" });
    return { ...base, state: placed.state, id: placed.id };
  };
  const place = (amount: number) => ({ verb: "PlaceTokensOnCampaignCard", amount }) as const;
  const tokens = (state: ReturnType<typeof doom>["state"], id: string) => state.cards[id]?.resources ?? 0;

  it("places the tokens on the campaign card kept in the game, and none when the amount is 0 or no campaign card is in the game", () => {
    const { state, ctx, id } = doom();
    expect(tokens(runInstruction(state, place(3), { seat: 0, sourceId: null }, ctx, []), id)).toBe(3);
    const bare = table({ cards: [hero("a")], effects: [], heroes: [{ code: "a" }] });
    expect(runInstruction(bare.state, place(3), { seat: 0, sourceId: null }, bare.ctx, [])).toBe(bare.state);
  });

  // The Forced effect of the end of the round, run as its own frame with STOP behind it.
  function endOfRound(run: ReturnType<typeof doom>, state: ReturnType<typeof doom>["state"]) {
    const record = records.find((effect) => effect.id === "146079:forced:1");
    const pushed = pushEffectFrame({ ...state, window: null }, { frame: "forced", sourceId: run.id, actor: 0, peril: false, effectId: "146079:forced:1", instructions: [...(record?.instructions ?? []), STOP], cancel: null, blockCancel: null }, []);
    return settle(pushed, run.ctx, []);
  }

  it("takes one token off at the end of each round and loses the game when none is left (X tokens last X rounds)", () => {
    const run = doom();
    const held = runInstruction(run.state, place(2), { seat: 0, sourceId: null }, run.ctx, []);
    const first = endOfRound(run, held);
    expect(tokens(first, run.id)).toBe(1);
    expect(first.lost).toBe(false);
    const second = endOfRound(run, first);
    expect(tokens(second, run.id)).toBe(0);
    expect(second.lost).toBe(true);
  });

  it("loses at the first end of round with no tokens (no record of The Black Gate)", () => {
    const run = doom();
    expect(endOfRound(run, run.state).lost).toBe(true);
  });
});

describe("The first treachery each quest phase (146075:B:2)", () => {
  // The quest stage with the marker is in play; each treachery of `order` is revealed in turn from the top of the deck (a Peril or Surge card reveals the next one itself).
  function reveals(order: readonly string[], phase: "Quest" | "Encounter" = "Quest", count = 1) {
    const cards = [hero("a"), definePrinted({ code: "146075", name: "The Land of Mordor", type: "quest" }), treachery("t1"), treachery("t2"), treachery("t3")];
    const base = table({ cards, effects: recordsOf(records, "146075"), heroes: [{ code: "a" }], encounter: order });
    const steps: EngineStep[] = [];
    let state = settle(spawn({ ...base.state, phase }, "146075", { zone: "questStage" }).state, base.ctx, steps);
    for (let index = 0; index < count; index += 1) state = revealNow(state, 0, base.ctx, steps);
    return { ...base, state, steps };
  }
  const revealed = (steps: readonly EngineStep[]) => steps.filter((step) => step.kind === "reveal").length;

  it("gives the first treachery revealed in the quest phase surge: the next card is revealed after it, and that one is not marked", () => {
    const run = reveals(["t1", "t2", "t3"]);
    expect(revealed(run.steps)).toBe(2);
    const first = Object.values(run.state.cards).find((card) => card.code === "t1");
    expect(run.state.modifiers.filter((modifier) => modifier.stat === "immuneToPlayerCards").map((modifier) => modifier.instanceId)).toEqual([first?.id]);
  });

  it("marks only the first: a second reveal in the same quest phase draws one card", () => {
    const run = reveals(["t1", "t2", "t3"], "Quest", 2);
    expect(revealed(run.steps)).toBe(3);
  });

  it("does not mark a treachery revealed in another phase", () => {
    const run = reveals(["t1", "t2"], "Encounter");
    expect(revealed(run.steps)).toBe(1);
  });

  it("is not read while no stage holds the marker", () => {
    const cards = [hero("a"), treachery("t1"), treachery("t2")];
    const base = table({ cards, effects: [], heroes: [{ code: "a" }], encounter: ["t1", "t2"] });
    const steps: EngineStep[] = [];
    revealNow({ ...base.state, phase: "Quest" }, 0, base.ctx, steps);
    expect(revealed(steps)).toBe(1);
  });
});

describe("DiscardUntilEnemies with cardType location (146077:A:1)", () => {
  it("discards from the top until a location for each player is found and adds each to the staging area, leaving the other cards in the discard pile", () => {
    const base = table({ cards: [hero("a"), treachery("t1"), location("l1"), location("l2")], effects: [], heroes: [{ code: "a" }], encounter: ["t1", "l1", "t1", "l2"] });
    const done = runInstruction({ ...base.state, window: null }, { verb: "DiscardUntilEnemies", perPlayer: 1, to: "staging", cardType: "location" }, { seat: 0, sourceId: null }, base.ctx, []);
    expect(done.staging.map((id) => done.cards[id]?.code)).toEqual(["l1"]);
    expect(done.encounterDiscard.map((id) => done.cards[id]?.code)).toEqual(["t1"]);
    expect(done.encounterDeck).toHaveLength(2);
  });

  it("stops at the end of the deck", () => {
    const base = table({ cards: [hero("a"), treachery("t1"), location("l1")], effects: [], heroes: [{ code: "a" }], seatCount: 2, encounter: ["l1", "t1"] });
    const done = runInstruction({ ...base.state, window: null }, { verb: "DiscardUntilEnemies", perPlayer: 1, to: "staging", cardType: "location" }, { seat: 0, sourceId: null }, base.ctx, []);
    expect(done.staging.map((id) => done.cards[id]?.code)).toEqual(["l1"]);
    expect(done.encounterDeck).toHaveLength(0);
  });
});

describe("TravelTo unlessActive (146076:A:1)", () => {
  const travel = { verb: "TravelTo", target: "picked", unlessActive: true } as const;

  it("makes the location in the staging area the active location when none is active", () => {
    const base = table({ cards: [hero("a"), location("road")], effects: [], heroes: [{ code: "a" }], staging: [{ code: "road" }] });
    const picked = { ...base.state, window: null, stack: [] };
    const next = runInstruction(picked, { ...travel, target: "self" }, { seat: 0, sourceId: base.ids.road ?? null }, base.ctx, []);
    expect(next.activeLocation).toBe(base.ids.road);
  });

  it("leaves another active location where it is, and the location in the staging area", () => {
    const base = table({ cards: [hero("a"), location("road"), location("other")], effects: [], heroes: [{ code: "a" }], staging: [{ code: "road" }, { code: "other" }] });
    const active = { ...base.state, window: null, activeLocation: base.ids.other ?? null };
    const next = runInstruction(active, { ...travel, target: "self" }, { seat: 0, sourceId: base.ids.road ?? null }, base.ctx, []);
    expect(next.activeLocation).toBe(base.ids.other);
  });
});
