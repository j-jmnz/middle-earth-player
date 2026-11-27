// Rules: hrd.track, hrd.track-example, hrd.search-objective, bts.valour, rr.forced, rr.response, rr.shadow-effects, rr.travel, rr.reveal (data/rules/entries.json); ledger lines 17065:A:1, 17065:A:2, 17065:A:3, 17066:A:1, 17066:A:2, 17067:A:1, 17067:A:2,
// 17068:A:1, 17068:A:2, 17068:A:3, 17069:A:1, 17069:A:2, 17069:A:3, 17070:A:1, 17070:A:2, 17071:A:1, 17071:A:2, 17071:A:3, 17072:A:1, 17072:A:2, 17072:A:3, 17073:A:1, 17073:A:2, 17074:A:1, 17074:A:2, 17075:A:1, 17075:A:2, 17076:A:1, 17076:B:1,
// 17077:A:1, 17077:B:1, 17078:A:1, 17078:B:1, 17078:B:2, 17078:B:3, 17079:A:1, 17079:A:2, 17080:A:1, 17080:A:2.
// An audit of Beneath the Sands (card-audit): each test is built from the printed words, the rule spans and the rulings of docs/scenarios/haradrim/beneath-the-sands.md, on the smallest table of the scene kit. A line's test runs again without the line's
// records and must fail there (`lineSpec`). The player cards of the other packs that a test plays (Ride to Ruin) have no ledger entry, so they are sent through `sendUnledgered`. Track is reached by a real travel, a Shadow line by a real attack (`fightEnemy`), a quest-phase Forced effect by the quest phase played to its end.
import { describe, expect, it } from "vitest";

import type { Effect } from "../../../catalog/boundary.ts";
import { EFFECTS } from "../../../effects/index.ts";
import { type ScenarioState } from "../../../rules/core/state.ts";
import { startScenario } from "../../../rules/engine/reduce.ts";
import type { PlayerIntent } from "../../../rules/engine/reduce.ts";
import { stagingThreat } from "../../../rules/quest/quest.ts";
import { codesIn, engagedCodes, finish, idOf, legalIntents, resolveRecords, revealFromTop, send, start, tableFromLayout, zoneOf, type Layout, type Run } from "../../../../test/harness/scene-kit.ts";
import { buildStart } from "../../start.ts";
import { loadAnyScenario, loadCampaigns } from "../../../../scripts/data/load-scenarios.ts";
import { lineSpec } from "../../../../test/harness/line-spec.ts";
import { sendUnledgered } from "../../../../test/harness/player-table.ts";
import { SID, BROOD, GUARDIAN, BROODLING, TUNNEL, NEST, CAVERN, PASSAGE, FORCED, GRABBED, LOST, CAVES, CLOSER, HIVE, OFF, ON, VIPER, SCORPION, PLACE, EOWYN, INJURED, tableOf, inDiscard, inDeck, has, resourcesOf, damageOf, travelTo, revealed, questPhase, questedTo, hitFor, SAFE_DECK, progressOf, threatsOf, surviving } from "./audit-kit.ts";

