// The fixtures of The Fate of Númenor (Dream-chaser part 2), written into src/campaign/fixtures/the-fate-of-numenor.json by scripts/e2e/fixtures.ts: real games of saved decklists (the fixture decks of scripts/e2e/seed-kit.ts), two-handed, Easy, so each is a real save. `fate-won` is the first seed that wins, parked on the win (the
// Resolution waits); `fate-lost` the first that loses, parked on the loss. A game not found in the seeds is left out.
// The log has part 1 recorded as won, so the open scenario is the playthrough's current node and `openNode` resumes it (a blank log keeps the Fate locked and the path opens Voyage Across
// Belegaer): it is the log the won game of Voyage Across Belegaer's golden writes (src/campaign/scenarios/voyage-across-belegaer/golden.test.ts, "two-handed, won"), run through the same `applyResolution` that
// writes it in the app, with the golden's plain-number heroes taken out (the fixture's seats play real decklists). `voyage-won`, a real-decklist win, is not committed.
// The Campaign Setup (damage traded for threat) is answered in the game by the auto-player: no damage is traded.
import type { CampaignLog } from "../../src/campaign/log.ts";
import type { StoredLoadout } from "../../src/campaign/save.ts";
import { legalIntents, legalTargets, type PlayerIntent, type ReduceContext, type ScenarioState } from "../../src/rules/engine/reduce.ts";

import { nextIntent } from "../../test/harness/auto-player.ts";
import { attackTogether, engageOneEach } from "../../test/harness/game-kit.ts";
import { VOYAGE_GOLDENS, playGolden as playVoyage, voyageWorld } from "../../test/scenarios/voyage-across-belegaer/game.ts";
import { createLog } from "../log.ts";
import { DREAM_CHASER, firstSeed, wonLog } from "./seed-kit.ts";

const say = createLog("e2e-fate");

export type FateFixture = { campaignId: string; seatCount: 2; loadout: StoredLoadout; seed: number; intents: PlayerIntent[]; log: CampaignLog };
export type FateFixtureName = "fate-won" | "fate-lost";

// The log of a playthrough whose first part was won: the Voyage golden's two-handed win resolved onto a new log, its heroes and what hangs on them left out.
export const voyageWonLog = (): Promise<CampaignLog> => wonLog({ title: "Voyage", goldens: VOYAGE_GOLDENS, world: voyageWorld, play: playVoyage });

// The auto-player's answer with what the scenario asks: no damage is traded for threat, damage the players assign falls on the least wounded hero, the heroes attack together, and the
// first location the travel phase offers is travelled to.
function intentFor(state: ScenarioState, ctx: ReduceContext, memory: Set<string>): PlayerIntent {
  if (state.window?.kind === "choose" && state.window.options.every((option) => option === "trade" || option === "keep")) return { type: "Choose", optionId: "keep" };
  if (state.window?.kind === "choose") {
    const heroes = state.window.options.filter((option) => state.cards[option]?.zone === "heroes");
    const least = [...heroes].sort((a, b) => (state.cards[a]?.damage ?? 0) - (state.cards[b]?.damage ?? 0))[0];
    if (least && heroes.length < state.window.options.length) return { type: "Choose", optionId: least };
  }
  if (state.window?.kind === "defense") {
    const defenders = legalIntents(state, ctx).some((intent) => intent.type === "DeclareDefender") ? legalTargets(state, { type: "DeclareDefender" }, ctx) : [];
    if (defenders[0]) return { type: "DeclareDefender", defenderId: defenders[0] };
    const targets = legalTargets(state, { type: "Undefended" }, ctx);
    const least = [...targets].sort((a, b) => (state.cards[a]?.damage ?? 0) - (state.cards[b]?.damage ?? 0))[0];
    if (least) return { type: "Undefended", heroId: least };
  }
  const together = attackTogether(state, ctx);
  if (together) return together;
  if (state.window?.kind === "optionalEngage") return engageOneEach(state, ctx, 2) ?? { type: "DeclineEngage" };
  return nextIntent(state, ctx, { scout: "", prefer: "", protect: "", play: true, act: true }, memory, legalIntents(state, ctx));
}

export async function fateFixtures(): Promise<Partial<Record<FateFixtureName, FateFixture>>> {
  const log = await voyageWonLog();
  const find = (wanted: (state: ScenarioState) => boolean, label: string): FateFixture | null => {
    const found = firstSeed(say, { campaignId: DREAM_CHASER, scenarioId: "the-fate-of-numenor", seatCount: 2, log, answer: intentFor }, "FATE_SEEDS", wanted, label);
    return found && { ...found, log };
  };
  const won = find((state) => state.stageCleared && !state.lost, "fate-won");
  const lost = find((state) => state.lost, "fate-lost");
  return { ...(won ? { "fate-won": won } : {}), ...(lost ? { "fate-lost": lost } : {}) };
}
