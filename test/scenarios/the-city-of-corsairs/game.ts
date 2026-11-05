import { emptyLog, type CampaignLog } from "../../../src/campaign/log.ts";
import type { Difficulty } from "../../../src/catalog/scenario-data.ts";
import type { CampaignFacts, ModeCard } from "../../../src/rules/core/campaign-state.ts";
import { legalIntents, type PlayerIntent, type ReduceContext, type ScenarioState } from "../../../src/rules/engine/reduce.ts";

import { campaign, corsairs } from "./scene.ts";
import { nextIntent, type PolicyOptions } from "../../harness/auto-player.ts";
import { campaignGame, fillerLoadout, HERO_STATS, type PlayedGame } from "../../harness/game-kit.ts";

// Test helper. A whole game of The City of Corsairs in Campaign Mode played by the auto-player, true solo or two-handed. The heroes are big numbers (or too small to quest, or too brittle to survive an attack) and the decks free
// events, so the outcome depends on the engine, the seed and the encounter deck, not on player card play. TODO: say how the players travel, engage and answer the choices this scenario asks.
export const CORSAIRS_POLICY: PolicyOptions = { scout: "", prefer: "", protect: "", play: false, act: false };
// "strong": big-number heroes that win; "weak": heroes too small to quest, so the players lose on threat; "brittle": strong questers that die to an attack.
export type CorsairsDecks = "strong" | "weak" | "brittle";

export const corsairsLoadout = fillerLoadout;

// The goldens' world, the plan and start of a game, and the log of a campaign whose earlier parts were won: the seeded game's parts every scenario shares (test/harness/game-kit.ts).
export const corsairsWorld = (decks: CorsairsDecks = "strong") => game.world(decks);
export const afterHaven = (seatCount: 1 | 2) => game.after(seatCount);
export const corsairsPlan = (seatCount: 1 | 2, log: CampaignLog = emptyLog(seatCount)) => game.plan(seatCount, log);
export const corsairsStart = (seatCount: 1 | 2, seed: number, difficulty: Difficulty, facts?: Omit<CampaignFacts, "modeCard">, log: CampaignLog = emptyLog(seatCount), modeCard?: ModeCard) => game.start(seatCount, seed, difficulty, facts, log, modeCard);

export type CorsairsPolicy = {
  // The option a Choose window with these answers takes: the first or the last.
  choose: "first" | "last";
};
export const DEFAULT_POLICY: CorsairsPolicy = { choose: "first" };

// The auto-player's answer (test/harness/auto-player.ts), except: a choice takes the first option, or the last as the policy says. Every intent is one the reducer listed.
// TODO: the scenario's own answers (where the players travel, who defends, which locations they explore) go before the auto-player's.
export function corsairsIntent(state: ScenarioState, ctx: ReduceContext, memory: Set<string>, policy: CorsairsPolicy = DEFAULT_POLICY): PlayerIntent {
  if (state.window?.kind === "choose") return { type: "Choose", optionId: (policy.choose === "last" ? state.window.options.at(-1) : state.window.options[0]) ?? "" };
  return nextIntent(state, ctx, CORSAIRS_POLICY, memory, legalIntents(state, ctx));
}

export type CorsairsGame = PlayedGame;

// The goldens (src/campaign/scenarios/the-city-of-corsairs/golden.test.ts), also played by the causes and replay tests once test/harness/golden-registry.ts lists them.
// `after`: the log of a campaign whose earlier parts were won. `upgraded`: the Upgraded sides. `mode`: the Hard or Expert Mode card.
export type CorsairsGolden = { name: string; seatCount: 1 | 2; seed: number; difficulty: Difficulty; decks: CorsairsDecks; outcome: "won" | "lost"; policy?: Partial<CorsairsPolicy>; after?: boolean; upgraded?: boolean; mode?: ModeCard; lossReason?: string };

// TODO: the games to pin, a few wins (true solo and two-handed, Normal and Easy, a Mode card, after the earlier parts) and a few losses (each way the scenario can be lost), each on a fixed seed.
export const CORSAIRS_GOLDENS: readonly CorsairsGolden[] = [];

const game = campaignGame<CorsairsDecks, CorsairsPolicy>({
  campaign,
  scenario: corsairs,
  stats: HERO_STATS,
  // TODO: the cards a game loads besides the scenario's piles, its campaign card's and the campaign's game codes.
  codes: [...corsairs.cards.map((card) => card.code)],
  intent: corsairsIntent,
  policy: DEFAULT_POLICY,
  limit: 6000,
  upgraded: [],
  // TODO: the XP each earlier part gained (in campaign order), the cards they put in the pool and the marks on the cards, as a campaign that won them leaves the log.
  earlier: { xp: [0, 0, 0, 0, 0, 0, 0, 0], pool: [], marks: {} },
});

export const playGolden = (golden: CorsairsGolden, ctx: ReduceContext): CorsairsGame => game.playGolden(golden, ctx);
