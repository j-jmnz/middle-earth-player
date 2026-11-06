// Rules: emce.setup-roam-across-rhovanion, rr.quest-advancement, rr.objective-cards, rr.guarded, rr.travel, rr.search, rr.cancel, rr.victory, rr.damage, emce.indestructible (data/rules/entries.json); ledger lines 19047:A:1 to 19051:B:3.
// The five stages of Roam Across Rhovanion on the scenario's scene: each record runs in a real state, and the stage changes go through the engine.
import { beforeAll, describe, expect, it } from "vitest";

import type { Effect } from "../../../catalog/boundary.ts";
import { definePrinted } from "../../../rules/core/printed.ts";
import { offerResponses } from "../../../rules/windows/responses.ts";
import { flagged, updateCard, type ScenarioState } from "../../../rules/core/state.ts";
import { modifiedStat } from "../../../rules/core/keywords.ts";
import { attachTo, moveCard, spawn } from "../../../rules/core/zones.ts";
import { settle } from "../../../rules/engine/machine.ts";
import { syncConstants } from "../../../rules/interpret/constants.ts";
import { restricted, travelBlocked } from "../../../rules/interpret/restrictions.ts";
import { guardWith } from "../../../rules/families/objectives/guard.ts";
import { stagePlace } from "../../../rules/families/quest/branch.ts";
import { CODES, STAGES, codesIn, finish, idOf, legalIntents, loadRhovanionWorld, resolveRecords, rhovanionTable, send, start, type PlayerIntent, type RhovanionWorld, type Run } from "../../../../test/scenarios/roam-across-rhovanion/scene.ts";

let world: RhovanionWorld;
beforeAll(async () => {
  world = await loadRhovanionWorld();
}, 120_000);

type Layout = Parameters<typeof rhovanionTable>[1];
type Table = ReturnType<typeof rhovanionTable>;
const TWOS = [CODES.stage2, CODES.stage3, CODES.stage4];
const stageOf = (state: ScenarioState): string | undefined => state.cards[state.questStage ?? ""]?.code;
const settled = (t: Table, state: ScenarioState): ScenarioState => settle({ ...state, window: null, mode: "stopped" }, t.ctx, []);
// The stage cards by zone, as codes.
const zoneOfStage = (state: ScenarioState, code: string): string | undefined => state.cards[idOf(state, code)]?.zone;
// The players quest with every character, then the window is passed until the quest is resolved and its Forced effects have answered.
const quest = (t: Table, state: ScenarioState, pick?: (state: ScenarioState) => string): Run => {
  let run = send(start(state), { type: "Commit", cardIds: [t.hero, t.hero2] }, t.ctx);
  run = send(run, { type: "Pass" }, t.ctx);
  for (let guard = 0; guard < 16; guard += 1) {
    const kind = run.state.window?.kind;
    if (kind === "look" || kind === "choose") run = finish(run, t.ctx, pick);
    else if (run.state.phase !== "Quest" || run.state.lost || run.state.stageCleared) break;
    else {
      const pass = legalIntents(run.state, t.ctx).find((intent) => intent.type === "Pass");
      if (!pass || run.state.mode === "travel") break;
      run = send(run, pass as PlayerIntent, t.ctx);
    }
  }
  return run;
};

