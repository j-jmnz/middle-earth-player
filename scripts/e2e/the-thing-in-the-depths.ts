// The Maestro fixtures of The Thing in the Depths (Dream-chaser part 5), written into src/campaign/fixtures/the-thing-in-the-depths.json by scripts/e2e/fixtures.ts: real games of saved decklists (the Defenders of
// Gondor and Swords of the Noldor lists of data/decks/prebuilt.json), two-handed, Easy, so each is a real save. `depths-won` is the first seed that wins, parked on the win (the Resolution waits); `depths-lost` the first that
// loses, parked on the loss. A game not found in the seeds is left out.
// The log has the first four parts recorded as won, so the open scenario is the playthrough's current node and `openNode` resumes it (a blank log keeps this part locked and the path opens Voyage Across Belegaer): it is the log
// of `scripts/e2e/flight-of-the-stormcaller.ts` (the Voyage, Fate and Raid goldens' wins), and on top of it the one of Flight of the Stormcaller's golden ("two-handed, won"), each run through the same `applyResolution` that writes it in
// the app, with the goldens' plain-number heroes taken out (the fixture's seats play real decklists). `voyage-won`, `fate-won`, `raid-won` and `stormcaller-won`, real-decklist wins, are open (docs/phases/STATUS.md).
// The Campaign Setup asks no choice; the Resolution asks whether Come Together joins the pool.
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";

import { applyResolution, type CampaignLog } from "../../src/campaign/log.ts";
import { newSave, type StoredLoadout } from "../../src/campaign/save.ts";
import { loadWorld, logCodes } from "../../src/campaign/world.ts";
import { EFFECTS } from "../../src/effects/index.ts";
import { type PlayerIntent, type ScenarioState } from "../../src/rules/engine/reduce.ts";

import { intentFor } from "./raid-on-the-grey-havens.ts";
import { raidWonLog } from "./flight-of-the-stormcaller.ts";
import { loadCampaign, loadScenario } from "../data/load-scenarios.ts";
import { createLog } from "../log.ts";
import { FLIGHT_GOLDENS, flightWorld, playGolden as playFlight } from "../../test/scenarios/flight-of-the-stormcaller/game.ts";
import { temporaryCatalog } from "../../test/harness/temp-catalog.ts";
import { playDealt, prebuiltDeck } from "./seed-kit.ts";

const say = createLog("e2e-depths");
const DECKS = ["defenders-of-gondor", "swords-of-the-noldor"] as const;
const CAMPAIGN = "dream-chaser";

export type DepthsFixture = { campaignId: string; seatCount: 2; loadout: StoredLoadout; seed: number; intents: PlayerIntent[]; log: CampaignLog };
export type DepthsFixtureName = "depths-won" | "depths-lost";

// The log of a playthrough whose first four parts were won: the log of the first three (scripts/e2e/flight-of-the-stormcaller.ts), then the Flight golden's two-handed win, resolved onto it, their heroes and what hangs on them left out.
export async function stormcallerWonLog(): Promise<CampaignLog> {
  const before = await raidWonLog();
  const golden = FLIGHT_GOLDENS.find((item) => item.name === "two-handed, won");
  if (!golden) throw new Error("The Flight golden \"two-handed, won\" is gone");
  const world = await flightWorld(golden.decks);
  const game = playFlight(golden, world.ctx);
  if (!game.state.stageCleared || game.state.lost) throw new Error("The Flight golden no longer wins");
  const written = applyResolution(before, game.state.scenarioId, game.state, world.cards);
  return { ...written, heroesBySeat: before.heroesBySeat, fallenHeroesBySeat: before.fallenHeroesBySeat, campaignPool: written.campaignPool.filter((card) => card.attachedTo == null) };
}

type Game = { loadout: StoredLoadout; intents: PlayerIntent[]; state: ScenarioState };

function play(seed: number, log: CampaignLog): Game {
  const campaign = loadCampaign(CAMPAIGN);
  const scenario = loadScenario("the-thing-in-the-depths");
  const catalog = drizzle(new Database(temporaryCatalog(), { readonly: true }));
  const seats = DECKS.map((id) => ({ deckId: id, ...prebuiltDeck(id) }));
  const loadout: StoredLoadout = { scenarioId: scenario.id, difficulty: "Easy", seats, ringBearer: null, choices: [], acceptPenalty: false };
  const world = loadWorld(catalog, campaign, scenario, EFFECTS, [...seats.flatMap((seat) => [...seat.heroes, ...seat.deck]), ...logCodes(log)]);
  return { loadout, ...playDealt(world, { ...newSave("fixture", campaign.id, 2), log }, loadout, seed, 8000, intentFor) };
}

function firstSeed(log: CampaignLog, wanted: (state: ScenarioState) => boolean, label: string): DepthsFixture | null {
  const limit = Number(process.env.DEPTHS_SEEDS ?? 100);
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

export async function depthsFixtures(): Promise<Partial<Record<DepthsFixtureName, DepthsFixture>>> {
  const log = await stormcallerWonLog();
  const won = firstSeed(log, (state) => state.stageCleared && !state.lost, "depths-won");
  const lost = firstSeed(log, (state) => state.lost, "depths-lost");
  return { ...(won ? { "depths-won": won } : {}), ...(lost ? { "depths-lost": lost } : {}) };
}
