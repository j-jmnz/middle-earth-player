// Rules: rr.setup, rr.winning-the-game, rr.player-elimination, rr.threat-elimination-level, rr.quest-advancement, hrd.multiple-encounter-sets, hrd.removed-from-the-game, hrd.setup-the-crossings-of-poros (data/rules/entries.json).
import { describe, expect, it } from "vitest";

import { POROS_GOLDENS, playGolden, porosWorld, type PorosDecks, type PorosGolden } from "../../../../test/scenarios/the-crossings-of-poros/game.ts";
import { printedOf } from "../../../rules/core/printed.ts";
import type { ScenarioState } from "../../../rules/core/state.ts";
import { loadAnyScenario, loadCampaign } from "../../../../scripts/data/load-scenarios.ts";
import { goldenSuite } from "../../../../test/harness/golden-suite.ts";

const cycle = loadCampaign("haradrim");
const poros = loadAnyScenario("the-crossings-of-poros");

const GARRISON = "17145";
const SERPENT = "17146";
const STAGE_1 = "17157";
const STAGE_2 = ["17158", "17159"];
const STAGE_3 = ["17160", "17161", "17162"];
const STAGE_4 = "17163";
// The set each stage 2A shuffles in; the other set leaves the game with the other stage 2A.
const STAGE_2_SETS: Record<string, { in: string; out: string }> = { "17158": { in: "Desert Sands", out: "Mountains of Shadow" }, "17159": { in: "Mountains of Shadow", out: "Desert Sands" } };
const ASIDE_SETS = ["Mountains of Shadow", "Desert Sands", "Desert Creatures", "Harad Soldiers", "Mordor Orcs"];
const stageCode = (state: ScenarioState) => state.cards[state.questStage ?? ""]?.code;
const cardsOf = (state: ScenarioState, codes: readonly string[]) => Object.values(state.cards).filter((card) => codes.includes(card.code));
// The stages the quest passed through, in order.
const pathOf = (trail: readonly ScenarioState[]) => {
  const path: string[] = [];
  for (const state of trail) {
    const code = stageCode(state);
    if (code && path[path.length - 1] !== code) path.push(code);
  }
  return path;
};

