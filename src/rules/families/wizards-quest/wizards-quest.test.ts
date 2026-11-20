// Rules: rr.search, rr.reveal, rr.cancel, rr.guarded, rr.in-play-and-out-of-play, rr.quest-cards-quest-deck (data/rules/entries.json); ledger lines 51001:A:1, 51001:B:1, 51003:A:1, 51004:B:1, 51004:B:2, 51008:B:1, 51013:A:1.
// The verbs and fields The Wizard's Quest adds, on fixture cards: BuildQuickDeck, ChooseQuestStage, SearchTopReveal, HoldPickedUnder (and the play bar on a held title), the search fields maxCost, maxCostMulti, types, top and byChallenge, the pick field `challenge`,
// CarryAwayHero `keepAttachments` and FlipOver `target: subject`.
import { describe, expect, it } from "vitest";

import type { Effect, Instruction } from "../../../catalog/boundary.ts";
import { cardMap, hero, idleScenario } from "../../core/test-fixture.ts";
import { definePrinted } from "../../core/printed.ts";
import { cancelBarred } from "../encounter/cancel.ts";
import { greatestChallenge, searchable } from "../../interpret/search.ts";
import { pickCandidates } from "../../interpret/pick.ts";
import { pushEffectFrame } from "../../interpret/effect-frames.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { settle } from "../../engine/machine.ts";
import { updateCard, type ScenarioState } from "../../core/state.ts";
import { attachTo, spawn } from "../../core/zones.ts";
import { carryAwayHero } from "../wilderland/carried.ts";
import { flipOver } from "../wilderland/flip.ts";
import { manifest } from "./index.ts";

const SETS = ["Set A", "Set B", "Set C", "Set D"];
const CARDS = cardMap([
  hero("frodo", "lore"),
  definePrinted({ code: "stage", name: "Stage", type: "quest", questPoints: 5 }),
  definePrinted({ code: "s2a", name: "Stage 2A", type: "quest" }),
  definePrinted({ code: "s2b", name: "Stage 2B", type: "quest" }),
  definePrinted({ code: "s2c", name: "Stage 2C", type: "quest" }),
  definePrinted({ code: "orcA", name: "Orc", type: "enemy", threat: 2, attack: 3, engagementCost: 20, defense: 1, health: 2, cost: 1, encounterSet: "Set A" }),
  definePrinted({ code: "brute", name: "Brute", type: "enemy", threat: 2, attack: 5, engagementCost: 20, defense: 1, health: 2, cost: 1, encounterSet: "Set B" }),
  definePrinted({ code: "hill", name: "Hill", type: "location", threat: 3, questPoints: 2, cost: 0, encounterSet: "Set B" }),
  definePrinted({ code: "mist", name: "Mist", type: "treachery", cost: 0, encounterSet: "Set C" }),
  definePrinted({ code: "giant", name: "Giant", type: "enemy", threat: 4, attack: 4, engagementCost: 30, defense: 1, health: 6, cost: 3, encounterSet: "Set D" }),
  definePrinted({ code: "ent", name: "Ent", type: "ally", sphere: "lore", cost: 3, willpower: 2, health: 3 }),
  definePrinted({ code: "elf", name: "Elf", type: "ally", sphere: "lore", cost: 2, willpower: 1, health: 2 }),
  definePrinted({ code: "ring", name: "Ring", type: "attachment", sphere: "lore", cost: 1 }),
  definePrinted({ code: "rhos", name: "Rhosgobel", type: "location", threat: 1, questPoints: 1 }),
  definePrinted({ code: "rider", name: "Rider", type: "enemy", threat: 0, attack: 6, engagementCost: 50, defense: 3, health: 10 }),
]);
const ctx: ReduceContext = { effects: [], cards: CARDS };

function deck(codes: readonly string[]): { state: ScenarioState; ids: string[] } {
  let state = idleScenario(1);
  state = spawn(state, "stage", { zone: "questStage" }).state;
  state = spawn(state, "frodo", { zone: "heroes", seat: 0 }).state;
  const ids: string[] = [];
  for (const code of codes) {
    const made = spawn(state, code, { zone: "encounterDeck" });
    state = made.state;
    ids.push(made.id);
  }
  return { state, ids };
}
const inFrame = (state: ScenarioState, picked: string[] = [], subject?: string): ScenarioState =>
  pushEffectFrame(state, { frame: "ResolveEffect", sourceId: null, actor: 0, peril: false, effectId: "x:whenRevealed:1", instructions: [], picked, ...(subject ? { subject } : {}), cancel: null, blockCancel: null }, []);

