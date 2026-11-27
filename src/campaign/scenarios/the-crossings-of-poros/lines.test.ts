// Rules: hrd.multiple-encounter-sets, hrd.removed-from-the-game, rr.in-play-and-out-of-play, rr.reveal, rr.quest-advancement, rr.cannot (data/rules/entries.json); ledger lines 17147:A:1, 17150:A:2, 17151:A:1, 17152:A:2, 17157:B:1, 17158:A:1, 17160:A:1, 17163:A:1, 17163:B:2.
// The pieces The Crossings of Poros added: the random card of a set aside encounter set (RandomSetAside), the stages set aside, the search for the enemies of the sets of the stages set aside, a set removed while it is set aside
// (RemoveEncounterSet `setAsideOnly`), allies entering play exhausted, and the stage defeated only at the end of the combat phase.
import { describe, expect, it } from "vitest";

import { flagged, heldAmount, updateCard, type ScenarioState } from "../../../rules/core/state.ts";
import { modifiedStat } from "../../../rules/core/keywords.ts";
import { codesIn, idOf, opened, resolveRecords, send, tableFromLayout, type Layout } from "../../../../test/harness/scene-kit.ts";
import { whenRevealedUncancelable } from "../../../rules/families/wilderland/heath.ts";
import type { Effect } from "../../../catalog/boundary.ts";
import { playSweep } from "../../../rules/families/play/sweep.ts";
import { advanceFreed } from "../../../rules/quest/stage-reveal.ts";
import { qualifyingEnemies } from "../../../rules/quest/quest.ts";
import { syncConstants } from "../../../rules/interpret/constants.ts";
import { settle } from "../../../rules/engine/machine.ts";
import type { EngineStep } from "../../../rules/core/intents.ts";
import { moveCard } from "../../../rules/core/zones.ts";
import { enterPlay } from "../../../rules/families/play/enter.ts";

const table = (layout: Layout = {}) => tableFromLayout("the-crossings-of-poros", { seats: 1, stage: "17157", ...layout });

const HARAD_SOLDIERS = ["16040", "16041", "16042", "16043", "16044"];
const MOUNTAINS = ["17153", "17154", "17155", "17156"];
const DESERT_CREATURES = ["16053", "16054", "16055"];
const ENEMIES_OF_HARAD_SOLDIERS = ["16041", "16042", "16043"];
const codeOf = (state: ScenarioState, id: string | undefined): string | undefined => state.cards[id ?? ""]?.code;
const chooseOption = (option: string) => () => option;

