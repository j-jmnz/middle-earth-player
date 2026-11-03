// The Maestro fixtures of Passage Through Mirkwood (Mirkwood Paths part 1), written into src/campaign/fixtures/passage-through-mirkwood.json
// by scripts/e2e/fixtures.ts: two real games of saved decklists (the Dwarves of Durin and the Elves of Lórien lists of data/decks/prebuilt.json),
// two-handed, Easy, from an empty Mirkwood Paths log, played by the auto-player, every intent one the reducer listed.
// `mirkwood-won`: the first seed that wins, parked on the win (the Resolution asks nothing, so the table shows Victory and the
// Resolution screen offers Confirm). `mirkwood-lost`: the first seed that loses when Mendor leaves play (01129:A:3), parked on the loss.
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";

import { contextOf, deal, resume } from "../../src/campaign/session.ts";
import { newSave, type StoredLoadout } from "../../src/campaign/save.ts";
import { loadWorld } from "../../src/campaign/world.ts";
import { CATALOG_VERSION } from "../../src/catalog/version.ts";
import { EFFECTS } from "../../src/effects/index.ts";
import { reduce, type PlayerIntent, type ScenarioState } from "../../src/rules/engine/reduce.ts";

import prebuilt from "../../data/decks/prebuilt.json" with { type: "json" };
import { nextIntent } from "../../test/harness/auto-player.ts";
import { loadCampaign, loadScenario } from "../data/load-scenarios.ts";
import { createLog } from "../log.ts";
import { temporaryCatalog } from "../../test/harness/temp-catalog.ts";

const say = createLog("e2e-mirkwood");
const DECKS = ["dwarves-of-durin", "elves-of-lorien"] as const;

export type MirkwoodFixture = { campaignId: string; seatCount: 2; loadout: StoredLoadout; seed: number; intents: PlayerIntent[] };

function listed(id: string): { heroes: string[]; deck: string[] } {
  const found = prebuilt.find((entry) => entry.id === id);
  if (!found) throw new Error(`No prebuilt deck ${id}`);
  return { heroes: [...found.heroes], deck: found.cards.flatMap((row) => Array.from({ length: row.count }, () => row.code)) };
}

function play(seed: number): { loadout: StoredLoadout; intents: PlayerIntent[]; state: ScenarioState } {
  const campaign = loadCampaign("mirkwood-paths");
  const scenario = loadScenario("passage-through-mirkwood");
  const catalog = drizzle(new Database(temporaryCatalog(), { readonly: true }));
  const seats = DECKS.map((id) => ({ deckId: id, ...listed(id) }));
  const loadout: StoredLoadout = { scenarioId: scenario.id, difficulty: "Easy", seats, ringBearer: null, choices: [], acceptPenalty: false };
  const world = loadWorld(catalog, campaign, scenario, EFFECTS, seats.flatMap((seat) => [...seat.heroes, ...seat.deck]));
  const dealt = deal(newSave("fixture", campaign.id, 2), world, loadout, seed, CATALOG_VERSION);
  if (!dealt.ok) throw new Error(dealt.briefing.problems.map((problem) => problem.message).join(" "));
  const resumed = resume(dealt.save, world, CATALOG_VERSION);
  if (!resumed.ok) throw new Error(resumed.reason);
  const ctx = contextOf(world);
  let state = resumed.state;
  const intents: PlayerIntent[] = [];
  const memory = new Set<string>();
  for (let turn = 0; turn < 6000 && !state.lost && !state.stageCleared; turn += 1) {
    const intent = nextIntent(state, ctx, { scout: "", prefer: "", protect: "", play: true, act: true }, memory);
    const result = reduce(state, intent, ctx);
    if (!result.ok) throw new Error(`The policy sent a refused intent: ${result.reason}`);
    state = result.state;
    intents.push(intent);
  }
  return { loadout, intents, state };
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
