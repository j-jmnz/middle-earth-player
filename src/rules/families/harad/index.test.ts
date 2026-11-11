// Rules: mec112.setup-journey-to-the-cross-roads, rr.reveal, rr.engaged, rr.search, rr.lasting-effects, mec109.archery, rr.travel (data/rules/entries.json); ledger lines 144027:A:1, 144027:A:2, 144030:A:2, 144032:A:2, 144036:A:2, 144037:A:1, 144038:A:2, 144039:A:1, 144039:A:2.
// Journey to the Cross-roads' own mechanics: the Harad deck under The Cross-roads (the pile `harad`, its count as an amount and a condition, its empty deck as an unpayable Travel cost), the enemies facedown under The Black Gate
// (PlaceFacedownUnder, facedownUnder), the Pick filters lowestAttack and lowestThreat, the deck-only search and the lasting effect of a Trait that reaches the enemies that arrive later.
import { describe, expect, it } from "vitest";

import type { Effect, Instruction } from "../../../catalog/boundary.ts";
import { archeryTotal } from "../../combat/combat.ts";
import { resolveAmount, frameScope } from "../../interpret/amounts.ts";
import { holds } from "../../interpret/conditions.ts";
import { pickCandidates } from "../../interpret/pick.ts";
import { travelCostUnpayable } from "../../interpret/restrictions.ts";
import { searchable } from "../../interpret/search.ts";
import { pushEffectFrame } from "../../interpret/effect-frames.ts";
import { settle } from "../../engine/machine.ts";
import { cardMap, hero } from "../../core/test-fixture.ts";
import { definePrinted } from "../../core/printed.ts";
import { modifiedStat } from "../../core/keywords.ts";
import { pileOf } from "../../core/piles.ts";
import { moveCard, spawn } from "../../core/zones.ts";
import type { ScenarioState } from "../../core/state.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { deal, table } from "../wilderland/fixture.ts";

const CARDS = cardMap([
  hero("frodo", "lore"),
  hero("sam", "spirit"),
  definePrinted({ code: "stage", name: "Stage", type: "quest", questPoints: 20 }),
  definePrinted({ code: "gate", name: "The Black Gate", type: "objective" }),
  definePrinted({ code: "roads", name: "The Cross-roads", type: "location", threat: 9, questPoints: 20 }),
  definePrinted({ code: "man", name: "Man of Harad", type: "enemy", traits: ["Harad"], threat: 2, engagementCost: 30, attack: 3, defense: 1, health: 3, keywords: { surge: true, archery: 1 } }),
  definePrinted({ code: "soldier", name: "Haradrim Soldier", type: "enemy", traits: ["Harad"], threat: 1, engagementCost: 20, attack: 2, defense: 1, health: 3 }),
  definePrinted({ code: "orc", name: "Orc", type: "enemy", traits: ["Orc"], threat: 4, engagementCost: 10, attack: 1, defense: 1, health: 2 }),
  definePrinted({ code: "mist", name: "Mist", type: "treachery" }),
  definePrinted({ code: "sword", name: "Sword", type: "attachment" }),
]);

const FORCED_ENGAGED = (code: string, instructions: Instruction[]): Effect => ({ id: `${code}:forced:1`, cardCode: code, lines: [`${code}:A:1`], timing: "forced", trigger: "engaged", subject: "self", instructions });
const DISCARD = FORCED_ENGAGED("soldier", [{ verb: "DiscardRandomFromHand" }]);
const TRAVEL: Effect = { id: "roads:travel:1", cardCode: "roads", lines: ["roads:A:2"], timing: "travel", instructions: [{ verb: "AddFromPile", pile: "harad", to: "staging", reveal: true }] };
const LOSS: Effect = {
  id: "gate:triggered:1", cardCode: "gate", lines: ["gate:A:2"], timing: "triggered", trigger: "placedUnder", subject: { type: "enemy", control: "any" },
  condition: { kind: "facedownUnder", code: "gate", min: 2, players: true }, instructions: [{ verb: "LoseGame" }],
};
const ctxOf = (effects: readonly Effect[] = []): ReduceContext => ({ effects, cards: CARDS });