describe("17069:A:1 17070:A:1 17071:A:1 17072:A:1 Track X", () => {
  // The Travel effect of Pitch Black Tunnel reveals the top card (a filler enemy); that of Nest of Vermin discards from the top until a Creature (a Sand Viper) is discarded and adds it to the staging area.
  const TRACKS: [string, string, number, string[]][] = [
    ["17069:A:1", TUNNEL, 4, ["f0"]],
    ["17070:A:1", NEST, 3, [VIPER]],
    ["17071:A:1", CAVERN, 2, []],
    ["17072:A:1", PASSAGE, 2, []],
  ];
  for (const [line, code, x, pre] of TRACKS) {
    // Nest of Vermin's own Travel effect shuffles the discard pile into the deck (the whole deck is reordered), so its Track is tested on decks of one kind of card (see the next describe).
    if (code === NEST) continue;
    const filler = Array.from({ length: x + 2 }, () => INJURED);
    const deckOf = (cards: readonly string[]): string[] => [...pre, ...cards];
    lineSpec(line, `after the players travel to the location while Off Track, ${x} cards are discarded from the encounter deck, no more; no marker leaves Off Track and its resources`, (effects) => {
      for (const seats of [1, 2] as const) {
        const { state } = travelTo(effects, { seats, staging: [{ code: OFF, resources: 2 }, code], deck: deckOf(filler) }, code);
        expect(inDiscard(state)).toHaveLength(x);
        expect(inDeck(state)).toHaveLength(2);
        expect(has(state, "staging", OFF)).toBe(true);
        expect(resourcesOf(state, OFF)).toBe(2);
      }
    });
    lineSpec(line, `a card that prints On Track among the ${x} discarded flips the objective to On Track and discards its resources; one past the ${x}th does not`, (effects) => {
      for (const seats of [1, 2] as const) {
        const last = [...filler.slice(0, x - 1), GUARDIAN, ...filler.slice(x - 1)];
        const flipped = travelTo(effects, { seats, staging: [{ code: OFF, resources: 2 }, code], deck: deckOf(last) }, code).state;
        expect(has(flipped, "staging", ON)).toBe(true);
        expect(has(flipped, "staging", OFF)).toBe(false);
        expect(resourcesOf(flipped, ON)).toBe(0);
        const beyond = [...filler.slice(0, x), GUARDIAN, ...filler.slice(x)];
        const stays = travelTo(effects, { seats, staging: [{ code: OFF, resources: 2 }, code], deck: deckOf(beyond) }, code).state;
        expect(has(stays, "staging", OFF)).toBe(true);
        expect(resourcesOf(stays, OFF)).toBe(2);
      }
    });
    lineSpec(line, "the On Track marker is read from each of the five cards that print it, and from no other card", (effects) => {
      for (const marker of [GUARDIAN, BROODLING, TUNNEL, NEST, PASSAGE]) {
        const state = travelTo(effects, { seats: 1, staging: [OFF, code], deck: deckOf([marker, ...filler.slice(1)]) }, code).state;
        expect(has(state, "staging", ON), marker).toBe(true);
      }
      const none = travelTo(effects, { seats: 1, staging: [OFF, code], deck: deckOf([CAVERN, VIPER, FORCED, GRABBED, ...filler]).slice(0, pre.length + x) }, code).state;
      expect(has(none, "staging", OFF)).toBe(true);
      expect(inDiscard(none)).toHaveLength(x);
    });
    {
      lineSpec(line, "an empty encounter deck is refilled from the discard pile and the discard goes on; X cards are discarded in all", (effects) => {
        const empty = travelTo(effects, { seats: 1, staging: [OFF, code], deck: deckOf([]), discard: [GUARDIAN, ...filler.slice(0, x - 1)] }, code).state;
        expect(has(empty, "staging", ON)).toBe(true);
        expect(inDiscard(empty)).toHaveLength(x);
        const plain = travelTo(effects, { seats: 1, staging: [OFF, code], deck: deckOf([]), discard: filler }, code).state;
        expect(inDiscard(plain)).toHaveLength(x);
        expect(inDeck(plain)).toHaveLength(filler.length - x);
        expect(has(plain, "staging", OFF)).toBe(true);
      });
    }
    lineSpec(line, "while On Track is in play nothing is discarded; while Lost Underground is in play Track does not resolve at all", (effects) => {
      const off = travelTo(effects, { seats: 1, staging: [OFF, code], deck: deckOf(filler) }, code).state;
      expect(inDiscard(off)).toHaveLength(x);
      const on = travelTo(effects, { seats: 1, staging: [ON, code], deck: deckOf(filler) }, code).state;
      expect(inDiscard(on)).toHaveLength(0);
      const lost = travelTo(effects, { seats: 1, staging: [OFF, code, LOST], deck: deckOf([GUARDIAN, ...filler]) }, code).state;
      expect(inDiscard(lost)).toHaveLength(0);
      expect(has(lost, "staging", OFF)).toBe(true);
    });
  }
});

