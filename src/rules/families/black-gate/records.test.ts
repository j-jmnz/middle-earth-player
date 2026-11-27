import { describe, expect, it } from "vitest";

import { AUTHORED_EFFECTS } from "../../../effects/authored/return-of-the-king/the-black-gate-opens.ts";
import { AUTHORED_EFFECTS as CAMPAIGN_CARDS } from "../../../effects/authored/return-of-the-king/the-return-of-the-king.ts";
import { pushEffectFrame } from "../../interpret/effect-frames.ts";
import { settle } from "../../engine/machine.ts";
import { definePrinted } from "../../core/printed.ts";
import type { ScenarioState } from "../../core/state.ts";
import { spawn } from "../../core/zones.ts";
import { hero, recordsOf, send, table, treachery } from "../defense/table.ts";

// Rules: mec113.saga-staging-rules, rr.defending-player, faq.enemy-attacks-outside-combat (data/rules/entries.json); ledger lines 146039:A:2, 146041:A:3.
// The records of The Black Gate Opens' cards, on a small table.

const records = [...AUTHORED_EFFECTS, ...CAMPAIGN_CARDS];
const mouth = definePrinted({ code: "146031", name: "The Mouth of Sauron", type: "enemy", attack: 6, defense: 5, health: 11, threat: 4, engagementCost: 99, isUnique: true });
// A plain enemy beside the Mouth keeps the optional engagement window open: the Mouth cannot leave the staging area, so it is never offered (rr.cannot).
const foe = definePrinted({ code: "foe", name: "Foe", type: "enemy", attack: 1, defense: 1, health: 1, threat: 1, engagementCost: 50 });
const rage = definePrinted({ code: "146039", name: "Rage Filled Him", type: "treachery" });

describe("Rage Filled Him (146039:A:2)", () => {
  function reveal(health: number) {
    const base = table({ cards: [hero("a", { health }), hero("b", { health }), mouth, foe, rage, treachery("x")], effects: recordsOf(records, "146039", "146031"), heroes: [{ code: "a" }, { code: "b" }], staging: [{ code: "146031" }, { code: "foe" }] });
    const placed = { ...base, state: { ...base.state, window: null } };
    const effect = recordsOf(records, "146039").find((record) => record.timing === "whenRevealed");
    const pushed = pushEffectFrame(placed.state, { frame: "whenRevealed", sourceId: null, actor: 0, peril: false, effectId: effect?.id ?? "", instructions: effect?.instructions ?? [], cancel: null, blockCancel: null }, []);
    return { ...base, state: settle(pushed, base.ctx, []) };
  }

  it("raises the revealing player's threat by 4 when the Mouth's attack destroys a character", () => {
    const { state, ctx, ids } = reveal(2);
    const before = state.seats[0]?.threat ?? 0;
    const done = settle(send(state, { type: "Undefended", heroId: ids.a ?? "" }, ctx), ctx, []);
    expect(done.seats[0]?.threat).toBe(before + 4);
  });

  it("raises nothing when the attack destroys no character", () => {
    const { state, ctx, ids } = reveal(20);
    const before = state.seats[0]?.threat ?? 0;
    const done = settle(send(state, { type: "Undefended", heroId: ids.a ?? "" }, ctx), ctx, []);
    expect(done.seats[0]?.threat).toBe(before);
  });
});