function run(state: ScenarioState, instruction: Instruction | readonly Instruction[], ctx: ReduceContext, sourceId = "none"): ScenarioState {
  const framed = pushEffectFrame(state, { frame: "whenRevealed", sourceId, actor: 0, peril: false, effectId: "fixture:whenRevealed:1", instructions: Array.isArray(instruction) ? instruction : [instruction], cancel: null, blockCancel: null }, []);
  return settle(framed, ctx, []);
}

// A table with the Harad deck dealt (top first) and The Black Gate in the staging area.
function withHarad(codes: readonly string[]): ScenarioState {
  const dealt = deal({ ...table(), piles: { haradDeck: [] } }, codes, { zone: "haradDeck" }).state;
  return spawn(dealt, "gate", { zone: "staging" }).state;
}

describe("the Harad deck (mec112.setup-journey-to-the-cross-roads)", () => {
  it("shuffles with the seed, and AddFromPile adds the top card to the staging area", () => {
    const state = withHarad(["man", "soldier", "orc", "man", "soldier", "man"]);
    const shuffled = run(state, { verb: "ShufflePile", pile: "harad" }, ctxOf());
    expect([...pileOf(shuffled, "haradDeck")].sort()).toEqual([...pileOf(state, "haradDeck")].sort());
    expect(pileOf(shuffled, "haradDeck")).not.toEqual(pileOf(state, "haradDeck"));
    const top = pileOf(shuffled, "haradDeck")[0] ?? "";
    const added = run(shuffled, { verb: "AddFromPile", pile: "harad", to: "staging" }, ctxOf());
    expect(added.staging).toContain(top);
    expect(pileOf(added, "haradDeck")).toHaveLength(5);
  });

  it("144068:B:1 reveals the top card: its Surge reveals another card from the encounter deck, and the card is staged", () => {
    const base = withHarad(["man", "soldier"]);
    const state = deal(base, ["mist", "orc"], { zone: "encounterDeck" }).state;
    const next = run(state, { verb: "AddFromPile", pile: "harad", to: "staging", reveal: true }, ctxOf());
    expect(next.staging.map((id) => next.cards[id]?.code)).toContain("man");
    // Surge: one more card is revealed from the encounter deck (a treachery here, discarded); the next one stays on top.
    expect(next.encounterDiscard.map((id) => next.cards[id]?.code)).toEqual(["mist"]);
    expect(next.encounterDeck.map((id) => next.cards[id]?.code)).toEqual(["orc"]);
    expect(pileOf(next, "haradDeck").map((id) => next.cards[id]?.code)).toEqual(["soldier"]);
  });

  it("144036:A:2 reveals the top card and puts it into play engaged with the actor, which has engaged: its Forced effect fires", () => {
    const state = spawn(withHarad(["soldier", "man"]), "mist", { zone: "hand", seat: 0 }).state;
    const next = run(state, { verb: "AddFromPile", pile: "harad", to: "engaged", reveal: true }, ctxOf([DISCARD]));
    expect(next.seats[0]?.engaged.map((id) => next.cards[id]?.code)).toEqual(["soldier"]);
    expect(next.seats[0]?.hand).toEqual([]);
    expect(next.cards[next.seats[0]?.engaged[0] ?? ""]?.face).toBe("up");
  });

  it("144030:A:2 reads the cards left as an amount and a condition; a game that did not deal the deck holds none", () => {
    const state = withHarad(["man", "soldier", "orc"]);
    const scope = frameScope(state, 0, null);
    expect(resolveAmount(state, { pile: "harad" }, scope, ctxOf())).toBe(3);
    expect(resolveAmount(state, { pile: "harad", negative: true }, scope, ctxOf())).toBe(-3);
    expect(holds(state, { kind: "pileHas", pile: "harad", min: 1 }, { actor: 0, sourceId: null, returned: 0 }, ctxOf())).toBe(true);
    expect(holds(state, { kind: "pileHas", pile: "harad", max: 0 }, { actor: 0, sourceId: null, returned: 0 }, ctxOf())).toBe(false);
    expect(holds(table(), { kind: "pileHas", pile: "harad", max: 0 }, { actor: 0, sourceId: null, returned: 0 }, ctxOf())).toBe(true);
    expect(resolveAmount(table(), { pile: "harad" }, frameScope(table(), 0, null), ctxOf())).toBe(0);
  });

  it("144032:A:2 cannot be paid with no card left in the Harad deck (rr.travel)", () => {
    const full = spawn(withHarad(["man"]), "roads", { zone: "staging" });
    expect(travelCostUnpayable(full.state, ctxOf([TRAVEL]), full.id)).toBe(false);
    const empty = spawn(withHarad([]), "roads", { zone: "staging" });
    expect(travelCostUnpayable(empty.state, ctxOf([TRAVEL]), empty.id)).toBe(true);
  });
});