describe("17070:A:1 Track 3 after the Travel effect of Nest of Vermin", () => {
  // The Travel effect shuffles the deck and discards a Creature to the staging area; a deck of one kind of card makes the order of the shuffle matter nothing.
  const nest = (effects: readonly Effect[], staging: Layout["staging"], deck: readonly string[], seats: 1 | 2 = 1): ScenarioState => travelTo(effects, { seats, staging, deck }, NEST).state;
  lineSpec("17070:A:1", "3 cards are discarded after the Travel effect has discarded its Creature, and no more; with no marker the objective stays Off Track with its resources", (effects) => {
    for (const seats of [1, 2] as const) {
      const state = nest(effects, [{ code: OFF, resources: 2 }, NEST], Array.from({ length: 6 }, () => VIPER), seats);
      expect(inDiscard(state)).toHaveLength(3);
      expect(has(state, "staging", OFF)).toBe(true);
      expect(resourcesOf(state, OFF)).toBe(2);
    }
  });
  lineSpec("17070:A:1", "a discarded card that prints On Track flips the objective to On Track and discards its resources", (effects) => {
    for (const seats of [1, 2] as const) {
      const state = nest(effects, [{ code: OFF, resources: 2 }, NEST], Array.from({ length: 6 }, () => GUARDIAN), seats);
      expect(inDiscard(state)).toHaveLength(3);
      expect(has(state, "staging", ON)).toBe(true);
      expect(has(state, "staging", OFF)).toBe(false);
      expect(resourcesOf(state, ON)).toBe(0);
    }
  });
  lineSpec("17070:A:1", "while On Track is in play nothing is discarded by Track; while Lost Underground is in play Track does not resolve at all", (effects) => {
    const off = nest(effects, [OFF, NEST], Array.from({ length: 6 }, () => VIPER));
    expect(inDiscard(off)).toHaveLength(3);
    const on = nest(effects, [ON, NEST], Array.from({ length: 6 }, () => VIPER));
    expect(inDiscard(on)).toHaveLength(0);
    const lost = nest(effects, [OFF, NEST, LOST], Array.from({ length: 6 }, () => GUARDIAN));
    expect(inDiscard(lost)).toHaveLength(0);
    expect(has(lost, "staging", OFF)).toBe(true);
  });
});

describe("17069:A:2 X is the number of characters the first player controls", () => {
  lineSpec("17069:A:2", "the Threat counts the characters the first player controls (heroes and allies), not another player's", (effects) => {
    const threatWith = (layout: Layout): number => {
      const made = tableOf(effects)({ staging: [TUNNEL], ...layout });
      return stagingThreat(made.state, made.ctx.cards);
    };
    expect(threatWith({ seats: 1 })).toBe(2);
    expect(threatWith({ seats: 1, play: ["ally"] })).toBe(3);
    expect(threatWith({ seats: 2, play: [{ code: "ally", seat: 1 }] })).toBe(2);
    expect(threatWith({ seats: 2, play: [{ code: "ally", seat: 0 }] })).toBe(3);
    // The second player is the first player: one hero, and the ally.
    expect(threatWith({ seats: 2, firstPlayer: 1, play: [{ code: "ally", seat: 1 }] })).toBe(2);
    expect(threatWith({ seats: 2, firstPlayer: 1, play: [{ code: "ally", seat: 0 }] })).toBe(1);
  });
});

describe("17075 Lost Underground", () => {
  lineSpec("17075:A:1", "When Revealed: the objective flips to Off Track, also from On Track; already Off Track nothing changes", (effects) => {
    for (const seats of [1, 2] as const) {
      const flipped = revealed(tableOf(effects)({ seats, staging: [{ code: ON }], deck: ["f0", "f0"] }), LOST).state;
      expect(has(flipped, "staging", OFF)).toBe(true);
      expect(has(flipped, "staging", ON)).toBe(false);
      const stays = revealed(tableOf(effects)({ seats, staging: [OFF], deck: ["f0", "f0"] }), LOST).state;
      expect(has(stays, "staging", OFF)).toBe(true);
      expect(has(stays, "staging", ON)).toBe(false);
    }
  });
  lineSpec("17075:A:1", "while Lost Underground is in play the objective cannot flip: neither Forced Off Track nor an unsuccessful quest turns On Track over", (effects) => {
    const forced = revealed(tableOf(effects)({ seats: 1, staging: [ON, LOST], deck: ["f0", "f0"] }), FORCED, undefined, "flip").state;
    expect(has(forced, "staging", ON)).toBe(true);
    expect(has(forced, "staging", OFF)).toBe(false);
    // No hero is committed, the Scorpion's Threat 3 beats willpower 0: the quest fails and On Track would flip.
    const failed = questedTo(effects, { seats: 1, staging: [ON, LOST, SCORPION], deck: SAFE_DECK }, { commit: false });
    expect(has(failed, "staging", ON)).toBe(true);
    const free = questedTo(effects, { seats: 1, staging: [ON, SCORPION], deck: SAFE_DECK }, { commit: false });
    expect(has(free, "staging", OFF)).toBe(true);
  });
  // The clause "ignore its Forced effects until the end of the phase" has no test: whether the lasting effect still holds when On Track's own Forced effect "at the end of the quest phase" is heard is settled by no doc (open point in the report).
  // The engine goes on to the end of the quest phase at once after the Response, so the flip is read from the steps and from the resources the flip discarded.
  lineSpec("17075:A:2", "Response: when the side quest is defeated the objective flips to On Track and its resources are discarded; without the Response nothing flips", (effects) => {
    const flips = (run: Run): number => run.steps.filter((step) => step.kind === "searchFlip" && step.to === "onTrack").length;
    for (const seats of [1, 2] as const) {
      const layout: Layout = { seats, phase: "Planning", staging: [{ code: OFF, resources: 2 }, { code: LOST, progress: 1 }], deck: ["f0", "f0", "f0", "f0"] };
      const made = tableOf(effects)(layout);
      const used = questPhase(made, made.state, { keys: [LOST, "threat"], trigger: LOST, stopAtTrigger: true });
      expect(zoneOf(used.state, LOST)).toBe("victory");
      expect(flips(used)).toBe(1);
      const declined = questPhase(made, made.state, { keys: [LOST, "threat"] });
      expect(zoneOf(declined.state, LOST)).toBe("victory");
      expect(flips(declined)).toBe(0);
      expect(resourcesOf(declined.state, OFF)).toBe(3);
      expect(resourcesOf(used.state, ON)).toBe(0);
    }
  });
});