describe("17147:A:1 RandomSetAside `pick`: the option that places an enemy is offered only while one is set aside", () => {
  it("17147:A:1 places a random enemy of the set, not its treachery or side quest, in the encounter discard pile and takes it from the set aside cards", () => {
    const made = table({ staging: ["17147"], setAside: HARAD_SOLDIERS });
    const run = resolveRecords(made.state, made.ctx, "17147", "forced", idOf(made.state, "17147"), chooseOption("place"));
    expect(run.state.encounterDiscard).toHaveLength(1);
    expect(ENEMIES_OF_HARAD_SOLDIERS).toContain(codeOf(run.state, run.state.encounterDiscard[0]));
    expect(run.state.setAside).toHaveLength(HARAD_SOLDIERS.length - 1);
    expect(modifiedStat(run.state, run.state.cards[run.id]!, "attack", made.ctx.cards)).toBe(3);
  });

  it("17147:A:1 gives the same card for the same game seed, and may give another for another seed", () => {
    const placed = (seed: number) => {
      const made = table({ staging: ["17147"], setAside: HARAD_SOLDIERS, seed });
      const run = resolveRecords(made.state, made.ctx, "17147", "forced", idOf(made.state, "17147"), chooseOption("place"));
      return codeOf(run.state, run.state.encounterDiscard[0]);
    };
    expect(placed(1)).toBe(placed(1));
    expect(new Set([1, 2, 3, 4, 5, 6, 7, 8].map(placed)).size).toBeGreaterThan(1);
  });

  it("17147:A:1 gives +3 Attack this round when the other option is taken, leaving the set aside cards where they are", () => {
    const made = table({ staging: ["17147"], setAside: HARAD_SOLDIERS });
    const run = resolveRecords(made.state, made.ctx, "17147", "forced", idOf(made.state, "17147"), chooseOption("attack"));
    expect(run.state.encounterDiscard).toEqual([]);
    expect(run.state.setAside).toHaveLength(HARAD_SOLDIERS.length);
    expect(modifiedStat(run.state, run.state.cards[run.id]!, "attack", made.ctx.cards)).toBe(3 + 3);
  });

  it("17147:A:1 offers only +3 Attack once no enemy of the set is left set aside", () => {
    const made = table({ staging: ["17147"], setAside: ["16040", "16044"] });
    const run = resolveRecords(made.state, made.ctx, "17147", "forced", idOf(made.state, "17147"));
    expect(run.state.encounterDiscard).toEqual([]);
    expect(modifiedStat(run.state, run.state.cards[run.id]!, "attack", made.ctx.cards)).toBe(3 + 3);
  });

  it("17147:A:1 offers only +3 Attack once its set was shuffled in by stage 3A (17161:A:1): none of it is set aside any more", () => {
    const first = table({ stage: "17161", side: "A", setAside: HARAD_SOLDIERS });
    expect(first.state.setAside.filter((id) => HARAD_SOLDIERS.includes(codeOf(first.state, id) ?? ""))).toHaveLength(HARAD_SOLDIERS.length);
    const shuffled = resolveRecords(first.state, first.ctx, "17161", "whenRevealed", idOf(first.state, "17161")).state;
    expect(shuffled.setAside.map((id) => codeOf(shuffled, id)).filter((code) => HARAD_SOLDIERS.includes(code ?? ""))).toEqual([]);
    const run = resolveRecords({ ...shuffled, encounterDeck: [], encounterDiscard: [] }, first.ctx, "17147", "forced");
    expect(run.state.encounterDiscard).toEqual([]);
    expect(modifiedStat(run.state, run.state.cards[run.id]!, "attack", first.ctx.cards)).toBe(3 + 3);
  });

  it("17147:A:1 offers only +3 Attack once its set was removed from the game: a removed set has no card set aside", () => {
    const made = table({ staging: ["17147"], setAside: HARAD_SOLDIERS });
    const gone = made.state.setAside.reduce((state, id) => moveCard(state, id, { zone: "removed" }), made.state);
    const run = resolveRecords(gone, made.ctx, "17147", "forced", idOf(gone, "17147"));
    expect(run.state.encounterDiscard).toEqual([]);
    expect(modifiedStat(run.state, run.state.cards[run.id]!, "attack", made.ctx.cards)).toBe(3 + 3);
  });
});

describe("17150:A:2 RandomSetAside `reveal` on the set with the most cards set aside", () => {
  it("17150:A:2 reveals a card of the set that holds the most cards, which is then part of the encounter deck", () => {
    const made = table({ staging: ["17150"], setAside: [...MOUNTAINS.slice(0, 2), ...HARAD_SOLDIERS] });
    const run = resolveRecords(made.state, made.ctx, "17150", "forced", idOf(made.state, "17150"));
    const revealed = [...run.state.staging, ...run.state.encounterDiscard].map((id) => codeOf(run.state, id)).filter((code) => HARAD_SOLDIERS.includes(code ?? ""));
    expect(revealed).toHaveLength(1);
    expect(run.state.setAside).toHaveLength(MOUNTAINS.slice(0, 2).length + HARAD_SOLDIERS.length - 1);
  });

  it("17150:A:2 asks the first player to choose between sets that tie, and reveals a card of the set chosen", () => {
    const made = table({ staging: ["17150"], setAside: [...MOUNTAINS.slice(0, 2), ...DESERT_CREATURES.slice(1)], seats: 2, firstPlayer: 1 });
    let asked: { seat: number; options: readonly string[] } | undefined;
    const run = resolveRecords(made.state, made.ctx, "17150", "forced", idOf(made.state, "17150"), (state) => {
      const window = state.window as { kind: string; seat: number; options: readonly string[] };
      asked = { seat: window.seat, options: window.options };
      return window.options.find((id) => codeOf(state, id) === "16054") ?? "";
    }, true, 0);
    expect(asked?.seat).toBe(1);
    expect((asked?.options ?? []).map((id) => codeOf(run.state, id)).sort()).toEqual(["16054", "17153"]);
    const left = run.state.setAside.map((id) => codeOf(run.state, id));
    expect(left.filter((code) => MOUNTAINS.includes(code ?? ""))).toHaveLength(2);
    expect(left.filter((code) => DESERT_CREATURES.includes(code ?? ""))).toHaveLength(1);
  });

  it("17150:A:2 does nothing when no set is left set aside", () => {
    const made = table({ staging: ["17150"] });
    const run = resolveRecords(made.state, made.ctx, "17150", "forced", idOf(made.state, "17150"));
    expect(run.state.staging).toEqual(made.state.staging.concat(run.id).filter((id, at, all) => all.indexOf(id) === at));
  });
});

