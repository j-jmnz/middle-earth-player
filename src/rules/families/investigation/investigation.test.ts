// Rules: rr.in-play-and-out-of-play, rr.forced, rr.search (data/rules/entries.json); ledger lines 50701:A:1, 50702:B:1, 50702:B:2, 50714:A:1, 50715:A:1, 50716:A:1 to 50720:A:1, 50719:A:2, 50720:A:2, 50722:A:1, 50726:A:2, 50728:A:1, 50703:B:1, 50721:A:2, 50727:A:1.
// The verbs the investigation family adds, on fixture cards (docs/scenarios/standalone-scenarios.md, Murder at the Prancing Pony, Readings): the Investigation deck built by the Setup, Investigate X and the other looks, the removal and the shuffle, the accusation, the condition and amount, and what a game with the deck never shows.
import { describe, expect, it } from "vitest";

import type { Effect, Instruction } from "../../../catalog/boundary.ts";
import { definePrinted } from "../../core/printed.ts";
import { cardMap, expectOk } from "../../core/test-fixture.ts";
import { reduce } from "../../engine/reduce.ts";
import { settle } from "../../engine/machine.ts";
import type { EngineStep } from "../../core/intents.ts";
import { holds } from "../../interpret/conditions.ts";
import { resolveAmount } from "../../interpret/amounts.ts";
import { pushEffectFrame } from "../../interpret/effect-frames.ts";
import { runInstruction } from "../../interpret/interpret.ts";
import { pileOf } from "../../core/piles.ts";
import { moveCard, spawn } from "../../core/zones.ts";
import type { ScenarioState } from "../../core/state.ts";
import { startReveal } from "../../windows/frames.ts";
import { seatThreat } from "../play/hooks.ts";
import { queueEvent } from "../../windows/queue.ts";
import { codesOf, ctxOf as baseCtx, deal, record, table, CARDS as BASE } from "../wilderland/fixture.ts";

const SUSPECTS = ["sus1", "sus2", "sus3"];
const HIDEOUTS = ["hid1", "hid2", "hid3"];
const CARDS = cardMap([
  ...BASE.values(),
  ...SUSPECTS.map((code) => definePrinted({ code, name: `Suspect ${code}`, type: "enemy", traits: ["Suspect", "Brigand"], threat: 1, engagementCost: 40, attack: 2, defense: 1, health: 3 })),
  ...HIDEOUTS.map((code) => definePrinted({ code, name: `Hideout ${code}`, type: "location", traits: ["Hideout"], threat: 1, questPoints: 3 })),
  definePrinted({ code: "taken", name: "Taken by Surprise", type: "treachery" }),
  definePrinted({ code: "inv", name: "Old Stable", type: "location", threat: 1, questPoints: 2 }),
]);
const ctxOf = (effects: readonly Effect[]) => ({ ...baseCtx(effects), cards: CARDS });
const HIDE: Instruction = { verb: "HideSuspectAndHideout", suspects: SUSPECTS, hideouts: HIDEOUTS };
const BUILD: Instruction = { verb: "BuildInvestigationDeck", codes: ["taken"] };
const FOCUS = { seat: 0, sourceId: null };

/** A table with the ten cards and one Taken by Surprise set aside, as the deal leaves them. */
function dealt(seed = 3): ScenarioState {
  const aside = deal(table(), [...SUSPECTS, ...HIDEOUTS, "taken"], { zone: "setAside" });
  return { ...aside.state, seed };
}
function built(seed = 3): ScenarioState {
  const hidden = runInstruction(dealt(seed), HIDE, FOCUS, ctxOf([]), []);
  return runInstruction(hidden, BUILD, FOCUS, ctxOf([]), []);
}

/** A frame the instruction runs in, as an effect's frame is. */
function framed(state: ScenarioState): ScenarioState {
  return pushEffectFrame(state, { frame: "ResolveEffect", sourceId: null, actor: 0, peril: false, effectId: "x:forced:1", instructions: [], picked: [], cancel: null, blockCancel: null }, []);
}