describe("17075:A:2 Lost Underground, the Forced effects On Track ignores until the end of the phase", () => {
  // "Until the end of the phase" includes the end of that phase: On Track's "At the end of the quest phase" Forced (17080:A:1) does not fire in the phase the side quest was defeated (docs/scenarios/haradrim/beneath-the-sands.md, Lost Underground).
  lineSpec("17075:A:2", "the Forced effect On Track has at the end of the quest phase does not fire in the phase Lost Underground was defeated, and fires with no Lost Underground", (effects) => {
    const layout: Layout = { seats: 1, phase: "Planning", staging: [{ code: OFF, resources: 2 }, { code: LOST, progress: 1 }], deck: ["f0", "f0", "f0", "f0"] };
    const made = tableOf(effects)(layout);
    // The quest phase is played to its end with the Response taken: the objective stays On Track and nothing is searched at the end of the phase.
    const used = questPhase(made, made.state, { keys: [LOST, "threat"], trigger: LOST });
    expect(zoneOf(used.state, LOST)).toBe("victory");
    expect(used.state.phase).not.toBe("Quest");
    expect(has(used.state, "staging", ON)).toBe(true);
    // The control has On Track in play with no Lost Underground: its Forced effect discards the top 3 cards when the quest phase ends.
    const control = tableOf(effects)({ phase: "Planning", staging: [{ code: ON, resources: 0 }], deck: ["f0", "f0", "f0", "f0", "f0", "f0", "f0"] });
    const normal = questPhase(control, control.state, { keys: ["threat"] });
    expect(inDiscard(normal.state).length).toBeGreaterThanOrEqual(3);
    expect(inDiscard(used.state)).toHaveLength(0);
  });
});

describe("17076:B:1 Searching the Caves", () => {
  const revealStage = (effects: readonly Effect[], layout: Layout): ScenarioState => {
    const made = tableOf(effects)({ stage: CAVES, ...layout });
    return resolveRecords(made.state, made.ctx, CAVES, "whenRevealed", made.state.questStage ?? "").state;
  };
  lineSpec("17076:B:1", "When Revealed: cards are discarded until X locations are discarded, X the number of players, and each location is added to the staging area", (effects) => {
    const deck = ["f0", PLACE, "f0", CAVERN, "f0"];
    const one = revealStage(effects, { seats: 1, deck });
    expect(codesIn(one, "staging")).toEqual([PLACE]);
    expect(inDiscard(one)).toEqual(["f0"]);
    expect(inDeck(one)).toEqual(["f0", CAVERN, "f0"]);
    const two = revealStage(effects, { seats: 2, deck });
    expect(codesIn(two, "staging")).toEqual([CAVERN, PLACE].sort());
    expect(inDiscard(two)).toEqual(["f0", "f0"]);
    expect(inDeck(two)).toEqual(["f0"]);
  });
  lineSpec("17076:B:1", "an encounter deck with too few locations is discarded to its end: no shuffle, the locations found are added", (effects) => {
    const state = revealStage(effects, { seats: 2, deck: ["f0", PLACE], discard: [CAVERN] });
    expect(codesIn(state, "staging")).toEqual([PLACE]);
    expect(inDeck(state)).toHaveLength(0);
    expect(inDiscard(state).sort()).toEqual([CAVERN, "f0"].sort());
  });
});

