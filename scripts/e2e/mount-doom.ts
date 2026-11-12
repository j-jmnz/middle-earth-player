// The Maestro fixtures of Mount Doom (the-return-of-the-king part 6), written into src/campaign/fixtures/mount-doom.json by scripts/e2e/fixtures.ts: real games of saved decklists (the Defenders of
// Gondor and Swords of the Noldor lists of data/decks/prebuilt.json), two-handed, Easy, so each is a real save. `doom-won` is the first seed that wins, parked on the win (the Resolution waits); `doom-lost` the first
// that loses, parked on the loss. A game not found in the seeds is left out.
// The log has the earlier parts recorded as won, so the open scenario is the playthrough's current node and `openNode` resumes it.
// TODO: say what the Campaign Setup and the Resolution ask, and which answers the saved decklists' policy gives them.
import type { CampaignLog } from "../../src/campaign/log.ts";
import type { StoredLoadout } from "../../src/campaign/save.ts";
import type { PlayerIntent, ScenarioState } from "../../src/rules/engine/reduce.ts";

import { OPENS_GOLDENS, opensWorld, playGolden as playOpens } from "../../test/scenarios/the-black-gate-opens/game.ts";
import { ungolWonLog } from "./the-black-gate-opens.ts";
import { nextIntent } from "../../test/harness/auto-player.ts";
import { createLog } from "../log.ts";
import { firstSeed, wonLog } from "./seed-kit.ts";

const say = createLog("e2e-doom");

export type DoomFixture = { campaignId: string; seatCount: 2; loadout: StoredLoadout; seed: number; intents: PlayerIntent[]; log: CampaignLog };
export type DoomFixtureName = "doom-won" | "doom-lost";

// The log of a playthrough whose first 5 parts were won: the log of the parts before The Black Gate Opens (scripts/e2e/the-black-gate-opens.ts), then the The Black Gate Opens golden's two-handed win, resolved onto it, their heroes and what hangs on them left out.
export async function opensWonLog(): Promise<CampaignLog> {
  return wonLog({ title: "The Black Gate Opens", goldens: OPENS_GOLDENS, world: opensWorld, play: playOpens }, await ungolWonLog());
}

export async function doomFixtures(): Promise<Partial<Record<DoomFixtureName, DoomFixture>>> {
  const log = await opensWonLog();
  const find = (wanted: (state: ScenarioState) => boolean, label: string): DoomFixture | null => {
    // TODO: the scenario's own answers in place of the saved decklists' policy, when the scenario needs them (scripts/e2e/temple-of-the-deceived.ts is the pattern).
    const found = firstSeed(say, { campaignId: "the-return-of-the-king", scenarioId: "mount-doom", seatCount: 2, log, answer: (state: ScenarioState, ctx: Parameters<typeof nextIntent>[1], memory: Set<string>) => nextIntent(state, ctx, { scout: "", prefer: "", protect: "", play: true, act: true }, memory) }, "DOOM_SEEDS", wanted, label);
    return found && { ...found, log };
  };
  const won = find((state) => state.stageCleared && !state.lost, "doom-won");
  const lost = find((state) => state.lost, "doom-lost");
  return { ...(won ? { "doom-won": won } : {}), ...(lost ? { "doom-lost": lost } : {}) };
}
