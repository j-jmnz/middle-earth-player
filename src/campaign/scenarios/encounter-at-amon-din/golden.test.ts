// Rules: rr.setup, rr.winning-the-game, rr.victory, rr.cannot, rr.response, rr.forced, rr.replacement-effects, rr.player-elimination, rr.threat-elimination-level, rr.step-6-4-3, rr.the-letter-x, ats.villagers, ats.villager-tokens-discarded, ats.setup-amon-din-objectives, ats.setup-encounter-at-amon-din, ltp.scoring (data/rules/entries.json).
import { describe, expect, it } from "vitest";

import { ALCARON, DEAD, DIN_GOLDENS, GHULAT, ghulatInPlay, playGolden, dinWorld, RESCUED, STAGE_TWO, type DinDecks, type DinGolden } from "../../../../test/scenarios/encounter-at-amon-din/game.ts";
import type { ScenarioState } from "../../../../src/rules/core/state.ts";
import { loadAnyScenario, loadCampaign } from "../../../../scripts/data/load-scenarios.ts";
import { goldenSuite } from "../../../../test/harness/golden-suite.ts";

const cycle = loadCampaign("against-the-shadow");
const din = loadAnyScenario("encounter-at-amon-din");
const cardOf = (state: ScenarioState, code: string) => Object.values(state.cards).find((card) => card.code === code);
const rescued = (state: ScenarioState): number => cardOf(state, RESCUED)?.resources ?? 0;
const dead = (state: ScenarioState): number => cardOf(state, DEAD)?.damage ?? 0;
// The three locations that print Villagers X.
const LOCATIONS: readonly string[] = ["06075", "06076", "06077"];
const golden = (name: string): DinGolden => DIN_GOLDENS.find((entry) => entry.name === name) as DinGolden;
// Stage 2B is defeated (its progress is in) while Ghulat is in play: the end is held (rr.cannot, 06067:B:2).
const holding = (state: ScenarioState): boolean => {
  const stage = state.cards[state.questStage ?? ""];
  return stage?.code === STAGE_TWO && stage.progress >= 15 && ghulatInPlay(state) && !state.lost && !state.stageCleared;
};

// The villager tokens on Rescued Villagers and the damage tokens on Dead Villagers at the end of each win (the win needs more of the first).
const COUNTS: Readonly<Record<string, readonly [number, number]>> = { "solo win": [12, 2], "two-handed win, hunt first": [10, 2], "Easy two-handed win": [12, 1] };