describe("17077 Getting Closer", () => {
  const revealStage = (effects: readonly Effect[], layout: Layout): ScenarioState => {
    const made = tableOf(effects)({ stage: CLOSER, side: "A", ...layout });
    return resolveRecords(made.state, made.ctx, CLOSER, "whenRevealed", made.state.questStage ?? "").state;
  };
  lineSpec("17077:A:1", "When Revealed: the objective flips to Off Track; the discard pile is shuffled into the deck and cards are discarded until X enemies are discarded, each added to the staging area", (effects) => {
    for (const seats of [1, 2] as const) {
      const state = revealStage(effects, { seats, staging: [ON], deck: [], discard: ["f0", "f0", "f0", INJURED] });
      expect(has(state, "staging", OFF)).toBe(true);
      expect(has(state, "staging", ON)).toBe(false);
      expect(surviving(state, "f0", "staging")).toBe(seats);
      expect(surviving(state, "f0", "encounterDiscard")).toBe(0);
      expect(surviving(state, "f0", "encounterDeck")).toBe(3 - seats);
    }
  });
  lineSpec("17077:A:1", "an enemy is not added before the discard pile is shuffled in: the discard pile's enemies are found; while Lost Underground is in play the flip does nothing but the rest resolves", (effects) => {
    const lost = revealStage(effects, { seats: 1, staging: [ON, LOST], deck: [INJURED], discard: ["f0"] });
    expect(has(lost, "staging", ON)).toBe(true);
    expect(zoneOf(lost, "f0")).toBe("staging");
    const none = revealStage(effects, { seats: 1, staging: [ON], deck: [INJURED], discard: [INJURED] });
    expect(has(none, "staging", OFF)).toBe(true);
    expect(codesIn(none, "staging").filter((code) => code === "f0")).toHaveLength(0);
  });
  lineSpec("17077:B:1", "While On Track is in play encounter card effects cannot be canceled; Off Track a When Revealed effect can be canceled", (effects) => {
    // Heat Exhaustion (16052): each player exhausts a character and deals 1 damage to it. A Test of Will (01050) cancels it; Éowyn pays.
    const reveal = (track: string): { state: ScenarioState; made: ReturnType<typeof tableFromLayout> } => {
      const made = tableFromLayout(SID, { stage: CLOSER, hand: ["01050"], heroes: [{ code: EOWYN, resources: 2 }], staging: [track], deck: ["f0"] }, { effects, extra: ["01050", EOWYN, "16052"] });
      const steps: Parameters<typeof revealFromTop>[3] = [];
      return { state: revealFromTop(made.state, made.ctx, "16052", steps).state, made };
    };
    const hurt = (state: ScenarioState): number => ["dh1", "dh2", EOWYN].reduce((sum, code) => sum + damageOf(state, code), 0);
    const off = reveal(OFF);
    const cancel = legalIntents(off.state, off.made.ctx).find((intent) => intent.type === "Trigger" && off.state.cards[intent.cardId]?.code === "01050");
    expect(cancel).toBeDefined();
    const canceled = sendUnledgered({ state: off.state, steps: [] }, { ...(cancel as Extract<PlayerIntent, { type: "Trigger" }>), payments: [{ heroId: idOf(off.state, EOWYN), amount: 1 }] } as PlayerIntent, off.made.ctx);
    expect(hurt(finish(canceled, off.made.ctx).state)).toBe(0);
    const on = reveal(ON);
    expect(on.state.window?.kind).not.toBe("cancelOffer");
    expect(legalIntents(on.state, on.made.ctx).some((intent) => intent.type === "Trigger" && on.state.cards[intent.cardId]?.code === "01050")).toBe(false);
    expect(hurt(finish({ state: on.state, steps: [] }, on.made.ctx).state)).toBe(1);
  });
});

