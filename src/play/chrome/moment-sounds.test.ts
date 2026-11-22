// Rules: rr.reveal, rr.treachery-cards, rr.mulligan, rr.step-3-4 (data/rules/entries.json). The sounds of an accepted intent (docs/design-system-table.md, Sound).
import { describe, expect, it } from "vitest";

import type { Cause } from "../../rules/core/cause.ts";
import type { EngineStep } from "../../rules/core/intents.ts";
import type { PrintedCard } from "../../rules/core/printed.ts";
import type { ScenarioState } from "../../rules/core/state.ts";
import { momentSounds } from "./moment-sounds.ts";

const cause = { kind: "rule", id: "rr.reveal" } as unknown as Cause;
const card = (type: string, traits: readonly string[] = []) => ({ type, traits }) as unknown as PrintedCard;
const cards = new Map<string, PrintedCard>([
  ["wraith", card("enemy", ["Nazgûl", "Ringwraith"])],
  ["orc", card("enemy", ["Orc"])],
  ["web", card("treachery")],
  ["hill", card("location")],
]);
const state = (phase: string): ScenarioState =>
  ({ phase, cards: { w: { code: "wraith" }, o: { code: "orc" }, t: { code: "web" }, h: { code: "hill" } } }) as unknown as ScenarioState;
const reveal = (cardId: string): EngineStep => ({ kind: "reveal", seat: 0, cardId, cause });

describe("moment sounds", () => {
  it("roars for a Nazgûl, stings for a treachery, and says nothing for any other reveal", () => {
    const game = state("Quest");
    expect(momentSounds(game, [reveal("w")], game, cards)).toEqual(["combat.roar"]);
    expect(momentSounds(game, [reveal("t")], game, cards)).toEqual(["dread.treachery"]);
    expect(momentSounds(game, [reveal("o")], game, cards)).toEqual([]);
    expect(momentSounds(game, [reveal("h")], game, cards)).toEqual([]);
  });

  it("plays one of each slot a moment, in the order the steps ran", () => {
    const game = state("Quest");
    expect(momentSounds(game, [reveal("t"), reveal("w"), reveal("t")], game, cards)).toEqual(["dread.treachery", "combat.roar"]);
  });

  it("shuffles for a shuffled set and for the encounter deck made again from its discard pile", () => {
    const game = state("Encounter");
    expect(momentSounds(game, [{ kind: "shuffleSet", set: "Orcs", count: 2 }], game, cards)).toEqual(["card.shuffle"]);
    expect(momentSounds(game, [{ kind: "resetEncounterDeck", count: 9, cause }], game, cards)).toEqual(["card.shuffle"]);
    expect(momentSounds(game, [{ kind: "reshuffleDeck", deck: "corsairDeck", count: 4, cause }], game, cards)).toEqual(["card.shuffle"]);
  });

  it("deals before the first round only: the same draw in a round is the motion's", () => {
    const draw: EngineStep = { kind: "draw", seat: 0, cardId: "h", cause };
    expect(momentSounds(state("Mulligan"), [draw, draw], state("Mulligan"), cards)).toEqual(["card.deal"]);
    expect(momentSounds(state("Setup"), [draw], state("Setup"), cards)).toEqual(["card.deal"]);
    expect(momentSounds(state("Resource"), [draw], state("Resource"), cards)).toEqual([]);
  });

  it("notices the results a banner reports: the quest, a test, an elimination", () => {
    const game = state("Quest");
    expect(momentSounds(game, [{ kind: "quest", willpower: 3, threat: 2, cause }], game, cards)).toEqual(["ui.notice"]);
    expect(momentSounds(game, [{ kind: "fortitudeTest", seat: 0, discardedIds: [], willpower: 1, eyes: 0, success: true }], game, cards)).toEqual(["ui.notice"]);
    expect(momentSounds(game, [{ kind: "eliminate", seat: 1 }], game, cards)).toEqual(["ui.notice"]);
    expect(momentSounds(game, [{ kind: "damage", targetId: "h", amount: 1, cause }], game, cards)).toEqual([]);
  });
});
