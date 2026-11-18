// The fixtures of Mount Gundabad (ered-mithrin part 8), written into src/campaign/fixtures/mount-gundabad.json by scripts/e2e/fixtures.ts: real games of saved decklists (The One Deck and the Defenders of Gondor lists of data/decks/test-decks.json and data/decks/prebuilt.json), two-handed, Easy, so each is a real save. `gundabad-won` is the first seed that wins, parked on the win (the Resolution waits); `gundabad-lost` the first
// that loses, parked on the loss. A game not found in the seeds is left out.
// The log has the earlier parts recorded as won, so the open scenario is the playthrough's current node and `openNode` resumes it.
// The Campaign Setup asks the first player for nothing here (the log holds no Melanwar or Beldis line, and the search for a unique boon ally is skipped: the one answer given is "skip"); the Resolution asks the first player for 1 of 3 random undiscovered treasures
// (the flow answers the first option). A win slays Dagnir at the Great Worm with the Reforged Wormsbane, so the decklists hunt her (test/scenarios/mount-gundabad/game.ts: Dagnir is engaged and attacked first, the Responses of The First Forge, Throat of the Mountain and
// Dagnir's Hoard are used, every character quests) with card play on.
import type { CampaignLog } from "../../src/campaign/log.ts";
import type { StoredLoadout } from "../../src/campaign/save.ts";
import type { PlayerIntent, ReduceContext, ScenarioState } from "../../src/rules/engine/reduce.ts";

import { FRAMSBURG_GOLDENS, framsburgWorld, playGolden as playFramsburg } from "../../test/scenarios/the-ghost-of-framsburg/game.ts";
import { DEFAULT_POLICY, GUNDABAD_POLICY, gundabadIntent } from "../../test/scenarios/mount-gundabad/game.ts";
import { nightWonLog } from "./the-ghost-of-framsburg.ts";
import { createLog } from "../log.ts";
import { firstSeed, wonLog } from "./seed-kit.ts";

const say = createLog("e2e-gundabad");

export type GundabadFixture = { campaignId: string; seatCount: 2; loadout: StoredLoadout; seed: number; intents: PlayerIntent[]; log: CampaignLog };
export type GundabadFixtureName = "gundabad-won" | "gundabad-lost";

// The log of a playthrough whose first 7 parts were won: the log of the parts before The Ghost of Framsburg (scripts/e2e/the-ghost-of-framsburg.ts), then the The Ghost of Framsburg golden's two-handed win, resolved onto it, their heroes and what hangs on them left out.
export async function framsburgWonLog(): Promise<CampaignLog> {
  return wonLog({ title: "The Ghost of Framsburg", golden: "two-handed, won, after the earlier parts, Misplaced Trust, the discard pile shuffled", goldens: FRAMSBURG_GOLDENS, world: framsburgWorld, play: playFramsburg }, await nightWonLog());
}

export async function gundabadFixtures(): Promise<Partial<Record<GundabadFixtureName, GundabadFixture>>> {
  const log = await framsburgWonLog();
  const find = (wanted: (state: ScenarioState) => boolean, label: string): GundabadFixture | null => {
    const answer = (state: ScenarioState, ctx: ReduceContext, memory: Set<string>) => gundabadIntent(state, ctx, memory, { ...DEFAULT_POLICY, quest: "all", engage: true, hunt: true, use: true }, { ...GUNDABAD_POLICY, play: true, act: true });
    const found = firstSeed(say, { campaignId: "ered-mithrin", scenarioId: "mount-gundabad", seatCount: 2, log, choices: ["skip"], answer }, "GUNDABAD_SEEDS", wanted, label);
    return found && { ...found, log };
  };
  const won = find((state) => state.stageCleared && !state.lost, "gundabad-won");
  const lost = find((state) => state.lost, "gundabad-lost");
  return { ...(won ? { "gundabad-won": won } : {}), ...(lost ? { "gundabad-lost": lost } : {}) };
}