describe("HideSuspectAndHideout and BuildInvestigationDeck (50701:A:1)", () => {
  it("keeps one Suspect and one Hideout set aside facedown and puts the other four and Taken by Surprise into the deck", () => {
    const done = built();
    expect(done.setAside).toHaveLength(2);
    const aside = done.setAside.map((id) => done.cards[id]);
    expect(aside.map((card) => card?.face)).toEqual(["down", "down"]);
    expect(aside.filter((card) => SUSPECTS.includes(card?.code ?? ""))).toHaveLength(1);
    expect(aside.filter((card) => HIDEOUTS.includes(card?.code ?? ""))).toHaveLength(1);
    const pile = pileOf(done, "investigationDeck");
    expect(pile).toHaveLength(5);
    expect(codesOf(done, pile).sort()).toEqual([...SUSPECTS, ...HIDEOUTS].filter((code) => !aside.some((card) => card?.code === code)).concat("taken").sort());
    expect(pile.every((id) => done.cards[id]?.zone === "investigationDeck" && done.cards[id]?.face === "down")).toBe(true);
  });

  it("pushes no step, so no log line can name a card of the deck or the hidden pair", () => {
    const steps: EngineStep[] = [];
    const hidden = runInstruction(dealt(), HIDE, FOCUS, ctxOf([]), steps);
    runInstruction(hidden, BUILD, FOCUS, ctxOf([]), steps);
    expect(steps).toEqual([]);
  });

  it("hides the same pair for one seed and, over several seeds, hides different ones", () => {
    const pair = (seed: number) => built(seed).setAside.map((id) => built(seed).cards[id]?.code).sort().join();
    expect(pair(5)).toBe(pair(5));
    expect(new Set([1, 2, 3, 4, 5, 6, 7, 8].map(pair)).size).toBeGreaterThan(1);
  });

  it("changes nothing in a game that dealt no such card", () => {
    const state = table();
    expect(runInstruction(state, HIDE, FOCUS, ctxOf([]), [])).toEqual(state);
    expect(state.piles?.investigationDeck).toBeUndefined();
  });
});

describe("Investigate X (50716:A:1 to 50720:A:1)", () => {
  const keyword = (amount: number): Effect => record("inv:forced:1", "inv", "forced", [{ verb: "Investigate", amount }], { trigger: "activeExplored", subject: "self" });
  function atExplore(effects: readonly Effect[], seed = 3): { state: ScenarioState; id: string } {
    const spawned = spawn(built(seed), "inv", { zone: "activeLocation" });
    return { state: spawned.state, id: spawned.id };
  }
  const explore = (state: ScenarioState, id: string, effects: readonly Effect[]): ScenarioState => settle(queueEvent(state, { trigger: "activeExplored", seat: null, subject: id }), ctxOf(effects), []);

  it("shuffles the deck and shows the top X cards to the first player, leaving them on top in the same order", () => {
    const effects = [keyword(2)];
    const { state, id } = atExplore(effects);
    const done = explore(state, id, effects);
    expect(done.window).toMatchObject({ kind: "look", seat: 0 });
    const shown = done.window?.kind === "look" ? done.window.cardIds : [];
    expect(shown).toHaveLength(2);
    expect(pileOf(done, "investigationDeck").slice(0, 2)).toEqual(shown);
    expect([...pileOf(done, "investigationDeck")].sort()).toEqual([...pileOf(state, "investigationDeck")].sort());
  });

  it("shows as many as the deck holds when it has fewer, and a card looked at is not moved", () => {
    const effects = [keyword(9)];
    const { state, id } = atExplore(effects);
    const done = explore(state, id, effects);
    expect(done.window?.kind === "look" ? done.window.cardIds : []).toHaveLength(5);
  });

  it("looks at the additional cards the flag investigateLooked holds", () => {
    const effects = [keyword(1)];
    const { state, id } = atExplore(effects);
    const wide = { ...state, modifiers: [...state.modifiers, { instanceId: id, sourceId: id, stat: "investigateLooked" as const, amount: 2, until: "endOfPhase" as const }] };
    expect((explore(wide, id, effects).window as unknown as { cardIds: string[] }).cardIds).toHaveLength(3);
  });

  it("does nothing while a card in play ignores the keyword, and the Investigate value still reads the printed number", () => {
    const ignore = record("stage:constant:1", "stage", "constant", [{ verb: "IgnoreKeyword", keywords: ["investigate"] }]);
    const effects = [keyword(2), ignore];
    const { state, id } = atExplore(effects);
    const done = explore(state, id, effects);
    expect(done.window).toBeNull();
    expect(pileOf(done, "investigationDeck")).toEqual(pileOf(state, "investigationDeck"));
    expect(holds(done, { kind: "investigateIgnored" }, { actor: 0, sourceId: null, returned: 0 }, ctxOf(effects))).toBe(true);
    expect(resolveAmount(done, { investigateValue: true, plus: 1 }, { actor: 0, sourceId: null }, ctxOf(effects))).toBe(3);
  });

  it("reads 0 as the Investigate value with no active location", () => {
    const state = built();
    expect(resolveAmount(state, { investigateValue: true, plus: 1 }, { actor: 0, sourceId: null }, ctxOf([keyword(2)]))).toBe(1);
  });

  it("tells the card looked at that hears the look (Taken by Surprise) once the effect has resolved, and no other card", () => {
    const hears = record("taken:forced:1", "taken", "forced", [{ verb: "RemoveSourceFromGame" }], { trigger: "lookedAtInvestigationDeck", subject: "self" });
    const effects = [keyword(5), hears];
    const { state, id } = atExplore(effects);
    const looked = explore(state, id, effects);
    // The look window is open; dismissing it ends the effect, and the card in the deck resolves its Forced effect from there.
    const done = expectOk(reduce(looked, { type: "Pass" }, ctxOf(effects))).state;
    expect(Object.values(done.cards).find((card) => card.code === "taken")?.zone).toBe("removed");
  });
});

