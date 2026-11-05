// Rules: emce.treasure, emce.boon-allies, emce.campaign-pool-encounter, emce.campaign-log, rr.guarded (data/rules/entries.json). The wilderland family on fixture cards: the random treasure
// (seeded, asked of the first player, attached as a guarded objective), the conditions that read the Campaign Log, and the Resolution that writes it.
import { describe, expect, it } from "vitest";

import type { Instruction } from "../../../catalog/boundary.ts";
import { cardMap, expectOk, hero, idleScenario } from "../../core/test-fixture.ts";
import { definePrinted } from "../../core/printed.ts";
import type { CampaignFacts } from "../../core/campaign-state.ts";
import { holds } from "../../interpret/conditions.ts";
import { pushEffectFrame } from "../../interpret/effect-frames.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { settle } from "../../engine/machine.ts";
import { legalIntents, reduce } from "../../engine/reduce.ts";
import { updateCard, type ScenarioState } from "../../core/state.ts";
import { attachTo, spawn } from "../../core/zones.ts";
import { effectSchema } from "../../../catalog/boundary.ts";
import { asksPlayers, openResolution, resolutionResult } from "../../setup/resolution.ts";
import { freeOfEncounters } from "../objectives/index.ts";
import { run } from "./index.ts";

const TREASURES = ["t1", "t2", "t3", "t4", "t5"];
const cards = cardMap([
  hero("frodo", "lore"),
  hero("sam", "spirit"),
  definePrinted({ code: "stage", name: "Stage", type: "quest" }),
  definePrinted({ code: "hall", name: "Twilight Hall", type: "location", threat: 2, questPoints: 3 }),
  definePrinted({ code: "wolf", name: "Wolf", type: "enemy", threat: 2, attack: 2, defense: 1, health: 2, engagementCost: 20 }),
  definePrinted({ code: "growing", name: "A Growing Threat", type: "treachery" }),
  definePrinted({ code: "turayn", name: "Turayn", type: "ally", sphere: "neutral", cost: 2, isUnique: true, willpower: 1, attack: 2, defense: 3, health: 3 }),
  definePrinted({ code: "blessing", name: "Blessing", type: "attachment", campaignKind: "boon", sphere: "neutral" }),
  definePrinted({ code: "curse", name: "Curse", type: "treachery", campaignKind: "burden", burdenSet: "x", backType: "encounter" }),
  ...TREASURES.map((code) => definePrinted({ code, name: `Treasure ${code}`, type: "treasure", campaignKind: "treasure" })),
]);
const ctx: ReduceContext = { effects: [], cards };

function table(seats: 1 | 2 = 1, seed = 3, facts?: CampaignFacts): { state: ScenarioState; guard: string } {
  let state: ScenarioState = { ...idleScenario(seats), seed, firstPlayer: 0, ...(facts ? { campaignFacts: facts } : {}) };
  state = spawn(state, "frodo", { zone: "heroes", seat: 0 }).state;
  if (seats === 2) state = spawn(state, "sam", { zone: "heroes", seat: 1 }).state;
  const guard = spawn(state, "hall", { zone: "staging" });
  return { state: guard.state, guard: guard.id };
}

const facts = (extra: Partial<CampaignFacts> = {}): CampaignFacts => ({ prisoner: null, usedOnce: [], counters: {}, ...extra });
const ATTACH: Instruction = { verb: "AttachRandomTreasure" };

// The verb as a When Revealed effect on the guard, which is a frame that can ask.
function asked(state: ScenarioState, guard: string, instruction: Instruction = ATTACH): ScenarioState {
  return settle(pushEffectFrame(state, { frame: "whenRevealed", sourceId: guard, actor: 0, peril: false, effectId: "hall:whenRevealed:1", instructions: [instruction], cancel: null, blockCancel: null }, []), ctx, []);
}

function options(state: ScenarioState): readonly string[] {
  return state.window?.kind === "choose" ? state.window.options : [];
}

const treasureCards = (state: ScenarioState) => Object.values(state.cards).filter((card) => TREASURES.includes(card.code));