// 146072:B:1, the Embassy from the Dark Tower, on one player: the pairs by cost and Threat, the first player's choice for each, the play at no cost and the clean-up.
describe("the Embassy from the Dark Tower (146072:B:1)", () => {
  const ally = (code: string, cost: number) => definePrinted({ code, name: code, type: "ally", sphere: "tactics", cost, willpower: 1, attack: 1, defense: 1, health: 3 });
  const foe = (code: string, threat: number) => definePrinted({ code, name: code, type: "enemy", threat, attack: 2, defense: 1, health: 3, engagementCost: 30 });
  const cards = [hero("a"), ally("p1", 2), ally("p2", 3), ally("p3", 0), ally("p4", 1), ally("p5", 5), foe("orc", 2), foe("troll", 4), definePrinted({ code: "mist", name: "mist", type: "treachery" }), definePrinted({ code: "marsh", name: "marsh", type: "location", threat: 3, questPoints: 2 })];

  function setup(deck: readonly string[], encounter: readonly string[]) {
    const base = table({ cards, effects: recordsOf(records, "146072"), heroes: [{ code: "a" }], encounter });
    let state = base.state;
    for (const code of deck) state = spawn(state, code, { zone: "deck", seat: 0 }).state;
    const effect = recordsOf(records, "146072").find((record) => record.timing === "whenRevealed");
    const pushed = pushEffectFrame({ ...state, window: null }, { frame: "whenRevealed", sourceId: null, actor: 0, peril: false, effectId: effect?.id ?? "", instructions: effect?.instructions ?? [], cancel: null, blockCancel: null }, []);
    return { ...base, state: settle(pushed, base.ctx, []) };
  }
  const codes = (state: ScenarioState, ids: readonly string[]) => ids.map((id) => state.cards[id]?.code);

  it("places four player cards and four encounter cards faceup and pairs each player card, highest cost first, with the highest Threat card left", () => {
    const { state } = setup(["p1", "p2", "p3", "p4", "p5"], ["orc", "troll", "mist", "marsh"]);
    expect(state.window).toMatchObject({ kind: "choose" });
    const pairs = state.embassy?.pairs.map((pair) => [state.cards[pair.player]?.code, state.cards[pair.encounter]?.code]);
    expect(pairs).toEqual([["p2", "troll"], ["p1", "marsh"], ["p4", "orc"], ["p3", "mist"]]);
    // The fifth card stays in the deck; the first four lie out of it.
    expect(state.seats[0]?.deck.map((id) => state.cards[id]?.code)).toEqual(["p5"]);
    expect(state.embassy?.at).toBe(1);
  });

  it("discards both cards of a pair, or reveals the encounter card and plays the player card at no cost; the Embassy is gone at the end", () => {
    const { state: first, ctx } = setup(["p1", "p2", "p3", "p4", "p5"], ["orc", "troll", "mist", "marsh"]);
    expect(first.window).toMatchObject({ kind: "choose", options: ["discard", "play"] });
    // Play the first pair: the Troll is revealed into the staging area and the cost-3 ally enters play.
    let state = send(first, { type: "Choose", optionId: "play" }, ctx);
    for (let guard = 0; guard < 12 && state.window?.kind === "choose"; guard += 1) state = send(state, { type: "Choose", optionId: "discard" }, ctx);
    expect(state.embassy).toBeUndefined();
    expect(codes(state, state.staging)).toContain("troll");
    expect(codes(state, state.seats[0]?.play ?? [])).toEqual(["p2"]);
    expect(codes(state, state.seats[0]?.discard ?? []).sort()).toEqual(["p1", "p3", "p4"]);
    expect(codes(state, state.encounterDiscard).sort()).toEqual(["marsh", "mist", "orc"]);
  });

  it("discards a pair without asking when its player card cannot be played at no cost (an event with no record), and asks for the next", () => {
    const event = definePrinted({ code: "ev", name: "ev", type: "event", sphere: "lore", cost: 9 });
    const base = table({ cards: [...cards, event], effects: recordsOf(records, "146072"), heroes: [{ code: "a" }], encounter: ["orc", "troll", "mist", "marsh"] });
    let state = base.state;
    for (const code of ["ev", "p2", "p3", "p4"]) state = spawn(state, code, { zone: "deck", seat: 0 }).state;
    const effect = recordsOf(records, "146072").find((record) => record.timing === "whenRevealed");
    const pushed = pushEffectFrame({ ...state, window: null }, { frame: "whenRevealed", sourceId: null, actor: 0, peril: false, effectId: effect?.id ?? "", instructions: effect?.instructions ?? [], cancel: null, blockCancel: null }, []);
    const next = settle(pushed, base.ctx, []);
    expect(next.window).toMatchObject({ kind: "choose", options: ["discard", "play"] });
    expect(next.embassy?.at).toBe(2);
    expect(codes(next, next.seats[0]?.discard ?? [])).toEqual(["ev"]);
    expect(codes(next, next.encounterDiscard)).toEqual(["troll"]);
  });
});
