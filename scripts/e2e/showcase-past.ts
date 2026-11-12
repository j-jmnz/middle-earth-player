// The README showcase's save of A Shadow of the Past (docs/showcase.md, Saves and decks), written into src/campaign/fixtures/scenario-1.json
// by scripts/e2e/fixtures.ts beside `duo`: the same two decklists (The One Deck with the saga Frodo, and Stealth and Steadfastness), two-handed, Easy,
// played by the auto-player's answers.
//
// `past-showcase-board`: the first player's planning window in round 3 or later, on the first seed whose table is full (heroes and allies in play with
// attachments, an enemy engaged, an active location, cards in staging) with both players in the game with three heroes or more (`seatsStanding`).
import type { StoredLoadout } from "../../src/campaign/save.ts";
import type { PlayerIntent, ScenarioState } from "../../src/rules/engine/reduce.ts";

import { nextIntent } from "../../test/harness/auto-player.ts";
import { loadCampaign } from "../data/load-scenarios.ts";
import { createLog } from "../log.ts";
import { boardHolds, playSeed, prebuiltDeck, seatsStanding, type SeedSpec } from "./seed-kit.ts";

const say = createLog("e2e-showcase-past");
const FRODO = "141001";
const SEEDS = 40;

export type PastShowcase = { seatCount: 2; loadout: StoredLoadout; seed: number; intents: PlayerIntent[] };
export type PastShowcaseName = "past-showcase-board";

function loadout(): StoredLoadout {
  const stealth = loadCampaign().starterDecks.find((entry) => entry.id === "stealth-and-steadfastness");
  if (!stealth) throw new Error("No starter deck stealth-and-steadfastness");
  const one = prebuiltDeck("the-one-deck");
  return {
    scenarioId: "a-shadow-of-the-past",
    difficulty: "Easy",
    seats: [
      { deckId: "the-one-deck", heroes: one.heroes, deck: one.deck },
      {
        deckId: "stealth-and-steadfastness",
        heroes: stealth.rows.filter((row) => row.type === "hero").map((row) => row.code),
        deck: stealth.rows.filter((row) => row.type !== "hero").flatMap((row) => Array.from({ length: row.count }, () => row.code)),
      },
    ],
    ringBearer: FRODO,
    choices: [],
    acceptPenalty: false,
  };
}

const FULL = { play: 8, attached: 4, engaged: 1, staging: 2, location: true } as const;
const atBoard = (state: ScenarioState) => seatsStanding(state, 3) && state.round >= 3 && state.mode === "planning" && state.activeSeat === 0 && boardHolds(state, FULL);

export function pastShowcase(): Partial<Record<PastShowcaseName, PastShowcase>> {
  const base = loadout();
  for (let seed = 1; seed <= SEEDS; seed += 1) {
    const spec: SeedSpec<2> = {
      campaignId: "fellowship-of-the-ring",
      scenarioId: base.scenarioId,
      seatCount: 2,
      loadout: base,
      codes: [FRODO],
      limit: 1500,
      answer: (state, ctx, memory) => nextIntent(state, ctx, { scout: "", prefer: "141035", protect: FRODO, play: true, act: true }, memory),
      stop: atBoard,
    };
    const game = playSeed(spec, seed);
    if (!atBoard(game.state)) continue;
    say.info(`past-showcase-board: seed ${seed}, ${game.intents.length} intents, round ${game.state.round}`);
    return { "past-showcase-board": { seatCount: 2, loadout: base, seed, intents: game.intents } };
  }
  say.warn(`no past-showcase-board game found in ${SEEDS} seeds`);
  return {};
}
