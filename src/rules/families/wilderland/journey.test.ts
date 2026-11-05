// Rules: emce.treasure, emce.campaign-pool-encounter, emce.evil-creatures-deck, rr.cancel, rr.damage, rr.guarded (data/rules/entries.json); ledger lines 120165:A:3, 12166:A:2, 12167:A:2, 18018:A:1, 18023:A:1, 18026:A:1, 18066:B:3, 18069:A:2.
// The verbs, flags, amount and pick filters Journey Up the Anduin adds to the wilderland family, on fixture cards.
import { describe, expect, it } from "vitest";

import type { Effect, Instruction } from "../../../catalog/boundary.ts";
import { cardMap } from "../../core/test-fixture.ts";
import { ruleCause } from "../../core/cause.ts";
import { placeDamage } from "../../core/keywords.ts";
import { definePrinted } from "../../core/printed.ts";
import { resolveAmount } from "../../interpret/amounts.ts";
import { pickCandidates } from "../../interpret/pick.ts";
import { settle } from "../../engine/machine.ts";
import { pushEffectFrame } from "../../interpret/effect-frames.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { updateCard, type ScenarioState } from "../../core/state.ts";
import { spawn } from "../../core/zones.ts";
import { damageShield } from "./shield.ts";
import { CARDS, ctxOf, marker, table } from "./fixture.ts";

const cards = cardMap([
  ...CARDS.values(),
  definePrinted({ code: "lost", name: "Lost", type: "treachery" }),
  definePrinted({ code: "unique", name: "Unique", type: "enemy", isUnique: true, threat: 1, engagementCost: 10, attack: 1, defense: 1, health: 1 }),
  definePrinted({ code: "curse", name: "Curse", type: "treachery", campaignKind: "burden", burdenSet: "x", backType: "encounter" }),
  definePrinted({ code: "haldan", name: "Haldan", type: "objective", willpower: 2, attack: 3, defense: 1, health: 4 }),
  definePrinted({ code: "axe", name: "Axe", type: "treasure", campaignKind: "treasure" }),
  definePrinted({ code: "village", name: "Village", type: "location", threat: 4, questPoints: 4 }),
]);

function frame(state: ScenarioState, sourceId: string, instructions: Instruction[], effects: readonly Effect[] = [], seat = 0): { state: ScenarioState; ctx: ReduceContext } {
  const ctx: ReduceContext = { effects, cards };
  const pushed = pushEffectFrame(state, { frame: "whenRevealed", sourceId, actor: seat, peril: false, effectId: "x:whenRevealed:1", instructions, cancel: null, blockCancel: null }, []);
  return { state: settle(pushed, ctx, []), ctx };
}

describe("SetAsideDiscardForPool (12167:A:2)", () => {
  it("sets aside the topmost card that is not unique, an objective or a burden, and tells the Resolution to add a copy of it", () => {
    let state = table();
    for (const code of ["orc", "unique", "curse", "sign"]) state = spawn(state, code, { zone: "encounterDiscard" }).state;
    const source = spawn(state, "mist", { zone: "staging" });
    const ran = frame(source.state, source.id, [{ verb: "SetAsideDiscardForPool", exclude: ["unique", "objective", "burden"] }]);
    const left = ran.state.encounterDiscard.map((id) => ran.state.cards[id]?.code);
    expect(left).toEqual(["unique", "curse", "sign"]);
    expect(ran.state.setAside.map((id) => ran.state.cards[id]?.code)).toEqual(["orc"]);
    expect(ran.state.resolution).toEqual([{ verb: "AddEncounterToPool", codes: ["orc"] }]);
  });

  it("does nothing when no card qualifies", () => {
    const state = spawn(table(), "unique", { zone: "encounterDiscard" }).state;
    const source = spawn(state, "mist", { zone: "staging" });
    const ran = frame(source.state, source.id, [{ verb: "SetAsideDiscardForPool", exclude: ["unique"] }]);
    expect(ran.state.resolution).toEqual([]);
    expect(ran.state.setAside).toEqual([]);
  });
});

describe("the damageShield flag (12166:A:2)", () => {
  it("cancels its points of the next damage placed on the card and is spent", () => {
    const state = table();
    const hero = state.seats[0]?.heroes[0] ?? "";
    const shielded = { ...state, modifiers: [{ instanceId: hero, sourceId: hero, stat: "damageShield" as const, amount: 1, until: "endOfRound" as const }] };
    expect(damageShield(shielded, hero, 3)).toMatchObject({ amount: 2, state: { modifiers: [] } });
    expect(damageShield(state, hero, 3).amount).toBe(3);
    const placed = placeDamage(shielded, hero, 1, cards, [], "combat", ruleCause("rr.damage"));
    expect(placed.cards[hero]?.damage).toBe(0);
    expect(placed.modifiers).toEqual([]);
  });
});