describe("17078 The Spiders' Hive", () => {
  const revealStage = (effects: readonly Effect[], layout: Layout) => {
    const made = tableOf(effects)({ stage: HIVE, side: "A", setAside: [BROOD], deck: ["f0", "f0"], ...layout });
    return resolveRecords(made.state, made.ctx, HIVE, "whenRevealed", made.state.questStage ?? "");
  };
  lineSpec("17078:A:1", "When Revealed: the first player adds Brood Mother to the staging area (she engages the first player), each other player reveals an encounter card, and the objective flips to Off Track", (effects) => {
    for (const firstPlayer of [0, 1] as const) {
      const done = revealStage(effects, { seats: 2, firstPlayer, staging: [ON] });
      expect(engagedCodes(done.state, firstPlayer)).toContain(BROOD);
      expect(has(done.state, "staging", OFF)).toBe(true);
      const revealers = done.steps.flatMap((step) => (step.kind === "reveal" ? [step.seat] : []));
      expect(revealers).toEqual([1 - firstPlayer]);
      expect(surviving(done.state, "f0", "staging")).toBe(1);
    }
    const solo = revealStage(effects, { seats: 1, staging: [ON] });
    expect(engagedCodes(solo.state)).toContain(BROOD);
    expect(solo.steps.filter((step) => step.kind === "reveal")).toHaveLength(0);
    expect(has(solo.state, "staging", OFF)).toBe(true);
  });
  lineSpec("17078:A:1", "while Lost Underground is in play the objective does not flip, but Brood Mother is still added", (effects) => {
    const done = revealStage(effects, { seats: 1, staging: [ON, LOST] });
    expect(has(done.state, "staging", ON)).toBe(true);
    expect(engagedCodes(done.state)).toContain(BROOD);
  });
  lineSpec("17078:B:1", "While there are at least 5 progress tokens on this stage Brood Mother loses 'Cannot take damage'; with 4 she still takes none", (effects) => {
    expect(hitFor(effects, { stage: HIVE, progress: 5, engaged: [BROOD], staging: [OFF] }, BROOD)).toBeGreaterThan(0);
    expect(hitFor(effects, { stage: HIVE, progress: 4, engaged: [BROOD], staging: [OFF] }, BROOD)).toBe(0);
    expect(hitFor(effects, { stage: HIVE, progress: 5, seats: 2, engaged: [BROOD], staging: [OFF] }, BROOD)).toBeGreaterThan(0);
  });
  const flipForced = (effects: readonly Effect[], layout: Layout): ScenarioState => revealed(tableOf(effects)({ stage: HIVE, progress: 3, deck: ["f0", "f0"], ...layout }), FORCED, undefined, "flip").state;
  lineSpec("17078:B:2", "Forced: after the objective flips to Off Track all progress tokens on this stage are removed; with no flip, or a flip to On Track, they stay", (effects) => {
    for (const seats of [1, 2] as const) {
      const flipped = flipForced(effects, { seats, staging: [ON] });
      expect(has(flipped, "staging", OFF)).toBe(true);
      expect(progressOf(flipped, HIVE)).toBe(0);
      const already = flipForced(effects, { seats, staging: [OFF] });
      expect(progressOf(already, HIVE)).toBe(3);
      const lost = flipForced(effects, { seats, staging: [ON, LOST] });
      expect(progressOf(lost, HIVE)).toBe(3);
    }
    const { state } = travelTo(effects, { seats: 1, stage: HIVE, progress: 3, staging: [OFF, CAVERN], deck: [GUARDIAN, INJURED, INJURED] }, CAVERN);
    expect(has(state, "staging", ON)).toBe(true);
    expect(progressOf(state, HIVE)).toBe(3);
  });
  lineSpec("17078:B:3", "This stage cannot be defeated while Brood Mother is in play (progress stays on it); with no Brood Mother, defeating it wins the game", (effects) => {
    for (const seats of [1, 2] as const) {
      const base: Layout = { seats, stage: HIVE, progress: 3, staging: [ON], deck: SAFE_DECK };
      const guarded = questedTo(effects, { ...base, engaged: [BROOD] });
      expect(guarded.stageCleared).not.toBe(true);
      expect(progressOf(guarded, HIVE)).toBeGreaterThanOrEqual(5);
      const free = questedTo(effects, base);
      expect(free.stageCleared).toBe(true);
      expect(free.lost).not.toBe(true);
    }
    // Brood Mother in the staging area holds the stage as well.
    const staged = questedTo(effects, { seats: 1, stage: HIVE, progress: 5, staging: [ON, BROOD], deck: SAFE_DECK });
    expect(staged.stageCleared).not.toBe(true);
  });
});