describe("BuildQuickDeck (51001:A:1, reading 2)", () => {
  const run = (state: ScenarioState) => manifest.run?.(state, { verb: "BuildQuickDeck", sets: SETS, keep: 2 }, { seat: 0, sourceId: null }, ctx, []) as ScenarioState;

  it("keeps two of the four sets by the seed and sets the cards of the others aside", () => {
    const { state } = deck(["orcA", "brute", "hill", "mist", "giant"]);
    const done = run(state);
    const kept = new Set(done.encounterDeck.map((id) => CARDS.get(done.cards[id]?.code ?? "")?.encounterSet));
    expect(kept.size).toBe(2);
    expect(done.encounterDeck.length + done.setAside.length).toBe(5);
    for (const id of done.setAside) expect(kept.has(CARDS.get(done.cards[id]?.code ?? "")?.encounterSet ?? null)).toBe(false);
    expect(done.seedCursor).toBeGreaterThan(state.seedCursor);
  });

  it("picks the same sets for the same seed, and not always the same ones for other seeds", () => {
    const { state } = deck(["orcA", "brute", "hill", "mist", "giant"]);
    const sets = (seed: number) => run({ ...state, seed }).setAside.map((id) => state.cards[id]?.code).sort().join();
    expect(sets(4)).toBe(sets(4));
    expect(new Set(Array.from({ length: 12 }, (_, seed) => sets(seed))).size).toBeGreaterThan(1);
  });

  it("changes nothing when the deck holds no more sets than it keeps", () => {
    const { state } = deck(["orcA", "brute"]);
    expect(run(state)).toBe(state);
  });
});

describe("ChooseQuestStage (51003 to 51009, reading 2)", () => {
  function stages() {
    let state = idleScenario(1);
    state = spawn(state, "stage", { zone: "questStage" }).state;
    const ids = ["s2a", "s2b", "s2c"].map((code) => {
      const made = spawn(state, code, { zone: "questDeck" });
      state = made.state;
      return made.id;
    });
    return { state: { ...state, stages: [{ code: "stage" }, { code: "s2a" }, { code: "s2b" }, { code: "s2c" }] }, ids };
  }
  const instruction: Instruction = { verb: "ChooseQuestStage", codes: ["s2a", "s2b", "s2c"] };

  it("asks the first player to choose among the stage cards and sets the others aside once he has", () => {
    const { state, ids } = stages();
    const asked = settle(manifest.run?.(inFrame(state), instruction, { seat: 0, sourceId: null }, ctx, []) as ScenarioState, ctx, []);
    expect(asked.window).toMatchObject({ kind: "choose", seat: 0 });
    const chosen = manifest.run?.(inFrame(state), instruction, { seat: 0, sourceId: null, chosen: ids[1] as string }, ctx, []) as ScenarioState;
    expect(chosen.questDeck).toEqual([ids[1]]);
    expect(chosen.setAside).toEqual([ids[0], ids[2]]);
    expect(chosen.stages.map((stage) => stage.code)).toEqual(["stage", "s2b"]);
  });

  it("takes the one card left without asking", () => {
    const { state, ids } = stages();
    const one = manifest.run?.(state, { verb: "ChooseQuestStage", codes: ["s2c"] }, { seat: 0, sourceId: null }, ctx, []) as ScenarioState;
    expect(one.questDeck).toEqual(ids);
    expect(one.setAside).toEqual([]);
  });
});

