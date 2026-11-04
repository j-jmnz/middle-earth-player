// Rules: ltp.setup-passage-through-mirkwood, rr.quest-advancement, rr.winning-the-game, rr.campaign-cards, rr.campaign-setup-checklist
// (data/rules/entries.json).
import { expect, it } from "vitest";

import { encounterCodes } from "../../../catalog/scenario-data.ts";
import { MIRKWOOD_GOLDENS, mirkwoodLoadout, mirkwoodWorld, playGolden, type MirkwoodDecks, type MirkwoodGolden } from "../../../../test/scenarios/passage-through-mirkwood/game.ts";
import { campaign, passage } from "../../../../test/scenarios/passage-through-mirkwood/scene.ts";
import { goldenSuite } from "../../../../test/harness/golden-suite.ts";
import { codesIn } from "../../../../test/harness/scene-kit.ts";

import { validateLoadout } from "../../loadout.ts";

// A permanent golden: whole games of Passage Through Mirkwood in Campaign Mode played by the auto-player (test/scenarios/passage-through-mirkwood/game.ts),
// true solo and two-handed, through a win on each stage 3B and through a loss, on fixed seeds. It pins the path from data/ through
// buildStart, the scenario's records, the branching stage 3, Mendor and the reducer, so a change that moves a game shows up as a diff here.
// Update the snapshot only when the change is meant.
goldenSuite<MirkwoodGolden, MirkwoodDecks>({
  title: "Passage Through Mirkwood",
  file: new URL("./golden.json", import.meta.url).pathname,
  campaign,
  scenario: passage,
  goldens: MIRKWOOD_GOLDENS,
  world: mirkwoodWorld,
  play: playGolden,
  guard: 0,
  opening: {
    title: "starts with Mendor in play under the first player and the campaign card beside the quest deck, and no saga setup",
    check: (kept, golden) => {
      expect(kept.cards[kept.questStage ?? ""]?.code, golden.name).toBe("01119");
      expect(codesIn(kept, "questDeck"), golden.name).toEqual(["01120", "01121", "01122"]);
      expect(codesIn(kept, "staging"), golden.name).toEqual(["01096", "01099"]);
      expect(codesIn(kept, "campaign"), golden.name).toEqual(["01129"]);
      const mendor = Object.values(kept.cards).find((card) => card.code === "01135");
      expect(mendor?.zone, golden.name).toBe("play");
      expect(mendor?.controller, golden.name).toBe(0);
      expect(kept.encounterDeck, golden.name).toHaveLength(encounterCodes(passage, golden.difficulty, golden.seatCount).length);
      expect(kept.burdenDeck, golden.name).toBeUndefined();
      expect(kept.life, golden.name).toBeUndefined();
      expect(kept.activeLocation, golden.name).toBeNull();
      expect(codesIn(kept, "attached"), golden.name).toEqual([]);
      expect(kept.stagesReached, golden.name).toBeUndefined();
    },
  },
  wins: (golden) => `wins on stage ${golden.branch}, runs 01129's Resolution and unlocks Journey Along the Anduin`,
  won: (state, golden) => {
    expect(state.stagesReached).toEqual(["01120", golden.branch]);
    expect(state.cards[state.questStage ?? ""]?.code).toBe(golden.branch);
    // The other 3B card is out of the game.
    const other = golden.branch === "01121" ? "01122" : "01121";
    expect(Object.values(state.cards).find((card) => card.code === other)?.zone).toBe("removed");
    // Don't Leave the Path! is won by defeating Ungoliant's Spawn; Beorn's Path by exploring ten quest points with the Spawn out of play.
    const spawn = Object.values(state.cards).find((card) => card.code === "01076");
    if (golden.branch === "01121") expect(spawn?.zone).toBe("encounterDiscard");
    else expect(["staging", "engaged"]).not.toContain(spawn?.zone);
    // Mendor never left play.
    expect(Object.values(state.cards).find((card) => card.code === "01135")?.zone).toBe("play");
    // One Mendor's Support for each player, and the burden of the stage 3B reached.
    const burden = golden.branch === "01122" ? "01136" : "01137";
    expect(state.resolutionLog.earned.map((item) => item.code)).toEqual([...Array.from({ length: golden.seatCount }, () => "01132"), burden]);
  },
  afterWin: ({ golden, log }) => {
    const burden = golden.branch === "01122" ? "01136" : "01137";
    expect(log.campaignPool.map((card) => card.code)).toEqual([...Array.from({ length: golden.seatCount }, () => "01132"), burden]);
    expect(campaign.scenarios[1]).toBe("journey-along-the-anduin");
  },
  checks: ({ world }) => {
    it("deals legal loadouts outside a saga", () => {
      for (const golden of MIRKWOOD_GOLDENS) expect(validateLoadout(mirkwoodLoadout(golden.seatCount), world(golden).cards, false), golden.name).toEqual([]);
    });
  },
});
