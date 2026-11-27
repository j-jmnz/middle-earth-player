// Rules: rr.setup, rr.winning-the-game, rr.player-elimination, rr.threat-elimination-level, rr.guarded, rr.objective-cards, hrd.guarded-x, hrd.stage-number (data/rules/entries.json).
import { describe, expect, it } from "vitest";

import { SERPENT_GOLDENS, playGolden, serpentWorld, type SerpentDecks, type SerpentGolden } from "../../../../test/scenarios/the-black-serpent/game.ts";
import type { ScenarioState } from "../../../rules/core/state.ts";
import { legalIntents } from "../../../rules/engine/reduce.ts";
import { loadAnyScenario, loadCampaign } from "../../../../scripts/data/load-scenarios.ts";
import { goldenSuite } from "../../../../test/harness/golden-suite.ts";

const cycle = loadCampaign("haradrim");
const serpent = loadAnyScenario("the-black-serpent");

const OBJECTIVES = ["17091", "17092", "17093"];
const SERPENT = "17094";
const QUEST_POINTS = 6;
const cardsOf = (state: ScenarioState, codes: readonly string[]) => Object.values(state.cards).filter((card) => codes.includes(card.code));
// A Harad objective in play that a hero holds (claimed: attached to a hero).
const heldByHero = (state: ScenarioState, id: string) => {
  const card = state.cards[id];
  const host = card?.host ? state.cards[card.host] : undefined;
  return host?.zone === "heroes";
};
// An objective in play that blocks the stages: it has a guard attached to it (it lies in the staging area with its guard) or hangs on an encounter card. A free objective in the staging area is claimed by the stage at once.
const blocking = (state: ScenarioState) => cardsOf(state, OBJECTIVES).filter((card) => card.zone !== "setAside" && card.zone !== "encounterDiscard" && !heldByHero(state, card.id) && (card.attachments.length > 0 || card.host != null));
// An objective in play that no hero holds (blocking or free).
const notHeld = (state: ScenarioState) => cardsOf(state, OBJECTIVES).filter((card) => card.zone !== "setAside" && card.zone !== "encounterDiscard" && !heldByHero(state, card.id));
const stageCode = (state: ScenarioState) => state.cards[state.questStage ?? ""]?.code;