describe("17151:A:1 RandomSetAside `discard`, then the discard pile is shuffled into the encounter deck", () => {
  it("17151:A:1 places a card of the largest set in the discard pile and shuffles the pile into the deck, so the card is part of the deck", () => {
    const made = table({ staging: ["17151"], setAside: [...MOUNTAINS, ...DESERT_CREATURES], deck: ["17147"], discard: ["17148"] });
    const run = resolveRecords(made.state, made.ctx, "17151", "forced", idOf(made.state, "17151"));
    expect(run.state.encounterDiscard).toEqual([]);
    const deck = run.state.encounterDeck.map((id) => codeOf(run.state, id));
    expect(deck).toHaveLength(3);
    expect(deck.filter((code) => MOUNTAINS.includes(code ?? ""))).toHaveLength(1);
    expect(run.state.setAside).toHaveLength(MOUNTAINS.length + DESERT_CREATURES.length - 1);
  });
});

describe("17151:A:1 #then: no shuffle when no card was placed", () => {
  it("17151:A:1 leaves the discard pile unshuffled when no set has a card left set aside (rr.then)", () => {
    const made = table({ staging: ["17151"], deck: ["17147"], discard: ["17148"] });
    const run = resolveRecords(made.state, made.ctx, "17151", "forced", idOf(made.state, "17151"));
    expect(run.state.encounterDiscard).toHaveLength(1);
    expect(run.state.encounterDeck).toHaveLength(1);
  });
});

describe("17152:A:2, 17152:A:3 RandomSetAside `reveal`", () => {
  it("17152:A:2 reveals a card of a set aside set when the treachery is revealed", () => {
    const made = table({ staging: ["17152"], setAside: DESERT_CREATURES });
    const run = resolveRecords(made.state, made.ctx, "17152", "whenRevealed", idOf(made.state, "17152"));
    expect(run.state.setAside).toHaveLength(DESERT_CREATURES.length - 1);
  });
});

describe("17158:A:1 RemoveEncounterSet `setAsideOnly`, ShuffleSetAsideSet and RemoveStage", () => {
  it("17158:A:1 shuffles Desert Sands in, removes the Mountains of Shadow cards still set aside (those in the deck stay) and the other stage 2A", () => {
    const made = table({ stage: "17158", side: "A", setAside: ["16049", "16050", ...MOUNTAINS.slice(0, 3)], deck: ["17147", "17155"] });
    const run = resolveRecords(made.state, made.ctx, "17158", "whenRevealed", idOf(made.state, "17158"));
    expect(codesIn(run.state, "encounterDeck").sort()).toEqual(["16049", "16050", "17147", "17155"]);
    expect(codesIn(run.state, "removed").sort()).toEqual(["17153", "17154", "17155"]);
    expect(run.state.setAside.map((id) => codeOf(run.state, id)).filter((code) => !["17157", "17159"].includes(code ?? ""))).toEqual([]);
    expect(run.state.cards[idOf(run.state, "17159")]).toMatchObject({ zone: "setAside", removedStage: true });
    expect(run.state.questDeck.map((id) => codeOf(run.state, id))).not.toContain("17159");
  });

  it("17158:A:1 leaves a removed set out of the cards a later pick can name", () => {
    const made = table({ staging: ["17150"], stage: "17158", setAside: [...MOUNTAINS.slice(0, 3), "16049"] });
    const removed = resolveRecords(made.state, made.ctx, "17158", "whenRevealed", idOf(made.state, "17158")).state;
    expect(removed.setAside.map((id) => codeOf(removed, id))).not.toContain("17153");
  });
});

describe("17157:A:1 the Setup shuffles the encounter deck and each other player reveals an encounter card", () => {
  it("17157:A:1 reveals one card for the second player and none for the first player", () => {
    const made = table({ seats: 2, deck: ["16041", "16042", "16043"], staging: ["17146"] });
    const run = resolveRecords(made.state, made.ctx, "17157", "setup", idOf(made.state, "17157"));
    expect(run.state.encounterDeck).toHaveLength(2);
    expect(run.state.staging.length + run.state.seats.reduce((sum, seat) => sum + seat.engaged.length, 0)).toBeGreaterThan(1);
  });

  it("17157:A:1 reveals none in a solo game", () => {
    const made = table({ seats: 1, deck: ["16041", "16042", "16043"], staging: ["17146"] });
    const run = resolveRecords(made.state, made.ctx, "17157", "setup", idOf(made.state, "17157"));
    expect(run.state.encounterDeck).toHaveLength(3);
  });
});

