// Rules: emce.discover, emce.loot, rr.in-play-and-out-of-play, rr.quest-advancement, rr.guarded, rr.surge, rr.reveal (data/rules/entries.json); ledger lines 50601:A:1, 50601:B:3, 50621:A:3, 50622:A:3, 50623:A:3, 50624:A:2, 50626:A:2, 50627:A:2, 50604:B:1.
// The verbs and fields The Ruins of Belegost adds, on fixture cards: HideRandomLoot, ReturnUnderToStaging `from`, the Discover amounts discoverLooked and discoverHazards, AttachLootFromDiscard `to: self`, AdvanceIfAttached (attachedStageFrom),
// the pick field `controlledBy: firstPlayer`, RevealDiscarded `anyType` and FirstTraitSurge `type: any`.
import { describe, expect, it } from "vitest";

import type { Effect } from "../../../catalog/boundary.ts";
import { definePrinted } from "../../core/printed.ts";
import { expectOk } from "../../core/test-fixture.ts";
import { reduce } from "../../engine/reduce.ts";
import { runInstruction } from "../../interpret/interpret.ts";
import { matchesPick } from "../../interpret/pick.ts";
import { updateCard, withMode, type ScenarioState } from "../../core/state.ts";
import { attachTo, moveCard, spawn } from "../../core/zones.ts";
import { pushEffectFrame } from "../../interpret/effect-frames.ts";
import { settle } from "../../engine/machine.ts";
import { startReveal } from "../../windows/frames.ts";
import { attachedStageFrom } from "../quest/branch.ts";
import { codesOf, ctxOf, deal, marker, record, table, CARDS } from "./fixture.ts";
import { hideRandomLoot } from "./hide.ts";

const LOOT = [marker("loot1", { verb: "Loot" }), marker("loot2", { verb: "Loot" })];
const discover = (amount: number): Effect => record("plain:forced:2", "plain", "forced", [{ verb: "Discover", amount }], { trigger: "becameActive", subject: "self" });
// "Forced: When resolving the Discover keyword on ..." (50622:A:3, 50623:A:3): the amounts are set when the location becomes the active location, before the keyword's own record.
const widen = (stat: "discoverLooked" | "discoverHazards", amount: number): Effect => record("plain:forced:1", "plain", "forced", [{ verb: "ModifyStat", stat, amount, until: "endOfPhase", target: "self" }], { trigger: "becameActive", subject: "self" });

function atTravel(deck: readonly string[]): { state: ScenarioState; hill: string } {
  const hill = spawn(table(), "plain", { zone: "staging" });
  const dealt = deal(hill.state, deck, { zone: "encounterDeck" });
  return { state: { ...withMode(dealt.state, "travel"), boundaryPhase: "Travel", window: { kind: "travel" } }, hill: hill.id };
}
const travel = (state: ScenarioState, id: string, effects: readonly Effect[]): ScenarioState => expectOk(reduce(state, { type: "Travel", locationId: id }, ctxOf(effects))).state;

