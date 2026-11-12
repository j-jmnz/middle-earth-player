// The Maestro fixtures of Escape from Mount Gram (angmar-awakened part 5), written into src/campaign/fixtures/escape-from-mount-gram.json by scripts/e2e/fixtures.ts: real games of saved decklists (the Defenders of
// Gondor and Swords of the Noldor lists of data/decks/prebuilt.json), two-handed, Easy, so each is a real save. `gram-won` is the first seed that wins, parked on the win (the Resolution waits); `gram-lost` the first
// that loses, parked on the loss. A game not found in the seeds is left out.
// The log has the earlier parts recorded as won, so the open scenario is the playthrough's current node and `openNode` resumes it.
// TODO: say what the Campaign Setup and the Resolution ask, and which answers the saved decklists' policy gives them.
import type { CampaignLog } from "../../../src/campaign/log.ts";
import type { StoredLoadout } from "../../../src/campaign/save.ts";
import type { PlayerIntent, ScenarioState } from "../../../src/rules/engine/reduce.ts";

import { ERIADOR_GOLDENS, eriadorWorld, playGolden as playEriador } from "../../../test/scenarios/the-wastes-of-eriador/game.ts";
import { dikeWonLog } from "./the-wastes-of-eriador.ts";
import { nextIntent } from "../../../test/harness/auto-player.ts";
import { createLog } from "../../log.ts";
import { firstSeed, wonLog } from "../seed-kit.ts";

const say = createLog("e2e-gram");

export type GramFixture = { campaignId: string; seatCount: 2; loadout: StoredLoadout; seed: number; intents: PlayerIntent[]; log: CampaignLog };
export type GramFixtureName = "gram-won" | "gram-lost";

// The log of a playthrough whose first 4 parts were won: the log of the parts before The Wastes of Eriador (scripts/e2e/angmar-awakened/the-wastes-of-eriador.ts), then the The Wastes of Eriador golden's two-handed win, resolved onto it, their heroes and what hangs on them left out.
export async function eriadorWonLog(): Promise<CampaignLog> {
  return wonLog({ title: "The Wastes of Eriador", goldens: ERIADOR_GOLDENS, world: eriadorWorld, play: playEriador }, await dikeWonLog());
}

export async function gramFixtures(): Promise<Partial<Record<GramFixtureName, GramFixture>>> {
  const log = await eriadorWonLog();
  const find = (wanted: (state: ScenarioState) => boolean, label: string): GramFixture | null => {
    // TODO: the scenario's own answers in place of the saved decklists' policy, when the scenario needs them (scripts/e2e/temple-of-the-deceived.ts is the pattern).
    const found = firstSeed(say, { campaignId: "angmar-awakened", scenarioId: "escape-from-mount-gram", seatCount: 2, log, answer: (state: ScenarioState, ctx: Parameters<typeof nextIntent>[1], memory: Set<string>) => nextIntent(state, ctx, { scout: "", prefer: "", protect: "", play: true, act: true }, memory) }, "GRAM_SEEDS", wanted, label);
    return found && { ...found, log };
  };
  const won = find((state) => state.stageCleared && !state.lost, "gram-won");
  const lost = find((state) => state.lost, "gram-lost");
  return { ...(won ? { "gram-won": won } : {}), ...(lost ? { "gram-lost": lost } : {}) };
}