describe("the amount mostPerPlayer (18023:A:1)", () => {
  it("is the most cards matching the pick that any one player controls", () => {
    let state = table(2);
    state = spawn(state, "frodo", { zone: "heroes", seat: 1 }).state;
    const scope = { actor: 0, sourceId: null, returned: 0 };
    const ctx = ctxOf([]);
    expect(resolveAmount(state, { mostPerPlayer: { type: "hero", control: "you" } }, scope, ctx)).toBe(2);
    expect(resolveAmount(state, { mostPerPlayer: { type: "hero", control: "you" }, times: 3, plus: 1 }, scope, ctx)).toBe(7);
  });
});

describe("AddFromPile with attachSource (18018:A:1) and FlipOver (18069:A:2)", () => {
  it("adds the top Evil Creatures card to the staging area, attaches the source to it and marks it picked", () => {
    let state = table();
    state = { ...state, piles: { evilCreaturesDeck: [], evilCreaturesDiscard: [] } };
    const top = spawn(state, "ec1", { zone: "evilCreaturesDeck" });
    const source = spawn(top.state, "mist", { zone: "staging" });
    const ran = frame(source.state, source.id, [{ verb: "AddFromPile", pile: "evilCreatures", to: "staging", attachSource: true }]);
    expect(ran.state.cards[top.id]?.zone).toBe("staging");
    expect(ran.state.cards[source.id]).toMatchObject({ zone: "attached", host: top.id });
  });

  it("turns the source over to the card it names, in the staging area, guarded by the picked enemy", () => {
    let state = table();
    state = { ...state, piles: { evilCreaturesDeck: [], evilCreaturesDiscard: [] } };
    const top = spawn(state, "ec1", { zone: "evilCreaturesDeck" });
    const village = spawn(top.state, "village", { zone: "encounterDiscard" });
    const ran = frame(village.state, village.id, [{ verb: "AddFromPile", pile: "evilCreatures", to: "staging" }, { verb: "FlipOver", into: "haldan", guardedBy: "picked" }]);
    expect(ran.state.cards[village.id]).toMatchObject({ code: "haldan", zone: "staging", other: "village", face: "up" });
    expect(ran.state.cards[top.id]).toMatchObject({ host: village.id, guard: true });
  });
});

describe("AddSourceToHandOfMost (18026:A:1)", () => {
  it("goes to the hand of the player with the most cards, skipping a player with a copy, and to nobody when each holds one", () => {
    let state = table(2);
    for (const [code, seat] of [["blessing", 0], ["blessing", 1], ["blessing", 1]] as const) state = spawn(state, code, { zone: "hand", seat }).state;
    const source = spawn(state, "lost", { zone: "staging" });
    const ran = frame(source.state, source.id, [{ verb: "AddSourceToHandOfMost" }]);
    expect(ran.state.cards[source.id]).toMatchObject({ zone: "hand", controller: 1 });
    const copy = spawn(source.state, "lost", { zone: "hand", seat: 1 });
    const second = frame(copy.state, source.id, [{ verb: "AddSourceToHandOfMost" }]);
    expect(second.state.cards[source.id]).toMatchObject({ zone: "hand", controller: 0 });
    const both = frame(spawn(copy.state, "lost", { zone: "hand", seat: 0 }).state, source.id, [{ verb: "AddSourceToHandOfMost" }]);
    expect(both.state.cards[source.id]?.zone).toBe("staging");
  });
});