describe("17145:A:1, 17145:A:3 the controller of Poros Garrison may engage one more enemy", () => {
  it("17145:A:1 the first player controls Poros Garrison, and control passes with the first player token", () => {
    const made = table({ seats: 2, firstPlayer: 1, play: [{ code: "17145", seat: 1 }] });
    const garrison = idOf(made.state, "17145");
    const held = opened(made).state;
    expect(held.cards[garrison]?.controller).toBe(1);
    const passed = opened(made, syncConstants(playSweep({ ...held, firstPlayer: 0 }, made.ctx, []), made.ctx)).state;
    expect(passed.cards[garrison]?.controller).toBe(0);
  });
  it("17145:A:3 gives the extra optional engagement to the player who controls it only", () => {
    const made = table({ seats: 2, firstPlayer: 1, play: [{ code: "17145", seat: 1 }] });
    const garrison = idOf(made.state, "17145");
    const held = opened(made).state;
    expect(held.cards[garrison]?.controller).toBe(1);
    expect(heldAmount(held, "seat:1", "extraOptionalEngage")).toBe(1);
    expect(heldAmount(held, "seat:0", "extraOptionalEngage")).toBe(0);
    const passed = opened(made, syncConstants(playSweep({ ...held, firstPlayer: 0 }, made.ctx, []), made.ctx)).state;
    expect(passed.cards[garrison]?.controller).toBe(0);
    expect(heldAmount(passed, "seat:0", "extraOptionalEngage")).toBe(1);
    expect(heldAmount(passed, "seat:1", "extraOptionalEngage")).toBe(0);
  });
});

describe("17153:A:1 the When Revealed effects of every encounter card cannot be canceled while Foothills of Mordor is in the staging area", () => {
  const CANCEL = { id: "shield:response:1", cardCode: "shield", lines: ["shield:A:1"], timing: "response", trigger: "whenRevealedPending", instructions: [{ verb: "CancelEffect" }] } as unknown as Effect;

  it("17153:A:1 bars a cancel of a treachery while it is in the staging area, and not once it has left", () => {
    const staged = table({ staging: ["17153", "17152"] });
    const treachery = idOf(staged.state, "17152");
    const event = { trigger: "whenRevealedPending" as const, seat: 0, subject: treachery };
    expect(whenRevealedUncancelable(opened(staged).state, event, CANCEL, staged.ctx)).toBe(true);
    const away = table({ active: "17153", staging: ["17152"] });
    expect(whenRevealedUncancelable(opened(away).state, { ...event, subject: idOf(away.state, "17152") }, CANCEL, away.ctx)).toBe(false);
  });
});

describe("17156:A:2 no player's threat can be reduced while Find a Way Down is in the staging area", () => {
  it("17156:A:2 bars every seat in the staging area, and none once the side quest is the active quest", () => {
    const staged = opened(table({ seats: 2, staging: ["17156"] })).state;
    expect(flagged(staged, "seat:0", "threatReductionBarred")).toBe(true);
    expect(flagged(staged, "seat:1", "threatReductionBarred")).toBe(true);
    const away = opened(table({ seats: 2, active: "17156" })).state;
    expect(flagged(away, "seat:0", "threatReductionBarred")).toBe(false);
  });
});

describe("17160:A:1 SetStagesAside", () => {
  it("17160:A:1 sets the other two stages 3A aside, shuffles the discard pile and Desert Creatures in and has each player reveal a card", () => {
    const made = table({ stage: "17160", side: "A", setAside: DESERT_CREATURES, discard: ["17147"], deck: ["17148", "17149"] });
    expect(made.state.questDeck.map((id) => codeOf(made.state, id))).toEqual(expect.arrayContaining(["17161", "17162"]));
    const run = resolveRecords(made.state, made.ctx, "17160", "whenRevealed", idOf(made.state, "17160"));
    expect(run.state.questDeck.map((id) => codeOf(run.state, id))).not.toEqual(expect.arrayContaining(["17161"]));
    expect(run.state.questDeck.map((id) => codeOf(run.state, id))).not.toEqual(expect.arrayContaining(["17162"]));
    expect(run.state.setAside.map((id) => codeOf(run.state, id)).sort()).toEqual(expect.arrayContaining(["17161", "17162"]));
    expect(run.state.encounterDiscard).toEqual([]);
  });
});