// A permanent golden: whole standalone games of Encounter at Amon Dîn played by the auto-player (test/scenarios/encounter-at-amon-din/game.ts) on fixed seeds, through a win and through each way to lose. A cycle has no Campaign
// Mode, so a win settles at once with a score and nothing earned. The players travel to the location with the most villager tokens, quest on stage 1 (progress moves tokens to Rescued Villagers), use Lord Alcaron's Response
// and defeat Ghulat. The solo win and the Easy win hold the end (Ghulat is in play when Protect the Villagers is defeated and the game ends when he leaves play); the two-handed win quests on stage 2 only once Ghulat is gone.
// The four losses are the ways to lose here: every hero destroyed (solo, brittle heroes), Lord Alcaron leaving play (solo, Craven Eagle's discard, after the hold), threat 50 (two-handed, heroes too weak to quest) and the
// comparison (two-handed, two undefended attacks on stage 2 discard villager tokens). Update the snapshot only when the change is meant.
describe("Encounter at Amon Dîn golden", () => {
  goldenSuite<DinGolden, DinDecks>({
    title: "Encounter at Amon Dîn",
    file: new URL("./golden.json", import.meta.url).pathname,
    campaign: cycle,
    scenario: din,
    standalone: true,
    goldens: DIN_GOLDENS,
    world: dinWorld,
    play: playGolden,
    opening: {
      title: "starts on Savagery of the Orcs with Ghulat set aside, Lord Alcaron in the first player's play area and Burning Farmhouse the active location",
      check(state, entry) {
        expect(state.cards[state.questStage ?? ""]?.code, entry.name).toBe("06066");
        expect(state.questDeck.map((id) => state.cards[id]?.code), entry.name).toEqual([STAGE_TWO]);
        expect(cardOf(state, GHULAT)?.zone, entry.name).toBe("setAside");
        expect(cardOf(state, ALCARON)).toMatchObject({ zone: "play", controller: 0 });
        expect(state.cards[state.activeLocation ?? ""]?.code, entry.name).toBe("06075");
        expect(state.cards[state.activeLocation ?? ""]?.resources ?? 0, entry.name).toBeGreaterThan(0);
        expect(state.staging.map((id) => state.cards[id]?.code), entry.name).toEqual(expect.arrayContaining(["06068", "06069"]));
      },
    },
    wins: "ends when Protect the Villagers is defeated with Ghulat gone and more villager tokens on Rescued Villagers than damage tokens on Dead Villagers, settles at once with a score and earns nothing",
    won(state, entry) {
      // Stage 2 was defeated (15 quest points in), Ghulat is in the victory display and not in play, and more villager tokens stand on Rescued Villagers than damage tokens on Dead Villagers.
      const stage = state.cards[state.questStage ?? ""];
      expect(stage?.code, entry.name).toBe(STAGE_TWO);
      expect(stage?.progress ?? 0, entry.name).toBeGreaterThanOrEqual(15);
      expect(cardOf(state, GHULAT)?.zone, entry.name).toBe("victory");
      expect(cardOf(state, ALCARON)?.zone, entry.name).toBe("play");
      expect([rescued(state), dead(state)], entry.name).toEqual(COUNTS[entry.name]);
      expect(rescued(state), entry.name).toBeGreaterThan(dead(state));
    },
    lost(state, entry) {
      const seats = state.seats.slice(0, entry.seatCount);
      if (entry.name.endsWith("threat 50")) expect(seats.every((seat) => seat.eliminated && seat.threat >= 50), entry.name).toBe(true);
      else if (entry.name.endsWith("every hero destroyed")) expect(seats.every((seat) => seat.eliminated && seat.heroes.length === 0), entry.name).toBe(true);
      else if (entry.name.endsWith("Lord Alcaron leaves play")) {
        // Ghulat is defeated (in the victory display), Lord Alcaron is out of play, and the villagers were not the cause: more were rescued than died.
        expect(cardOf(state, GHULAT)?.zone, entry.name).toBe("victory");
        expect(cardOf(state, ALCARON)?.zone, entry.name).not.toBe("play");
        expect(rescued(state), entry.name).toBeGreaterThan(dead(state));
      } else {
        // The comparison: Ghulat is gone and no more villager tokens stand on Rescued Villagers than damage tokens lie on Dead Villagers.
        expect(cardOf(state, GHULAT)?.zone, entry.name).toBe("victory");
        expect(cardOf(state, ALCARON)?.zone, entry.name).toBe("play");
        expect([rescued(state), dead(state)], entry.name).toEqual([4, 12]);
      }
    },
    checks({ game }) {
      it("holds the end while Ghulat is in play in the solo and the Easy win, and never in the hunt-first win", () => {
        for (const name of ["solo win", "Easy two-handed win"]) {
          const played = game(golden(name));
          const trail = played.trail ?? [];
          // The stage's progress is in with Ghulat in play, the game goes on, and the first state in which the game is won has him out of play.
          expect(trail.some(holding), name).toBe(true);
          const first = trail.findIndex((state) => state.stageCleared);
          expect(first, name).toBeGreaterThan(trail.findIndex(holding));
          expect(ghulatInPlay(trail[first] as ScenarioState), name).toBe(false);
          expect(trail.filter((state) => state.stageCleared).every((state) => !ghulatInPlay(state)), name).toBe(true);
        }
        const hunt = game(golden("two-handed win, hunt first"));
        expect((hunt.trail ?? []).some(holding)).toBe(false);
        // Ghulat is defeated in the victory display before the stage's progress is in.
        const defeated = (hunt.trail ?? []).findIndex((state) => cardOf(state, GHULAT)?.zone === "victory");
        const stageProgress = (hunt.trail ?? []).findIndex((state) => (state.cards[state.questStage ?? ""]?.progress ?? 0) >= 15 && state.cards[state.questStage ?? ""]?.code === STAGE_TWO);
        expect(defeated).toBeGreaterThanOrEqual(0);
        expect(stageProgress).toBeGreaterThanOrEqual(defeated);
      });

      it("discards villager tokens from Rescued Villagers for an undefended attack on stage 2, one damage token on Dead Villagers for each and no damage to a hero", () => {
        const played = game(golden("two-handed loss: the comparison"));
        const trail = played.trail ?? [];
        const rescuedId = cardOf(played.state, RESCUED)?.id;
        const attacks = played.intents.flatMap((intent, index) => (intent.type === "Undefended" && intent.heroId === rescuedId ? [index] : []));
        // The two undefended attacks the policy allowed, and each of them was an attack on stage 2.
        expect(attacks).toHaveLength(2);
        const strikes = played.steps.filter((step) => step.kind === "strike" && step.undefended && step.targetId === rescuedId);
        expect(strikes).toHaveLength(2);
        let taken = 0;
        for (const index of attacks) {
          const before = (index === 0 ? played.kept : trail[index - 1]) as ScenarioState;
          const after = trail[index] as ScenarioState;
          expect(before.cards[before.questStage ?? ""]?.code).toBe(STAGE_TWO);
          const lost = rescued(before) - rescued(after);
          expect(lost).toBeGreaterThan(0);
          taken += lost;
          expect(dead(after) - dead(before)).toBeGreaterThanOrEqual(lost);
          for (const id of [...before.seats[0].heroes, ...before.seats[1].heroes]) expect(after.cards[id]?.damage ?? 0).toBe(before.cards[id]?.damage ?? 0);
        }
        // The damage tokens on Dead Villagers came from the discards (06069:forced:1), the tokens that left the objective.
        const discards = played.steps.filter((step) => step.kind === "damage" && "effect" in step.cause && step.cause.effect === "06069:forced:1");
        expect(discards.length).toBeGreaterThanOrEqual(taken);
      });

      it("has Lord Alcaron save a discarded villager token in every game that uses his Response: he exhausts and exactly one villager token is placed", () => {
        // The discard (and its damage token on Dead Villagers) came first as a Forced effect. An intent goes on past the placing when more of the round ends (a second Farmhouse discards its own token) or the quest resolves, so the check is two:
        // (1) the tokens of the cards in play when the Response opened (their villager tokens, each token that moved to Rescued Villagers with them, and the damage tokens on Dead Villagers, one for each discard) grow by exactly 1 in the intent;
        // (2) in an intent that stops at the placing, the picked location holds exactly 1 more, and Rescued Villagers, the card the token left and Dead Villagers keep what they held.
        const HELD = ["staging", "activeLocation", "questStage"];
        let stopped = 0;
        for (const entry of DIN_GOLDENS.filter((item) => item.outcome === "won" || item.name.endsWith("comparison"))) {
          const played = game(entry);
          const trail = played.trail ?? [];
          played.intents.forEach((intent, index) => {
            if (intent.type !== "Trigger" || intent.effectId !== "06070:response:1") return;
            // The Response exhausts Lord Alcaron and places the token on a location: at once when one location is in play, else when the pick that follows the Trigger is answered.
            const label = `${entry.name} #${index}`;
            const before = (index === 0 ? played.kept : trail[index - 1]) as ScenarioState;
            const placed = (trail[index]?.window?.kind === "choose" ? trail[index + 1] : trail[index]) as ScenarioState;
            expect(placed.cards[intent.cardId]?.exhausted, label).toBe(true);
            expect(before.cards[intent.cardId]?.exhausted, label).toBeFalsy();
            const held = Object.keys(before.cards).filter((id) => HELD.includes(before.cards[id]?.zone ?? ""));
            const tokens = (state: ScenarioState): number => held.reduce((sum, id) => sum + (HELD.includes(state.cards[id]?.zone ?? "") ? (state.cards[id]?.resources ?? 0) : 0), 0) + dead(state);
            // The Setup goes on past a Response (it places the stage's Villagers 5 and the next revealed card's own), so (1) reads the rounds.
            if (before.round > 0) expect(tokens(placed) - tokens(before), label).toBe(1);
            const moved = held.filter((id) => before.cards[id]?.zone !== placed.cards[id]?.zone || (before.cards[id]?.resources ?? 0) !== (placed.cards[id]?.resources ?? 0));
            const picked = moved.filter((id) => (placed.cards[id]?.resources ?? 0) - (before.cards[id]?.resources ?? 0) === 1);
            if (moved.length !== 1 || picked.length !== 1) return;
            // The intent stopped at the placing: one location grew by 1, nothing else moved, Rescued Villagers and Dead Villagers are as they were.
            expect(LOCATIONS, label).toContain(placed.cards[picked[0] as string]?.code);
            expect(rescued(placed), label).toBe(rescued(before));
            expect(dead(placed), label).toBe(dead(before));
            stopped += 1;
          });
        }
        expect(stopped).toBeGreaterThan(0);
      });

      it("loses when Ghulat leaves play after Lord Alcaron was discarded in his presence, not before", () => {
        const played = game(golden("solo loss: Lord Alcaron leaves play"));
        const trail = played.trail ?? [];
        const gone = trail.findIndex((state) => cardOf(state, ALCARON)?.zone !== "play");
        expect(gone).toBeGreaterThanOrEqual(0);
        // At the intent that discarded him Ghulat was in play, the game was not lost, and the loss came with the intent that defeated Ghulat.
        expect(ghulatInPlay(trail[gone] as ScenarioState)).toBe(true);
        expect((trail[gone] as ScenarioState).lost).toBe(false);
        const lostAt = trail.findIndex((state) => state.lost);
        expect(lostAt).toBeGreaterThan(gone);
        expect(ghulatInPlay(trail[lostAt] as ScenarioState)).toBe(false);
      });
    },
  });
});