describe("AttachRandomTreasure (emce.treasure)", () => {
  it("draws 3 of the undiscovered treasures, asks the first player, and guards the one chosen with the card", () => {
    const { state, guard } = table();
    const waiting = asked(state, guard);
    expect(options(waiting)).toHaveLength(3);
    expect(new Set(options(waiting)).size).toBe(3);
    expect(options(waiting).every((code) => TREASURES.includes(code))).toBe(true);
    expect(waiting.window).toMatchObject({ kind: "choose", seat: 0 });
    const pick = options(waiting)[1] ?? "";
    const done = expectOk(reduce(waiting, { type: "Choose", optionId: pick }, ctx)).state;
    const [treasure] = treasureCards(done);
    expect(treasureCards(done)).toHaveLength(1);
    expect(treasure).toMatchObject({ code: pick, zone: "staging" });
    // The location guards it: attached to the treasure and kept there until it leaves play.
    expect(done.cards[guard]).toMatchObject({ host: treasure?.id, guard: true });
    expect(freeOfEncounters(done, treasure?.id ?? null)).toBe(false);
  });

  it("is free of encounters, so the players may claim it, once the guard has left play", () => {
    const { state, guard } = table();
    const waiting = asked(state, guard);
    const done = expectOk(reduce(waiting, { type: "Choose", optionId: options(waiting)[0] ?? "" }, ctx)).state;
    const treasure = treasureCards(done)[0]?.id ?? "";
    const gone = updateCard(done, guard, { zone: "encounterDiscard", host: null });
    const freed = updateCard(gone, treasure, { attachments: [] });
    expect(freeOfEncounters(freed, treasure)).toBe(true);
  });

  it("leaves out the treasures the log records and the ones the game already deals", () => {
    const { state, guard } = table(1, 3, facts({ treasures: ["t1", "t2"] }));
    const dealt = spawn(state, "t3", { zone: "setAside" }).state;
    const waiting = asked(dealt, guard);
    expect([...options(waiting)].sort()).toEqual(["t4", "t5"]);
    expect(options(waiting)).toHaveLength(2);
  });

  it("offers every treasure that is left when fewer than three are, and attaches the only one without asking", () => {
    const { state, guard } = table(1, 3, facts({ treasures: ["t1", "t2", "t3", "t4"] }));
    const attached = asked(state, guard);
    expect(attached.window).toBeNull();
    expect(treasureCards(attached).map((card) => card.code)).toEqual(["t5"]);
    const none = table(1, 3, facts({ treasures: TREASURES }));
    expect(treasureCards(asked(none.state, none.guard))).toEqual([]);
  });

  it("draws with the game's seed: the same seed offers the same treasures, and the seed moves on once", () => {
    const first = table(1, 11);
    const again = table(1, 11);
    const left = asked(first.state, first.guard);
    expect(options(left)).toEqual(options(asked(again.state, again.guard)));
    expect(left.seedCursor).toBeGreaterThan(first.state.seedCursor);
    const offers = new Set([1, 2, 3, 4, 5, 6, 7, 8].map((seed) => options(asked(table(1, seed).state, table(1, seed).guard)).join(",")));
    expect(offers.size).toBeGreaterThan(1);
  });

  it("takes the first treasure drawn when it runs outside a frame, which cannot ask", () => {
    const { state, guard } = table();
    const direct = run(state, ATTACH, { seat: 0, sourceId: guard }, ctx, []);
    expect(direct?.window).toBeNull();
    expect(treasureCards(direct ?? state)).toHaveLength(1);
    expect(direct?.seedCursor).toBeGreaterThan(state.seedCursor);
  });

  it("does nothing when the card to guard it is not in the staging area or engaged", () => {
    const { state, guard } = table();
    const away = updateCard(state, guard, { zone: "encounterDiscard" });
    expect(treasureCards(run(away, ATTACH, { seat: 0, sourceId: guard }, ctx, []) ?? away)).toEqual([]);
  });

  it("refuses a treasure the window did not offer", () => {
    const { state, guard } = table(1, 3, facts({ treasures: ["t1"] }));
    expect(treasureCards(run(state, ATTACH, { seat: 0, sourceId: guard, chosen: "t1" }, ctx, []) ?? state)).toEqual([]);
  });
});

describe("the Campaign Log's conditions (emce.boon-allies, emce.treasure)", () => {
  const scope = { actor: 0, sourceId: null, returned: 0 };
  it("holds a line when the log records it, and a count when enough treasures are recorded", () => {
    const logged = table(1, 3, facts({ allyLines: ["turayn"], treasures: ["t1", "t2", "t3", "t4", "t5", "t6"] })).state;
    const bare = table().state;
    expect(holds(logged, { kind: "logged", line: "turayn" }, scope, ctx)).toBe(true);
    expect(holds(logged, { kind: "logged", line: "isolde" }, scope, ctx)).toBe(false);
    expect(holds(logged, { kind: "logged", line: "isolde", is: false }, scope, ctx)).toBe(true);
    expect(holds(logged, { kind: "treasuresLogged", min: 6 }, scope, ctx)).toBe(true);
    expect(holds(logged, { kind: "treasuresLogged", min: 7 }, scope, ctx)).toBe(false);
    expect(holds(bare, { kind: "logged", line: "turayn" }, scope, ctx)).toBe(false);
    expect(holds(bare, { kind: "treasuresLogged", min: 1 }, scope, ctx)).toBe(false);
  });
});

