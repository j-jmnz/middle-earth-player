// Rules: rr.quest-advancement, rr.victory, rr.engaged (data/rules/entries.json); docs/brief.md (The Old Forest, The table); ledger lines 147002:B:2, 147006:B:1, 147011:A:2, 147022:A:1.
// What the table says of The Old Forest: the Victory dial of stage 2, the advance beat, the stage 2 preview, the dock's hold on stage 3B, Old Man Willow's words and Tom Bombadil's delayed lines.
import { describe, expect, it } from "vitest";

import { first, idOf, tableFromLayout, type Layout } from "../../../../test/harness/scene-kit.ts";
import { cardEffects, delayedLines } from "../../cards/card-effects.ts";
import { dungeonDetail } from "../../cards/dungeon-preview.ts";
import { dialProps } from "../dials.ts";
import { forestAdvanceWords, forestScore } from "./old-forest-words.ts";
import { forestDials, forestHoldWords } from "./old-forest.ts";

const ID = "the-old-forest";
const table = (layout: Layout) => tableFromLayout(ID, layout);
const name = (id: string) => id;

describe("the Victory dial of stage 2", () => {
  it("147002:B:2 reads the points in the victory display against the players times 5, and a tap opens the victory display", () => {
    const made = table({ stage: "147002", victory: ["147011", "147013"] });
    const [dial] = forestDials(made.state, made.ctx);
    expect(dial).toMatchObject({ id: "victory", value: 5, limit: 5, goal: true, pile: "victory" });
    expect(dialProps(dial!).hint).toBe("Shows the cards");
  });

  it("147002:B:2 warns within one location of the number and not before", () => {
    const far = forestDials(table({ stage: "147002", victory: ["147014"] }).state, table({ stage: "147002" }).ctx);
    expect(far[0]?.warn).toBeUndefined();
    const made = table({ stage: "147002", victory: ["147013", "147016"] });
    expect(forestDials(made.state, made.ctx)[0]?.warn).toEqual({ level: "near", words: "1 more Victory point and the next progress sends the quest to stage 3A." });
  });

  it("has no dial on stage 3 or in another scenario", () => {
    const made = table({ stage: "147006", victory: ["147011"] });
    expect(forestDials(made.state, made.ctx)).toEqual([]);
    const other = tableFromLayout("the-battle-of-lake-town", { stage: "50203" });
    expect(forestDials(other.state, other.ctx)).toEqual([]);
  });

  it("147002:B:2 says the threshold on the stage in place of no quest points, and reads X from two players", () => {
    const made = table({ stage: "147002", seats: 2, victory: ["147011"] });
    expect(forestScore(made.state, made.ctx)).toEqual({ points: 3, need: 10 });
  });
});

describe("the advance beat", () => {
  it("147002:B:2 says a different stage 2A when the points fell short and that the number was reached when they did not", () => {
    const made = table({ stage: "147002", victory: ["147011"] });
    const to2 = { ...made.state, questStage: idOf(made.state, "147003") };
    expect(forestAdvanceWords(made.ctx, made.state, to2, idOf(made.state, "147003"))).toBe("3 of 5 Victory points in the victory display: the quest goes to a different stage 2A");
    const rich = table({ stage: "147002", victory: ["147011", "147013"] });
    expect(forestAdvanceWords(rich.ctx, rich.state, rich.state, idOf(rich.state, "147006"))).toBe("The 5 Victory points in the victory display were reached: the quest goes to stage 3A");
    const other = table({ stage: "147006" });
    expect(forestAdvanceWords(other.ctx, other.state, other.state, idOf(other.state, "147006"))).toBeNull();
  });
});

describe("the dock on stage 3B", () => {
  it("147011:A:2 says Withywindle holds the win when the progress would fill the stage", () => {
    const held = table({ stage: "147006", staging: ["147011"] });
    expect(forestHoldWords(held.state, held.ctx, 40)).toBe("Withywindle holds the win");
    expect(forestHoldWords(held.state, held.ctx, 1)).toBeNull();
    const free = table({ stage: "147006" });
    expect(forestHoldWords(free.state, free.ctx, 40)).toBeNull();
  });
});

describe("Old Man Willow's words", () => {
  it("147006:B:1 says he is engaged with each player and shows no Cannot be engaged pill", () => {
    const made = table({ stage: "147006", staging: ["147007"] });
    const id = first(made.state, "147007");
    expect(cardEffects(made.state, made.ctx, id).flags.map((flag) => flag.word)).not.toContain("Cannot be engaged");
    expect(dungeonDetail(made.state, made.ctx, id, name)).toContain("Engaged with each player from the staging area");
  });
});

describe("Tom Bombadil's delayed lines", () => {
  it("147022:A:1 says he is discarded and the encounter discard pile is shuffled in, not that its effect resolves twice", () => {
    const made = table({ stage: "147002" });
    const id = idOf(made.state, "147002");
    const instructions = [{ verb: "Discard", target: { kind: "self" } }, { verb: "ShuffleEncounterDiscard" }] as const;
    const state = { ...made.state, delayed: [{ id: "d", sourceId: id, subjectId: id, until: "endOfRound" as const, instructions, seat: 0, phase: made.state.phase }] } as unknown as typeof made.state;
    expect(delayedLines(state, id, name)).toEqual(["At the end of the round: is discarded, then the encounter discard pile is shuffled into the encounter deck"]);
  });
});
