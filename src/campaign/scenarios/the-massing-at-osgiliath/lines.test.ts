// Rules: rr.travel, rr.step-3-4, rr.play-and-put-into-play, rr.defending-player, rr.step-3-2, rr.winning-the-game (data/rules/entries.json).
import { describe, expect, it } from "vitest";

import { EFFECTS } from "../../../effects/index.ts";
import { runInstruction } from "../../../rules/interpret/interpret.ts";
import { travelBlocked } from "../../../rules/interpret/restrictions.ts";
import { placeQuestingProgress } from "../../../rules/families/defense/damage.ts";
import { enemy, hero, send as sendTable, table as cardTable, treachery, until, recordsOf } from "../../../rules/families/defense/table.ts";

import { play } from "../../../../test/harness/card-spec-play.ts";
import type { Row } from "../../../../test/harness/card-spec.ts";
import { reduce } from "../../../rules/engine/reduce.ts";
import { first, idsOf, legalIntents, send, tableFromLayout, type Layout } from "../../../../test/harness/scene-kit.ts";

// What a card-spec row cannot express for The Massing at Osgiliath: the stages' bars (a travel not offered, a play refused, progress not placed), a character committed, an attack another player's Sentinel defends and a stage defeated. Each test starts its title with the line id.
const ID = "the-massing-at-osgiliath";
const CROSSED = "00019";
const table = (layout: Layout = {}) => tableFromLayout(ID, layout);
const QUEST_START = { seat: null, phase: "Quest" } as const;
const played = (row: Omit<Row, "line">) => play(ID, { line: "test", ...row } as Row, EFFECTS, false);

describe("the stages bar travel by Trait", () => {
  const barred = (stage: string, location: string): boolean => {
    const made = table({ stage, staging: [location] });
    return travelBlocked(made.state, made.ctx, first(made.state, location));
  };
  const WEST = "00007";
  const EAST = "00011";

  it("00016:B:1 stage 1 bars the West Bank locations and not the East Bank ones", () => {
    expect(barred("00016", WEST)).toBe(true);
    expect(barred("00016", EAST)).toBe(false);
  });

  it("00017:B:1 stage 2 bars the West Bank locations and not the East Bank ones", () => {
    expect(barred("00017", WEST)).toBe(true);
    expect(barred("00017", EAST)).toBe(false);
  });

  it("00018:B:2 stage 3 bars the East Bank and the West Bank locations", () => {
    expect(barred("00018", WEST)).toBe(true);
    expect(barred("00018", EAST)).toBe(true);
  });

  it("00019:B:2 stage 4 bars the East Bank locations and frees the West Bank ones", () => {
    expect(barred(CROSSED, EAST)).toBe(true);
    expect(barred(CROSSED, WEST)).toBe(false);
  });
});

describe("00017:B:2 one card from the hand each round", () => {
  it("00017:B:2 a player who played a card from his hand cannot play another that round", () => {
    const made = table({ phase: "Planning", stage: "00017", heroResources: 4, hand: ["ally", "ally", "filler"] });
    const plays = (state: typeof made.state) => legalIntents(state, made.ctx).filter((intent) => intent.type === "PlayCard");
    expect(plays(made.state).length).toBeGreaterThan(1);
    const cardId = plays(made.state)[0]?.cardId ?? "";
    const done = send({ state: made.state, steps: [] }, { type: "PlayCard", cardId, payments: [{ heroId: made.hero, amount: made.cards.get(made.state.cards[cardId]?.code ?? "")?.cost ?? 0 }] }, made.ctx);
    expect(plays(done.state)).toHaveLength(0);
  });
});

describe("00018:B:1 no progress from card effects on the quest or the active location", () => {
  const stageProgress = (layout: Layout, instruction: Parameters<typeof runInstruction>[1]) => {
    const made = table({ stage: "00018", ...layout });
    return { made, state: runInstruction(made.state, instruction, { seat: 0, sourceId: null }, made.ctx, []) };
  };

  it("00018:B:1 a card effect places no progress on the quest card or on the active location", () => {
    const quest = stageProgress({ active: "00011" }, { verb: "ProgressQuest", amount: 2 });
    expect(quest.state.cards[quest.made.state.questStage ?? ""]?.progress).toBe(0);
    expect(quest.state.cards[first(quest.state, "00011")]?.progress).toBe(0);
    const located = stageProgress({ active: "00011" }, { verb: "PlaceProgressOn", amount: 2, target: "activeLocation" });
    expect(located.state.cards[first(located.state, "00011")]?.progress).toBe(0);
  });

  it("00018:B:1 the quest's own progress still goes on the active location, and a staged location takes effect progress", () => {
    const made = table({ stage: "00018", active: "00011" });
    const questing = placeQuestingProgress(made.state, 2, made.cards, [], () => true);
    expect(questing.cards[first(questing, "00011")]?.progress).toBe(2);
    const staged = stageProgress({ staging: ["00007"] }, { verb: "PlaceProgressOn", amount: 1, target: "eachStagingLocation" });
    expect(staged.state.cards[first(staged.state, "00007")]?.progress).toBe(1);
  });

  it("00018:B:1 another stage leaves the effect's progress free", () => {
    const other = stageProgress({ stage: "00017", active: "00011" }, { verb: "ProgressQuest", amount: 2 });
    expect(other.state.cards[first(other.state, "00011")]?.progress).toBe(2);
  });
});