describe("Discover with the amounts of Abandoned Mine and Flooded Hall (50622:A:3, 50623:A:3)", () => {
  it("looks at the additional cards the location's discoverLooked holds, so a Loot objective below the printed value is found", () => {
    const { state, hill } = atTravel(["mist", "orc", "loot1", "stalker"]);
    const plain = travel(state, hill, [...LOOT, discover(2)]);
    expect(plain.cards[hill]?.host).toBeNull();
    const wide = travel(state, hill, [...LOOT, widen("discoverLooked", 2), discover(2)]);
    expect(codesOf(wide, wide.staging).sort()).toEqual(["loot1", "stalker"]);
    expect(wide.encounterDeck).toEqual([]);
    expect(codesOf(wide, wide.encounterDiscard).sort()).toEqual(["mist", "orc"]);
  });

  it("reveals the additional Hazard cards the location's discoverHazards holds, one at a time, and discards the Hazards not selected", () => {
    const { state, hill } = atTravel(["stalker", "hazard", "hazard2", "orc"]);
    const one = expectOk(reduce(state, { type: "Travel", locationId: hill }, ctxOf([...LOOT, discover(4)])));
    expect(one.steps.flat().filter((step) => step.kind === "reveal")).toHaveLength(1);
    const two = expectOk(reduce(state, { type: "Travel", locationId: hill }, ctxOf([...LOOT, widen("discoverHazards", 1), discover(4)])));
    expect(two.steps.flat().filter((step) => step.kind === "reveal")).toHaveLength(2);
    // Of the three Hazard cards two are revealed (the enemy staged, a treachery resolved and discarded); the third and the Orc go to the discard pile.
    expect(two.state.staging.length + two.state.encounterDiscard.length).toBe(4);
    expect(two.state.encounterDeck).toEqual([]);
  });

  it("reveals every looked-at Hazard when fewer than the amount are there", () => {
    const { state, hill } = atTravel(["stalker", "orc"]);
    const done = travel(state, hill, [...LOOT, widen("discoverHazards", 3), discover(2)]);
    expect(codesOf(done, done.staging)).toEqual(["stalker"]);
    expect(codesOf(done, done.encounterDiscard)).toEqual(["orc"]);
  });
});

describe("HideRandomLoot (50601:A:1)", () => {
  const CODES = ["loot1", "loot2", "relic"];
  function setup() {
    const host = spawn(table(), "sign", { zone: "staging" });
    const aside = deal(host.state, CODES, { zone: "setAside" });
    return { state: aside.state, host: host.id, ids: aside.ids };
  }
  const hide = (state: ScenarioState, under = "sign") => hideRandomLoot(state, { verb: "HideRandomLoot", codes: CODES, under });

  it("puts one of the set-aside cards facedown under the card and the others into the encounter deck", () => {
    const { state, host } = setup();
    const done = hide(state);
    const under = Object.values(done.cards).filter((card) => card.zone === "under");
    expect(under).toHaveLength(1);
    expect(under[0]).toMatchObject({ host, face: "down" });
    expect(done.encounterDeck).toHaveLength(2);
    expect(done.setAside).toEqual([]);
    expect(done.encounterDeck.every((id) => done.cards[id]?.face === "down")).toBe(true);
    expect(done.seedCursor).toBeGreaterThan(state.seedCursor);
  });

  it("picks the same card for the same seed, and a different one for some other seed", () => {
    const { state } = setup();
    const hidden = (seed: number) => Object.values(hide({ ...state, seed }).cards).find((card) => card.zone === "under")?.code;
    expect(hidden(3)).toBe(hidden(3));
    expect(new Set(Array.from({ length: 12 }, (_, seed) => hidden(seed))).size).toBeGreaterThan(1);
  });

  it("does nothing when the card to hide under is not in play", () => {
    const { state } = setup();
    expect(hide(state, "hoard")).toBe(state);
  });
});

describe("ReturnUnderToStaging from a card (50621:A:3)", () => {
  it("adds the card under the named card to the staging area faceup, not the cards under the source", () => {
    const host = spawn(table(), "sign", { zone: "staging" });
    const lair = spawn(host.state, "cave1", { zone: "activeLocation" });
    const key = spawn(lair.state, "loot1", { zone: "staging" });
    const other = spawn(key.state, "loot2", { zone: "staging" });
    const placed = updateCard(moveCard(moveCard(other.state, key.id, { zone: "under", locationId: host.id }), other.id, { zone: "under", locationId: lair.id }), key.id, { face: "down" });
    const done = runInstruction(placed, { verb: "ReturnUnderToStaging", from: "sign" }, { seat: 0, sourceId: lair.id }, ctxOf([]), []);
    expect(done.cards[key.id]).toMatchObject({ zone: "staging", face: "up" });
    expect(done.cards[other.id]?.zone).toBe("under");
  });
});

