import { emptyLog, type CampaignLog } from "../../../src/campaign/log.ts";
import type { Difficulty } from "../../../src/catalog/scenario-data.ts";
import type { CampaignFacts, ModeCard } from "../../../src/rules/core/campaign-state.ts";
import { legalIntents, type PlayerIntent, type ReduceContext, type ScenarioState } from "../../../src/rules/engine/reduce.ts";

import { loadCampaign, loadScenario } from "../../../scripts/data/load-scenarios.ts";
import { nextIntent, type PolicyOptions } from "../../harness/auto-player.ts";
import { campaignGame, fillerLoadout, HERO_STATS, type PlayedGame } from "../../harness/game-kit.ts";

const campaign = loadCampaign("angmar-awakened");
const chetwood = loadScenario("intruders-in-chetwood");

// Test helper. A whole game of Intruders in Chetwood in Campaign Mode played by the auto-player, true solo or two-handed. The heroes are big numbers (or too small to quest, or too brittle to survive an attack) and the decks free
// events, so the outcome depends on the engine, the seed and the encounter deck, not on player card play. TODO: say how the players travel, engage and answer the choices this scenario asks.
export const CHETWOOD_POLICY: PolicyOptions = { scout: "", prefer: "", protect: "", play: false, act: false };
// "strong": big-number heroes that win; "weak": heroes too small to quest, so the players lose on threat; "brittle": strong questers that die to an attack.
export type ChetwoodDecks = "strong" | "weak" | "brittle";

export const chetwoodLoadout = fillerLoadout;

// The goldens' world, the plan and start of a game, and the log of a campaign whose earlier parts were won: the seeded game's parts every scenario shares (test/harness/game-kit.ts).
export const chetwoodWorld = (decks: ChetwoodDecks = "strong") => game.world(decks);
export const chetwoodPlan = (seatCount: 1 | 2, log: CampaignLog = emptyLog(seatCount)) => game.plan(seatCount, log);
export const chetwoodStart = (seatCount: 1 | 2, seed: number, difficulty: Difficulty, facts?: Omit<CampaignFacts, "modeCard">, log: CampaignLog = emptyLog(seatCount), modeCard?: ModeCard) => game.start(seatCount, seed, difficulty, { facts, log, modeCard });

export type ChetwoodPolicy = {
  // The option a Choose window with these answers takes: the first or the last.
  choose: "first" | "last";
};
export const DEFAULT_POLICY: ChetwoodPolicy = { choose: "first" };

// The auto-player's answer (test/harness/auto-player.ts), except: a choice takes the first option, or the last as the policy says. Every intent is one the reducer listed.
// TODO: the scenario's own answers (where the players travel, who defends, which locations they explore) go before the auto-player's.
export function chetwoodIntent(state: ScenarioState, ctx: ReduceContext, memory: Set<string>, policy: ChetwoodPolicy = DEFAULT_POLICY): PlayerIntent {
  if (state.window?.kind === "choose") return { type: "Choose", optionId: (policy.choose === "last" ? state.window.options.at(-1) : state.window.options[0]) ?? "" };
  return nextIntent(state, ctx, CHETWOOD_POLICY, memory, legalIntents(state, ctx));
}

export type ChetwoodGame = PlayedGame;

// The goldens (src/campaign/scenarios/intruders-in-chetwood/golden.test.ts).
// `after`: the log of a campaign whose earlier parts were won. `upgraded`: the Upgraded sides. `mode`: the Hard or Expert Mode card.
export type ChetwoodGolden = { name: string; seatCount: 1 | 2; seed: number; difficulty: Difficulty; decks: ChetwoodDecks; outcome: "won" | "lost"; policy?: Partial<ChetwoodPolicy>; after?: boolean; upgraded?: boolean; mode?: ModeCard; lossReason?: string };

// TODO: the games to pin (at most 3000 intents in all, .claude/rules/code-standards.md, Test cost), a few wins (true solo and two-handed, Normal and Easy, a Mode card, after the earlier parts) and a few losses (each way the scenario can be lost), each on a fixed seed.
export const CHETWOOD_GOLDENS: readonly ChetwoodGolden[] = [];

const game = campaignGame<ChetwoodDecks, ChetwoodPolicy>({
  campaign,
  scenario: chetwood,
  stats: HERO_STATS,
  // TODO: the cards a game loads besides the scenario's piles, its campaign card's and the campaign's game codes.
  codes: [...chetwood.cards.map((card) => card.code)],
  intent: chetwoodIntent,
  policy: DEFAULT_POLICY,
  limit: 6000,
  upgraded: [],
});

export const playGolden = (golden: ChetwoodGolden, ctx: ReduceContext): ChetwoodGame => game.playGolden(golden, ctx);