describe("PlaceFacedownUnder and facedownUnder (144027:A:1, 144027:A:2)", () => {
  it("places an enemy facedown under the card in play with the code, out of play, its attachments discarded, and hears placedUnder", () => {
    const base = withHarad([]);
    const engaged = spawn(base, "soldier", { zone: "engaged", seat: 0 });
    const armed = spawn(engaged.state, "sword", { zone: "play", seat: 0 });
    const attached = { ...armed.state, cards: { ...armed.state.cards, [armed.id]: { ...armed.state.cards[armed.id]!, zone: "attached" as const, host: engaged.id } } };
    const gate = Object.values(attached.cards).find((card) => card.code === "gate")!;
    const state = { ...attached, cards: { ...attached.cards, [engaged.id]: { ...attached.cards[engaged.id]!, damage: 2 } } };
    const pick: Instruction = { verb: "Pick", pick: { type: "enemy", control: "any", engaged: "you" } };
    const placed = run(state, [pick, { verb: "PlaceFacedownUnder", code: "gate", target: "picked" }], ctxOf());
    expect(placed.cards[engaged.id]).toMatchObject({ zone: "under", host: gate.id, face: "down", damage: 0 });
    expect(placed.seats[0]?.engaged).toEqual([]);
  });

  it("changes nothing for a card not in play or with no such host in play", () => {
    const noGate = table();
    const enemy = spawn(noGate, "soldier", { zone: "staging" });
    const none = run({ ...enemy.state, staging: [enemy.id] }, { verb: "PlaceFacedownUnder", code: "gate", target: "self" }, ctxOf(), enemy.id);
    expect(none.cards[enemy.id]?.zone).toBe("staging");
  });

  it("loses the game when the cards under it reach min plus the number of players (here 2 + 1)", () => {
    let state = withHarad([]);
    const gate = Object.values(state.cards).find((card) => card.code === "gate")!;
    const enemies = ["soldier", "man", "soldier"].map((code) => {
      const made = spawn(state, code, { zone: "staging" });
      state = made.state;
      return made.id;
    });
    const placeFor = (current: ScenarioState, id: string): ScenarioState => run(current, { verb: "PlaceFacedownUnder", code: "gate", target: "self" }, ctxOf([LOSS]), id);
    // One player: the limit is 2 + 1 = 3 cards.
    state = placeFor(state, enemies[0]!);
    state = placeFor(state, enemies[1]!);
    expect(state.lost).toBeFalsy();
    expect(holds(state, { kind: "facedownUnder", code: "gate", min: 2, players: true }, { actor: 0, sourceId: null, returned: 0 }, ctxOf())).toBe(false);
    state = placeFor(state, enemies[2]!);
    expect(state.cards[enemies[2]!]).toMatchObject({ zone: "under", host: gate.id });
    expect(holds(state, { kind: "facedownUnder", code: "gate", min: 2, players: true }, { actor: 0, sourceId: null, returned: 0 }, ctxOf())).toBe(true);
    expect(holds(state, { kind: "facedownUnder", code: "gate", max: 2 }, { actor: 0, sourceId: null, returned: 0 }, ctxOf())).toBe(false);
    expect(state.lost).toBeTruthy();
  });

  it("144039:A:2 afterAttack waits for the attack in progress to end", () => {
    const state = withHarad([]);
    const enemy = spawn(state, "soldier", { zone: "engaged", seat: 0 });
    const attacked: ScenarioState = { ...enemy.state, pendingAttack: { enemyId: enemy.id, defenderId: null, undefended: false } as unknown as ScenarioState["pendingAttack"] };
    const next = run(attacked, { verb: "PlaceFacedownUnder", code: "gate", target: "self", afterAttack: true }, ctxOf(), enemy.id);
    expect(next.cards[enemy.id]?.zone).toBe("engaged");
    expect(next.pendingAttack?.after).toEqual([{ verb: "PlaceFacedownUnder", code: "gate", target: "self" }]);
  });
});

