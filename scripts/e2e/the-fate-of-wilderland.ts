// The Maestro fixtures of The Fate of Wilderland (ered-mithrin part 9), written into src/campaign/fixtures/the-fate-of-wilderland.json by scripts/e2e/fixtures.ts: real games of saved decklists (The One Deck and the Defenders of Gondor lists of data/decks/test-decks.json and data/decks/prebuilt.json), two-handed, Easy, so each is a real save. `wilderland-won` is the first seed that wins, parked on the win (the Resolution waits); `wilderland-lost` the first
// that loses, parked on the loss. A game not found in the seeds is left out.
// The log has the earlier parts recorded as won, so the open scenario is the playthrough's current node and `openNode` resumes it.
// The Campaign Setup asks the first player to search their deck for a boon or treasure card (the pool holds the boon allies the earlier parts earned): the one answer given is "skip", and the log holds no Turayn or Beldis line, so no removal is asked. The Resolution
// asks nothing ("The players win the campaign!"). A win destroys Urdug once The Heroes' Defense holds 5 resources for each player, so the decklists engage one enemy at a time, defend with the sturdiest character and attack with the rest (test/scenarios/the-fate-of-wilderland/game.ts:
// two characters of a seat quest, a choice spares the objective and the threat, the Response of The Heroes' Defense is used) with card play on. The won game is OPEN: no seed of the 100 searched, under this policy and four others, wins (docs/phases/STATUS.md): the real heroes die to the first
// enemies' attacks or the seats' threat reaches 50 before The Heroes' Defense holds 10 resources.
import type { CampaignLog } from "../../src/campaign/log.ts";
import type { StoredLoadout } from "../../src/campaign/save.ts";
import type { PlayerIntent, ReduceContext, ScenarioState } from "../../src/rules/engine/reduce.ts";

import { GUNDABAD_GOLDENS, gundabadWorld, playGolden as playGundabad } from "../../test/scenarios/mount-gundabad/game.ts";
import { DEFAULT_POLICY, WILDERLAND_POLICY, wilderlandIntent } from "../../test/scenarios/the-fate-of-wilderland/game.ts";
import { framsburgWonLog } from "./mount-gundabad.ts";
import { createLog } from "../log.ts";
import { firstSeed, wonLog } from "./seed-kit.ts";

const say = createLog("e2e-wilderland");

export type WilderlandFixture = { campaignId: string; seatCount: 2; loadout: StoredLoadout; seed: number; intents: PlayerIntent[]; log: CampaignLog };
export type WilderlandFixtureName = "wilderland-won" | "wilderland-lost";

// The log of a playthrough whose first 8 parts were won: the log of the parts before Mount Gundabad (scripts/e2e/mount-gundabad.ts), then the Mount Gundabad golden's two-handed win, resolved onto it, their heroes and what hangs on them left out.
export async function gundabadWonLog(): Promise<CampaignLog> {
  return wonLog({ title: "Mount Gundabad", golden: "two-handed, won, after the earlier parts, Misplaced Trust, no stage bypassed", goldens: GUNDABAD_GOLDENS, world: gundabadWorld, play: playGundabad }, await framsburgWonLog());
}

export async function wilderlandFixtures(): Promise<Partial<Record<WilderlandFixtureName, WilderlandFixture>>> {
  const log = await gundabadWonLog();
  const find = (wanted: (state: ScenarioState) => boolean, label: string): WilderlandFixture | null => {
    const answer = (state: ScenarioState, ctx: ReduceContext, memory: Set<string>) => wilderlandIntent(state, ctx, memory, { ...DEFAULT_POLICY, quest: "pair", defend: "all", most: 1, choose: "spare", use: true }, { ...WILDERLAND_POLICY, play: true, act: true });
    const found = firstSeed(say, { campaignId: "ered-mithrin", scenarioId: "the-fate-of-wilderland", seatCount: 2, log, choices: ["skip"], answer }, "WILDERLAND_SEEDS", wanted, label);
    return found && { ...found, log };
  };
  const won = find((state) => state.stageCleared && !state.lost, "wilderland-won");
  const lost = find((state) => state.lost, "wilderland-lost");
  return { ...(won ? { "wilderland-won": won } : {}), ...(lost ? { "wilderland-lost": lost } : {}) };
}