describe("the pick filters fromDeck and Undiscardable (18066:B:3, 18026:A:1)", () => {
  it("fromDeck keeps the cards dealt into the Evil Creatures deck, wherever they lie", () => {
    let state = table();
    const marked = spawn(state, "ec1", { zone: "staging" });
    const plain = spawn(marked.state, "ec2", { zone: "staging" });
    state = updateCard(plain.state, marked.id, { deck: "evilCreatures" });
    const found = pickCandidates(state, { type: "enemy", control: "any", staging: true, fromDeck: "evilCreatures" }, 0, [], null, ctxOf([]));
    expect(found).toEqual([marked.id]);
  });

  it("a hand pick that is discarded leaves out a card with the Undiscardable marker when a player card makes it; an encounter card's pick does not, and a pick that gives or swaps still offers it", () => {
    const ctx: ReduceContext = { effects: [marker("lost", { verb: "Undiscardable" })], cards };
    let state = table();
    state = spawn(state, "lost", { zone: "hand", seat: 0 }).state;
    state = spawn(state, "blessing", { zone: "hand", seat: 0 }).state;
    const staging = spawn(state, "mist", { zone: "staging" });
    const spec = { type: "card", control: "you", from: "hand" } as const;
    const codes = (source: string | null, discards: boolean | undefined) =>
      pickCandidates(staging.state, spec, 0, [], source, ctx, undefined, undefined, false, { discards }).map((id) => staging.state.cards[id]?.code).sort();
    const hero = staging.state.seats[0]?.heroes[0] ?? null;
    expect(codes(hero, true)).toEqual(["blessing"]);
    expect(codes(staging.id, true)).toEqual(["blessing", "lost"]);
    expect(codes(hero, false)).toEqual(["blessing", "lost"]);
    expect(pickCandidates(staging.state, { ...spec, discarded: true }, 0, [], hero, ctx).map((id) => staging.state.cards[id]?.code)).toEqual(["blessing"]);
  });

  it("a Pick followed by DiscardPicked in a player card's effect never discards it, and a Pick for GivePicked offers it", () => {
    const ctx: ReduceContext = { effects: [marker("lost", { verb: "Undiscardable" })], cards };
    let state = table();
    state = spawn(state, "lost", { zone: "hand", seat: 0 }).state;
    const hero = state.seats[0]?.heroes[0] ?? "";
    const pick = { verb: "Pick", pick: { type: "card", control: "you", from: "hand" } } as const;
    const discarded = frame(state, hero, [pick, { verb: "DiscardPicked" }], ctx.effects);
    expect(discarded.state.seats[0]?.hand).toHaveLength(1);
    const each = frame(state, hero, [{ verb: "Each", pick: pick.pick, instructions: [{ verb: "DiscardPicked" }] }], ctx.effects);
    expect(each.state.seats[0]?.hand).toHaveLength(1);
    const cost = frame(state, hero, [{ verb: "DiscardFromHand", amount: 1 }], ctx.effects);
    expect(cost.state.seats[0]?.hand).toHaveLength(1);
    // The same hand pick, chosen for GivePicked, is offered both cards (08032).
    const withBlessing = spawn(state, "blessing", { zone: "hand", seat: 0 }).state;
    const give = frame(withBlessing, hero, [{ verb: "Each", pick: pick.pick, upTo: 1, instructions: [{ verb: "GivePicked" }] }], ctx.effects);
    const offered = give.state.window?.kind === "choose" ? give.state.window.options.flatMap((id) => give.state.cards[id]?.code ?? []).sort() : [];
    expect(offered).toEqual(["blessing", "lost"]);
    const dropped = frame(withBlessing, hero, [{ verb: "Each", pick: pick.pick, upTo: 1, instructions: [{ verb: "DiscardPicked" }] }], ctx.effects);
    const kept = dropped.state.window?.kind === "choose" ? dropped.state.window.options.flatMap((id) => dropped.state.cards[id]?.code ?? []) : [];
    expect(kept).toEqual(["blessing"]);
  });

  it("a treasure is a player card: its pick leaves out a card immune to player card effects and a card that cannot be discarded by them", () => {
    const ctx: ReduceContext = { effects: [marker("lost", { verb: "Undiscardable" })], cards };
    let state = table();
    state = spawn(state, "lost", { zone: "hand", seat: 0 }).state;
    state = spawn(state, "blessing", { zone: "hand", seat: 0 }).state;
    const immune = spawn(state, "urdug", { zone: "staging" });
    const axe = spawn(immune.state, "axe", { zone: "play", seat: 0 });
    const enemies = pickCandidates(axe.state, { type: "enemy", control: "any", staging: true }, 0, [], axe.id, ctx);
    expect(enemies).toEqual([]);
    const byMist = pickCandidates(axe.state, { type: "enemy", control: "any", staging: true }, 0, [], immune.id, ctx);
    expect(byMist).toEqual([immune.id]);
    const hand = pickCandidates(axe.state, { type: "card", control: "you", from: "hand" }, 0, [], axe.id, ctx, undefined, undefined, false, { discards: true });
    expect(hand.map((id) => axe.state.cards[id]?.code)).toEqual(["blessing"]);
  });
});