describe("the search fields (51001:A:1, 51003:A:1, 51003:B:1)", () => {
  const { state, ids } = deck(["giant", "orcA", "hill", "mist", "brute"]);
  it("maxCost reads the printed cost, and maxCostMulti the limit with two or more players", () => {
    const names = (selector: Parameters<typeof searchable>[1], from = state) => searchable(from, selector, ctx).map((id) => from.cards[id]?.code);
    expect(names({ maxCost: 0 })).toEqual(["hill", "mist"]);
    expect(names({ maxCost: 1, maxCostMulti: 3 })).toEqual(["orcA", "hill", "mist", "brute"]);
    expect(names({ maxCost: 1, maxCostMulti: 3 }, { ...state, seatCount: 2 })).toEqual(["giant", "orcA", "hill", "mist", "brute"]);
  });

  it("types lists the printed types and top the number of cards of the deck, the discard pile left out", () => {
    expect(searchable(state, { maxCost: 0, types: ["enemy", "location"] }, ctx)).toEqual([ids[2]]);
    expect(searchable(state, { top: 2 }, ctx)).toEqual([ids[0], ids[1]]);
    const withDiscard = { ...state, encounterDiscard: [], encounterDeck: state.encounterDeck };
    expect(searchable(withDiscard, { top: 5, maxCost: 3 }, ctx)).toHaveLength(5);
  });

  it("byChallenge takes the highest Threat, then the highest Attack of enemies, then the card nearest the top (reading 3)", () => {
    expect(greatestChallenge(state, ids, ctx)).toBe(ids[0]);
    expect(greatestChallenge(state, [ids[1] as string, ids[4] as string], ctx)).toBe(ids[4]);
    expect(greatestChallenge(state, [ids[3] as string, ids[2] as string], ctx)).toBe(ids[2]);
    expect(greatestChallenge(state, [ids[3] as string], ctx)).toBe(ids[3]);
    expect(greatestChallenge(state, [], ctx)).toBeNull();
  });
});

describe("SearchTopReveal (51003:A:1, readings 3 and 5)", () => {
  const search = { verb: "SearchTopReveal", top: 3, maxCost: 1, maxCostMulti: 2 } as const;
  const run = (codes: readonly string[]) => {
    const { state } = deck(codes);
    const steps: Parameters<typeof settle>[2] = [];
    return settle(manifest.run?.(inFrame(state), search, { seat: 0, sourceId: null }, ctx, steps) as ScenarioState, ctx, steps);
  };

  it("sets aside the card nearest the top that costs 1 or less, shuffles the deck and reveals the card: an enemy enters the staging area", () => {
    const done = run(["giant", "orcA", "brute", "mist"]);
    expect(done.staging.map((id) => done.cards[id]?.code)).toEqual(["orcA"]);
    expect(done.encounterDeck).toHaveLength(3);
    expect(done.setAside).toEqual([]);
    expect(done.seedCursor).toBeGreaterThan(0);
  });

  it("looks only at the top cards: a card below them is not found", () => {
    const done = run(["giant", "giant", "giant", "orcA"]);
    expect(done.staging).toEqual([]);
    expect(done.encounterDeck).toHaveLength(4);
    expect(done.seedCursor).toBeGreaterThan(0);
  });

  it("marks the revealed card: no Response that cancels its When Revealed effects is offered", () => {
    const { state } = deck(["mist", "orcA"]);
    const found = manifest.run?.(inFrame(state), search, { seat: 0, sourceId: null }, ctx, []) as ScenarioState;
    const id = Object.values(found.cards).find((card) => card.code === "mist")?.id as string;
    const cancel: Effect = { id: "c:response:1", cardCode: "c", lines: ["c:A:1"], timing: "response", instructions: [{ verb: "CancelEffect" }] };
    expect(cancelBarred(found, { trigger: "whenRevealedPending", seat: 0, subject: id }, cancel)).toBe(true);
    expect(cancelBarred(state, { trigger: "whenRevealedPending", seat: 0, subject: id }, cancel)).toBe(false);
  });
});

