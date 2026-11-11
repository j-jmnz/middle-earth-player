// Rules: mec109.burden-deck, mec109.ringbearers-life, rr.burdens, rr.campaign-cards, ltp.campaign-cards (data/rules/entries.json).
import { expect, it } from "vitest";

import type { PrintedCard } from "../../../rules/core/printed.ts";
import { inPlay, type ScenarioState } from "../../../rules/core/state.ts";
import { FORD_GOLDENS, fordLoadout, fordWorld, playGolden, type FordDecks, type FordGolden } from "../../../../test/scenarios/flight-to-the-ford/game.ts";
import { BURDENS, campaign, ford } from "../../../../test/scenarios/flight-to-the-ford/scene.ts";
import { goldenSuite, ownCauses } from "../../../../test/harness/golden-suite.ts";
import { applyResolution, emptyLog } from "../../log.ts";
import { campaignPath } from "../../path.ts";
import { validateLoadout } from "../../loadout.ts";
import { NO_COPY_LIMITS } from "../../wilderland.ts";

// A permanent golden: whole games of Flight to the Ford played by the auto-player (test/scenarios/flight-to-the-ford/game.ts), true solo and
// two-handed, through a win and through a loss, on fixed seeds. The wins use the big-number loadout beside the saga Frodo; the
// starter decks lose on the Ring-bearer's life, and the weak heroes lose on it and on threat. It pins the path from data/
// through buildStart, the scenario's records, the burden deck, the Ring-bearer's life and the reducer, so a change that moves a
// game shows up as a diff here. Update the snapshot only when the change is meant.
goldenSuite<FordGolden, FordDecks>({
  title: "Flight to the Ford",
  file: new URL("./golden.json", import.meta.url).pathname,
  campaign,
  scenario: ford,
  goldens: FORD_GOLDENS,
  world: fordWorld,
  play: playGolden,
  guard: 0,
  opening: {
    title: "starts with the burden deck, the life and the campaign card the Setup and the campaign checklist give it",
    check: (kept, golden) => {
      expect(kept.life, golden.name).toBe(15);
      expect(kept.burdenDeck, golden.name).toHaveLength(5);
      expect(kept.burdenDeck?.map((id) => kept.cards[id]?.code).sort(), golden.name).toEqual([...BURDENS]);
      expect(Object.values(kept.cards).filter((card) => card.zone === "campaign").map((card) => card.code), golden.name).toEqual(["141056"]);
      const wound = Object.values(kept.cards).find((card) => card.code === "141057");
      expect(kept.cards[wound?.host ?? ""]?.code, golden.name).toBe("141001");
      expect(kept.setAside.map((id) => kept.cards[id]?.code).sort(), golden.name).toEqual(["141059", "141068"]);
    },
  },
  causeTitle: "names a cause for every number a step changes, the Ring-bearer's life included",
  cause: (game, golden) => expect(game.steps.some((step) => step.kind === "life"), golden.name).toBe(true),
  wins: "wins at stage 2B and runs 141056's Resolution, earning exactly the burdens in play, in the encounter deck and in the discard pile",
  won: (state, _golden, { cards }) => {
    expect(state.cards[state.questStage ?? ""]?.code).toBe("141029");
    // Life 0 loses; a win leaves some life.
    expect(state.life).toBeGreaterThan(0);
    const burdens = Object.values(state.cards).filter((card) => cards.get(card.code)?.campaignKind === "burden");
    const earnable = earnableBurdens(state, cards);
    const kept = burdens.filter((card) => card.zone === "burdenDeck").map((card) => card.code);
    expect(state.resolutionLog.earned.map((item) => item.code).sort()).toEqual([...new Set(earnable)].sort());
    expect(state.resolutionLog.earned.every((item) => item.to === "pool" && item.seat == null && item.hero == null)).toBe(true);
    for (const code of kept) expect(state.resolutionLog.earned.map((item) => item.code), `${code} is still in the burden deck`).not.toContain(code);
  },
  afterWin: ({ state, golden, world, log }) => {
    expect(log.campaignPool.map((card) => card.code).sort()).toEqual([...new Set(earnableBurdens(state, world.cards))].sort());
    for (const card of log.campaignPool) expect(card).toMatchObject({ back: "encounter", burdenSet: "Flight to the Ford", attachedTo: null });
    // Written after scenarios 1 and 2, the win unlocks The Ring Goes South.
    const after = applyResolution({ ...emptyLog(golden.seatCount), completed: ["a-shadow-of-the-past", "a-knife-in-the-dark"] }, state.scenarioId, state, world.cards, NO_COPY_LIMITS);
    expect(campaignPath(campaign, {}, after).map((node) => node.status).slice(0, 4)).toEqual(["completed", "completed", "completed", "current"]);
    expect(campaign.scenarios[3]).toBe("the-ring-goes-south");
  },
  lost: (state, golden) => {
    expect(state.lossReason).toBe(golden.lossReason);
    // Life 0 is a loss, and only life 0 is: the other loss leaves the life where it was.
    expect(state.life === 0).toBe(golden.lossReason === "The Ring-bearer's life reached 0");
  },
  checks: ({ game, world }) => {
    it("deals legal loadouts", () => {
      for (const golden of FORD_GOLDENS) expect(validateLoadout(fordLoadout(golden.seatCount, golden.decks), world(golden).cards, true), golden.name).toEqual([]);
    });

    it("moves the Ring-bearer's life by the scenario's own records and by the rules", () => {
      // The quest stages, the locations, the treacheries and the Fell Riders change the life, and so does the round's rules.
      const lives = FORD_GOLDENS.flatMap((golden) => game(golden).steps).filter((step) => step.kind === "life");
      expect(lives.length).toBeGreaterThan(20);
      expect(ownCauses(ford, lives).length).toBeGreaterThan(0);
      expect(lives.some((step) => "rule" in step.cause)).toBe(true);
    });
  },
});

// The burdens in play, in the encounter deck and in the discard pile: the ones the Resolution earns.
function earnableBurdens(state: ScenarioState, cards: ReadonlyMap<string, PrintedCard>): string[] {
  return Object.values(state.cards).filter((card) => cards.get(card.code)?.campaignKind === "burden" && (inPlay(card.zone) || card.zone === "encounterDeck" || card.zone === "encounterDiscard")).map((card) => card.code);
}