describe("19047 The Goblin's Task (stage 1)", () => {
  it("19047:A:1 Setup: the first player takes control of Urdug, the other objectives wait set aside, and a location for each player joins the staging area", () => {
    for (const seats of [1, 2] as const) {
      const t = rhovanionTable(world, { seats, setAside: [CODES.urdug, CODES.tiny, CODES.durinSKey, CODES.urdugSHorn], deck: [CODES.slopesOfEredMithrin, "f0", CODES.greyMoorland, "treachery", CODES.deepRavine] });
      const run = resolveRecords(t.state, t.ctx, CODES.stage1, "setup", t.state.questStage ?? undefined);
      expect(run.state.cards[idOf(run.state, CODES.urdug)], `${seats} seats`).toMatchObject({ zone: "play", controller: 0, face: "up" });
      expect(codesIn(run.state, "setAside").sort()).toEqual([CODES.tiny, CODES.durinSKey, CODES.urdugSHorn].sort());
      const staged = codesIn(run.state, "staging");
      expect(staged, `${seats} seats`).toHaveLength(seats);
      for (const code of staged) expect(world.cards.get(code)?.type).toBe("location");
    }
  });

  it("19047:A:1 the encounter deck is shuffled with the game's seed before the locations are discarded", () => {
    const orders = [3, 4, 5, 6].map((seed) => {
      const t = rhovanionTable(world, { seed, setAside: [CODES.urdug], deck: [CODES.slopesOfEredMithrin, CODES.greyMoorland, CODES.deepRavine, "place", "f0", "f3", "treachery"] });
      return codesIn(resolveRecords(t.state, t.ctx, CODES.stage1, "setup", t.state.questStage ?? undefined).state, "staging").join();
    });
    expect(new Set(orders).size).toBeGreaterThan(1);
  });

  it("19047:B:1 no progress can be placed on the locations in the staging area", () => {
    const t = rhovanionTable(world, { staging: [CODES.greyMoorland] });
    expect(flagged(t.state, idOf(t.state, CODES.greyMoorland), "noProgressPlaced")).toBe(true);
    const later = rhovanionTable(world, { stage: "19048", staging: [CODES.greyMoorland] });
    expect(flagged(later.state, idOf(later.state, CODES.greyMoorland), "noProgressPlaced")).toBe(false);
  });

  // The active location is a Slopes of Ered Mithrin one point short of explored (the cards of the deck are spawned first, so the active one is found by its zone).
  const exploring = (layout: Layout = {}) => {
    const t = rhovanionTable(world, { active: CODES.slopesOfEredMithrin, deck: ["f0", "f3", "place", "treachery", "f0"], play: [CODES.urdug], ...layout });
    const active = t.state.activeLocation!;
    return { t, nearly: updateCard(t.state, active, { progress: (world.cards.get(CODES.slopesOfEredMithrin)?.questPoints ?? 4) - 1 }), moorland: active };
  };

  it("19047:B:2 when the active location is explored with the first player controlling Urdug, the quest proceeds to a random stage 2", () => {
    const reached = new Set<string>();
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const { t, nearly, moorland } = exploring({ seed, setAside: [CODES.tiny, CODES.urdugSHorn, CODES.durinSKey], deck: [CODES.greyMoorland, CODES.greyMountainGiant, CODES.deepRavine, "f0", "f3"] });
      const run = quest(t, nearly);
      expect(run.state.cards[moorland]?.zone, `seed ${seed}`).not.toBe("activeLocation");
      const code = stageOf(run.state);
      expect(TWOS, `seed ${seed}`).toContain(code);
      reached.add(code ?? "");
      // The other two stage 2 cards wait in the quest deck, stage 3 below them.
      expect(zoneOfStage(run.state, CODES.stage1)).not.toBe("questStage");
      expect(zoneOfStage(run.state, CODES.stage5)).toBe("questDeck");
      expect(TWOS.filter((other) => other !== code).every((other) => zoneOfStage(run.state, other) === "questDeck")).toBe(true);
    }
    expect(reached.size).toBeGreaterThan(1);
  });

  it("19047:B:2 the same seed gives the same stage 2", () => {
    const first = [1, 2].map(() => {
      const { t, nearly } = exploring({ seed: 5, setAside: [CODES.tiny, CODES.urdugSHorn, CODES.durinSKey], deck: [CODES.greyMoorland, CODES.greyMountainGiant, CODES.deepRavine, "f0", "f3"] });
      return stageOf(quest(t, nearly).state);
    });
    expect(first[0]).toBe(first[1]);
  });

  it("19047:B:2 without Urdug under the first player's control the quest stays at stage 1", () => {
    const { t, nearly, moorland } = exploring({ play: [], staging: [CODES.urdug, CODES.sneakingOff] });
    const guarded = guardWith(nearly, idOf(nearly, CODES.sneakingOff), idOf(nearly, CODES.urdug));
    const run = quest(t, guarded);
    expect(run.state.cards[moorland]?.zone).not.toBe("activeLocation");
    expect(stageOf(run.state)).toBe(CODES.stage1);
  });

  it("stage places: the three stage 2 cards share one place of three", () => {
    const t = rhovanionTable(world, {});
    expect([CODES.stage1, CODES.stage2, CODES.stage3, CODES.stage4, CODES.stage5].map((code) => stagePlace(t.state, code))).toEqual([
      { at: 1, of: 3 },
      { at: 2, of: 3 },
      { at: 2, of: 3 },
      { at: 2, of: 3 },
      { at: 3, of: 3 },
    ]);
  });
});

