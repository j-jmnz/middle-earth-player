import { describe, expect, it } from "vitest";

import { definePrinted } from "../../core/printed.ts";
import { addModifier, modifiedStat } from "../../core/keywords.ts";
import { committedWillpower } from "../../quest/quest.ts";
import { runInstruction } from "../../interpret/interpret.ts";
import { updateCard, type ScenarioState } from "../../core/state.ts";
import { spawn } from "../../core/zones.ts";
import { ally, hero, table, treachery } from "../defense/table.ts";
import { BLIZZARD_LIMIT, redirectProgress } from "./blizzard.ts";

// Rules: rr.step-3-4, rr.active-location, faq.progress-without-advancing, faq.lasting-effects (data/rules/entries.json); ledger lines 901307:A:2, 04016:A:1, 04022:A:1, 04023:A:1.
// Blinding Blizzard (a card in the staging area holding progressRedirect) takes the progress that would go on the current quest or on a Snow location, up to 5, and is discarded with the 5th; Fanuidhol's heroes count their Willpower only once paid
// for (willpowerCostsResource and countsWillpower); the questing characters' lasting -1 reaches a character that commits later; a character that cannot quest is not committed by an effect.

const SNOW_PLACE = definePrinted({ code: "snow", name: "Snow Place", type: "location", traits: ["Snow"], threat: 1, questPoints: 6 });
const PLAIN_PLACE = definePrinted({ code: "plain", name: "Plain Place", type: "location", threat: 1, questPoints: 6 });
const BLIZZARD = treachery("blizzard");
const QUEST = definePrinted({ code: "quest", name: "Quest", type: "quest", questPoints: 8 });

function withBlizzards(count: number, snow = true) {
  const built = table({ cards: [hero("a", { willpower: 2 }), hero("b", { willpower: 3 }), SNOW_PLACE, PLAIN_PLACE, BLIZZARD, QUEST], effects: [], heroes: [{ code: "a" }, { code: "b" }] });
  let state: ScenarioState = built.state;
  const blizzards: string[] = [];
  for (let at = 0; at < count; at += 1) {
    const spawned = spawn(state, "blizzard", { zone: "staging" });
    state = addModifier(spawned.state, spawned.id, spawned.id, "progressRedirect", 1, "whileSourceInPlay");
    blizzards.push(spawned.id);
  }
  const place = spawn(state, snow ? "snow" : "plain", { zone: "staging" });
  return { ...built, state: place.state, blizzards, place: place.id };
}

describe("progressRedirect (901307:A:2)", () => {
  it("901307:A:2 places the progress that would go on a Snow location on the Blizzard, and none on the location", () => {
    const { state, blizzards, place, ctx } = withBlizzards(1);
    const direct = redirectProgress(state, place, 3, ctx.cards, []);
    expect(direct.remaining).toBe(0);
    expect(direct.state.cards[blizzards[0]!]?.progress).toBe(3);
    expect(direct.state.cards[place]?.progress).toBe(0);
  });

  it("901307:A:2 leaves the progress for a location that is not Snow where it goes", () => {
    const { state, blizzards, place, ctx } = withBlizzards(1, false);
    const direct = redirectProgress(state, place, 3, ctx.cards, []);
    expect(direct.remaining).toBe(3);
    expect(direct.state.cards[blizzards[0]!]?.progress).toBe(0);
  });

  it("901307:A:2 discards the Blizzard as its 5th progress is placed and places the rest as it would have gone", () => {
    const { state, blizzards, place, ctx } = withBlizzards(1);
    const direct = redirectProgress(state, place, 7, ctx.cards, []);
    expect(BLIZZARD_LIMIT).toBe(5);
    expect(direct.remaining).toBe(2);
    expect(direct.state.cards[blizzards[0]!]?.zone).toBe("encounterDiscard");
    expect(direct.state.cards[blizzards[0]!]?.progress).toBe(0);
  });

  it("901307:A:2 fills the first of two Blizzards and gives the second what is left", () => {
    const { state, blizzards, place, ctx } = withBlizzards(2);
    const direct = redirectProgress(state, place, 7, ctx.cards, []);
    expect(direct.remaining).toBe(0);
    expect(direct.state.cards[blizzards[0]!]?.zone).toBe("encounterDiscard");
    expect(direct.state.cards[blizzards[1]!]?.progress).toBe(2);
  });

  it("901307:A:2 takes the progress that would go on the current quest stage", () => {
    const { state, blizzards, ctx } = withBlizzards(1);
    const spawned = spawn(state, "quest", { zone: "questStage" });
    const direct = redirectProgress({ ...spawned.state, questStage: spawned.id }, spawned.id, 2, ctx.cards, []);
    expect(direct.remaining).toBe(0);
    expect(direct.state.cards[blizzards[0]!]?.progress).toBe(2);
  });
});