describe("17163:A:1 SearchAsideStageSets and TakeObjectiveAlly", () => {
  const fourth = () => {
    const made = table({
      stage: "17163",
      side: "A",
      seats: 2,
      firstPlayer: 1,
      setAside: ["17145", "17161", "17162"],
      deck: ["16041", "16054", "16061", "16044", "17147"],
      discard: ["16042", "16055", "16062"],
    });
    const unplayed = ["17161", "17162"].reduce((state, code) => updateCard(state, idOf(state, code), { removedStage: true }), made.state);
    return { made, run: resolveRecords(unplayed, made.ctx, "17163", "whenRevealed", idOf(made.state, "17163")) };
  };

  it("17163:A:1 stages each enemy of the sets of the stages 3 set aside, from the deck and the discard pile, and no other card or set", () => {
    const { run } = fourth();
    const staged = codesIn(run.state, "staging").filter((code) => code !== "17163");
    expect(staged.sort()).toEqual(["16041", "16042", "16061", "16062"]);
    expect(run.state.encounterDeck.map((id) => codeOf(run.state, id)).sort()).toEqual(["16044", "16054", "17147"]);
    expect(codesIn(run.state, "encounterDiscard")).toEqual(["16055"]);
  });

  it("17163:A:1 puts Poros Garrison from the set aside cards into the play area of the first player", () => {
    const { run } = fourth();
    const garrison = idOf(run.state, "17145");
    expect(run.state.cards[garrison]?.zone).toBe("play");
    expect(run.state.seats[1]?.play).toContain(garrison);
    expect(run.state.setAside).not.toContain(garrison);
  });

  it("17163:A:1 searches no set for a stage 3 that was played and defeated, which lies set aside too", () => {
    const made = table({ stage: "17163", side: "A", setAside: ["17145", "17161"], deck: ["16041"] });
    const run = resolveRecords(made.state, made.ctx, "17163", "whenRevealed", idOf(made.state, "17163"));
    expect(codesIn(run.state, "staging").filter((code) => code !== "17163")).toEqual([]);
  });
});

describe("17157:B:1 allies enter play exhausted", () => {
  const played = (layout: Layout) => {
    const made = table({ phase: "Planning", hand: ["ally"], heroResources: 5, ...layout });
    const ally = made.state.seats[0]!.hand[0]!;
    const run = send(opened(made), { type: "PlayCard", cardId: ally, payments: [{ heroId: made.hero, amount: 1 }] } as never, made.ctx);
    return run.state.cards[ally];
  };

  it("17157:B:1 exhausts an ally as it enters play while the stage is the main quest", () => {
    expect(played({})).toMatchObject({ zone: "play", exhausted: true });
  });

  it("17157:B:1 does not exhaust one while another stage is the main quest", () => {
    expect(played({ stage: "17158" })).toMatchObject({ zone: "play", exhausted: false });
  });

  // The ally put into play by an effect (families/play/enter.ts) and the one played free from the top of the deck (Vilya, families/encounter/items.ts) enter exhausted too: "Allies enter play exhausted".
  it("17157:B:1 exhausts an ally an effect puts into play, and not on another stage", () => {
    const entered = (layout: Layout) => {
      const made = table({ hand: ["ally"], ...layout });
      const ally = made.state.seats[0]!.hand[0]!;
      return enterPlay(made.state, ally, 0, {}, { seat: 0 } as never, made.ctx, []).cards[ally];
    };
    expect(entered({})).toMatchObject({ zone: "play", exhausted: true });
    expect(entered({ stage: "17158" })).toMatchObject({ zone: "play", exhausted: false });
  });

  it("17157:B:1 exhausts the ally Vilya plays free from the top of the deck, and not on another stage", () => {
    const freed = (layout: Layout) => {
      const made = tableFromLayout("the-crossings-of-poros", { seats: 1, stage: "17157", deckOf: ["ally"], attached: [{ code: "04137", to: "dh1" }], phase: "Planning", ...layout }, { extra: ["04137"] });
      const top = made.state.seats[0]!.deck[0]!;
      const ring = idOf(made.state, "04137");
      const looking = send(opened(made), { type: "Trigger", cardId: ring, effectId: "04137:action:1" }, made.ctx);
      const done = send(send(looking, { type: "Pass" }, made.ctx), { type: "Choose", optionId: "play" }, made.ctx);
      return done.state.cards[top];
    };
    expect(freed({})).toMatchObject({ zone: "play", exhausted: true });
    expect(freed({ stage: "17158" })).toMatchObject({ zone: "play", exhausted: false });
  });
});