describe("LookAtInvestigation (50715:A:1, 50722:A:1, 50726:A:2)", () => {
  it("shows the top two or the bottom card without moving or shuffling anything", () => {
    const state = framed(built());
    const pile = pileOf(state, "investigationDeck");
    const top = runInstruction(state, { verb: "LookAtInvestigation", from: "top", count: 2 }, FOCUS, ctxOf([]), []);
    expect(top.window).toMatchObject({ kind: "look", cardIds: pile.slice(0, 2) });
    const bottom = runInstruction(state, { verb: "LookAtInvestigation", from: "bottom" }, FOCUS, ctxOf([]), []);
    expect(bottom.window).toMatchObject({ kind: "look", cardIds: pile.slice(-1) });
    expect(pileOf(bottom, "investigationDeck")).toEqual(pile);
    expect(bottom.seedCursor).toBe(state.seedCursor);
  });

  it("shows nothing when the deck is empty", () => {
    const done = runInstruction(framed(table()), { verb: "LookAtInvestigation", from: "bottom" }, FOCUS, ctxOf([]), []);
    expect(done.window).toBeFalsy();
  });
});

describe("RemoveRandomInvestigation (50702:B:1)", () => {
  it("removes one card of the deck from the game with no step", () => {
    const state = built();
    const steps: EngineStep[] = [];
    const done = runInstruction(state, { verb: "RemoveRandomInvestigation" }, FOCUS, ctxOf([]), steps);
    expect(pileOf(done, "investigationDeck")).toHaveLength(4);
    expect(Object.values(done.cards).filter((card) => card.zone === "removed")).toHaveLength(1);
    expect(steps).toEqual([]);
  });

  it("does nothing with an empty deck", () => {
    const state = table();
    expect(runInstruction(state, { verb: "RemoveRandomInvestigation" }, FOCUS, ctxOf([]), [])).toEqual(state);
  });
});

describe("ShuffleSelfIntoInvestigation (50728:A:1)", () => {
  it("puts the source card facedown into the deck, which is shuffled", () => {
    const made = spawn(built(), "mist", { zone: "staging" });
    const done = runInstruction(made.state, { verb: "ShuffleSelfIntoInvestigation" }, { seat: 0, sourceId: made.id }, ctxOf([]), []);
    expect(pileOf(done, "investigationDeck")).toHaveLength(6);
    expect(done.cards[made.id]).toMatchObject({ zone: "investigationDeck", face: "down" });
    expect(done.staging).not.toContain(made.id);
  });
});