// A won scenario with these Resolution instructions, opened.
function won(resolution: readonly Instruction[], state: ScenarioState): ScenarioState {
  return openResolution({ ...state, stageCleared: true, window: null, resolution: [...resolution] }, ctx);
}

const choose = (state: ScenarioState, optionId: string): ScenarioState => expectOk(reduce(state, { type: "ChooseResolution", optionId }, ctx)).state;
const choices = (state: ScenarioState): string[] => legalIntents(state, ctx).flatMap((intent) => (intent.type === "ChooseResolution" ? [intent.optionId] : []));

describe("DiscoverTreasure (emce.treasure)", () => {
  it("records each treasure a player controls, and not one still guarded in the staging area", () => {
    const { state } = table();
    const claimed = spawn(state, "t2", { zone: "attached" });
    const heroId = Object.values(state.cards).find((card) => card.code === "frodo")?.id ?? "";
    const held = updateCard(attachTo(claimed.state, claimed.id, heroId), claimed.id, { controller: 0, claimed: true });
    const guarded = spawn(held, "t4", { zone: "staging" }).state;
    expect(resolutionResult(won([{ verb: "DiscoverTreasure" }], guarded))?.treasures).toEqual(["t2"]);
    expect(resolutionResult(won([{ verb: "DiscoverTreasure" }], table().state))?.treasures).toBeUndefined();
  });
});

describe("BoonAllyOrLogLine (emce.boon-allies)", () => {
  const verb: Instruction = { verb: "BoonAllyOrLogLine", ally: "turayn", line: "turayn" };

  it("asks the first player and has no default: the ally for a player, or the line", () => {
    const waiting = won([verb], table(2).state);
    expect(resolutionResult(waiting)).toBeNull();
    expect(waiting.window).toMatchObject({ kind: "resolution", seat: 0 });
    const heroes = Object.values(waiting.cards).filter((card) => card.zone === "heroes").map((card) => card.id);
    expect(choices(waiting)).toEqual([`turayn>${heroes[0]}`, `turayn>${heroes[1]}`, "line"]);
  });

  it("adds the ally to the pool for the player chosen, and records no line", () => {
    const waiting = won([verb], table(2).state);
    const second = choices(waiting)[1] ?? "";
    const result = resolutionResult(choose(waiting, second));
    expect(result?.earned).toEqual([{ code: "turayn", to: "pool", seat: 1, hero: null, step: 0 }]);
    expect(result?.allyLines).toBeUndefined();
  });

  it("records the line instead, and adds no ally", () => {
    const result = resolutionResult(choose(won([verb], table().state), "line"));
    expect(result?.allyLines).toEqual(["turayn"]);
    expect(result?.earned).toEqual([]);
  });

  it("is skipped by its condition", () => {
    const skipped = won([{ ...verb, when: { kind: "logged", line: "isolde" } }], table().state);
    expect(resolutionResult(skipped)?.earned).toEqual([]);
  });
});

