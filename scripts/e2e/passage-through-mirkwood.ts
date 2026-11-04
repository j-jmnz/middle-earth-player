// The Maestro fixtures of Passage Through Mirkwood (Mirkwood Paths part 1), written into src/campaign/fixtures/passage-through-mirkwood.json
// by scripts/e2e/fixtures.ts: two real games of saved decklists (the Dwarves of Durin and the Elves of Lórien lists of data/decks/prebuilt.json),
// two-handed, Easy, from an empty Mirkwood Paths log, played by the auto-player, every intent one the reducer listed.
// `mirkwood-won`: the first seed that wins, parked on the win (the Resolution asks nothing, so the table shows Victory and the
// Resolution screen offers Confirm). `mirkwood-lost`: the first seed that loses when Mendor leaves play (01129:A:3), parked on the loss.
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";

import { newSave, type StoredLoadout } from "../../src/campaign/save.ts";
import { loadWorld } from "../../src/campaign/world.ts";
import { EFFECTS } from "../../src/effects/index.ts";
import { type PlayerIntent, type ScenarioState } from "../../src/rules/engine/reduce.ts";

import { nextIntent } from "../../test/harness/auto-player.ts";
import { loadCampaign, loadScenario } from "../data/load-scenarios.ts";
import { createLog } from "../log.ts";
import { temporaryCatalog } from "../../test/harness/temp-catalog.ts";
import { playDealt, prebuiltDeck } from "./seed-kit.ts";

const say = createLog("e2e-mirkwood");
const DECKS = ["dwarves-of-durin", "elves-of-lorien"] as const;

export type MirkwoodFixture = { campaignId: string; seatCount: 2; loadout: StoredLoadout; seed: number; intents: PlayerIntent[] };

function play(seed: number): { loadout: StoredLoadout; intents: PlayerIntent[]; state: ScenarioState } {
  const campaign = loadCampaign("mirkwood-paths");
  const scenario = loadScenario("passage-through-mirkwood");
  const catalog = drizzle(new Database(temporaryCatalog(), { readonly: true }));
  const seats = DECKS.map((id) => ({ deckId: id, ...prebuiltDeck(id) }));
  const loadout: StoredLoadout = { scenarioId: scenario.id, difficulty: "Easy", seats, ringBearer: null, choices: [], acceptPenalty: false };
  const world = loadWorld(catalog, campaign, scenario, EFFECTS, seats.flatMap((seat) => [...seat.heroes, ...seat.deck]));
  return { loadout, ...playDealt(world, newSave("fixture", campaign.id, 2), loadout, seed, 6000, (state, ctx, memory) => nextIntent(state, ctx, { scout: "", prefer: "", protect: "", play: true, act: true }, memory)) };
}

function firstSeed(wanted: (state: ScenarioState) => boolean, label: string): MirkwoodFixture {
  for (let seed = 1; seed <= 60; seed += 1) {
    const game = play(seed);
    if (!wanted(game.state)) continue;
    say.info(`${label}: seed ${seed}, ${game.intents.length} intents, round ${game.state.round}, ${game.state.lost ? game.state.lossReason : game.state.stagesReached?.join(",")}`);
    return { campaignId: "mirkwood-paths", seatCount: 2, loadout: game.loadout, seed, intents: game.intents };
  }
  throw new Error(`No ${label} game found in 60 seeds`);
}

export function mirkwoodFixtures(): { "mirkwood-won": MirkwoodFixture; "mirkwood-lost": MirkwoodFixture } {
  return {
    "mirkwood-won": firstSeed((state) => state.stageCleared && !state.lost, "mirkwood-won"),
    "mirkwood-lost": firstSeed((state) => state.lost && (state.lossReason ?? "").includes("Mendor left play"), "mirkwood-lost"),
  };
}
