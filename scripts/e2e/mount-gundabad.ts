// The Maestro fixtures of Mount Gundabad (ered-mithrin part 8), written into src/campaign/fixtures/mount-gundabad.json by scripts/e2e/fixtures.ts: real games of saved decklists (the Defenders of
// Gondor and Swords of the Noldor lists of data/decks/prebuilt.json), two-handed, Easy, so each is a real save. `gundabad-won` is the first seed that wins, parked on the win (the Resolution waits); `gundabad-lost` the first
// that loses, parked on the loss. A game not found in the seeds is left out.
// The log has the earlier parts recorded as won, so the open scenario is the playthrough's current node and `openNode` resumes it.
// TODO: say what the Campaign Setup and the Resolution ask, and which answers the saved decklists' policy gives them.
import type { CampaignLog } from "../../src/campaign/log.ts";
import type { StoredLoadout } from "../../src/campaign/save.ts";
import type { PlayerIntent, ScenarioState } from "../../src/rules/engine/reduce.ts";

import { FRAMSBURG_GOLDENS, framsburgWorld, playGolden as playFramsburg } from "../../test/scenarios/the-ghost-of-framsburg/game.ts";
import { nightWonLog } from "./the-ghost-of-framsburg.ts";
import { nextIntent } from "../../test/harness/auto-player.ts";
import { createLog } from "../log.ts";
import { firstSeed, wonLog } from "./seed-kit.ts";

const say = createLog("e2e-gundabad");

export type GundabadFixture = { campaignId: string; seatCount: 2; loadout: StoredLoadout; seed: number; intents: PlayerIntent[]; log: CampaignLog };
export type GundabadFixtureName = "gundabad-won" | "gundabad-lost";

// The log of a playthrough whose first 7 parts were won: the log of the parts before The Ghost of Framsburg (scripts/e2e/the-ghost-of-framsburg.ts), then the The Ghost of Framsburg golden's two-handed win, resolved onto it, their heroes and what hangs on them left out.
export async function framsburgWonLog(): Promise<CampaignLog> {
  return wonLog({ title: "The Ghost of Framsburg", goldens: FRAMSBURG_GOLDENS, world: framsburgWorld, play: playFramsburg }, await nightWonLog());
}

export async function gundabadFixtures(): Promise<Partial<Record<GundabadFixtureName, GundabadFixture>>> {
  const log = await framsburgWonLog();
  const find = (wanted: (state: ScenarioState) => boolean, label: string): GundabadFixture | null => {
    // TODO: the scenario's own answers in place of the saved decklists' policy, when the scenario needs them (scripts/e2e/temple-of-the-deceived.ts is the pattern).
    const found = firstSeed(say, { campaignId: "ered-mithrin", scenarioId: "mount-gundabad", seatCount: 2, log, answer: (state: ScenarioState, ctx: Parameters<typeof nextIntent>[1], memory: Set<string>) => nextIntent(state, ctx, { scout: "", prefer: "", protect: "", play: true, act: true }, memory) }, "GUNDABAD_SEEDS", wanted, label);
    return found && { ...found, log };
  };
  const won = find((state) => state.stageCleared && !state.lost, "gundabad-won");
  const lost = find((state) => state.lost, "gundabad-lost");
  return { ...(won ? { "gundabad-won": won } : {}), ...(lost ? { "gundabad-lost": lost } : {}) };
}
