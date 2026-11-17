// Rules: rr.travel, rr.step-3-4, rr.step-3-2, rr.winning-the-game (data/rules/entries.json).
import { describe, expect, it } from "vitest";

import { EFFECTS } from "../../../effects/index.ts";
import { travelBlocked } from "../../../rules/interpret/restrictions.ts";

import { play } from "../../../../test/harness/card-spec-play.ts";
import type { Row } from "../../../../test/harness/card-spec.ts";
import { reduce } from "../../../rules/engine/reduce.ts";
import { first, idsOf, tableFromLayout, type Layout } from "../../../../test/harness/scene-kit.ts";

// What a card-spec row cannot express for The Massing at Osgiliath: the stages' travel bars, the cost of committing on stage 3, a character committed and a stage defeated (the flags the stages hold are tested with their families, families/quest/effect-progress.test.ts, wilderland/hand-plays.test.ts and defense/damage-to-threat.test.ts). Each test starts its title with the line id.
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

describe("00019:B:3 defeating the last stage", () => {
  it("00019:B:3 the 15th progress on Race to Minas Tirith wins the game", () => {
    const done = played({ layout: { stage: CROSSED, progress: 11 }, act: [{ act: "quest", outcome: "success" }], expect: [] });
    expect(done.run.state.stageCleared).toBe(true);
    expect(done.run.state.lost).toBeFalsy();
  });
});
