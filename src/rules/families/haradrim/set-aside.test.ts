// Rules: hrd.multiple-encounter-sets, hrd.removed-from-the-game, rr.in-play-and-out-of-play, rr.reveal, rr.quest-advancement, rr.cannot (data/rules/entries.json); ledger lines 17147:A:1, 17150:A:2, 17151:A:1, 17152:A:2, 17157:B:1, 17158:A:1, 17160:A:1, 17163:A:1, 17163:B:2.
// The pieces The Crossings of Poros added: the random card of a set aside encounter set (RandomSetAside), the stages set aside, the search for the enemies of the sets of the stages set aside, a set removed while it is set aside
// (RemoveEncounterSet `setAsideOnly`), allies entering play exhausted, and the stage defeated only at the end of the combat phase.
import { describe, expect, it } from "vitest";

import { updateCard, type ScenarioState } from "../../core/state.ts";
import { modifiedStat } from "../../core/keywords.ts";
import { codesIn, idOf, opened, resolveRecords, send, tableFromLayout, type Layout } from "../../../../test/harness/scene-kit.ts";
import { advanceFreed } from "../../quest/stage-reveal.ts";
import { qualifyingEnemies } from "../../quest/quest.ts";
import { settle } from "../../engine/machine.ts";
import type { EngineStep } from "../../core/intents.ts";

const table = (layout: Layout = {}) => tableFromLayout("the-crossings-of-poros", { seats: 1, stage: "17157", ...layout });

const HARAD_SOLDIERS = ["16040", "16041", "16042", "16043", "16044"];
const MOUNTAINS = ["17153", "17154", "17155", "17156"];
const DESERT_CREATURES = ["16053", "16054", "16055"];
const ENEMIES_OF_HARAD_SOLDIERS = ["16041", "16042", "16043"];
const codeOf = (state: ScenarioState, id: string | undefined): string | undefined => state.cards[id ?? ""]?.code;
const chooseOption = (option: string) => () => option;

describe("17147:A:1 RandomSetAside `pick`: the option that places an enemy is offered only while one is set aside", () => {
  it("places a random enemy of the set, not its treachery or side quest, in the encounter discard pile and takes it from the set aside cards", () => {
    const made = table({ staging: ["17147"], setAside: HARAD_SOLDIERS });
    const run = resolveRecords(made.state, made.ctx, "17147", "forced", idOf(made.state, "17147"), chooseOption("place"));
    expect(run.state.encounterDiscard).toHaveLength(1);
    expect(ENEMIES_OF_HARAD_SOLDIERS).toContain(codeOf(run.state, run.state.encounterDiscard[0]));
    expect(run.state.setAside).toHaveLength(HARAD_SOLDIERS.length - 1);
    expect(modifiedStat(run.state, run.state.cards[run.id]!, "attack", made.ctx.cards)).toBe(3);
  });

  it("gives the same card for the same game seed, and may give another for another seed", () => {
    const placed = (seed: number) => {
      const made = table({ staging: ["17147"], setAside: HARAD_SOLDIERS, seed });
      const run = resolveRecords(made.state, made.ctx, "17147", "forced", idOf(made.state, "17147"), chooseOption("place"));
      return codeOf(run.state, run.state.encounterDiscard[0]);
    };
    expect(placed(1)).toBe(placed(1));
    expect(new Set([1, 2, 3, 4, 5, 6, 7, 8].map(placed)).size).toBeGreaterThan(1);
  });

  it("gives +3 Attack this round when the other option is taken, leaving the set aside cards where they are", () => {
    const made = table({ staging: ["17147"], setAside: HARAD_SOLDIERS });
    const run = resolveRecords(made.state, made.ctx, "17147", "forced", idOf(made.state, "17147"), chooseOption("attack"));
    expect(run.state.encounterDiscard).toEqual([]);
    expect(run.state.setAside).toHaveLength(HARAD_SOLDIERS.length);
    expect(modifiedStat(run.state, run.state.cards[run.id]!, "attack", made.ctx.cards)).toBe(3 + 3);
  });

  it("offers only +3 Attack once no enemy of the set is left set aside", () => {
    const made = table({ staging: ["17147"], setAside: ["16040", "16044"] });
    const run = resolveRecords(made.state, made.ctx, "17147", "forced", idOf(made.state, "17147"));
    expect(run.state.encounterDiscard).toEqual([]);
    expect(modifiedStat(run.state, run.state.cards[run.id]!, "attack", made.ctx.cards)).toBe(3 + 3);
  });

  it("offers only +3 Attack for a set removed from the game, and so for a set shuffled in", () => {
    const made = table({ staging: ["17147"] });
    const run = resolveRecords(made.state, made.ctx, "17147", "forced", idOf(made.state, "17147"));
    expect(modifiedStat(run.state, run.state.cards[run.id]!, "attack", made.ctx.cards)).toBe(3 + 3);
  });
});

