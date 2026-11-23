// Rules: hob.riddle-area, hob.riddles, rr.cannot, rr.cost, rr.immune, mec109.immune-to-player-card-effects, rr.encounter-deck (data/rules/entries.json); ledger lines 131030:B:2, 131030:B:3, 131079:A:2, 131079:A:3, 131081:A:1. What the riddle area bars and what the riddle cards leave out: the stage's own progress, the cards that stay in the area, the Ring's two Actions, It Likes Riddles?
import { describe, expect, it } from "vitest";

import type { Effect, Instruction, PickSpec } from "../../../catalog/boundary.ts";
import { settle } from "../../engine/machine.ts";
import { takeProgressOff } from "../../core/progress.ts";
import { updateCard, type ScenarioState } from "../../core/state.ts";
import { spawn } from "../../core/zones.ts";
import { placeProgress } from "../../interpret/effect-verbs.ts";
import type { EngineStep } from "../../core/intents.ts";
import { codesIn, idOf, resolveRecords } from "../../../../test/harness/scene-kit.ts";
import { inDiscard, progressOf, revealAnswering, riddleTable, stacked, type RiddleTable } from "./fixture.ts";

const AREA: PickSpec = { type: "card", control: "any", riddleArea: true };
const ANY_ENEMY: PickSpec = { type: "enemy", control: "any" };

// A table whose context also holds a record of a card "f0", which is resolved as a When Revealed effect of that card (an encounter card's effect) or of the player card "event" (a player card's).
function withRecord(made: RiddleTable, cardCode: string, instructions: readonly Instruction[]): { made: RiddleTable; effect: Effect } {
  const effect: Effect = { id: `${cardCode}:whenRevealed:9`, cardCode, lines: [`${cardCode}:A:9`], timing: "whenRevealed", instructions: [...instructions] };
  return { made: { ...made, ctx: { ...made.ctx, effects: [...made.ctx.effects, effect] } }, effect };
}

describe("131030:B:2 no card effect adds progress to or takes it off stage 2", () => {
  it("131030:B:2 places none on the stage when a card effect would", () => {
    const made = riddleTable();
    const stage = idOf(made.state, "131030");
    const steps: EngineStep[] = [];
    expect(placeProgress(made.state, stage, 3, made.ctx, steps).cards[stage]?.progress).toBe(0);
    expect(steps.filter((step) => step.kind === "progress")).toEqual([]);
  });

  it("131030:B:2 takes none off the stage when a card effect would, and keeps the progress the riddles placed", () => {
    const made = riddleTable();
    const stage = idOf(made.state, "131030");
    const held = updateCard(made.state, stage, { progress: 4 });
    const steps: EngineStep[] = [];
    expect(takeProgressOff(held, stage, 3, steps).cards[stage]?.progress).toBe(4);
    expect(steps.filter((step) => step.kind === "progress")).toEqual([]);
  });

  it("131030:B:2 leaves the active location and the first stage free: card effects still place and remove progress there", () => {
    const made = riddleTable({ active: "place" });
    const location = made.state.activeLocation ?? "";
    const first = idOf(made.state, "131029");
    expect(location).not.toBe("");
    const steps: EngineStep[] = [];
    expect(placeProgress(made.state, location, 1, made.ctx, steps).cards[location]?.progress).toBe(1);
    const loaded = updateCard(updateCard(made.state, location, { progress: 2 }), first, { progress: 5 });
    expect(takeProgressOff(loaded, location, 1, steps).cards[location]?.progress).toBe(1);
    expect(takeProgressOff(loaded, first, 2, steps).cards[first]?.progress).toBe(3);
  });

  it("131030:B:2 still takes progress off by answering riddles and by Not Fair! Not Fair!, and puts it on by answering", () => {
    const made = riddleTable({ deck: ["131074", "131079", "f0", "f0", "treachery", "f0", "f0"], deckOf: ["01013", "01013"] });
    const answered = revealAnswering(made.state, made.ctx, "131076", ["answer", "ally"]);
    expect(progressOf(answered.state)).toBe(2);
    const removed = revealAnswering(stacked(answered.state, ["f0", "f0", "treachery"]), made.ctx, "131084", ["enemy"]);
    expect(progressOf(removed.state)).toBe(1);
  });

  it("131030:B:2 ends with the stage: once stage 3 has removed it, the flags are gone", () => {
    const made = riddleTable();
    const stage = idOf(made.state, "131030");
    const left = updateCard(made.state, stage, { progress: 9 });
    const free = settle(updateCard(left, idOf(left, "131029"), { progress: 14 }), made.ctx, []);
    expect(free.cards[stage]?.zone).toBe("removed");
    expect(takeProgressOff(updateCard(free, stage, { progress: 3 }), stage, 2, []).cards[stage]?.progress).toBe(1);
  });
});

