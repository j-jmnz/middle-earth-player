import { emptyLog, type CampaignLog } from "../../../src/campaign/log.ts";
import type { Difficulty } from "../../../src/catalog/scenario-data.ts";
import type { CampaignFacts, ModeCard } from "../../../src/rules/core/campaign-state.ts";
import { legalIntents, type PlayerIntent, type ReduceContext, type ScenarioState } from "../../../src/rules/engine/reduce.ts";

import { nextIntent, type PolicyOptions } from "../../harness/auto-player.ts";
import { campaignGame, fillerLoadout, HERO_STATS, type PlayedGame } from "../../harness/game-kit.ts";
import { TREASURES } from "../the-withered-heath/scene.ts";
import { campaign, night } from "./scene.ts";

// The cards the first five parts leave in the pool: the boon allies, the burdens, the Accolade and Song boons, Misplaced Trust and Urdug's Cunning, and two cards of the encounter pool (a Caves location and a Spiders of Mirkwood enemy).
const POOL_CODES: readonly string[] = ["12166", "12167", "12169", "12171", "12172", "12173", "12174", "12176", "12177", "12178", "12179", "12180", "12181", "12182", "12183", "12185", "12186", "18046", "18052"];

// Test helper. A whole game of Fire in the Night in Campaign Mode played by the auto-player, true solo or two-handed. The heroes are big numbers (or too small to quest, or too brittle to survive an attack) and the decks free
// events, so the outcome depends on the engine, the seed and the encounter deck, not on player card play. TODO: say how the players travel, engage and answer the choices this scenario asks.
export const NIGHT_POLICY: PolicyOptions = { scout: "", prefer: "", protect: "", play: false, act: false };
// "strong": big-number heroes that win; "weak": heroes too small to quest, so the players lose on threat; "brittle": strong questers that die to an attack.
export type NightDecks = "strong" | "weak" | "brittle";

export const nightLoadout = fillerLoadout;

// The goldens' world, the plan and start of a game, and the log of a campaign whose earlier parts were won: the seeded game's parts every scenario shares (test/harness/game-kit.ts).
export const nightWorld = (decks: NightDecks = "strong") => game.world(decks);
export const afterRhovanion = (seatCount: 1 | 2) => game.after(seatCount);
export const nightPlan = (seatCount: 1 | 2, log: CampaignLog = emptyLog(seatCount), choices?: readonly string[], difficulty?: Difficulty) => game.plan(seatCount, log, choices, difficulty);
export const nightStart = (seatCount: 1 | 2, seed: number, difficulty: Difficulty, facts?: Omit<CampaignFacts, "modeCard">, log: CampaignLog = emptyLog(seatCount), modeCard?: ModeCard, choices?: readonly string[]) => game.start(seatCount, seed, difficulty, facts, log, modeCard, choices);

export type NightPolicy = {
  // The option a Choose window with these answers takes: the first or the last.
  choose: "first" | "last";
};
export const DEFAULT_POLICY: NightPolicy = { choose: "first" };

// The auto-player's answer (test/harness/auto-player.ts), except: a choice takes the first option, or the last as the policy says. Every intent is one the reducer listed.
// TODO: the scenario's own answers (where the players travel, who defends, which locations they explore) go before the auto-player's.
export function nightIntent(state: ScenarioState, ctx: ReduceContext, memory: Set<string>, policy: NightPolicy = DEFAULT_POLICY): PlayerIntent {
  if (state.window?.kind === "choose") return { type: "Choose", optionId: (policy.choose === "last" ? state.window.options.at(-1) : state.window.options[0]) ?? "" };
  return nextIntent(state, ctx, NIGHT_POLICY, memory, legalIntents(state, ctx));
}

export type NightGame = PlayedGame;

// The goldens (src/campaign/scenarios/fire-in-the-night/golden.test.ts), also played by the causes and replay tests once test/harness/golden-registry.ts lists them.
// `after`: the log of a campaign whose earlier parts were won. `upgraded`: the Upgraded sides. `mode`: the Hard or Expert Mode card.
export type NightGolden = { name: string; seatCount: 1 | 2; seed: number; difficulty: Difficulty; decks: NightDecks; outcome: "won" | "lost"; policy?: Partial<NightPolicy>; after?: boolean; upgraded?: boolean; mode?: ModeCard; lossReason?: string };

// TODO: the games to pin, a few wins (true solo and two-handed, Normal and Easy, a Mode card, after the earlier parts) and a few losses (each way the scenario can be lost), each on a fixed seed.
export const NIGHT_GOLDENS: readonly NightGolden[] = [];

const game = campaignGame<NightDecks, NightPolicy>({
  campaign,
  scenario: night,
  stats: HERO_STATS,
  // The scenario's cards, and what the earlier parts leave in the pool (the boon allies, the burdens, the Accolade and Song boons) and the treasures a Resolution may offer.
  codes: [...night.cards.map((card) => card.code), ...POOL_CODES, ...TREASURES],
  intent: nightIntent,
  policy: DEFAULT_POLICY,
  limit: 6000,
  upgraded: [],
  // TODO: the XP each earlier part gained (in campaign order), the cards they put in the pool and the marks on the cards, as a campaign that won them leaves the log.
  earlier: { xp: [0, 0, 0, 0, 0], pool: [], marks: {} },
});

export const playGolden = (golden: NightGolden, ctx: ReduceContext): NightGame => game.playGolden(golden, ctx);
