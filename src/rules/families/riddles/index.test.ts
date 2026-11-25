// Rules: hob.riddle-area, hob.riddles, hob.riddles-steps-2-and-3, rr.quest-advancement, faq.progress-without-advancing (data/rules/entries.json); ledger lines 131029:A:1, 131029:B:1, 131030:A:1, 131030:B:2, 131030:B:3, 131031:B:1, 131075:A:2, 131076:A:2, 131079:A:2. The riddle area, stage 2 and the answering of a riddle.
import { describe, expect, it } from "vitest";

import type { EngineStep } from "../../core/intents.ts";
import { updateCard } from "../../core/state.ts";
import { codesIn, idOf, resolveRecords, revealFromTop } from "../../../../test/harness/scene-kit.ts";
import { inDiscard, progressOf, revealAnswering, riddleTable, stacked } from "./fixture.ts";

describe("the riddle area (131029:A:1, 131030:A:1)", () => {
  it("is created by the first stage's Setup: stage 2, Gollum and the Ring leave the quest deck and the encounter deck", () => {
    const made = riddleTable();
    expect(codesIn(made.state, "riddleArea")).toEqual(["131030", "131074"]);
    expect(made.state.questDeck.map((id) => made.state.cards[id]?.code)).toEqual(["131031"]);
    const ring = made.state.cards[idOf(made.state, "131079")];
    expect(ring?.zone).toBe("attached");
    expect(ring?.host).toBe(made.bilbo);
    expect(made.state.encounterDeck.map((id) => made.state.cards[id]?.code)).toEqual(["f0", "f0"]);
    expect(made.state.cards[idOf(made.state, "131030")]?.face).toBe("B");
  });
});

describe("answering a riddle (131076:A:2)", () => {
  it("offers the first player the choice when Wild Wargs is revealed from the encounter deck", () => {
    const made = riddleTable({ deckOf: ["01013", "01013"] });
    const revealed = revealFromTop(made.state, made.ctx, "131076", []).state;
    expect(revealed.window).toMatchObject({ kind: "choose", options: ["answer", "resolve"], seat: made.state.firstPlayer });
  });

  it("names the type, shuffles and discards 2 cards, and puts 1 progress on stage 2 for each match", () => {
    const made = riddleTable({ deckOf: ["01013", "01013", "01040"] });
    const run = revealAnswering(made.state, made.ctx, "131076", ["answer", "ally"]);
    expect(inDiscard(run.state, "01013") + inDiscard(run.state, "01040")).toBe(2);
    expect(progressOf(run.state)).toBe(inDiscard(run.state, "01013"));
    expect(run.state.cards[idOf(run.state, "131076")]?.zone).toBe("encounterDiscard");
  });

  it("puts every matching card on stage 2: 2 allies name 2 progress", () => {
    const made = riddleTable({ deckOf: ["01013", "01013"] });
    expect(progressOf(revealAnswering(made.state, made.ctx, "131076", ["answer", "ally"]).state)).toBe(2);
  });

  it("resolves the card as any card when the first player does not answer: it stays in the staging area and nothing is discarded", () => {
    const made = riddleTable({ deckOf: ["01013", "01013"] });
    const run = revealAnswering(made.state, made.ctx, "131076", ["resolve"]);
    expect(run.state.cards[idOf(run.state, "131076")]?.zone).toBe("staging");
    expect(inDiscard(run.state, "01013")).toBe(0);
    expect(progressOf(run.state)).toBe(0);
  });

  it("gives the first player no choice for a card that is not revealed from the encounter deck (a search or a shadow card)", () => {
    const made = riddleTable();
    const run = resolveRecords(made.state, made.ctx, "131076", "whenRevealed");
    expect(run.state.window?.kind).not.toBe("choose");
    expect(run.state.cards[run.id]?.zone).toBe("staging");
  });
});

describe("naming several items (131075:A:2)", () => {
  it("counts a card as a match only when it has every named item: type, sphere and cost", () => {
    const made = riddleTable({ deckOf: ["01013", "01021", "01025"] });
    const run = revealAnswering(made.state, made.ctx, "131075", ["answer", "ally", "leadership", "2"]);
    expect(inDiscard(run.state, "01013") + inDiscard(run.state, "01021") + inDiscard(run.state, "01025")).toBe(3);
    expect(progressOf(run.state)).toBe(1);
  });

  it("matches no named sphere for a card with none (a neutral card) and no number for a cost of X", () => {
    const made = riddleTable({ deckOf: ["01051", "01040", "event"] });
    const sphere = revealAnswering(made.state, made.ctx, "131077", ["answer", "spirit"]);
    expect(progressOf(sphere.state)).toBe(0);
    const costX = revealAnswering(riddleTable({ deckOf: ["01051", "01051", "01051"] }).state, made.ctx, "131081", ["answer", "0"]);
    expect(progressOf(costX.state)).toBe(0);
  });
});