describe("ShuffleSelfIntoInvestigation after a destroying attack (50728:A:2)", () => {
  it("leaves the shadow card where it is and queues the shuffle for the end of the attack, for a character destroyed", () => {
    const shadow = spawn(built(), "mist", { zone: "encounterDiscard" });
    const attacked: ScenarioState = { ...shadow.state, pendingAttack: { enemyId: "e", seat: 0 } as NonNullable<ScenarioState["pendingAttack"]> };
    const queued = runInstruction(attacked, { verb: "ShuffleSelfIntoInvestigation", ifDestroyed: true }, { seat: 0, sourceId: shadow.id }, ctxOf([]), []);
    expect(pileOf(queued, "investigationDeck")).toHaveLength(5);
    expect(queued.pendingAttack?.after).toEqual([{ verb: "ShuffleSelfIntoInvestigation", card: shadow.id, when: { kind: "x", min: 1 } }]);
    const later = runInstruction(queued, { verb: "ShuffleSelfIntoInvestigation", card: shadow.id }, { seat: 0, sourceId: "e" }, ctxOf([]), []);
    expect(later.cards[shadow.id]).toMatchObject({ zone: "investigationDeck", face: "down" });
  });
});

describe("the accusation (50702:B:2)", () => {
  /** The hidden pair of the state, as codes. */
  const pairOf = (state: ScenarioState) => state.setAside.map((id) => state.cards[id]?.code ?? "");
  const accuse = (state: ScenarioState, suspect: string, hideout: string): ScenarioState => {
    const named = { ...framedWith(state, [`suspect:${suspect}`, `hideout:${hideout}`]) };
    return runInstruction(named, { verb: "MakeAccusation", suspects: SUSPECTS, hideouts: HIDEOUTS }, FOCUS, ctxOf([]), []);
  };
  function framedWith(state: ScenarioState, named: string[]): ScenarioState {
    const pushed = framed(state);
    const top = pushed.stack.at(-1);
    return top && top.data.kind === "effect" ? { ...pushed, stack: [...pushed.stack.slice(0, -1), { ...top, data: { ...top.data, named } }] } : pushed;
  }

  it("turns the hidden pair up into the staging area, and the effect's X is 0 when both names were right", () => {
    const state = built(4);
    const [suspect, hideout] = [pairOf(state).find((code) => SUSPECTS.includes(code)) ?? "", pairOf(state).find((code) => HIDEOUTS.includes(code)) ?? ""];
    const done = accuse(state, suspect, hideout);
    expect(codesOf(done, done.staging).sort()).toEqual([hideout, suspect].sort());
    expect(done.setAside).toEqual([]);
    expect(pileOf(done, "investigationDeck")).toHaveLength(5);
    const top = done.stack.at(-1);
    expect(top?.data.kind === "effect" ? top.data.x : undefined).toBe(0);
  });

  it("adds each wrongly named card the deck holds to the staging area as well, and sets X to 1", () => {
    const state = built(4);
    const pair = pairOf(state);
    const inDeck = (list: string[]) => list.find((code) => !pair.includes(code)) ?? "";
    const wrongSuspect = inDeck(SUSPECTS);
    const wrongHideout = inDeck(HIDEOUTS);
    const done = accuse(state, wrongSuspect, wrongHideout);
    expect(codesOf(done, done.staging)).toHaveLength(4);
    expect(codesOf(done, done.staging)).toEqual(expect.arrayContaining([wrongSuspect, wrongHideout]));
    expect(pileOf(done, "investigationDeck")).toHaveLength(3);
    const top = done.stack.at(-1);
    expect(top?.data.kind === "effect" ? top.data.x : undefined).toBe(1);
  });

  it("does not add a wrongly named card that is already in play", () => {
    const state = built(4);
    const pair = pairOf(state);
    const wrongSuspect = SUSPECTS.find((code) => !pair.includes(code)) ?? "";
    const id = pileOf(state, "investigationDeck").find((other) => state.cards[other]?.code === wrongSuspect) ?? "";
    const inPlayAlready = moveCard(state, id, { zone: "staging" });
    const suspect = pair.find((code) => SUSPECTS.includes(code)) ?? "";
    const hideout = pair.find((code) => HIDEOUTS.includes(code)) ?? "";
    const done = accuse(inPlayAlready, wrongSuspect, hideout);
    expect(codesOf(done, done.staging).filter((code) => code === wrongSuspect)).toHaveLength(1);
    expect(codesOf(done, done.staging)).toContain(suspect);
  });

  it("asks the actor for a name and keeps the one chosen", () => {
    const asked = runInstruction(framed(built()), { verb: "NameInvestigation", kind: "suspect", codes: SUSPECTS }, FOCUS, ctxOf([]), []);
    expect(asked.window).toMatchObject({ kind: "choose" });
    const named = runInstruction(framed(built()), { verb: "NameInvestigation", kind: "suspect", codes: SUSPECTS }, { ...FOCUS, chosen: "sus2" }, ctxOf([]), []);
    const top = named.stack.at(-1);
    expect(top?.data.kind === "effect" ? top.data.named : undefined).toEqual(["suspect:sus2"]);
  });
});