describe("17150:A:2 RandomSetAside `reveal` on the set with the most cards set aside", () => {
  it("reveals a card of the set that holds the most cards, which is then part of the encounter deck", () => {
    const made = table({ staging: ["17150"], setAside: [...MOUNTAINS.slice(0, 2), ...HARAD_SOLDIERS] });
    const run = resolveRecords(made.state, made.ctx, "17150", "forced", idOf(made.state, "17150"));
    const revealed = [...run.state.staging, ...run.state.encounterDiscard].map((id) => codeOf(run.state, id)).filter((code) => HARAD_SOLDIERS.includes(code ?? ""));
    expect(revealed).toHaveLength(1);
    expect(run.state.setAside).toHaveLength(MOUNTAINS.slice(0, 2).length + HARAD_SOLDIERS.length - 1);
  });

  it("asks the first player to choose between sets that tie, and reveals a card of the set chosen", () => {
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

  it("does nothing when no set is left set aside", () => {
    const made = table({ staging: ["17150"] });
    const run = resolveRecords(made.state, made.ctx, "17150", "forced", idOf(made.state, "17150"));
    expect(run.state.staging).toEqual(made.state.staging.concat(run.id).filter((id, at, all) => all.indexOf(id) === at));
  });
});

describe("17151:A:1 RandomSetAside `discard`, then the discard pile is shuffled into the encounter deck", () => {
  it("places a card of the largest set in the discard pile and shuffles the pile into the deck, so the card is part of the deck", () => {
    const made = table({ staging: ["17151"], setAside: [...MOUNTAINS, ...DESERT_CREATURES], deck: ["17147"], discard: ["17148"] });
    const run = resolveRecords(made.state, made.ctx, "17151", "forced", idOf(made.state, "17151"));
    expect(run.state.encounterDiscard).toEqual([]);
    const deck = run.state.encounterDeck.map((id) => codeOf(run.state, id));
    expect(deck).toHaveLength(3);
    expect(deck.filter((code) => MOUNTAINS.includes(code ?? ""))).toHaveLength(1);
    expect(run.state.setAside).toHaveLength(MOUNTAINS.length + DESERT_CREATURES.length - 1);
  });
});

describe("17152:A:2, 17152:A:3 RandomSetAside `reveal`", () => {
  it("reveals a card of a set aside set when the treachery is revealed", () => {
    const made = table({ staging: ["17152"], setAside: DESERT_CREATURES });
    const run = resolveRecords(made.state, made.ctx, "17152", "whenRevealed", idOf(made.state, "17152"));
    expect(run.state.setAside).toHaveLength(DESERT_CREATURES.length - 1);
  });
});

describe("17158:A:1 RemoveEncounterSet `setAsideOnly`, ShuffleSetAsideSet and RemoveStage", () => {
  it("shuffles Desert Sands in, removes the Mountains of Shadow cards still set aside (those in the deck stay) and the other stage 2A", () => {
    const made = table({ stage: "17158", side: "A", setAside: ["16049", "16050", ...MOUNTAINS.slice(0, 3)], deck: ["17147", "17155"] });
    const run = resolveRecords(made.state, made.ctx, "17158", "whenRevealed", idOf(made.state, "17158"));
    expect(codesIn(run.state, "encounterDeck").sort()).toEqual(["16049", "16050", "17147", "17155"]);
    expect(codesIn(run.state, "removed").sort()).toEqual(["17153", "17154", "17155"]);
    expect(run.state.setAside.map((id) => codeOf(run.state, id)).filter((code) => !["17157", "17159"].includes(code ?? ""))).toEqual([]);
    expect(run.state.cards[idOf(run.state, "17159")]).toMatchObject({ zone: "setAside", removedStage: true });
    expect(run.state.questDeck.map((id) => codeOf(run.state, id))).not.toContain("17159");
  });

  it("leaves a removed set out of the cards a later pick can name", () => {
    const made = table({ staging: ["17150"], stage: "17158", setAside: [...MOUNTAINS.slice(0, 3), "16049"] });
    const removed = resolveRecords(made.state, made.ctx, "17158", "whenRevealed", idOf(made.state, "17158")).state;
    expect(removed.setAside.map((id) => codeOf(removed, id))).not.toContain("17153");
  });
});

describe("17160:A:1 SetStagesAside", () => {
  it("sets the other two stages 3A aside, shuffles the discard pile and Desert Creatures in and has each player reveal a card", () => {
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

  it("stages each enemy of the sets of the stages 3 set aside, from the deck and the discard pile, and no other card or set", () => {
    const { run } = fourth();
    const staged = codesIn(run.state, "staging").filter((code) => code !== "17163");
    expect(staged.sort()).toEqual(["16041", "16042", "16061", "16062"]);
    expect(run.state.encounterDeck.map((id) => codeOf(run.state, id)).sort()).toEqual(["16044", "16054", "17147"]);
    expect(codesIn(run.state, "encounterDiscard")).toEqual(["16055"]);
  });

  it("puts Poros Garrison from the set aside cards into the play area of the first player", () => {
    const { run } = fourth();
    const garrison = idOf(run.state, "17145");
    expect(run.state.cards[garrison]?.zone).toBe("play");
    expect(run.state.seats[1]?.play).toContain(garrison);
    expect(run.state.setAside).not.toContain(garrison);
  });

  it("searches no set for a stage 3 that was played and defeated, which lies set aside too", () => {
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

  it("exhausts an ally as it enters play while the stage is the main quest", () => {
    expect(played({})).toMatchObject({ zone: "play", exhausted: true });
  });

  it("does not exhaust one while another stage is the main quest", () => {
    expect(played({ stage: "17158" })).toMatchObject({ zone: "play", exhausted: false });
  });
});

describe("17163:B:2 the stage is defeated only at the end of the combat phase", () => {
  const full = (layout: Layout = {}) => table({ stage: "17163", progress: 20, ...layout });
  const sweep = (state: ScenarioState, made: { ctx: Parameters<typeof settle>[1] }): ScenarioState => advanceFreed(settle({ ...state, window: null, mode: "stopped" }, made.ctx, []), made.ctx, [] as EngineStep[]);

  it("keeps a full stage in play before the end of the combat phase", () => {
    const made = full();
    const run = opened(made);
    expect(sweep(run.state, made).stageCleared).not.toBe(true);
    expect(sweep(run.state, made).questStage).toBe(made.state.questStage);
  });

  it("defeats it, and so wins, once the end of the combat phase marks the table", () => {
    const made = full({ phase: "Combat" });
    const run = resolveRecords(made.state, made.ctx, "17163", "forced", idOf(made.state, "17163"), undefined, false);
    expect(run.state.stageCleared).toBe(true);
  });
});

describe("17146:A:1 an enemy that cannot leave the staging area is passed over by the engagement check", () => {
  it("does not qualify The Black Serpent for a check its cost is low enough for, as it would never leave, and still qualifies another enemy", () => {
    const made = table({ staging: ["17146", "17147"], threat: [50, 20] });
    const state = opened(made).state;
    expect(qualifyingEnemies(state, 0, made.ctx.cards).map((id) => codeOf(state, id))).toEqual(["17147"]);
  });
});