describe("HoldPickedUnder and the held title (51004:B:1, 51004:B:2, 51013:A:1, reading 9)", () => {
  function table() {
    let state = deck([]).state;
    const stage = state.questStage as string;
    const heroId = state.seats[0]?.heroes[0] as string;
    const ent = spawn(state, "ent", { zone: "play", seat: 0 });
    const ring = spawn(ent.state, "ring", { zone: "attached" });
    const hand = spawn(ring.state, "elf", { zone: "hand", seat: 0 });
    state = updateCard(attachTo(hand.state, ring.id, ent.id), ent.id, { damage: 1 });
    return { state, stage, heroId, ent: ent.id, ring: ring.id, elf: hand.id };
  }

  it("lays an ally in play faceup under the source, discards its attachments and tokens, and keeps it its owner's", () => {
    const { state, stage, ent, ring } = table();
    const done = manifest.run?.(inFrame(state, [ent]), { verb: "HoldPickedUnder" }, { seat: 0, sourceId: stage }, ctx, []) as ScenarioState;
    expect(done.cards[ent]).toMatchObject({ zone: "under", host: stage, face: "up", owner: 0, heldTitle: true, damage: 0 });
    expect(done.cards[ring]?.zone).not.toBe("attached");
    expect(done.seats[0]?.play ?? []).not.toContain(ent);
  });

  it("lays a card of the hand under the source", () => {
    const { state, stage, elf } = table();
    const done = manifest.run?.(inFrame(state, [elf]), { verb: "HoldPickedUnder" }, { seat: 0, sourceId: stage }, ctx, []) as ScenarioState;
    expect(done.cards[elf]).toMatchObject({ zone: "under", host: stage, owner: 0 });
    expect(done.seats[0]?.hand).not.toContain(elf);
  });

  it("bars playing, not putting into play, a card with the held card's title, and no other (\"copies of that card cannot be played\", 51013:A:1)", () => {
    const { state, stage, ent } = table();
    const done = manifest.run?.(inFrame(state, [ent]), { verb: "HoldPickedUnder" }, { seat: 0, sourceId: stage }, ctx, []) as ScenarioState;
    const copy = spawn(done, "ent", { zone: "hand", seat: 0 });
    const other = spawn(copy.state, "elf", { zone: "hand", seat: 0 });
    expect(manifest.play?.(other.state, copy.id, ctx, {})).toBe(true);
    expect(manifest.play?.(other.state, copy.id, ctx, { putting: true })).toBe(false);
    expect(manifest.play?.(other.state, other.id, ctx, {})).toBe(false);
  });
});

describe("the pick field `challenge` (51004:B:1, reading 3)", () => {
  it("leaves the first card of the ranking, so nobody is asked and a tie is broken by the order", () => {
    let state = deck([]).state;
    for (const code of ["elf", "ent", "ent"]) state = spawn(state, code, { zone: "play", seat: 0 }).state;
    const ents = Object.values(state.cards).filter((card) => card.code === "ent").map((card) => card.id);
    const spec = { type: "ally", control: "you", highestCost: true } as const;
    expect(pickCandidates(state, spec, 0, [], null, ctx)).toEqual(ents);
    expect(pickCandidates(state, { ...spec, challenge: true }, 0, [], null, ctx)).toEqual([ents[0]]);
    expect(pickCandidates(state, { type: "ally", control: "you", challenge: true }, 0, [], null, ctx)).toHaveLength(1);
  });
});

describe("CarryAwayHero `keepAttachments` (51008:B:1, reading 10)", () => {
  it("discards only the hero's tokens: the attachments stay on it under the enemy", () => {
    let state = deck([]).state;
    const heroId = state.seats[0]?.heroes[0] as string;
    const ring = spawn(state, "ring", { zone: "attached" });
    state = updateCard(attachTo(ring.state, ring.id, heroId), heroId, { damage: 2, resources: 1 });
    const enemy = spawn(state, "orcA", { zone: "staging" });
    const done = carryAwayHero(inFrame(enemy.state, [heroId, enemy.id]), ctx, [], true);
    expect(done.cards[heroId]).toMatchObject({ zone: "captive", host: enemy.id, damage: 0, resources: 0, guardedHero: true });
    expect(done.cards[heroId]?.attachments).toEqual([ring.id]);
    expect(done.cards[ring.id]?.zone).toBe("attached");
    const bare = carryAwayHero(inFrame(enemy.state, [heroId, enemy.id]), ctx, [], false);
    expect(bare.cards[heroId]?.attachments).toEqual([]);
  });
});

describe("FlipOver `target: subject` (51001:B:1, reading 7)", () => {
  it("turns the explored location into the card `into`, in the staging area, with none of its tokens", () => {
    const { state } = deck([]);
    const stage = state.questStage as string;
    const place = spawn(state, "rhos", { zone: "encounterDiscard" });
    const done = flipOver(place.state, { verb: "FlipOver", into: "rider", target: "subject" }, { seat: 0, sourceId: stage }, place.id);
    expect(done.cards[place.id]).toMatchObject({ code: "rider", zone: "staging", other: "rhos", damage: 0, progress: 0 });
    expect(done.cards[stage]?.code).toBe("stage");
    expect(flipOver(place.state, { verb: "FlipOver", into: "rider", target: "subject" }, { seat: 0, sourceId: stage }, null)).toBe(place.state);
  });
});

