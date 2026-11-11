import { emptyLog, type CampaignLog } from "../../../src/campaign/log.ts";
import type { Difficulty } from "../../../src/catalog/scenario-data.ts";
import type { CampaignFacts, ModeCard } from "../../../src/rules/core/campaign-state.ts";
import { legalIntents, type PlayerIntent, type ReduceContext, type ScenarioState } from "../../../src/rules/engine/reduce.ts";

import { loadCampaign, loadScenario } from "../../../scripts/data/load-scenarios.ts";
import { nextIntent, type PolicyOptions } from "../../harness/auto-player.ts";
import { campaignGame, fillerLoadout, HERO_STATS, type PlayedGame } from "../../harness/game-kit.ts";

const campaign = loadCampaign("the-return-of-the-king");
const fields = loadScenario("the-battle-of-the-pelennor-fields");

// Test helper. A whole game of The Battle of the Pelennor Fields in Campaign Mode played by the auto-player, true solo or two-handed. The heroes are big numbers (or too small to quest, or too brittle to survive an attack) and the decks free
// events, so the outcome depends on the engine, the seed and the encounter deck, not on player card play. TODO: say how the players travel, engage and answer the choices this scenario asks.
export const FIELDS_POLICY: PolicyOptions = { scout: "", prefer: "", protect: "", play: false, act: false };
// "strong": big-number heroes that win; "weak": heroes too small to quest, so the players lose on threat; "brittle": strong questers that die to an attack.
export type FieldsDecks = "strong" | "weak" | "brittle";

export const fieldsLoadout = fillerLoadout;

// The goldens' world, the plan and start of a game, and the log of a campaign whose earlier parts were won: the seeded game's parts every scenario shares (test/harness/game-kit.ts).
export const fieldsWorld = (decks: FieldsDecks = "strong") => game.world(decks);
export const afterGondor = (seatCount: 1 | 2) => game.after(seatCount);
export const fieldsPlan = (seatCount: 1 | 2, log: CampaignLog = emptyLog(seatCount)) => game.plan(seatCount, log);
export const fieldsStart = (seatCount: 1 | 2, seed: number, difficulty: Difficulty, facts?: Omit<CampaignFacts, "modeCard">, log: CampaignLog = emptyLog(seatCount), modeCard?: ModeCard) => game.start(seatCount, seed, difficulty, { facts, log, modeCard });

export type FieldsPolicy = {
  // The option a Choose window with these answers takes: the first or the last.
  choose: "first" | "last";
};
export const DEFAULT_POLICY: FieldsPolicy = { choose: "first" };

// The auto-player's answer (test/harness/auto-player.ts), except: a choice takes the first option, or the last as the policy says. Every intent is one the reducer listed.
// TODO: the scenario's own answers (where the players travel, who defends, which locations they explore) go before the auto-player's.
export function fieldsIntent(state: ScenarioState, ctx: ReduceContext, memory: Set<string>, policy: FieldsPolicy = DEFAULT_POLICY): PlayerIntent {
  if (state.window?.kind === "choose") return { type: "Choose", optionId: (policy.choose === "last" ? state.window.options.at(-1) : state.window.options[0]) ?? "" };
  return nextIntent(state, ctx, FIELDS_POLICY, memory, legalIntents(state, ctx));
}

export type FieldsGame = PlayedGame;

// The goldens (src/campaign/scenarios/the-battle-of-the-pelennor-fields/golden.test.ts).
// `after`: the log of a campaign whose earlier parts were won. `upgraded`: the Upgraded sides. `mode`: the Hard or Expert Mode card.
export type FieldsGolden = { name: string; seatCount: 1 | 2; seed: number; difficulty: Difficulty; decks: FieldsDecks; outcome: "won" | "lost"; policy?: Partial<FieldsPolicy>; after?: boolean; upgraded?: boolean; mode?: ModeCard; lossReason?: string };

// TODO: the games to pin (at most 3000 intents in all, .claude/rules/code-standards.md, Test cost), a few wins (true solo and two-handed, Normal and Easy, a Mode card, after the earlier parts) and a few losses (each way the scenario can be lost), each on a fixed seed.
export const FIELDS_GOLDENS: readonly FieldsGolden[] = [];

const game = campaignGame<FieldsDecks, FieldsPolicy>({
  campaign,
  scenario: fields,
  stats: HERO_STATS,
  // TODO: the cards a game loads besides the scenario's piles, its campaign card's and the campaign's game codes.
  codes: [...fields.cards.map((card) => card.code)],
  intent: fieldsIntent,
  policy: DEFAULT_POLICY,
  limit: 6000,
  upgraded: [],
  // TODO: the XP each earlier part gained (in campaign order), the cards they put in the pool and the marks on the cards, as a campaign that won them leaves the log.
  earlier: { xp: [0, 0], pool: [], marks: {} },
});

export const playGolden = (golden: FieldsGolden, ctx: ReduceContext): FieldsGame => game.playGolden(golden, ctx);