describe("AttachLootFromDiscard `to: self` (50626:A:2)", () => {
  it("attaches a Loot objective of the encounter discard pile to the source location as its guarded objective", () => {
    const hill = spawn(table(), "plain", { zone: "activeLocation" });
    const pile = deal(hill.state, ["mist", "loot1"], { zone: "encounterDiscard" });
    const ctx = ctxOf(LOOT);
    const done = runInstruction(pile.state, { verb: "AttachLootFromDiscard", to: "self" }, { seat: 0, sourceId: hill.id }, ctx, []);
    const loot = Object.values(done.cards).find((card) => card.code === "loot1");
    expect(loot?.zone).toBe("staging");
    expect(done.cards[hill.id]).toMatchObject({ host: loot?.id, guard: true });
    expect(codesOf(done, done.encounterDiscard)).toEqual(["mist"]);
  });

  it("does nothing with no Loot objective in the discard pile", () => {
    const hill = spawn(table(), "plain", { zone: "activeLocation" });
    const pile = deal(hill.state, ["mist"], { zone: "encounterDiscard" });
    expect(runInstruction(pile.state, { verb: "AttachLootFromDiscard", to: "self" }, { seat: 0, sourceId: hill.id }, ctxOf(LOOT), [])).toEqual(pile.state);
  });
});

describe("AdvanceIfAttached (50601:B:3, 50606:B:3)", () => {
  const cards = new Map(CARDS);
  for (const code of ["s1", "s2", "s3"]) cards.set(code, definePrinted({ code, name: code, type: "quest", questPoints: 2 }));
  // Stage s1 leads to s2 with Loot "loot1" attached to a hero, else to s3; the stages after it come from the quest deck or, once played, from the set-aside pile.
  function stages(played: readonly string[] = []) {
    let state = table();
    const made = ["s2", "s3"].map((code) => {
      const card = spawn(state, code, { zone: played.includes(code) ? "setAside" : "questDeck" });
      state = card.state;
      return card.id;
    });
    return { state: { ...state, stages: [{ code: "stage", attachedNext: { code: "loot1", then: "s2", otherwise: "s3" } }, { code: "s2" }, { code: "s3" }] }, ids: made };
  }
  const lootAttached = (state: ScenarioState): ScenarioState => {
    const hero = state.seats[0]!.heroes[0]!;
    const loot = spawn(state, "loot1", { zone: "attached" });
    return attachTo(loot.state, loot.id, hero);
  };

  it("goes to the named stage when the card is attached to a hero, else to the other", () => {
    const { state, ids } = stages();
    expect(attachedStageFrom(state, "stage", cards)?.id).toBe(ids[1]);
    const withLoot = lootAttached(state);
    expect(attachedStageFrom(withLoot, "stage", cards)?.id).toBe(ids[0]);
  });

  it("takes a card lying in the staging area or on a location as not attached to a hero", () => {
    const { state, ids } = stages();
    const loose = spawn(state, "loot1", { zone: "staging" }).state;
    expect(attachedStageFrom(loose, "stage", cards)?.id).toBe(ids[1]);
  });

  it("brings a stage the quest played before back from the set-aside pile with no progress and side A up", () => {
    const { state, ids } = stages(["s3"]);
    const played = updateCard(state, ids[1]!, { progress: 2, face: "B" });
    const back = attachedStageFrom(played, "stage", cards);
    expect(back?.id).toBe(ids[1]);
    expect(back?.state.questDeck).toContain(ids[1]);
    expect(back?.state.cards[ids[1]!]).toMatchObject({ zone: "questDeck", progress: 0, face: "A" });
  });

  it("names none for a stage without attachedNext, so every other quest advances as it did", () => {
    const { state } = stages();
    expect(attachedStageFrom(state, "s2", cards)).toBeNull();
  });
});

