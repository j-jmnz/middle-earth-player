import type { Difficulty } from "../../../src/catalog/scenario-data.ts";
import { legalIntents, type PlayerIntent, type ReduceContext, type ScenarioState } from "../../../src/rules/engine/reduce.ts";

import { loadAnyScenario, loadCampaign } from "../../../scripts/data/load-scenarios.ts";
import { nextIntent, type PolicyOptions } from "../../harness/auto-player.ts";
import { fillerLoadout, HERO_STATS, standaloneGame, type PlayedGame } from "../../harness/game-kit.ts";

const cycle = loadCampaign("against-the-shadow");
const ithilien = loadAnyScenario("into-ithilien");

// Test helper. A whole standalone game of Into Ithilien played by the auto-player, true solo or two-handed. The heroes are big numbers (or too small to quest, or too brittle to survive an attack) and the decks free
// events, so the outcome depends on the engine, the seed and the encounter deck, not on player card play. There is no campaign: no checklist, no log, no earlier part, no Resolution. TODO: say how the players travel, engage and answer the choices this scenario asks.
export const ITHILIEN_POLICY: PolicyOptions = { scout: "", prefer: "", protect: "", play: false, act: false };
// "strong": big-number heroes that win; "weak": heroes too small to quest, so the players lose on threat; "brittle": strong questers that die to an attack.
export type IthilienDecks = "strong" | "weak" | "brittle";

export const ithilienLoadout = fillerLoadout;

// The goldens' world and the start of a game: the seeded game's parts every scenario shares (test/harness/game-kit.ts).
export const ithilienWorld = (decks: IthilienDecks = "strong") => game.world(decks);
export const ithilienStart = (seatCount: 1 | 2, seed: number, difficulty: Difficulty) => game.start(seatCount, seed, difficulty);

export type IthilienPolicy = {
  // The option a Choose window with these answers takes: the first or the last.
  choose: "first" | "last";
};
export const DEFAULT_POLICY: IthilienPolicy = { choose: "first" };

// The auto-player's answer (test/harness/auto-player.ts), except: a choice takes the first option, or the last as the policy says. Every intent is one the reducer listed.
// TODO: the scenario's own answers (where the players travel, who defends, which locations they explore) go before the auto-player's.
export function ithilienIntent(state: ScenarioState, ctx: ReduceContext, memory: Set<string>, policy: IthilienPolicy = DEFAULT_POLICY): PlayerIntent {
  if (state.window?.kind === "choose") return { type: "Choose", optionId: (policy.choose === "last" ? state.window.options.at(-1) : state.window.options[0]) ?? "" };
  return nextIntent(state, ctx, ITHILIEN_POLICY, memory, legalIntents(state, ctx));
}

export type IthilienGame = PlayedGame;

// The goldens (src/campaign/scenarios/into-ithilien/golden.test.ts). A standalone game has no earlier parts, Upgraded sides or Mode card.
export type IthilienGolden = { name: string; seatCount: 1 | 2; seed: number; difficulty: Difficulty; decks: IthilienDecks; outcome: "won" | "lost"; policy?: Partial<IthilienPolicy>; lossReason?: string };

// TODO: the games to pin (at most 3000 intents in all, .claude/rules/code-standards.md, Test cost), a few wins (true solo and two-handed, Normal and Nightmare) and a few losses (each way the scenario can be lost), each on a fixed seed.
export const ITHILIEN_GOLDENS: readonly IthilienGolden[] = [];

const game = standaloneGame<IthilienDecks, IthilienPolicy>({
  campaign: cycle,
  scenario: ithilien,
  stats: HERO_STATS,
  // TODO: the cards a game loads besides the scenario's piles and its Nightmare deck.
  codes: [...ithilien.cards.map((card) => card.code)],
  intent: ithilienIntent,
  policy: DEFAULT_POLICY,
  limit: 6000,
});

export const playGolden = (golden: IthilienGolden, ctx: ReduceContext): IthilienGame => game.playGolden(golden, ctx);