describe("AddEncounterToPool and RemoveFromPool (emce.campaign-pool-encounter)", () => {
  it("adds a copy of each card, and keeps counting the copies the log already tallies", () => {
    const { state } = table(1, 3, facts({ encounterPool: { wolf: 1 } }));
    const result = resolutionResult(won([{ verb: "AddEncounterToPool", codes: ["growing", "wolf"] }], state));
    expect(result?.encounterPool).toEqual({ wolf: 2, growing: 1 });
  });

  it("adds a copy for each card of the code in play with `inPlay`, and none for a card that is not", () => {
    const { state } = table();
    const wolves = spawn(spawn(state, "wolf", { zone: "staging" }).state, "wolf", { zone: "engaged", seat: 0 }).state;
    const apart = spawn(wolves, "wolf", { zone: "encounterDiscard" }).state;
    const result = resolutionResult(won([{ verb: "AddEncounterToPool", codes: ["wolf", "growing"], inPlay: true }], apart));
    expect(result?.encounterPool).toEqual({ wolf: 2 });
  });

  it("counts with `inPlay` only the copies the pool did not deal into the game", () => {
    // The pool holds 1 wolf, dealt with the scenario's own: 2 wolves are in play, so the pool gains the 1 that was the scenario's, not both.
    const { state } = table(1, 3, facts({ encounterPool: { wolf: 1 } }));
    const dealt = spawn(spawn(state, "wolf", { zone: "staging" }).state, "wolf", { zone: "engaged", seat: 0 }).state;
    expect(resolutionResult(won([{ verb: "AddEncounterToPool", codes: ["wolf"], inPlay: true }], dealt))?.encounterPool).toEqual({ wolf: 2 });
    // Two wolves dealt (one the pool's) and one in play: a copy has no identity, so the pool gains one, never more than the scenario's own.
    const one = spawn(spawn(state, "wolf", { zone: "staging" }).state, "wolf", { zone: "encounterDeck" }).state;
    expect(resolutionResult(won([{ verb: "AddEncounterToPool", codes: ["wolf"], inPlay: true }], one))?.encounterPool).toEqual({ wolf: 2 });
  });

  it("removes every copy of the cards named", () => {
    const { state } = table(1, 3, facts({ encounterPool: { growing: 2, wolf: 1 } }));
    expect(resolutionResult(won([{ verb: "RemoveFromPool", codes: ["growing"] }], state))?.encounterPool).toEqual({ wolf: 1 });
  });

  it("lets each player in turn remove one non-burden card, or decline; a burden is never offered", () => {
    const base = table(2, 3, facts({ encounterPool: { wolf: 2 }, pool: [{ code: "blessing", seat: 0 }, { code: "curse", seat: null }, { code: "turayn", seat: 1 }] })).state;
    const waiting = won([{ verb: "RemoveFromPool", choice: "eachPlayerNonBurden" }], base);
    expect(waiting.window).toMatchObject({ kind: "resolution", seat: 0 });
    expect(choices(waiting)).toEqual(["e:wolf", "p:blessing@0", "p:turayn@1", "skip"]);
    const second = choose(waiting, "e:wolf");
    expect(second.window).toMatchObject({ kind: "resolution", seat: 1 });
    const done = resolutionResult(choose(second, "p:turayn@1"));
    expect(done?.encounterPool).toEqual({ wolf: 1 });
    expect(done?.poolRemoved).toEqual([{ code: "turayn", seat: 1 }]);
  });

  it("offers nothing to a player when no card may be removed, and a declined answer changes nothing", () => {
    const empty = won([{ verb: "RemoveFromPool", choice: "eachPlayerNonBurden" }], table().state);
    expect(resolutionResult(empty)?.poolRemoved).toBeUndefined();
    const some = table(1, 3, facts({ encounterPool: { wolf: 1 } })).state;
    const declined = resolutionResult(choose(won([{ verb: "RemoveFromPool", choice: "eachPlayerNonBurden" }], some), "skip"));
    expect(declined?.encounterPool).toBeUndefined();
    expect(declined?.poolRemoved).toBeUndefined();
  });
});

describe("the records and the instructions that ask", () => {
  const record = (instruction: Instruction) => ({ id: "x:resolution:1", cardCode: "x", lines: ["x:B:1"], timing: "resolution", instructions: [instruction] });

  it("a RemoveFromPool record names exactly one of the cards and the choice", () => {
    expect(effectSchema.safeParse(record({ verb: "RemoveFromPool", codes: ["growing"] })).success).toBe(true);
    expect(effectSchema.safeParse(record({ verb: "RemoveFromPool", choice: "eachPlayerNonBurden" })).success).toBe(true);
    expect(effectSchema.safeParse(record({ verb: "RemoveFromPool" })).success).toBe(false);
    expect(effectSchema.safeParse(record({ verb: "RemoveFromPool", codes: ["growing"], choice: "eachPlayerNonBurden" })).success).toBe(false);
  });

  it("asksPlayers is true for an instruction that opens a window, and for a removal only when it has a choice", () => {
    expect(asksPlayers({ verb: "BoonAllyOrLogLine", ally: "turayn", line: "turayn" })).toBe(true);
    expect(asksPlayers({ verb: "RemoveFromPool", choice: "eachPlayerNonBurden" })).toBe(true);
    expect(asksPlayers({ verb: "RemoveFromPool", codes: ["growing"] })).toBe(false);
    expect(asksPlayers({ verb: "AddEncounterToPool", codes: ["wolf"] })).toBe(false);
    expect(asksPlayers(undefined)).toBe(false);
  });
});