describe("19048 Rescue Tiny, 19049 Retrieve Urdug's Horn, 19050 Find Durin's Key (stage 2)", () => {
  const revealed = (stage: string, layout: Layout = {}) => {
    const t = rhovanionTable(world, { stage: stage as (typeof STAGES)[number], setAside: [CODES.tiny, CODES.urdugSHorn, CODES.durinSKey], play: [CODES.urdug], deck: ["f0", CODES.greyMoorland, CODES.greyMountainGiant, CODES.deepRavine, "f3"], ...layout });
    return { t, run: resolveRecords(t.state, t.ctx, stage, "whenRevealed", t.state.questStage ?? undefined) };
  };
  const cases = [
    { stage: CODES.stage2, line: "19048:A:1", guard: CODES.greyMoorland, objective: CODES.tiny },
    { stage: CODES.stage3, line: "19049:A:1", guard: CODES.greyMountainGiant, objective: CODES.urdugSHorn },
    { stage: CODES.stage4, line: "19050:A:1", guard: CODES.deepRavine, objective: CODES.durinSKey },
  ] as const;

  for (const { stage, line, guard, objective } of cases) {
    it(`${line} When Revealed: the guard is found in the encounter deck, joins the staging area and guards the set-aside objective; the deck is shuffled`, () => {
      const { run } = revealed(stage);
      const found = run.state.cards[idOf(run.state, guard)]!;
      const held = run.state.cards[idOf(run.state, objective)]!;
      expect(held).toMatchObject({ zone: "staging", controller: null });
      expect(found).toMatchObject({ zone: "staging", host: held.id, guard: true });
      expect(codesIn(run.state, "encounterDeck")).toHaveLength(4);
      // The other objectives stay set aside, and the guard is not found twice.
      expect(codesIn(run.state, "setAside").filter((code) => world.cards.get(code)?.type === "objective")).toHaveLength(2);
    });

    it(`${line} the guard is also found in the discard pile, and the other players each reveal an encounter card`, () => {
      const { run } = revealed(stage, { seats: 2, deck: ["f0", "f3", "place"], discard: [guard] });
      expect(run.state.cards[idOf(run.state, objective)]).toMatchObject({ zone: "staging" });
      expect(run.state.cards[idOf(run.state, guard)]?.guard).toBe(true);
      // The second player revealed one card from the top of the deck.
      expect(codesIn(run.state, "encounterDeck")).toHaveLength(2);
      expect(codesIn(run.state, "staging").filter((code) => code === "f0" || code === "f3" || code === "place").length + codesIn(run.state, "encounterDiscard").length).toBeGreaterThan(0);
    });

    // User ruling (2026-11-05): a search that finds no copy of the guard brings the objective into the staging area unguarded, and the first player claims it at once.
    it(`${line} with no ${guard} to find the objective comes into the staging area unguarded and the first player claims it at once`, () => {
      const { run } = revealed(stage, { deck: ["f0", "f3"], campaign: true });
      const card = run.state.cards[idOf(run.state, objective)]!;
      expect(codesIn(run.state, "setAside")).not.toContain(objective);
      expect(card.guard, "unguarded").not.toBe(true);
      expect(card.zone, "no longer in the staging area").not.toBe("staging");
      expect(card.controller, "claimed by the first player").toBe(0);
      // A claim: the campaign card (12184:B:1) asked about trust, and the first answer (trust) put a resource on Urdug.
      expect(run.state.cards[idOf(run.state, CODES.urdug)]?.resources, "asked about trust").toBe(1);
    });
  }

  // A Response that cancels the When Revealed effects of the card just revealed, on an attachment in play.
  const cancels: Effect = { id: "blade:response:9", cardCode: "blade", lines: ["blade:A:1"], timing: "response", trigger: "whenRevealedPending", instructions: [{ verb: "CancelEffect" }] };
  const offered = (stage: string, revealed: string): string[] => {
    const t = rhovanionTable(world, { stage: stage as (typeof STAGES)[number] });
    const ctx = { ...t.ctx, effects: [...t.ctx.effects, cancels], cards: new Map([...t.ctx.cards, ["blade", definePrinted({ code: "blade", name: "Blade", type: "attachment" })]]) };
    const blade = spawn(t.state, "blade", { zone: "play", seat: 0 });
    const card = spawn(attachTo(blade.state, blade.id, t.hero), revealed, { zone: "staging" });
    const opened = offerResponses(card.state, { trigger: "whenRevealedPending", seat: 0, subject: card.id }, ctx, []);
    const top = opened.stack[opened.stack.length - 1];
    return top?.data.kind === "responses" ? top.data.offers.map((offer) => offer.effectId) : [];
  };

  it("19048:B:1 the When Revealed effects of treachery cards cannot be canceled; those of other cards can", () => {
    expect(offered("19049", CODES.harshWeather)).toEqual(["blade:response:9"]);
    expect(offered("19048", CODES.harshWeather)).toEqual([]);
    expect(offered("19048", CODES.wilderlandBear)).toEqual(["blade:response:9"]);
  });

  it("19048:B:3 the players cannot travel to the Grey Moorland guarding Tiny without 5 progress on this stage, but may travel to another Grey Moorland", () => {
    for (const progress of [0, 4, 5]) {
      const t = rhovanionTable(world, { stage: "19048", progress, staging: [CODES.greyMoorland, CODES.greyMoorland, CODES.tiny] });
      const [guarding, other] = [0, 1].map((at) => Object.values(t.state.cards).filter((card) => card.code === CODES.greyMoorland)[at]!.id);
      const held = guardWith(t.state, guarding!, idOf(t.state, CODES.tiny));
      expect(travelBlocked(held, t.ctx, guarding!), `${progress} progress`).toBe(progress < 5);
      expect(travelBlocked(held, t.ctx, other!), `${progress} progress`).toBe(false);
    }
  });

  it("19048:B:3 the stage cannot be defeated unless the first player controls Urdug and Tiny", () => {
    const t = rhovanionTable(world, { stage: "19048", play: [CODES.urdug, CODES.tiny] });
    expect(restricted(t.state, t.ctx, "advance")).toHaveLength(0);
    const noTiny = rhovanionTable(world, { stage: "19048", play: [CODES.urdug] });
    expect(restricted(noTiny.state, noTiny.ctx, "advance").length).toBeGreaterThan(0);
    const noUrdug = rhovanionTable(world, { stage: "19048", play: [CODES.tiny] });
    expect(restricted(noUrdug.state, noUrdug.ctx, "advance").length).toBeGreaterThan(0);
    // Guarded in the staging area, Urdug is not under the first player's control.
    const guarded = rhovanionTable(world, { stage: "19048", play: [CODES.tiny], staging: [CODES.urdug, CODES.sneakingOff] });
    expect(restricted(guardWith(guarded.state, idOf(guarded.state, CODES.sneakingOff), idOf(guarded.state, CODES.urdug)), guarded.ctx, "advance").length).toBeGreaterThan(0);
  });

  it("19049:B:1 each enemy that guards a card gets +2 Threat and +2 Defense", () => {
    const t = rhovanionTable(world, { stage: "19049", staging: [CODES.greyMountainGiant, CODES.urdugSHorn, "f3"] });
    const held = syncConstants(guardWith(t.state, idOf(t.state, CODES.greyMountainGiant), idOf(t.state, CODES.urdugSHorn)), t.ctx);
    const giant = held.cards[idOf(held, CODES.greyMountainGiant)]!;
    const printed = world.cards.get(CODES.greyMountainGiant)!;
    expect(modifiedStat(held, giant, "threat", world.cards)).toBe((printed.threat ?? 0) + 2);
    expect(modifiedStat(held, giant, "defense", world.cards)).toBe((printed.defense ?? 0) + 2);
    const free = held.cards[idOf(held, "f3")]!;
    expect(modifiedStat(held, free, "threat", world.cards)).toBe(3);
    // An enemy guarding a card by holding it under it (Hobgoblin) counts too.
    const hobgoblin = rhovanionTable(world, { stage: "19049", engaged: [CODES.hobgoblin] });
    expect(modifiedStat(hobgoblin.state, hobgoblin.state.cards[idOf(hobgoblin.state, CODES.hobgoblin)]!, "defense", world.cards)).toBe(world.cards.get(CODES.hobgoblin)?.defense);
  });

  it("19049:B:3 the Giant guarding the Horn cannot take damage without 5 progress on this stage", () => {
    for (const progress of [0, 5]) {
      const t = rhovanionTable(world, { stage: "19049", progress, staging: [CODES.greyMountainGiant, CODES.greyMountainGiant, CODES.urdugSHorn] });
      const [guarding, other] = Object.values(t.state.cards).filter((card) => card.code === CODES.greyMountainGiant).map((card) => card.id);
      const held = syncConstants(guardWith(t.state, guarding!, idOf(t.state, CODES.urdugSHorn)), t.ctx);
      expect(flagged(held, guarding!, "cannotTakeDamage"), `${progress} progress`).toBe(progress < 5);
      expect(flagged(held, other!, "cannotTakeDamage"), `${progress} progress`).toBe(false);
    }
  });

  it("19049:B:3 the stage cannot be defeated unless the first player controls Urdug with the Horn attached", () => {
    const t = rhovanionTable(world, { stage: "19049", play: [CODES.urdug] });
    expect(restricted(t.state, t.ctx, "advance").length).toBeGreaterThan(0);
  });

  it("19050:B:1 each encounter card guarding a card is immune to player card effects", () => {
    const t = rhovanionTable(world, { stage: "19050", staging: [CODES.deepRavine, CODES.durinSKey, CODES.greyMoorland] });
    const held = settled(t, guardWith(t.state, idOf(t.state, CODES.deepRavine), idOf(t.state, CODES.durinSKey)));
    expect(flagged(held, idOf(held, CODES.deepRavine), "immuneToPlayerCards")).toBe(true);
    expect(flagged(held, idOf(held, CODES.greyMoorland), "immuneToPlayerCards")).toBe(false);
  });

  it("19050:B:3 the players cannot travel to the Deep Ravine guarding Durin's Key without 5 progress on this stage", () => {
    for (const progress of [0, 5]) {
      const t = rhovanionTable(world, { stage: "19050", progress, staging: [CODES.deepRavine, CODES.durinSKey] });
      const held = guardWith(t.state, idOf(t.state, CODES.deepRavine), idOf(t.state, CODES.durinSKey));
      expect(travelBlocked(held, t.ctx, idOf(held, CODES.deepRavine)), `${progress} progress`).toBe(progress < 5);
    }
  });

  it("19050:B:3 the stage cannot be defeated unless the players control Urdug and Durin's Key", () => {
    const t = rhovanionTable(world, { stage: "19050", play: [CODES.urdug] });
    expect(restricted(t.state, t.ctx, "advance").length).toBeGreaterThan(0);
  });
});