describe("Bilbo's Magic Ring while answering (131079:A:2)", () => {
  it("lets the first player spend Bilbo's Baggins resources, one at a time, to discard 1 more card each and count it", () => {
    const made = riddleTable({ deckOf: ["01013", "01013", "01013", "01013"] });
    const resourced = updateCard(made.state, made.bilbo, { resources: 2 });
    const run = revealAnswering(resourced, made.ctx, "131076", ["answer", "ally", "ring", "ring"]);
    expect(run.state.cards[made.bilbo]?.resources).toBe(0);
    expect(inDiscard(run.state, "01013")).toBe(4);
    expect(progressOf(run.state)).toBe(4);
  });

  it("is asked again after each use and stops when the first player says so", () => {
    const made = riddleTable({ deckOf: ["01013", "01013", "01013"] });
    const resourced = updateCard(made.state, made.bilbo, { resources: 2 });
    const run = revealAnswering(resourced, made.ctx, "131076", ["answer", "ally", "ring", "stop"]);
    expect(run.state.cards[made.bilbo]?.resources).toBe(1);
    expect(inDiscard(run.state, "01013")).toBe(3);
  });

  it("asks nothing when Bilbo holds no resource or the deck is empty", () => {
    const made = riddleTable({ deckOf: ["01013", "01013"] });
    const run = revealAnswering(made.state, made.ctx, "131076", ["answer", "ally"]);
    expect(run.state.window?.kind).not.toBe("choose");
    expect(progressOf(run.state)).toBe(2);
  });
});

describe("the riddle cards that must be answered (131081:A:1, 131083:A:1)", () => {
  it("gives What's In My Pocket? no choice: the first player names a sphere and a cost at once", () => {
    const made = riddleTable({ deckOf: ["01013", "01021"] });
    const steps: EngineStep[] = [];
    const revealed = revealFromTop(made.state, made.ctx, "131083", steps).state;
    expect(revealed.window).toMatchObject({ kind: "choose" });
    expect(revealed.window?.kind === "choose" ? revealed.window.options : []).toEqual(["leadership", "spirit", "lore", "tactics", "baggins"]);
    const run = revealAnswering(made.state, made.ctx, "131083", ["leadership", "2"]);
    expect(progressOf(run.state)).toBe(1);
    expect(run.state.cards[idOf(run.state, "131083")]?.zone).toBe("encounterDiscard");
  });

  it("answers a second riddle when It Likes Riddles? finds a match: encounter cards are discarded until a card with a riddle is discarded", () => {
    const made = riddleTable({ deck: ["131074", "131079", "f0", "f0", "131076", "f0", "f0"], deckOf: ["01013", "01013", "01013", "01013"] });
    const run = revealAnswering(stacked(made.state, ["f0", "f0", "131076"]), made.ctx, "131081", ["2", "ally"]);
    // The riddle of It Likes Riddles? names a cost; the card found, Wild Wargs, names a type.
    const wargs = Object.values(run.state.cards).find((card) => card.code === "131076");
    expect(wargs?.zone).toBe("encounterDiscard");
    expect(inDiscard(run.state, "01013")).toBe(4);
  });

  it("answers no second riddle when the first finds no match", () => {
    const made = riddleTable({ deck: ["131074", "131079", "f0", "f0", "131076", "f0", "f0"], deckOf: ["01040", "01040", "01013", "01013"] });
    const run = revealAnswering(stacked(made.state, ["f0", "f0", "131076"]), made.ctx, "131081", ["0"]);
    expect(inDiscard(run.state, "01013") + inDiscard(run.state, "01040")).toBe(2);
    expect(Object.values(run.state.cards).find((card) => card.code === "131076")?.zone).toBe("encounterDeck");
    expect(run.state.encounterDiscard.map((id) => run.state.cards[id]?.code)).toEqual(["131081"]);
  });
});