describe("AddLookedToStaging and the condition investigationTop (50720:A:2)", () => {
  it("adds the top card of the deck to the staging area faceup when it is a Suspect or a Hideout", () => {
    const state = built();
    const suspectId = pileOf(state, "investigationDeck").find((id) => SUSPECTS.includes(state.cards[id]?.code ?? ""));
    if (!suspectId) throw new Error("the fixture deck holds a Suspect");
    const onTop = { ...state, piles: { ...state.piles, investigationDeck: [suspectId, ...pileOf(state, "investigationDeck").filter((id) => id !== suspectId)] } };
    expect(holds(onTop, { kind: "investigationTop", traits: ["Suspect", "Hideout"] }, { actor: 0, sourceId: null, returned: 0 }, ctxOf([]))).toBe(true);
    const done = runInstruction(onTop, { verb: "AddLookedToStaging", traits: ["Suspect", "Hideout"] }, FOCUS, ctxOf([]), []);
    expect(done.cards[suspectId]).toMatchObject({ zone: "staging", face: "up" });
    expect(pileOf(done, "investigationDeck")).toHaveLength(4);
  });

  it("leaves a Taken by Surprise on top where it is", () => {
    const state = built();
    const takenId = pileOf(state, "investigationDeck").find((id) => state.cards[id]?.code === "taken") ?? "";
    const onTop = { ...state, piles: { ...state.piles, investigationDeck: [takenId, ...pileOf(state, "investigationDeck").filter((id) => id !== takenId)] } };
    expect(holds(onTop, { kind: "investigationTop", traits: ["Suspect", "Hideout"] }, { actor: 0, sourceId: null, returned: 0 }, ctxOf([]))).toBe(false);
    expect(runInstruction(onTop, { verb: "AddLookedToStaging", traits: ["Suspect", "Hideout"] }, FOCUS, ctxOf([]), [])).toEqual(onTop);
  });
});

describe("UncancelableWhenRevealed `doomed` (50721:A:2)", () => {
  it("gives the first treachery revealed in a round Doomed 1, and the next one nothing", () => {
    const marker = record("inv:constant:1", "inv", "constant", [{ verb: "UncancelableWhenRevealed", firstRevealedEachRound: true, doomed: 1 }]);
    const ctx = ctxOf([marker]);
    const spawned = spawn(table(), "inv", { zone: "staging" });
    const { state } = deal(spawned.state, ["mist", "mist"], { zone: "encounterDeck" });
    const before = seatThreat(state, 0);
    const first = settle(startReveal(state, 0, ctx, []), ctx, []);
    expect(seatThreat(first, 0)).toBe(before + 1);
    const second = settle(startReveal(first, 0, ctx, []), ctx, []);
    expect(seatThreat(second, 0)).toBe(before + 1);
  });

  it("changes nothing for a game without the marker", () => {
    const ctx = ctxOf([]);
    const { state } = deal(table(), ["mist"], { zone: "encounterDeck" });
    expect(seatThreat(settle(startReveal(state, 0, ctx, []), ctx, []), 0)).toBe(seatThreat(state, 0));
  });
});