describe("the stage 2 cards in a random order, then stage 3", () => {
  // The stage 2 card in play with 4 of its 5 progress and what its line asks of the players: Urdug and Tiny (19048), Urdug with the Horn on him (19049), Urdug and Durin's Key on a hero (19050).
  // The stage 2 cards named in `left` still wait in the quest deck; the others were played and are gone.
  const nearlyDone = (stage: string, left: readonly string[], seed: number): { t: Table; state: ScenarioState } => {
    const t = rhovanionTable(world, { seed, stage: stage as (typeof STAGES)[number], progress: 4, play: stage === CODES.stage2 ? [CODES.urdug, CODES.tiny] : [CODES.urdug], deck: ["f0", "f3", "place"] });
    let state = t.state;
    for (const code of TWOS.filter((other) => other !== stage)) state = moveCard(state, idOf(state, code), { zone: left.includes(code) ? "questDeck" : "removed" });
    if (stage === CODES.stage3) {
      const horn = spawn(state, CODES.urdugSHorn, { zone: "attached" });
      state = updateCard(attachTo(horn.state, horn.id, idOf(state, CODES.urdug)), horn.id, { claimed: true, controller: 0, face: "up" });
    }
    if (stage === CODES.stage4) {
      const key = spawn(state, CODES.durinSKey, { zone: "attached" });
      state = updateCard(attachTo(key.state, key.id, t.hero), key.id, { claimed: true, controller: 0, face: "up" });
    }
    return { t, state: syncConstants(state, t.ctx) };
  };

  it("each stage 2 defeated is removed from the game, and the quest proceeds to one of the stage 2 cards left, at random", () => {
    for (const [stage, others] of [[CODES.stage2, [CODES.stage3, CODES.stage4]], [CODES.stage3, [CODES.stage2, CODES.stage4]], [CODES.stage4, [CODES.stage2, CODES.stage3]]] as const) {
      const reached = new Set<string>();
      for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
        const { t, state } = nearlyDone(stage, others, seed);
        expect(restricted(state, t.ctx, "advance"), `${stage} can be defeated`).toHaveLength(0);
        const run = quest(t, state);
        expect(zoneOfStage(run.state, stage), `${stage} seed ${seed}`).toBe("removed");
        const code = stageOf(run.state);
        expect(others, `${stage} seed ${seed}`).toContain(code);
        reached.add(code ?? "");
      }
      expect(reached.size, stage).toBe(2);
    }
  });

  it("with no stage 2 left, the quest proceeds to stage 3, whose When Revealed flips Urdug and Tiny to their enemy sides in the staging area, keeping what is attached to Urdug", () => {
    const { t, state } = nearlyDone(CODES.stage3, [], 1);
    const tiny = spawn(state, CODES.tiny, { zone: "play", seat: 0 });
    const run = quest(t, tiny.state);
    expect(zoneOfStage(run.state, CODES.stage3)).toBe("removed");
    expect(stageOf(run.state)).toBe(CODES.stage5);
    const urdug = Object.values(run.state.cards).find((card) => card.code === CODES.urdugEnemy)!;
    expect(urdug).toMatchObject({ zone: "staging", controller: null });
    expect(run.state.cards[idOf(run.state, CODES.tinyEnemy)]).toMatchObject({ zone: "staging", controller: null });
    expect(run.state.cards[idOf(run.state, CODES.urdugSHorn)]).toMatchObject({ zone: "attached", host: urdug.id });
  });

  it("the stage cannot be defeated while its line is unmet: the quest keeps its 5 progress and stays at the stage", () => {
    const t = rhovanionTable(world, { stage: "19048", progress: 4, play: [CODES.urdug], deck: ["f0", "f3", "place"] });
    const run = quest(t, t.state);
    expect(stageOf(run.state)).toBe(CODES.stage2);
    // A stage that cannot advance has no upper limit on its progress (faq.progress-without-advancing).
    expect(run.state.cards[t.state.questStage ?? ""]?.progress).toBeGreaterThanOrEqual(5);
  });
});