describe("17079 Off Track", () => {
  const endOfQuest = (effects: readonly Effect[], layout: Layout, ...keys: string[]): ScenarioState => questedTo(effects, { staging: [{ code: OFF, resources: 1 }], deck: ["f0", "f0"], ...layout }, { commit: false, keys });
  lineSpec("17079:A:1", "Forced: at the end of the quest phase 1 resource is placed here, then each player's threat rises by 1 for each resource here", (effects) => {
    for (const seats of [1, 2] as const) {
      const state = endOfQuest(effects, { seats }, "threat");
      expect(resourcesOf(state, OFF)).toBe(2);
      expect(threatsOf(state).slice(0, seats)).toEqual(Array.from({ length: seats }, () => 30));
    }
  });
  lineSpec("17079:A:1", "Forced: or the topmost location of the encounter discard pile (the one discarded last) returns to the staging area, and no threat is raised", (effects) => {
    for (const seats of [1, 2] as const) {
      // Place is explored in this quest phase (3 of 4 willpower and the progress it holds make its 2 quest points) and is discarded after Cobwebbed Cavern, which lies there already.
      const state = questedTo(effects, { seats, staging: [{ code: OFF, resources: 1 }], active: { code: PLACE, progress: 1 }, discard: [CAVERN], deck: ["f0", "f0", "f0", "f0"] }, { keys: ["location"] });
      expect(resourcesOf(state, OFF)).toBe(2);
      expect(zoneOf(state, PLACE)).toBe("staging");
      expect(zoneOf(state, CAVERN)).toBe("encounterDiscard");
      expect(threatsOf(state).slice(0, seats)).toEqual(Array.from({ length: seats }, () => 28));
    }
  });
  lineSpec("17079:A:1", "with no location in the discard pile only the threat is raised; while On Track is in play it does not fire", (effects) => {
    const none = endOfQuest(effects, { seats: 1, discard: ["f3"] }, "location");
    expect(threatsOf(none)[0]).toBe(30);
    expect(zoneOf(none, "f3")).toBe("encounterDiscard");
    const on = questedTo(effects, { seats: 1, staging: [ON], deck: SAFE_DECK }, { commit: false });
    expect(threatsOf(on)[0]).toBe(28);
  });
  lineSpec("17079:A:2", "Progress cannot be placed on the main quest while Off Track is in play, and can while On Track is in play", (effects) => {
    for (const seats of [1, 2] as const) {
      const off = questedTo(effects, { seats, staging: [OFF], deck: ["f0", "f0"] });
      expect(progressOf(off, CAVES)).toBe(0);
      const on = questedTo(effects, { seats, staging: [ON], deck: SAFE_DECK });
      if (seats === 1) expect(progressOf(on, CAVES)).toBe(4);
      else expect(progressOf(on, CAVES)).toBeGreaterThan(0);
    }
  });
  // The rule alone gives the side quest the progress (hrd.current-quest), so this ruling has no run without the record.
  it("17079:A:2 a side quest that is the current quest still takes progress while Off Track is in play (the main quest card is not named)", () => {
    const made = tableOf(EFFECTS)({ phase: "Planning", staging: [OFF, LOST], deck: ["f0", "f0"] });
    const done = questPhase(made, made.state, { keys: [LOST, "threat"] }).state;
    expect(progressOf(done, LOST)).toBe(4);
    expect(progressOf(done, CAVES)).toBe(0);
  });
});