describe("the lowestAttack and lowestThreat filters (144036:A:2, 144038:A:2)", () => {
  it("keep only the Harad enemies tied on the lowest value, all of them when tied", () => {
    let state = table();
    for (const code of ["man", "soldier", "orc", "soldier"]) state = spawn(state, code, { zone: "staging" }).state;
    const staged = Object.values(state.cards).filter((card) => card.zone === "staging").map((card) => card.id);
    state = { ...state, staging: staged };
    const found = (spec: object) => pickCandidates(state, { type: "enemy", control: "any", trait: "Harad", stagingOnly: true, ...spec }, 0, [], null, ctxOf()).map((id) => state.cards[id]?.code);
    expect(found({})).toHaveLength(3);
    expect(found({ lowestThreat: true })).toEqual(["soldier", "soldier"]);
    expect(found({ lowestAttack: true })).toEqual(["soldier", "soldier"]);
    // The Orc has the highest Threat but is not a Harad enemy: it takes no part.
    expect(found({ lowestAttack: true, lowestThreat: true })).toEqual(["soldier", "soldier"]);
  });
});

describe("the deck-only search (144037:A:1)", () => {
  it("searches the encounter deck alone, not its discard pile, when deckOnly", () => {
    let state = table();
    state = spawn(state, "soldier", { zone: "encounterDiscard" }).state;
    expect(searchable(state, { trait: "Harad" }, ctxOf())).toHaveLength(1);
    expect(searchable(state, { trait: "Harad", deckOnly: true }, ctxOf())).toHaveLength(0);
    state = spawn(state, "man", { zone: "encounterDeck" }).state;
    expect(searchable(state, { trait: "Harad", deckOnly: true }, ctxOf())).toHaveLength(1);
    expect(holds(state, { kind: "searchable", trait: "Harad", deckOnly: true }, { actor: 0, sourceId: null, returned: 0 }, ctxOf())).toBe(true);
  });
});

describe("a lasting effect on a Trait's enemies (144029:A:1, 144039:A:1)", () => {
  it("reaches the Harad enemies that arrive later in the round, and no other enemy", () => {
    const source = spawn(table(), "mist", { zone: "staging" });
    const existing = spawn(source.state, "soldier", { zone: "staging" });
    const buff = run(existing.state, { verb: "ModifyStat", stat: "attack", amount: 1, until: "endOfRound", target: "enemies", trait: "Harad" }, ctxOf(), source.id);
    const later = spawn(buff, "soldier", { zone: "haradDeck" });
    const orc = spawn(later.state, "orc", { zone: "encounterDeck" });
    const arrived = moveCard(moveCard(orc.state, later.id, { zone: "staging" }), orc.id, { zone: "staging" });
    const attack = (id: string) => modifiedStat(arrived, arrived.cards[id]!, "attack", CARDS);
    expect(attack(existing.id)).toBe(3);
    expect(attack(later.id)).toBe(3);
    expect(attack(orc.id)).toBe(1);
  });

  it("adds a gained Archery to the printed one, for an enemy that arrives later too, and the effects are cumulative", () => {
    const source = spawn(table(), "mist", { zone: "staging" });
    const man = spawn(source.state, "man", { zone: "staging" });
    expect(archeryTotal(man.state, CARDS)).toBe(1);
    const buff = run(man.state, { verb: "ModifyStat", stat: "archery", amount: 2, until: "endOfRound", target: "enemies", trait: "Harad" }, ctxOf(), source.id);
    expect(archeryTotal(buff, CARDS)).toBe(3);
    const later = spawn(buff, "soldier", { zone: "staging" });
    expect(archeryTotal(later.state, CARDS)).toBe(5);
  });
});
