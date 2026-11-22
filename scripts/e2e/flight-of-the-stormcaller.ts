// The fixtures of Flight of the Stormcaller (Dream-chaser part 4), written into src/campaign/fixtures/flight-of-the-stormcaller.json by scripts/e2e/fixtures.ts: real games of saved decklists (The One Deck and the Defenders of Gondor lists of data/decks/test-decks.json and data/decks/prebuilt.json), two-handed, Easy, so each is a real save. `stormcaller-won` is the first seed that wins, parked on the win (the Resolution
// waits); `stormcaller-lost` the first that loses, parked on the loss. A game not found in the seeds is left out.
// The log has the Grey Havens box (parts 1 to 3) recorded as won, so the open scenario is the playthrough's current node and `openNode` resumes it (a blank log keeps this part locked and the path opens Voyage Across
// Belegaer): it is the log of `scripts/e2e/raid-on-the-grey-havens.ts` (the Voyage and Fate goldens' wins), and on top of it the one of Raid on the Grey Havens' golden (src/campaign/scenarios/raid-on-the-grey-havens/golden.test.ts, "two-handed, won"), each run
// through the same `applyResolution` that writes it in the app, with the goldens' plain-number heroes taken out (the fixture's seats play real decklists). `voyage-won`, `fate-won` and `raid-won`, real-decklist
// wins, are not committed. The Campaign Setup asks no choice.
import type { CampaignLog } from "../../src/campaign/log.ts";
import type { StoredLoadout } from "../../src/campaign/save.ts";
import { type PlayerIntent, type ScenarioState } from "../../src/rules/engine/reduce.ts";

import { fateWonLog, intentFor } from "./raid-on-the-grey-havens.ts";
import { createLog } from "../log.ts";
import { RAID_GOLDENS, playGolden as playRaid, raidWorld } from "../../test/scenarios/raid-on-the-grey-havens/game.ts";
import { DREAM_CHASER, firstSeed, wonLog } from "./seed-kit.ts";

const say = createLog("e2e-stormcaller");

export type StormcallerFixture = { campaignId: string; seatCount: 2; loadout: StoredLoadout; seed: number; intents: PlayerIntent[]; log: CampaignLog };
export type StormcallerFixtureName = "stormcaller-won" | "stormcaller-lost";

// The log of a playthrough whose first three parts were won: the Voyage and Fate goldens' wins (scripts/e2e/raid-on-the-grey-havens.ts), then the Raid golden's two-handed win, resolved onto it, their heroes and what hangs on them left out.
export async function raidWonLog(): Promise<CampaignLog> {
  return wonLog({ title: "Raid", goldens: RAID_GOLDENS, world: raidWorld, play: playRaid }, await fateWonLog());
}

export async function stormcallerFixtures(): Promise<Partial<Record<StormcallerFixtureName, StormcallerFixture>>> {
  const log = await raidWonLog();
  const find = (wanted: (state: ScenarioState) => boolean, label: string): StormcallerFixture | null => {
    const found = firstSeed(say, { campaignId: DREAM_CHASER, scenarioId: "flight-of-the-stormcaller", seatCount: 2, log, answer: intentFor }, "STORMCALLER_SEEDS", wanted, label);
    return found && { ...found, log };
  };
  const won = find((state) => state.stageCleared && !state.lost, "stormcaller-won");
  const lost = find((state) => state.lost, "stormcaller-lost");
  return { ...(won ? { "stormcaller-won": won } : {}), ...(lost ? { "stormcaller-lost": lost } : {}) };
}