describe("17080 On Track", () => {
  // Each player reveals one encounter card in the quest phase (a filler enemy), so the deck the end of the phase finds starts after those cards.
  const endOfQuest = (effects: readonly Effect[], layout: Layout): ScenarioState => questedTo(effects, { staging: [ON], ...layout, deck: [...Array.from({ length: layout.seats ?? 1 }, () => "f0"), ...(layout.deck ?? [])] }, { commit: false });
  lineSpec("17080:A:1", "Forced: at the end of the quest phase the first card of the top 3 that prints On Track is added to the staging area (not revealed) and the others of the 3 are discarded; the objective stays On Track", (effects) => {
    for (const seats of [1, 2] as const) {
      const state = endOfQuest(effects, { seats, deck: [INJURED, GUARDIAN, INJURED, "f0"] });
      expect(zoneOf(state, GUARDIAN)).toBe("staging");
      expect(inDiscard(state)).toEqual([INJURED, INJURED]);
      expect(inDeck(state)).toEqual(["f0"]);
      expect(has(state, "staging", ON)).toBe(true);
    }
  });
  lineSpec("17080:A:1", "with two marked cards in the top 3 only the first is added and the second is discarded", (effects) => {
    const state = endOfQuest(effects, { seats: 1, deck: [GUARDIAN, BROODLING, "f0", "f0"] });
    expect(zoneOf(state, GUARDIAN)).toBe("staging");
    expect(zoneOf(state, BROODLING)).toBe("encounterDiscard");
    expect(inDeck(state)).toEqual(["f0"]);
  });
  lineSpec("17080:A:1", "if no card enters play the objective flips to Off Track: none in the top 3 (a marked card fourth stays in the deck), or fewer than 3 cards in the deck", (effects) => {
    for (const seats of [1, 2] as const) {
      const none = endOfQuest(effects, { seats, deck: [INJURED, INJURED, INJURED, GUARDIAN] });
      expect(has(none, "staging", OFF)).toBe(true);
      expect(has(none, "staging", ON)).toBe(false);
      expect(inDiscard(none)).toHaveLength(3);
      expect(zoneOf(none, GUARDIAN)).toBe("encounterDeck");
      const short = endOfQuest(effects, { seats, deck: [INJURED] });
      expect(has(short, "staging", OFF)).toBe(true);
      expect(inDiscard(short)).toEqual([INJURED]);
      const empty = endOfQuest(effects, { seats, deck: [] });
      expect(has(empty, "staging", OFF)).toBe(true);
    }
  });
  lineSpec("17080:A:1", "while Lost Underground is in play the objective cannot flip, but the top 3 cards are still searched", (effects) => {
    const state = endOfQuest(effects, { seats: 1, staging: [ON, LOST], deck: [INJURED, INJURED, INJURED, "f0"] });
    expect(has(state, "staging", ON)).toBe(true);
    expect(inDiscard(state)).toHaveLength(3);
  });
  lineSpec("17080:A:2", "Forced: after the players quest unsuccessfully (threat higher than willpower) the objective flips to Off Track", (effects) => {
    for (const seats of [1, 2] as const) {
      // The marked card on top keeps the other Forced effect from flipping it; nobody is committed, so willpower 0 meets Threat 3.
      const failed = questedTo(effects, { seats, staging: [ON, SCORPION], deck: SAFE_DECK }, { commit: false });
      expect(has(failed, "staging", OFF)).toBe(true);
      expect(has(failed, "staging", ON)).toBe(false);
    }
  });
  lineSpec("17080:A:2", "a successful quest, and a tie of willpower and threat, do not flip the objective (an unsuccessful one with the same cards does)", (effects) => {
    for (const seats of [1, 2] as const) {
      const failed = questedTo(effects, { seats, staging: [ON, SCORPION], deck: SAFE_DECK }, { commit: false });
      expect(has(failed, "staging", OFF)).toBe(true);
      const won = questedTo(effects, { seats, staging: [ON, SCORPION], deck: SAFE_DECK });
      expect(has(won, "staging", ON)).toBe(true);
      // Willpower 4 (6 with two players) against Threat 4 (6): not unsuccessful.
      const tie = questedTo(effects, { seats, staging: seats === 1 ? [ON, VIPER] : [ON, VIPER, PLACE], deck: SAFE_DECK });
      expect(has(tie, "staging", ON)).toBe(true);
      expect(has(tie, "staging", OFF)).toBe(false);
    }
  });
});

describe("17076:A:1 Searching the Caves Setup", () => {
  // The Setup is carried by the scenario's piles (the set-aside pile and the staging pile), not by an instruction of its record, so the line has no run without records: the test plays the real deal.
  it("17076:A:1 Setup: Brood Mother is set aside out of play and the Search objective is added to the staging area with Off Track face up", () => {
    const campaign = loadCampaigns().find((one) => one.scenarios.includes(SID));
    if (campaign === undefined) throw new Error("no campaign plays the scenario");
    const made = tableOf(EFFECTS)({});
    for (const seatCount of [1, 2] as const) {
      const seats = [{ heroes: ["dh1", "dh2"], deck: [] }, { heroes: ["dh3"], deck: [] }].slice(0, seatCount);
      const deal = buildStart({ campaign, scenario: loadAnyScenario(SID), seatCount, seed: 1, threatModifier: 0, seats, effects: EFFECTS, mode: "standalone" });
      // The deal waits at the mulligan: each seat keeps its hand and the Setup runs.
      let run: Run = start(startScenario(deal, { effects: EFFECTS, cards: made.ctx.cards }));
      for (let guard = 0; guard < 6 && run.state.window?.kind === "mulligan"; guard += 1) run = send(run, { type: "Keep" }, made.ctx);
      const state = finish(run, made.ctx).state;
      expect(zoneOf(state, BROOD)).toBe("setAside");
      expect(has(state, "staging", OFF)).toBe(true);
      expect(has(state, "staging", ON)).toBe(false);
      expect(state.cards[idOf(state, OFF)]?.face).toBe("up");
      expect(state.cards[idOf(state, OFF)]?.resources ?? 0).toBe(0);
    }
  });
});