describe("the pick field controlledBy: firstPlayer (50627:A:2)", () => {
  it("matches the characters the first player controls, whichever seat the effect runs for", () => {
    const state = table(2);
    const [first, second] = [state.seats[0]!.heroes[0]!, state.seats[1]!.heroes[0]!];
    const at = { seat: 1, sourceId: null };
    const spec = { type: "character" as const, control: "any" as const, controlledBy: "firstPlayer" as const };
    expect(matchesPick(state, first, spec, at, ctxOf([]))).toBe(true);
    expect(matchesPick(state, second, spec, at, ctxOf([]))).toBe(false);
    expect(matchesPick({ ...state, firstPlayer: 1 }, second, spec, at, ctxOf([]))).toBe(true);
  });
});

describe("RevealDiscarded `anyType` (50624:A:2)", () => {
  // The effect discards the top card of the encounter deck and reveals it from the discard pile when it has the Hazard trait, whatever its type.
  function discardAndReveal(deck: readonly string[], anyType: boolean) {
    const ctx = ctxOf([]);
    const steps: Parameters<typeof settle>[2] = [];
    const frame = pushEffectFrame(deal(table(), deck, { zone: "encounterDeck" }).state, { frame: "ResolveEffect", sourceId: null, actor: 0, peril: false, effectId: "x:forced:1", instructions: [], picked: [], cancel: null, blockCancel: null }, []);
    let next = runInstruction(frame, { verb: "DiscardEncounterTop", count: 1, reset: true }, { seat: 0, sourceId: null }, ctx, steps);
    next = runInstruction(next, { verb: "RevealDiscarded", trait: "Hazard", ...(anyType ? { anyType: true as const } : {}) }, { seat: 0, sourceId: null }, ctx, steps);
    return { state: settle(next, ctx, steps), steps };
  }

  it("reveals a discarded Hazard treachery, which resolves and returns to the discard pile, and a Hazard enemy, which enters the staging area", () => {
    const treachery = discardAndReveal(["hazard", "orc"], true);
    expect(treachery.steps.filter((step) => step.kind === "reveal")).toHaveLength(1);
    expect(codesOf(treachery.state, treachery.state.encounterDiscard)).toEqual(["hazard"]);
    const enemy = discardAndReveal(["stalker", "orc"], true);
    expect(codesOf(enemy.state, enemy.state.staging)).toEqual(["stalker"]);
  });

  it("leaves a discarded card without the Hazard trait in the discard pile, and a Hazard treachery too without `anyType`", () => {
    expect(discardAndReveal(["mist", "orc"], true).steps.some((step) => step.kind === "reveal")).toBe(false);
    expect(discardAndReveal(["hazard", "orc"], false).steps.some((step) => step.kind === "reveal")).toBe(false);
  });
});

describe("FirstTraitSurge `type: any` (50604:B:1)", () => {
  const reveal = (deck: readonly string[], type: "any" | "treachery") => {
    const ctx = ctxOf([record("stage:constant:1", "stage", "constant", [{ verb: "FirstTraitSurge", trait: "Hazard", type }])]);
    const { state } = deal(table(), deck, { zone: "encounterDeck" });
    return settle(startReveal(state, 0, ctx, []), ctx, []);
  };

  it("gives surge to the first Hazard card revealed in a round whatever its type, so the next card is revealed and does not surge", () => {
    const done = reveal(["stalker", "hazard", "orc"], "any");
    expect(codesOf(done, done.staging)).toEqual(["stalker"]);
    expect(codesOf(done, done.encounterDiscard)).toEqual(["hazard"]);
    expect(codesOf(done, done.encounterDeck)).toEqual(["orc"]);
  });

  it("gives surge only to a card of the marker's own type otherwise (a treachery by default)", () => {
    const done = reveal(["stalker", "hazard", "orc"], "treachery");
    expect(codesOf(done, done.staging)).toEqual(["stalker"]);
    expect(codesOf(done, done.encounterDeck)).toEqual(["hazard", "orc"]);
  });
});