describe("willpowerCostsResource (04016:A:1)", () => {
  function committed() {
    const built = table({ cards: [hero("a", { willpower: 2 }), hero("b", { willpower: 3 })], effects: [], heroes: [{ code: "a" }, { code: "b" }] });
    let state = updateCard(updateCard(built.state, built.ids.a!, { committed: true }), built.ids.b!, { committed: true });
    state = addModifier(addModifier(state, built.ids.a!, built.ids.a!, "willpowerCostsResource", 1, "endOfPhase"), built.ids.b!, built.ids.a!, "willpowerCostsResource", 1, "endOfPhase");
    return { ...built, state };
  }

  it("04016:A:1 counts no hero's Willpower until it has paid, and the Willpower of the hero that did", () => {
    const { state, ids, ctx } = committed();
    expect(committedWillpower(state, ctx.cards)).toBe(0);
    const paid = addModifier(state, ids.b!, ids.a!, "countsWillpower", 1, "endOfPhase");
    expect(committedWillpower(paid, ctx.cards)).toBe(3);
  });

  it("04016:A:1 does not touch an ally, which counts its Willpower as usual", () => {
    const built = table({ cards: [hero("a", { willpower: 2 }), ally("friend", { willpower: 2 })], effects: [], heroes: [{ code: "a" }], allies: [{ code: "friend" }] });
    const quested = updateCard(updateCard(built.state, built.ids.a!, { committed: true }), built.ids.friend!, { committed: true });
    const costly = addModifier(quested, built.ids.a!, built.ids.a!, "willpowerCostsResource", 1, "endOfPhase");
    expect(committedWillpower(costly, built.ctx.cards)).toBe(2);
  });
});

describe("questingCharacters (04022:A:1)", () => {
  it("04022:A:1 gives the -1 to a character that commits after the effect resolved, and not before", () => {
    const built = table({ cards: [hero("a", { willpower: 2 })], effects: [], heroes: [{ code: "a" }] });
    const resolved = runInstruction(built.state, { verb: "ModifyStat", stat: "willpower", amount: -1, until: "endOfPhase", target: "questingCharacters" }, { seat: 0, sourceId: built.ids.a! }, built.ctx, []);
    const card = (state: ScenarioState) => state.cards[built.ids.a!]!;
    expect(modifiedStat(resolved, card(resolved), "willpower", built.ctx.cards)).toBe(2);
    const committed = updateCard(resolved, built.ids.a!, { committed: true });
    expect(modifiedStat(committed, card(committed), "willpower", built.ctx.cards)).toBe(1);
  });
});

describe("CommitToQuest and cannotQuest (04023:A:1, 04024:A:1)", () => {
  function frozenHero(cards: ReturnType<typeof treachery>[]) {
    const built = table({ cards: [hero("a"), hero("b"), ...cards], effects: [], heroes: [{ code: "a" }, { code: "b" }] });
    const spawned = cards.length > 0 ? spawn(built.state, "04023", { zone: "staging" }).state : built.state;
    return { built, frozen: addModifier(spawned, built.ids.a!, built.ids.a!, "cannotQuest", 1, "whileSourceInPlay") };
  }

  it("04024:A:1 does not commit a character that cannot quest in a game that deals Freezing Cold, and commits one that can", () => {
    const { built, frozen } = frozenHero([treachery("04023")]);
    let next = runInstruction(frozen, { verb: "CommitToQuest", target: "self" }, { seat: 0, sourceId: built.ids.a! }, built.ctx, []);
    expect(next.cards[built.ids.a!]?.committed).toBe(false);
    next = runInstruction(frozen, { verb: "CommitToQuest", target: "self" }, { seat: 0, sourceId: built.ids.b! }, built.ctx, []);
    expect(next.cards[built.ids.b!]?.committed).toBe(true);
  });

  it("refuses a character that cannot quest in every game, with no Freezing Cold dealt too", () => {
    const { built, frozen } = frozenHero([]);
    const next = runInstruction(frozen, { verb: "CommitToQuest", target: "self" }, { seat: 0, sourceId: built.ids.a! }, built.ctx, []);
    expect(next.cards[built.ids.a!]?.committed).toBe(false);
  });
});