describe("131030:B:3 the riddle area keeps its cards until stage 3 takes them out", () => {
  const inArea = (state: ScenarioState): string[] => [...codesIn(state, "riddleArea"), ...(state.cards[idOf(state, "131001")]?.zone === "heroes" ? ["131001"] : []), ...(state.cards[idOf(state, "131079")]?.host === idOf(state, "131001") ? ["131079"] : [])].sort();

  it("131030:B:3 offers no card of the area to a player card effect, so none can move Bilbo Baggins, Gollum or the Ring", () => {
    const made = riddleTable();
    const { made: played } = withRecord(made, "event", [{ verb: "Each", pick: AREA, instructions: [{ verb: "Discard", target: { kind: "picked" } }] }]);
    const card = spawn(played.state, "event", { zone: "hand", seat: 0 });
    const run = resolveRecords(card.state, played.ctx, "event", "whenRevealed", card.id);
    expect(inArea(run.state)).toEqual(["131001", "131030", "131074", "131079"]);
    expect(run.state.cards[made.bilbo]?.zone).toBe("heroes");
  });

  it("131030:B:3 keeps Gollum in the area when an encounter effect returns every enemy to the staging area, engages every enemy in play or discards every enemy", () => {
    const made = riddleTable({ engaged: [{ code: "f0", seat: 0 }] });
    const { made: effects } = withRecord(made, "f0", [
      { verb: "ReturnToStaging", target: { kind: "engagedEnemies", who: "each", pick: "all" } },
      { verb: "EngageAll", who: "firstPlayer", inPlay: true },
      { verb: "Each", pick: ANY_ENEMY, instructions: [{ verb: "Discard", target: { kind: "picked" } }] },
    ]);
    const source = spawn(effects.state, "f0", { zone: "staging" });
    const run = resolveRecords(source.state, effects.ctx, "f0", "whenRevealed", source.id);
    expect(run.state.cards[idOf(run.state, "131074")]?.zone).toBe("riddleArea");
    expect(inArea(run.state)).toEqual(["131001", "131030", "131074", "131079"]);
  });

  it("131030:B:3 keeps Gollum in the area when stage 3's own engage effect runs while stage 2 is in play, and moves him when stage 2 has left", () => {
    const made = riddleTable();
    const gollum = idOf(made.state, "131074");
    const same = resolveRecords(made.state, made.ctx, "131031", "whenRevealed", idOf(made.state, "131031"));
    expect(inArea(same.state)).not.toContain("131030");
    expect(same.state.cards[gollum]?.zone).toBe("engaged");
    const held = { ...made, ctx: { ...made.ctx, effects: made.ctx.effects.filter((effect) => effect.id !== "131031:whenRevealed:1") } };
    const stays = resolveRecords(held.state, held.ctx, "131031", "whenRevealed", idOf(held.state, "131031"));
    expect(stays.state.cards[gollum]?.zone).toBe("riddleArea");
  });

  it("131030:B:3 moves Bilbo Baggins, Gollum and the Ring out by stage 3's quest effects only: stage 2 leaves, Bilbo keeps the Ring, Gollum engages the first player", () => {
    const made = riddleTable();
    const run = resolveRecords(made.state, made.ctx, "131031", "whenRevealed", idOf(made.state, "131031"));
    expect(codesIn(run.state, "riddleArea")).toEqual([]);
    expect(run.state.cards[made.bilbo]?.zone).toBe("heroes");
    expect(run.state.cards[idOf(run.state, "131079")]?.host).toBe(made.bilbo);
    expect(run.state.cards[idOf(run.state, "131074")]).toMatchObject({ zone: "engaged", controller: run.state.firstPlayer });
  });
});