describe("00018:B:3 the cost of committing", () => {
  const begin = (layout: Layout, ...answers: string[]) => played({ layout: { stage: "00018", ...layout }, act: [{ act: "announce", trigger: "beginningOfPhase", extra: QUEST_START }, ...answers.map((id) => ({ act: "answer" as const, id }))], expect: [] });
  const commits = (done: ReturnType<typeof begin>, ...cards: string[]) => reduce(done.run.state, { type: "Commit", cardIds: cards }, done.table.ctx).ok;

  it("00018:B:3 a player who pays nothing commits no character", () => {
    const done = begin({}, "none");
    expect(commits(done, done.table.hero, done.table.hero2)).toBe(false);
    expect(commits(done, done.table.hero2)).toBe(false);
  });

  it("00018:B:3 a player who discards a hero commits the others, and the discarded one is not committed", () => {
    const done = begin({}, "hero", "dh1");
    expect(done.run.state.cards[done.table.hero]?.zone).toBe("discard");
    expect(commits(done, done.table.hero2)).toBe(true);
  });

  it("00018:B:3 a Ranger of Ithilien the player controls (an objective ally) is a candidate: it is discarded to the encounter discard pile and the heroes still commit", () => {
    const done = begin({ play: ["00015"] }, "ranger");
    expect(done.table.cards.get("00015")?.type).toBe("objective");
    expect(done.run.state.cards[idsOf(done.run.state, "00015")[0] ?? ""]?.zone).toBe("encounterDiscard");
    expect(commits(done, done.table.hero, done.table.hero2)).toBe(true);
  });

  it("00018:B:3 with no Ranger of Ithilien under his control the Ranger option is not offered", () => {
    expect(() => begin({}, "ranger")).toThrow();
  });
});

describe("00015:A:1 the Ranger of Ithilien committed to the quest", () => {
  it("00015:A:1 revealed in the quest phase it enters committed and exhausted, and Morgulduin deals it 1 damage", () => {
    const done = played({ layout: { active: "00009", deck: ["f0"], committed: [] }, act: [{ act: "reveal", code: "00015" }], expect: [] });
    const ranger = done.run.state.cards[idsOf(done.run.state, "00015")[0] ?? ""];
    expect(ranger?.zone).toBe("play");
    expect(ranger?.committed).toBe(true);
    expect(ranger?.exhausted).toBe(true);
    expect(ranger?.damage).toBe(1);
  });

  it("00015:A:1 revealed outside the quest phase it enters exhausted and not committed", () => {
    const done = played({ layout: { phase: "Encounter", deck: ["f0"] }, act: [{ act: "reveal", code: "00015" }], expect: [] });
    const ranger = done.run.state.cards[idsOf(done.run.state, "00015")[0] ?? ""];
    expect(ranger?.committed).toBeFalsy();
    expect(ranger?.exhausted).toBe(true);
  });
});

describe("00004:A:1 whose threat Wainriders raise", () => {
  const shade = treachery("shade");
  const wainriders = recordsOf(EFFECTS, "00004");
  const defenseWindow = (state: Parameters<typeof until>[0]) => state.window?.kind === "defense";

  it("00004:A:1 another player's Sentinel defending raises the threat of the attacked player, not his own", () => {
    const built = cardTable({
      seatCount: 2,
      cards: [hero("a", { health: 9 }), hero("guard", { health: 9, keywords: { sentinel: true } }), enemy("00004", { attack: 3, engagementCost: 30 }), shade],
      effects: wainriders,
      heroes: [{ code: "a" }, { code: "guard", seat: 1 }],
      enemies: [{ code: "00004" }],
      encounter: ["shade"],
    });
    const { ids, ctx } = built;
    const defense = until(sendTable(built.state, { type: "DeclineEngage" }, ctx), ctx, defenseWindow);
    const before = [defense.seats[0].threat, defense.seats[1].threat];
    const hit = until(sendTable(defense, { type: "DeclareDefender", defenderId: ids.guard! }, ctx), ctx, (current) => current.pendingAttack == null);
    expect(hit.cards[ids.guard!]?.damage).toBe(2);
    expect([hit.seats[0].threat, hit.seats[1].threat]).toEqual([before[0]! + 2, before[1]]);
  });
});

describe("00019:B:3 defeating the last stage", () => {
  it("00019:B:3 the 15th progress on Race to Minas Tirith wins the game", () => {
    const done = played({ layout: { stage: CROSSED, progress: 11 }, act: [{ act: "quest", outcome: "success" }], expect: [] });
    expect(done.run.state.stageCleared).toBe(true);
    expect(done.run.state.lost).toBeFalsy();
  });
});