// A permanent golden: whole standalone games of The Black Serpent played by the auto-player (test/scenarios/the-black-serpent/game.ts) on fixed seeds, through a win and through each way to lose.
// A cycle has no Campaign Mode, so a win settles at once with a score and nothing earned. The wins are true solo and two-handed: the players claim a Harad objective on each stage, the objective of stage 3A hangs on The Black Serpent, the heroes carry 6 progress on
// stage 3B, engage the Serpent (it loses "Cannot leave the staging area or take damage"), defeat it and win. The losses are every player's threat at 50, every hero destroyed and, two-handed, the first player eliminated while his hero holds an objective.
// Update the snapshot only when the change is meant.
describe("The Black Serpent golden", () => {
  goldenSuite<SerpentGolden, SerpentDecks>({
    title: "The Black Serpent",
    file: new URL("./golden.json", import.meta.url).pathname,
    campaign: cycle,
    scenario: serpent,
    standalone: true,
    goldens: SERPENT_GOLDENS,
    world: serpentWorld,
    play: playGolden,
    opening: {
      title: "starts on stage 1B with The Black Serpent in the staging area, one Harad objective revealed (with its guard) and the other two set aside",
      check(state, golden) {
        expect(state.cards[state.questStage ?? ""], golden.name).toMatchObject({ code: "17106", zone: "questStage" });
        expect(cardsOf(state, [SERPENT]).map((card) => card.zone), golden.name).toEqual(["staging"]);
        const objectives = cardsOf(state, OBJECTIVES);
        expect(objectives.filter((card) => card.zone === "setAside"), golden.name).toHaveLength(2);
        expect(objectives.filter((card) => card.zone !== "setAside"), golden.name).toHaveLength(1);
      },
    },
    wins: "ends when stage 3B is defeated with every Harad objective in play on a hero and The Black Serpent defeated, settles at once with a score and earns nothing",
    won(state, golden) {
      expect(state.stageCleared, golden.name).toBe(true);
      expect(stageCode(state), golden.name).toBe("17108");
      // The Serpent was defeated (it had lost "cannot take damage" with 6 progress on 3B) and no objective is left guarded or hanging.
      const [serpentCard] = cardsOf(state, [SERPENT]);
      expect(serpentCard?.zone, golden.name).toBe("encounterDiscard");
      expect(serpentCard?.damage, golden.name).toBeGreaterThanOrEqual(8);
      expect(state.cards[state.questStage ?? ""]?.progress ?? 0, golden.name).toBeGreaterThanOrEqual(QUEST_POINTS);
      expect(notHeld(state), golden.name).toEqual([]);
      expect(state.seats.slice(0, golden.seatCount).some((seat) => !seat.eliminated), golden.name).toBe(true);
    },
    lost(state, golden) {
      const seats = state.seats.slice(0, golden.seatCount);
      expect(seats.every((seat) => seat.eliminated), golden.name).toBe(true);
      // Threat losses end with every seat at 50 or more; destroyed heroes leave the threat under 50.
      if (golden.decks === "weak") expect(seats.every((seat) => seat.threat >= 50), golden.name).toBe(true);
      else expect(seats.every((seat) => seat.threat < 50), golden.name).toBe(true);
    },
    // Read from the states the one play kept (playGolden, trail).
    checks({ game, world }) {
      const trailOf = (golden: SerpentGolden) => {
        const played = game(golden);
        const trail = played.trail ?? [];
        expect(trail.length, golden.name).toBe(played.intents.length);
        return trail;
      };

      // A stage cannot be defeated while a Harad objective is guarded or hangs on an encounter card (the stages' last line): in each intent that defeats a stage (another stage opens or the last one clears) the objectives were all held or out of play.
      it("a stage is never defeated while a Harad objective is guarded or hangs on an encounter card", () => {
        let blocked = 0;
        let defeated = 0;
        for (const golden of SERPENT_GOLDENS) {
          const trail = trailOf(golden);
          trail.forEach((state, at) => {
            const before = trail[at - 1];
            if (!before) return;
            const progress = before.cards[before.questStage ?? ""]?.progress ?? 0;
            // Progress on the stage reached the quest points but an objective is not held: the stage stays.
            if (progress >= QUEST_POINTS && blocking(before).length > 0 && !before.lost) {
              blocked += 1;
              expect(stageCode(state), `${golden.name} after intent ${at}`).toBe(stageCode(before));
              expect(state.stageCleared && !before.stageCleared, `${golden.name} after intent ${at}`).toBe(false);
            }
            if (stageCode(state) !== stageCode(before) || (state.stageCleared && !before.stageCleared)) {
              defeated += 1;
              expect(blocking(before).map((card) => card.code), `${golden.name} after intent ${at}`).toEqual([]);
            }
          });
        }
        // The goldens meet the block (a guarded objective, an objective on the Serpent) and defeat every stage.
        expect(blocked).toBeGreaterThan(0);
        expect(defeated).toBeGreaterThanOrEqual(3);
      });

      // The Action of a claimed objective is offered to the player who controls it and to nobody else.
      it("a claimed Harad objective's Action is offered only to the player whose hero holds it", () => {
        let offers = 0;
        for (const golden of SERPENT_GOLDENS.filter((item) => item.outcome === "won")) {
          const { ctx } = world(golden);
          const trail = trailOf(golden);
          trail.forEach((state, at) => {
            if (state.lost || cardsOf(state, OBJECTIVES).every((card) => card.controller == null)) return;
            for (let seat = 0; seat < golden.seatCount; seat += 1) {
              for (const intent of legalIntents({ ...state, activeSeat: seat }, ctx)) {
                if (intent.type !== "Trigger") continue;
                const card = state.cards[intent.cardId];
                if (!card || !OBJECTIVES.includes(card.code)) continue;
                offers += 1;
                expect(card.controller, `${golden.name} after intent ${at}: seat ${seat}`).toBe(seat);
                expect(heldByHero(state, card.id), `${golden.name} after intent ${at}`).toBe(true);
              }
            }
          });
        }
        expect(offers).toBeGreaterThan(0);
      });

      // The loss only a two-handed game reaches: the first player is eliminated while his hero holds a Harad objective (it goes back to the staging area) and the other player claims it.
      it("the first player's held objective returns to the staging area when he is eliminated, and the other player claims it", () => {
        const golden = SERPENT_GOLDENS.find((item) => item.name.includes("the first player is eliminated holding an objective"));
        expect(golden).toBeDefined();
        const trail = trailOf(golden as SerpentGolden);
        const out = trail.findIndex((state) => !state.lost && state.seats[0]?.eliminated && !state.seats[1]?.eliminated);
        expect(out).toBeGreaterThan(0);
        const held = cardsOf(trail[out - 1] as ScenarioState, OBJECTIVES).filter((card) => card.controller === 0 && heldByHero(trail[out - 1] as ScenarioState, card.id));
        expect(held.length).toBeGreaterThan(0);
        const after = trail[out] as ScenarioState;
        for (const card of held) expect(after.cards[card.id]?.zone, card.code).toBe("staging");
        const claimed = trail.slice(out).some((state) => held.every((card) => state.cards[card.id]?.controller === 1 && heldByHero(state, card.id)));
        expect(claimed).toBe(true);
      });
    },
  });
});
