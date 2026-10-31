// The Maestro fixtures of Flight of the Stormcaller (Dream-chaser part 4), written into src/campaign/fixtures/flight-of-the-stormcaller.json by scripts/e2e-fixtures.ts: real games of saved decklists (the
// Defenders of Gondor and Swords of the Noldor lists of data/decks/prebuilt.json), two-handed, Easy, so each is a real save. `stormcaller-won` is the first seed that wins, parked on the win (the Resolution
// waits); `stormcaller-lost` the first that loses, parked on the loss. A game not found in the seeds is left out.
// The log has the Grey Havens box (parts 1 to 3) recorded as won, so the open scenario is the playthrough's current node and `openNode` resumes it (a blank log keeps this part locked and the path opens Voyage Across
// Belegaer): it is the log of `scripts/e2e-raid.ts` (the Voyage and Fate goldens' wins), and on top of it the one of Raid on the Grey Havens' golden (src/campaign/golden-raid.test.ts, "two-handed, won"), each run
// through the same `applyResolution` that writes it in the app, with the goldens' plain-number heroes taken out (the fixture's seats play real decklists). `voyage-won`, `fate-won` and `raid-won`, real-decklist
// wins, are open (docs/phases/STATUS.md). The Campaign Setup asks no choice.
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";

import { applyResolution, type CampaignLog } from "../src/campaign/log.ts";
import { contextOf, deal, resume } from "../src/campaign/session.ts";
import { newSave, type StoredLoadout } from "../src/campaign/save.ts";
import { loadWorld, logCodes } from "../src/campaign/world.ts";
import { CATALOG_VERSION } from "../src/catalog/version.ts";
import { EFFECTS } from "../src/effects/index.ts";
import { reduce, type PlayerIntent, type ScenarioState } from "../src/rules/reduce.ts";

import { fateWonLog, intentFor, listed } from "./e2e-raid.ts";
import { loadCampaign, loadScenario } from "./data/load-scenarios.ts";
import { createLog } from "./log.ts";
import { RAID_GOLDENS, playGolden as playRaid, raidWorld } from "./raid-game.ts";
import { temporaryCatalog } from "./temp-catalog.ts";

const say = createLog("e2e-stormcaller");
const DECKS = ["defenders-of-gondor", "swords-of-the-noldor"] as const;
const CAMPAIGN = "dream-chaser";

export type StormcallerFixture = { campaignId: string; seatCount: 2; loadout: StoredLoadout; seed: number; intents: PlayerIntent[]; log: CampaignLog };
export type StormcallerFixtureName = "stormcaller-won" | "stormcaller-lost";

// The log of a playthrough whose first three parts were won: the Voyage and Fate goldens' wins (scripts/e2e-raid.ts), then the Raid golden's two-handed win, resolved onto it, their heroes and what hangs on them left out.
async function raidWonLog(): Promise<CampaignLog> {
  const before = await fateWonLog();
  const raid = RAID_GOLDENS.find((item) => item.name === "two-handed, won");
  if (!raid) throw new Error("The Raid golden \"two-handed, won\" is gone");
  const world = await raidWorld(raid.decks);
  const game = playRaid(raid, world.ctx);
  if (!game.state.stageCleared || game.state.lost) throw new Error("The Raid golden no longer wins");
  const written = applyResolution(before, game.state.scenarioId, game.state, world.cards);
  return { ...written, heroesBySeat: before.heroesBySeat, fallenHeroesBySeat: before.fallenHeroesBySeat, campaignPool: written.campaignPool.filter((card) => card.attachedTo == null) };
}

type Game = { loadout: StoredLoadout; intents: PlayerIntent[]; state: ScenarioState };

function play(seed: number, log: CampaignLog): Game {
  const campaign = loadCampaign(CAMPAIGN);
  const scenario = loadScenario("flight-of-the-stormcaller");
  const catalog = drizzle(new Database(temporaryCatalog(), { readonly: true }));
  const seats = DECKS.map((id) => ({ deckId: id, ...listed(id) }));
  const loadout: StoredLoadout = { scenarioId: scenario.id, difficulty: "Easy", seats, ringBearer: null, choices: [], acceptPenalty: false };
  const world = loadWorld(catalog, campaign, scenario, EFFECTS, [...seats.flatMap((seat) => [...seat.heroes, ...seat.deck]), ...logCodes(log)]);
  const dealt = deal({ ...newSave("fixture", campaign.id, 2), log }, world, loadout, seed, CATALOG_VERSION);
  if (!dealt.ok) throw new Error(dealt.briefing.problems.map((problem) => problem.message).join(" "));
  const resumed = resume(dealt.save, world, CATALOG_VERSION);
  if (!resumed.ok) throw new Error(resumed.reason);
  const ctx = contextOf(world);
  let state = resumed.state;
  const intents: PlayerIntent[] = [];
  const memory = new Set<string>();
  for (let turn = 0; turn < 8000 && !state.lost && !state.stageCleared; turn += 1) {
    const intent = intentFor(state, ctx, memory);
    const result = reduce(state, intent, ctx);
    if (!result.ok) throw new Error(`The policy sent a refused intent: ${result.reason}`);
    state = result.state;
    intents.push(intent);
  }
  return { loadout, intents, state };
}

function firstSeed(log: CampaignLog, wanted: (state: ScenarioState) => boolean, label: string): StormcallerFixture | null {
  const limit = Number(process.env.STORMCALLER_SEEDS ?? 100);
  for (let seed = 1; seed <= limit; seed += 1) {
    const game = play(seed, log);
    say.debug(`seed ${seed}: ${game.intents.length} intents, round ${game.state.round}, ${game.state.lost ? game.state.lossReason : game.state.stageCleared ? "won" : "stalled"}`);
    if (!wanted(game.state)) continue;
    say.info(`${label}: seed ${seed}, ${game.intents.length} intents, round ${game.state.round}, ${game.state.lost ? game.state.lossReason : "won"}`);
    return { campaignId: CAMPAIGN, seatCount: 2, loadout: game.loadout, seed, intents: game.intents, log };
  }
  say.warn(`no ${label} game found in ${limit} seeds`);
  return null;
}

export async function stormcallerFixtures(): Promise<Partial<Record<StormcallerFixtureName, StormcallerFixture>>> {
  const log = await raidWonLog();
  const won = firstSeed(log, (state) => state.stageCleared && !state.lost, "stormcaller-won");
  const lost = firstSeed(log, (state) => state.lost, "stormcaller-lost");
  return { ...(won ? { "stormcaller-won": won } : {}), ...(lost ? { "stormcaller-lost": lost } : {}) };
}