// A permanent golden: whole standalone games of The Crossings of Poros played by the auto-player (test/scenarios/the-crossings-of-poros/game.ts) on fixed seeds, through a win and through each way to lose.
// A cycle has no Campaign Mode, so a win settles at once with a score and nothing earned. The stage path is random (stage 1B to a random stage 2, each stage 2B to a random stage 3), so the four wins together play both stage 2 cards and all three stage 3 cards; the winning
// games reach stage 4A (Poros Garrison comes under the first player's control, the enemies of the two set aside stage 3 sets are staged) and win at the end of a combat phase. The losses are every player's threat at 50, every hero destroyed and Poros Garrison leaving play
// (Southron Archer's choice to discard an ally, with the Garrison the only ally). A two-handed loss reaches nothing a solo one does not. Update the snapshot only when the change is meant.
describe("The Crossings of Poros golden", () => {
  goldenSuite<PorosGolden, PorosDecks>({
    title: "The Crossings of Poros",
    file: new URL("./golden.json", import.meta.url).pathname,
    campaign: cycle,
    scenario: poros,
    standalone: true,
    goldens: POROS_GOLDENS,
    world: porosWorld,
    play: playGolden,
    opening: {
      title: "starts on stage 1B with The Black Serpent in the staging area, Poros Garrison and the five encounter sets set aside (bar a card another player's first reveal drew), and the encounter deck holding only The Crossings of Poros",
      check(state, golden, world) {
        expect(state.cards[state.questStage ?? ""], golden.name).toMatchObject({ code: "17157", zone: "questStage" });
        expect(cardsOf(state, [SERPENT]).map((card) => card.zone), golden.name).toEqual(["staging"]);
        expect(cardsOf(state, [GARRISON]).map((card) => card.zone), golden.name).toEqual(["setAside"]);
        // Every card of the five sets lies set aside; the encounter deck and the staging area hold The Crossings of Poros alone (the cards of the quest and the player decks have no encounter set).
        const sets = Object.values(state.cards).filter((card) => ASIDE_SETS.includes(printedOf(world.ctx.cards, card.code).encounterSet ?? ""));
        expect(sets.length, golden.name).toBeGreaterThan(20);
        // A card that another player's first reveal drew from a set aside set (Danger Close Behind) has left the set aside zone, but never joined the deck.
        expect(sets.filter((card) => card.zone === "setAside").length, golden.name).toBeGreaterThanOrEqual(sets.length - 1);
        expect(state.encounterDeck.every((id) => printedOf(world.ctx.cards, state.cards[id]?.code ?? "").encounterSet === "The Crossings of Poros"), golden.name).toBe(true);
        // The path cards: the two stage 2 and the three stage 3 wait in the quest deck.
        expect(cardsOf(state, [...STAGE_2, ...STAGE_3, STAGE_4]).every((card) => card.zone === "questDeck"), golden.name).toBe(true);
      },
    },
    wins: "ends when stage 4B is defeated at the end of a combat phase with Poros Garrison in play, settles at once with a score and earns nothing",
    won(state, golden) {
      expect(state.stageCleared, golden.name).toBe(true);
      expect(stageCode(state), golden.name).toBe(STAGE_4);
      expect(state.cards[state.questStage ?? ""]?.progress ?? 0, golden.name).toBeGreaterThanOrEqual(20);
      const [garrison] = cardsOf(state, [GARRISON]);
      expect(garrison?.zone, golden.name).toBe("play");
      expect(garrison?.controller, golden.name).toBe(state.firstPlayer);
    },
    lost(state, golden) {
      const seats = state.seats.slice(0, golden.seatCount);
      const [garrison] = cardsOf(state, [GARRISON]);
      if (golden.decks === "weak") {
        // Every seat at 50 threat or more; the quest never left stage 2.
        expect(seats.every((seat) => seat.eliminated && seat.threat >= 50), golden.name).toBe(true);
        expect(STAGE_2, golden.name).toContain(stageCode(state));
      } else if (golden.decks === "brittle") {
        expect(seats.every((seat) => seat.eliminated && seat.threat < 50), golden.name).toBe(true);
        expect(garrison?.zone, golden.name).not.toBe("encounterDiscard");
      } else {
        // The Garrison left play (the encounter discard pile), the players lost with their threat under 50 and a hero alive.
        expect(garrison?.zone, golden.name).toBe("encounterDiscard");
        expect(stageCode(state), golden.name).toBe(STAGE_4);
        expect(seats.every((seat) => seat.threat < 50), golden.name).toBe(true);
      }
    },
    // Read from the states the one play kept (playGolden, trail).
    checks({ game, world }) {
      const trailOf = (golden: PorosGolden) => {
        const played = game(golden);
        const trail = played.trail ?? [];
        expect(trail.length, golden.name).toBe(played.intents.length);
        return trail;
      };

      it("the stage path is 1B, a stage 2, a stage 3 and stage 4A, and the goldens play both stage 2 cards and every stage 3 card", () => {
        const stage2 = new Set<string>();
        const stage3 = new Set<string>();
        for (const golden of POROS_GOLDENS) {
          const path = pathOf(trailOf(golden));
          expect(path[0], golden.name).toBe(STAGE_1);
          if (path[1]) stage2.add(path[1]);
          if (path[2]) stage3.add(path[2]);
          expect(path.length >= 2 ? STAGE_2 : [], golden.name).toContain(path[1] ?? "");
          if (path.length >= 3) expect(STAGE_3, golden.name).toContain(path[2]);
          if (golden.outcome === "won") expect(path, golden.name).toHaveLength(4);
          if (golden.outcome === "won") expect(path[3], golden.name).toBe(STAGE_4);
        }
        expect([...stage2].sort()).toEqual(STAGE_2);
        expect([...stage3].sort()).toEqual(STAGE_3);
      });

      // The cards of the set that stage 2A removes, as they lay set aside when it resolved, and the stage 2 it removes never come back: from the first state that holds them removed, they stay so (a removed card is out of the game, a removed stage never becomes the quest).
      it("the encounter set and the stage 2 that stage 2A removes never come back", () => {
        let removedSets = 0;
        for (const golden of POROS_GOLDENS) {
          const { ctx } = world(golden);
          const trail = trailOf(golden);
          const first = stageCode(trail[0] ?? ({} as ScenarioState));
          expect(first, golden.name).toBe(STAGE_1);
          const chosen = pathOf(trail)[1];
          if (!chosen) continue;
          const sets = STAGE_2_SETS[chosen];
          const inSet = (state: ScenarioState, set: string) => Object.values(state.cards).filter((card) => printedOf(ctx.cards, card.code).encounterSet === set && printedOf(ctx.cards, card.code).campaignKind == null);
          const otherStage = STAGE_2.find((code) => code !== chosen) ?? "";
          // The cards of the removed set that lay set aside when stage 2A resolved: the last state before the stage 2 came up. The ones the stage 1 Setup dealt into the deck stay in the game (setAsideOnly).
          const before = trail.findLast((state) => stageCode(state) === STAGE_1) as ScenarioState;
          const asideOut = new Set(inSet(before, sets?.out ?? "").filter((card) => card.zone === "setAside").map((card) => card.id));
          expect(asideOut.size, golden.name).toBeGreaterThan(0);
          let seenRemoved = false;
          let seenStageRemoved = false;
          for (const state of trail) {
            const out = [...asideOut].map((id) => state.cards[id]);
            if (out.every((card) => card?.zone === "removed")) seenRemoved = true;
            if (seenRemoved) {
              removedSets += 1;
              expect(out.every((card) => card?.zone === "removed"), golden.name).toBe(true);
            }
            const [other] = cardsOf(state, [otherStage]);
            if (other?.removedStage === true) seenStageRemoved = true;
            if (seenStageRemoved) {
              expect(other?.removedStage, golden.name).toBe(true);
              expect(stageCode(state), golden.name).not.toBe(otherStage);
              expect(state.questStage, golden.name).not.toBe(other?.id);
            }
          }
          // Stage 2A ran: the chosen set was shuffled in (none of it set aside), the other set's set-aside cards and the other stage left.
          const last = trail[trail.length - 1] as ScenarioState;
          if (pathOf(trail).length >= 2) {
            expect(seenRemoved, golden.name).toBe(true);
            expect(seenStageRemoved, golden.name).toBe(true);
            expect(inSet(last, sets?.in ?? "").some((card) => card.zone === "setAside"), golden.name).toBe(false);
            expect([...asideOut].every((id) => last.cards[id]?.zone === "removed"), golden.name).toBe(true);
          }
        }
        expect(removedSets).toBeGreaterThan(0);
      });

      // Stage 4B cannot be defeated except at the end of the combat phase: every won game clears the stage in an intent that ends a combat phase.
      it("stage 4B is defeated only at the end of the combat phase", () => {
        let cleared = 0;
        for (const golden of POROS_GOLDENS.filter((item) => item.outcome === "won")) {
          const trail = trailOf(golden);
          trail.forEach((state, at) => {
            if (stageCode(state) !== STAGE_4) return;
            const before = trail[at - 1];
            if (before && state.stageCleared && !before.stageCleared) {
              cleared += 1;
              expect(before.phase, `${golden.name} after intent ${at}`).toBe("Combat");
            }
          });
        }
        expect(cleared).toBe(POROS_GOLDENS.filter((item) => item.outcome === "won").length);
      });
    },
  });
});
