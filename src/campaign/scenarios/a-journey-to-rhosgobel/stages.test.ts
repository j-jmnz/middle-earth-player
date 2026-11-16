// Rules: rr.setup, rr.first-player, rr.quest-advancement, rr.winning-the-game, sotm.setup-a-journey-to-rhosgobel, sotm.ally-objective-wilyador (data/rules/entries.json); ledger lines 02060:A:1, 02064:A:1, 900601:A:2, 02062:B:2.
// A Journey to Rhosgobel from its start: Wilyador joins the first player with 2 damage on him, Rhosgobel waits in the staging area, and the Nightmare deck adds the Goblin Eagle-hunter; stage 3 prints 0 quest points and resolves when it is revealed.
import { describe, expect, it } from "vitest";

import { coreSpiritGame } from "../../../../test/harness/core-spirit-game.ts";

import type { ScenarioState } from "../../../rules/core/state.ts";



const game = (difficulty: "Normal" | "Nightmare", seatCount: 1 | 2 = 1) => coreSpiritGame("shadows-of-mirkwood", "a-journey-to-rhosgobel", difficulty, seatCount);

const where = (state: ScenarioState, code: string) => Object.values(state.cards).filter((card) => card.code === code);

describe("the start of A Journey to Rhosgobel", () => {
  it("02060:A:1 puts Wilyador into the first player's play area with 2 damage on him, and Rhosgobel into the staging area", () => {
    const { state } = game("Normal", 2);
    const [wilyador] = where(state, "02064");
    expect(wilyador).toMatchObject({ zone: "play", controller: state.firstPlayer, damage: 2, exhausted: false });
    expect(state.staging.map((id) => state.cards[id]?.code)).toEqual(["02065"]);
    expect(where(state, "02063").map((card) => card.zone)).toEqual(["encounterDeck", "encounterDeck", "encounterDeck", "encounterDeck"]);
  });

  it("900601:A:2 adds the Goblin Eagle-hunter to the staging area on Nightmare, and not on Normal", () => {
    const normal = game("Normal").state;
    expect(normal.staging.map((id) => normal.cards[id]?.code)).not.toContain("900602");
    const nightmare = game("Nightmare").state;
    expect(nightmare.staging.map((id) => nightmare.cards[id]?.code).sort()).toEqual(["02065", "900602"]);
    // The one copy the Setup searched out; the other copies of the deck stay in it.
    expect(where(nightmare, "900602").filter((card) => card.zone === "staging")).toHaveLength(1);
    expect(where(nightmare, "900602").every((card) => card.zone === "staging" || card.zone === "encounterDeck")).toBe(true);
  });
});
