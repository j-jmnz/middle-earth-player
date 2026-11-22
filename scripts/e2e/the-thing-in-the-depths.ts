// The fixtures of The Thing in the Depths (Dream-chaser part 5), written into src/campaign/fixtures/the-thing-in-the-depths.json by scripts/e2e/fixtures.ts: real games of saved decklists (The One Deck and the Defenders of Gondor lists of data/decks/test-decks.json and data/decks/prebuilt.json), two-handed, Easy, so each is a real save. `depths-won` is the first seed that wins, parked on the win (the Resolution waits); `depths-lost` the first that
// loses, parked on the loss. A game not found in the seeds is left out.
// The log has the first four parts recorded as won, so the open scenario is the playthrough's current node and `openNode` resumes it (a blank log keeps this part locked and the path opens Voyage Across Belegaer): it is the log
// of `scripts/e2e/flight-of-the-stormcaller.ts` (the Voyage, Fate and Raid goldens' wins), and on top of it the one of Flight of the Stormcaller's golden ("two-handed, won"), each run through the same `applyResolution` that writes it in
// the app, with the goldens' plain-number heroes taken out (the fixture's seats play real decklists). `voyage-won`, `fate-won`, `raid-won` and `stormcaller-won`, real-decklist wins, are not committed.
// The Campaign Setup asks no choice; the Resolution asks whether Come Together joins the pool.
import type { CampaignLog } from "../../src/campaign/log.ts";
import type { StoredLoadout } from "../../src/campaign/save.ts";
import { type PlayerIntent, type ScenarioState } from "../../src/rules/engine/reduce.ts";

import { intentFor } from "./raid-on-the-grey-havens.ts";
import { raidWonLog } from "./flight-of-the-stormcaller.ts";
import { createLog } from "../log.ts";
import { FLIGHT_GOLDENS, flightWorld, playGolden as playFlight } from "../../test/scenarios/flight-of-the-stormcaller/game.ts";
import { DREAM_CHASER, firstSeed, wonLog } from "./seed-kit.ts";

const say = createLog("e2e-depths");

export type DepthsFixture = { campaignId: string; seatCount: 2; loadout: StoredLoadout; seed: number; intents: PlayerIntent[]; log: CampaignLog };
export type DepthsFixtureName = "depths-won" | "depths-lost";

// The log of a playthrough whose first four parts were won: the log of the first three (scripts/e2e/flight-of-the-stormcaller.ts), then the Flight golden's two-handed win, resolved onto it, their heroes and what hangs on them left out.
export async function stormcallerWonLog(): Promise<CampaignLog> {
  return wonLog({ title: "Flight", goldens: FLIGHT_GOLDENS, world: flightWorld, play: playFlight }, await raidWonLog());
}

export async function depthsFixtures(): Promise<Partial<Record<DepthsFixtureName, DepthsFixture>>> {
  const log = await stormcallerWonLog();
  const find = (wanted: (state: ScenarioState) => boolean, label: string): DepthsFixture | null => {
    const found = firstSeed(say, { campaignId: DREAM_CHASER, scenarioId: "the-thing-in-the-depths", seatCount: 2, log, answer: intentFor }, "DEPTHS_SEEDS", wanted, label);
    return found && { ...found, log };
  };
  const won = find((state) => state.stageCleared && !state.lost, "depths-won");
  const lost = find((state) => state.lost, "depths-lost");
  return { ...(won ? { "depths-won": won } : {}), ...(lost ? { "depths-lost": lost } : {}) };
}
