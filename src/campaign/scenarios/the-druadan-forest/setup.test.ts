// Rules: ats.setup-the-druadan-forest, rr.staging, rr.reveal, faq.reveal-and-add (data/rules/entries.json).
// The Setup of The Drúadan Forest (06042:A:1) and the first When Revealed (06042:B:1) played by the engine, with one and with two players: Drû-buri-Drû is set aside, out of play, and the encounter deck is shuffled without him; stage 1B then reveals 1 card for each player.
import { describe, expect, it } from "vitest";

import type { ScenarioState } from "../../../rules/core/state.ts";
import { reduce, startScenario, type PlayerIntent } from "../../../rules/engine/reduce.ts";
import { expectOk } from "../../../rules/core/test-fixture.ts";
import { druadanStart, druadanWorld } from "../../../../test/scenarios/the-druadan-forest/game.ts";
import { CODES } from "../../../../test/scenarios/the-druadan-forest/table.ts";

const codesIn = (state: ScenarioState, ids: readonly string[]): string[] => ids.map((id) => state.cards[id]?.code ?? "");

describe("06042:A:1 Setup", () => {
  it("06042:A:1 sets Drû-buri-Drû aside, out of play, and shuffles the rest of the encounter deck, with one player and with two", async () => {
    const { ctx } = await druadanWorld();
    for (const seats of [1, 2] as const) {
      let state = startScenario(druadanStart(seats, 3, "Normal"), ctx);
      for (let guard = 0; guard < 12 && (state.window?.kind === "mulligan" || state.window?.kind === "choose"); guard += 1) {
        const intent: PlayerIntent = state.window.kind === "mulligan" ? { type: "Keep" } : { type: "Choose", optionId: state.window.options[0] ?? "" };
        state = expectOk(reduce(state, intent, ctx)).state;
      }
      expect(codesIn(state, state.setAside)).toEqual([CODES.druBuriDru]);
      expect(codesIn(state, state.encounterDeck)).not.toContain(CODES.druBuriDru);
      expect(state.encounterDeck.length).toBeGreaterThan(20);
      // Stage 1 is current and Drû-buri-Drû has not been seen: he is in no zone of the table.
      expect(state.cards[state.questStage ?? ""]?.code).toBe(CODES.pursuit);
      expect(Object.values(state.cards).filter((card) => card.code === CODES.druBuriDru).map((card) => card.zone)).toEqual(["setAside"]);
    }
  });

  it("06042:B:1 stage 1B has revealed 1 card for each player and added it to the staging area", async () => {
    const { ctx } = await druadanWorld();
    for (const seats of [1, 2] as const) {
      let state = startScenario(druadanStart(seats, 3, "Normal"), ctx);
      for (let guard = 0; guard < 12 && (state.window?.kind === "mulligan" || state.window?.kind === "choose"); guard += 1) {
        const intent: PlayerIntent = state.window.kind === "mulligan" ? { type: "Keep" } : { type: "Choose", optionId: state.window.options[0] ?? "" };
        state = expectOk(reduce(state, intent, ctx)).state;
      }
      const revealed = Object.values(state.cards).filter((card) => ["staging", "engaged", "encounterDiscard"].includes(card.zone));
      // The 1B side is faceup, and each player's card (more when a card gains surge or reveals another) is in the staging area.
      expect(state.cards[state.questStage ?? ""]?.face).toBe("B");
      expect(revealed.length).toBeGreaterThanOrEqual(seats);
    }
  });
});