describe("131081:A:1 It Likes Riddles? does not find itself again", () => {
  it("131081:A:1 answers no second riddle when the only riddle card left is It Likes Riddles? itself, shuffled back with the discard pile", () => {
    const made = riddleTable({ deck: ["131074", "131079", "f0", "f0", "f0"], deckOf: ["01013", "01013", "01013"] });
    const run = revealAnswering(stacked(made.state, ["f0", "f0", "f0"]), made.ctx, "131081", ["2"]);
    expect(progressOf(run.state)).toBeGreaterThanOrEqual(0);
    // Nothing is left to discard: the three f0 cards stay in the deck and the source card is the only card in the encounter discard pile.
    expect(run.state.encounterDiscard.map((id) => run.state.cards[id]?.code)).toEqual(["131081"]);
    expect(inDiscard(run.state, "01013")).toBe(2);
  });

  it("131081:A:1 does not take the source card when the discard pile is shuffled in while another riddle card is found", () => {
    const made = riddleTable({ deck: ["131074", "131079", "f0", "131076", "f0"], deckOf: ["01013", "01013", "01013", "01013"] });
    const run = revealAnswering(stacked(made.state, ["f0", "131076"]), made.ctx, "131081", ["2", "ally"]);
    expect(Object.values(run.state.cards).find((card) => card.code === "131076")?.zone).toBe("encounterDiscard");
    expect(run.state.encounterDiscard.map((id) => run.state.cards[id]?.code).sort()).toEqual(["131076", "131081", "f0"]);
    expect(run.state.encounterDeck.map((id) => run.state.cards[id]?.code)).toEqual(["f0"]);
  });

  it("131081:A:1 answers the second riddle when exactly 1 card matched the first, and none when 0 did", () => {
    const one = riddleTable({ deck: ["131074", "131079", "f0", "131076"], deckOf: ["01013", "01040"] });
    const run = revealAnswering(stacked(one.state, ["f0", "131076"]), one.ctx, "131081", ["2"]);
    // The first riddle names cost 2 and discards 2: Guard of the Citadel (cost 2) is the one match, then Wild Wargs is found and its riddle is answered (it discards 2 more).
    expect(Object.values(run.state.cards).find((card) => card.code === "131076")?.zone).toBe("encounterDiscard");
    const none = riddleTable({ deck: ["131074", "131079", "f0", "131076"], deckOf: ["01040", "01040"] });
    const failed = revealAnswering(stacked(none.state, ["f0", "131076"]), none.ctx, "131081", ["2"]);
    expect(Object.values(failed.state.cards).find((card) => card.code === "131076")?.zone).toBe("encounterDeck");
  });
});

describe("a riddle card that is answered is never added to the staging area", () => {
  it("131076:A:2 fires no effect that hears an enemy added to the staging area when the first player answers, and fires it when he resolves the card", () => {
    const made = riddleTable({ deckOf: ["01013", "01013"] });
    const hear: Effect = { id: "131078:forced:9", cardCode: "131078", lines: ["131078:A:9"], timing: "forced", trigger: "addedToStaging", subject: { type: "enemy", control: "any" }, instructions: [{ verb: "ModifyStat", stat: "engagementCost", amount: 5, until: "endOfRound", target: "subject" }] };
    const heard = { ...made, ctx: { ...made.ctx, effects: [...made.ctx.effects, hear] } };
    const marked = (state: ScenarioState): boolean => state.modifiers.some((modifier) => modifier.stat === "engagementCost" && modifier.amount === 5);
    expect(marked(revealAnswering(heard.state, heard.ctx, "131076", ["answer", "ally"]).state)).toBe(false);
    expect(marked(revealAnswering(heard.state, heard.ctx, "131076", ["resolve"]).state)).toBe(true);
  });
});