describe("17163:B:2 the stage is defeated only at the end of the combat phase", () => {
  const full = (layout: Layout = {}) => table({ stage: "17163", progress: 20, ...layout });
  const sweep = (state: ScenarioState, made: { ctx: Parameters<typeof settle>[1] }): ScenarioState => advanceFreed(settle({ ...state, window: null, mode: "stopped" }, made.ctx, []), made.ctx, [] as EngineStep[]);

  it("17163:B:2 keeps a full stage in play before the end of the combat phase", () => {
    const made = full();
    const run = opened(made);
    expect(sweep(run.state, made).stageCleared).not.toBe(true);
    expect(sweep(run.state, made).questStage).toBe(made.state.questStage);
  });

  it("17163:B:2 defeats it, and so wins, once the end of the combat phase marks the table", () => {
    const made = full({ phase: "Combat" });
    const run = resolveRecords(made.state, made.ctx, "17163", "forced", idOf(made.state, "17163"), undefined, false);
    expect(run.state.stageCleared).toBe(true);
  });
});

describe("17146:A:1 an enemy that cannot leave the staging area is passed over by the engagement check", () => {
  it("17146:A:1 does not qualify The Black Serpent for a check its cost is low enough for, as it would never leave, and still qualifies another enemy", () => {
    const made = table({ staging: ["17146", "17147"], threat: [50, 20] });
    const state = opened(made).state;
    expect(qualifyingEnemies(state, 0, made.ctx.cards).map((id) => codeOf(state, id))).toEqual(["17147"]);
  });
});

describe("the steps that tell a random stage, a stage that left and a pass of control", () => {
  it("17157:B:2 tells the stages the random advance chose among, with the stage's own line as its cause", () => {
    const made = table({ stage: "17157", side: "B", phase: "Planning" });
    const run = resolveRecords(made.state, made.ctx, "17157", "forced", idOf(made.state, "17157"));
    const advance = run.steps.find((step) => step.kind === "advance");
    expect(advance).toMatchObject({ random: { cause: { effect: "17157:forced:1", line: "17157:B:2" } } });
    const from = advance?.kind === "advance" ? (advance.random?.from ?? []).map((id) => codeOf(run.state, id)).sort() : [];
    expect(from).toEqual(["17158", "17159"]);
    expect(advance?.kind === "advance" ? from.includes(codeOf(run.state, advance.cardId)) : false).toBe(true);
  });

  it("17158:A:1 tells the other stage 2A as removed from the game, caused by the stage's line", () => {
    const made = table({ stage: "17158", side: "A", setAside: ["16049"] });
    const run = resolveRecords(made.state, made.ctx, "17158", "whenRevealed", idOf(made.state, "17158"));
    const left = run.steps.filter((step) => step.kind === "stageLeaves");
    expect(left).toEqual([{ kind: "stageLeaves", cardId: idOf(run.state, "17159"), how: "removed", cause: { effect: "17158:whenRevealed:1", line: "17158:A:1" } }]);
  });

  it("17160:A:1 tells each other stage 3A as set aside", () => {
    const made = table({ stage: "17160", side: "A", setAside: DESERT_CREATURES });
    const run = resolveRecords(made.state, made.ctx, "17160", "whenRevealed", idOf(made.state, "17160"));
    const left = run.steps.flatMap((step) => (step.kind === "stageLeaves" ? [[codeOf(run.state, step.cardId), step.how]] : []));
    expect(left.sort()).toEqual([["17161", "setAside"], ["17162", "setAside"]]);
  });

  it("17145:A:1 tells Poros Garrison passing to the new first player, and says nothing while the first player stays", () => {
    const made = table({ seats: 2, play: [{ code: "17145", seat: 0 }], firstPlayer: 1 });
    const garrison = idOf(made.state, "17145");
    const steps: EngineStep[] = [];
    const passed = playSweep(syncConstants(updateCard(made.state, garrison, { controller: 0 }), made.ctx), made.ctx, steps);
    expect(passed.cards[garrison]?.controller).toBe(1);
    expect(steps).toEqual([{ kind: "controlPasses", cardId: garrison, seat: 1, cause: { effect: "17145:constant:1", line: "17145:A:1" } }]);
    const quiet: EngineStep[] = [];
    playSweep(passed, made.ctx, quiet);
    expect(quiet).toEqual([]);
  });
});
