import type { Difficulty } from "../../../src/catalog/scenario-data.ts";
import { legalIntents, type PlayerIntent, type ReduceContext, type ScenarioState } from "../../../src/rules/engine/reduce.ts";

import { loadAnyScenario, loadCampaign } from "../../../scripts/data/load-scenarios.ts";
import { nextIntent, type PolicyOptions } from "../../harness/auto-player.ts";
import { fillerLoadout, HERO_STATS, standaloneGame, type PlayedGame } from "../../harness/game-kit.ts";

const cycle = loadCampaign("standalone-scenarios");
const osgiliath = loadAnyScenario("the-massing-at-osgiliath");

// Test helper. A whole standalone game of The Massing at Osgiliath played by the auto-player, true solo or two-handed. The heroes are big numbers (or too small to quest, or too brittle to survive an attack) and the decks free
// events, so the outcome depends on the engine, the seed and the encounter deck, not on player card play. There is no campaign: no checklist, no log, no earlier part, no Resolution. TODO: say how the players travel, engage and answer the choices this scenario asks.
export const OSGILIATH_POLICY: PolicyOptions = { scout: "", prefer: "", protect: "", play: false, act: false };
// "strong": big-number heroes that win; "weak": heroes too small to quest, so the players lose on threat; "brittle": strong questers that die to an attack.
export type OsgiliathDecks = "strong" | "weak" | "brittle";

export const osgiliathLoadout = fillerLoadout;

// The goldens' world and the start of a game: the seeded game's parts every scenario shares (test/harness/game-kit.ts).
export const osgiliathWorld = (decks: OsgiliathDecks = "strong") => game.world(decks);
export const osgiliathStart = (seatCount: 1 | 2, seed: number, difficulty: Difficulty) => game.start(seatCount, seed, difficulty);

export type OsgiliathPolicy = {
  // The option a Choose window with these answers takes: the first or the last.
  choose: "first" | "last";
};
export const DEFAULT_POLICY: OsgiliathPolicy = { choose: "first" };

// The auto-player's answer (test/harness/auto-player.ts), except: a choice takes the first option, or the last as the policy says. Every intent is one the reducer listed.
// TODO: the scenario's own answers (where the players travel, who defends, which locations they explore) go before the auto-player's.
export function osgiliathIntent(state: ScenarioState, ctx: ReduceContext, memory: Set<string>, policy: OsgiliathPolicy = DEFAULT_POLICY): PlayerIntent {
  if (state.window?.kind === "choose") return { type: "Choose", optionId: (policy.choose === "last" ? state.window.options.at(-1) : state.window.options[0]) ?? "" };
  return nextIntent(state, ctx, OSGILIATH_POLICY, memory, legalIntents(state, ctx));
}

export type OsgiliathGame = PlayedGame;

// The goldens (src/campaign/scenarios/the-massing-at-osgiliath/golden.test.ts). A standalone game has no earlier parts, Upgraded sides or Mode card.
export type OsgiliathGolden = { name: string; seatCount: 1 | 2; seed: number; difficulty: Difficulty; decks: OsgiliathDecks; outcome: "won" | "lost"; policy?: Partial<OsgiliathPolicy>; lossReason?: string };

// TODO: the games to pin (at most 3000 intents in all, .claude/rules/code-standards.md, Test cost), a few wins (true solo and two-handed, Normal and Nightmare) and a few losses (each way the scenario can be lost), each on a fixed seed.
export const OSGILIATH_GOLDENS: readonly OsgiliathGolden[] = [];

const game = standaloneGame<OsgiliathDecks, OsgiliathPolicy>({
  campaign: cycle,
  scenario: osgiliath,
  stats: HERO_STATS,
  // TODO: the cards a game loads besides the scenario's piles and its Nightmare deck.
  codes: [...osgiliath.cards.map((card) => card.code)],
  intent: osgiliathIntent,
  policy: DEFAULT_POLICY,
  limit: 6000,
});

export const playGolden = (golden: OsgiliathGolden, ctx: ReduceContext): OsgiliathGame => game.playGolden(golden, ctx);