describe("19051 Urdug's Gambit (stage 3)", () => {
  const gambit = (layout: Layout = {}) => rhovanionTable(world, { stage: "19051", ...layout });

  it("19051:A:1 When Revealed: Urdug and Tiny turn to their enemy sides in the staging area with their damage removed and their resources kept; the other players reveal an encounter card", () => {
    const t = rhovanionTable(world, { seats: 2, stage: "19051", play: [CODES.urdug, CODES.tiny] });
    const urdug = idOf(t.state, CODES.urdug);
    const tiny = idOf(t.state, CODES.tiny);
    const hurt = updateCard(updateCard(t.state, urdug, { damage: 3, resources: 2, exhausted: true }), tiny, { damage: 4 });
    const withDeck = { ...hurt };
    const run = resolveRecords(withDeck, t.ctx, CODES.stage5, "whenRevealed", t.state.questStage ?? undefined);
    expect(run.state.cards[urdug]).toMatchObject({ code: CODES.urdugEnemy, zone: "staging", controller: null, damage: 0, resources: 2, exhausted: false });
    expect(run.state.cards[tiny]).toMatchObject({ code: CODES.tinyEnemy, zone: "staging", controller: null, damage: 0 });
    expect(run.state.seats[0]?.play).toEqual([]);
  });

  it("19051:B:1 progress cannot be placed on the quest from questing successfully", () => {
    const t = gambit({ staging: [CODES.urdugEnemy, CODES.tinyEnemy] });
    const run = quest(t, t.state);
    expect(run.state.cards[t.state.questStage ?? ""]?.progress).toBe(0);
  });

  it("19051:B:2 when the players quest unsuccessfully they do not raise their threat: the amount goes on the stage as progress", () => {
    // Staging Threat 8 against 4 Willpower: the quest fails by 4.
    const t = gambit({ seats: 2, staging: [CODES.greyMountainGiant, CODES.huntingEagle, CODES.wilderlandBear], threat: [30, 31] });
    const needed = world.cards.get(CODES.greyMountainGiant)!.threat! + world.cards.get(CODES.huntingEagle)!.threat! + world.cards.get(CODES.wilderlandBear)!.threat!;
    const run = quest(t, t.state);
    expect(run.state.seats.map((seat) => seat.threat)).toEqual([30, 31]);
    const progress = run.state.cards[t.state.questStage ?? ""]?.progress ?? 0;
    // Two heroes of 2 Willpower each commit for seat 0; the shortfall is placed once, however many players there are.
    expect(progress).toBe(needed - 4);
    expect(run.state.lost).toBeFalsy();
  });

  it("19051:B:2 the players lose the game when the stage holds as much progress as its quest points", () => {
    const t = gambit({ staging: [CODES.greyMountainGiant, CODES.huntingEagle, CODES.wilderlandBear], threat: [30, 31] });
    const nearly = updateCard(t.state, t.state.questStage!, { progress: 4 });
    const run = quest(t, nearly);
    expect(run.state.lost).toBe(true);
    expect(run.state.cards[t.state.questStage ?? ""]?.progress).toBeGreaterThanOrEqual(5);
  });

  it("19051:B:2 the stage is never defeated by progress", () => {
    const t = gambit({ staging: [CODES.urdugEnemy] });
    const full = updateCard(t.state, t.state.questStage!, { progress: 9 });
    const run = settled(t, full);
    expect(run.stageCleared).toBeFalsy();
    expect(run.questStage).toBe(t.state.questStage);
  });

  it("19051:B:3 when Urdug has no hit points remaining the players win the game", () => {
    const hp = world.cards.get(CODES.urdugEnemy)?.health ?? 5;
    for (const [damage, won] of [[hp - 1, false], [hp, true], [hp + 4, true]] as const) {
      const t = gambit({ staging: [{ code: CODES.urdugEnemy, damage }] });
      const run = settled(t, t.state);
      expect(Boolean(run.stageCleared), `${damage} damage`).toBe(won);
    }
    // With Urdug out of play (still an objective ally) nothing is won.
    const early = gambit({ play: [CODES.urdug] });
    expect(settled(early, early.state).stageCleared).toBeFalsy();
  });
});
