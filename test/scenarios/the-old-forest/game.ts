import type { Difficulty } from "../../../src/catalog/scenario-data.ts";
import { legalIntents, type PlayerIntent, type ReduceContext, type ScenarioState } from "../../../src/rules/engine/reduce.ts";

import { loadAnyScenario, loadCampaign } from "../../../scripts/data/load-scenarios.ts";
import { nextIntent, type PolicyOptions } from "../../harness/auto-player.ts";
import { fillerLoadout, HERO_STATS, standaloneGame, type PlayedGame } from "../../harness/game-kit.ts";

const cycle = loadCampaign("standalone-scenarios");
const forest = loadAnyScenario("the-old-forest");

// Test helper. A whole standalone game of The Old Forest played by the auto-player, true solo or two-handed. The heroes are big numbers (or too small to quest, or too brittle to survive an attack) and the decks free
// events, so the outcome depends on the engine, the seed and the encounter deck, not on player card play. There is no campaign: no checklist, no log, no earlier part, no Resolution. The players travel to the first location they
// may, quest with everyone, answer every search and choice with the first option (or the last as the policy says) and attack what the auto-player attacks; Old Man Willow comes at stage 3 and attacks each player in turn.
export const FOREST_POLICY: PolicyOptions = { scout: "", prefer: "", protect: "", play: false, act: false };
// "strong": big-number heroes that win; "weak": heroes too small to quest, so the players lose on threat; "brittle": strong questers that die to an attack.
export type ForestDecks = "strong" | "weak" | "brittle";

export const forestLoadout = fillerLoadout;

// The goldens' world and the start of a game: the seeded game's parts every scenario shares (test/harness/game-kit.ts).
export const forestWorld = (decks: ForestDecks = "strong") => game.world(decks);
export const forestStart = (seatCount: 1 | 2, seed: number, difficulty: Difficulty) => game.start(seatCount, seed, difficulty);

export type ForestPolicy = {
  // The option a Choose window takes: the first.
  choose: "first";
};
export const DEFAULT_POLICY: ForestPolicy = { choose: "first" };

// The auto-player's answer (test/harness/auto-player.ts), except: a choice takes the first option. Every intent is one the reducer listed.
export function forestIntent(state: ScenarioState, ctx: ReduceContext, memory: Set<string>): PlayerIntent {
  if (state.window?.kind === "choose") return { type: "Choose", optionId: state.window.options[0] ?? "" };
  return nextIntent(state, ctx, FOREST_POLICY, memory, legalIntents(state, ctx));
}

export type ForestGame = PlayedGame;

// The goldens (src/campaign/scenarios/the-old-forest/golden.test.ts). A standalone game has no earlier parts, Upgraded sides or Mode card.
export type ForestGolden = { name: string; seatCount: 1 | 2; seed: number; difficulty: Difficulty; decks: ForestDecks; outcome: "won" | "lost"; policy?: Partial<ForestPolicy>; lossReason?: string };

// The games to pin (about 400 intents in all, .claude/rules/code-standards.md, Test cost): wins true solo and two-handed on Normal and true solo on Easy (stage 3B defeated with Withywindle out of play), and the two ways to lose: every player's
// threat at 50 (heroes too small to quest) and every hero destroyed (brittle heroes under Old Man Willow's and the stage 2 enemies' attacks). No card of the scenario ends the game itself and it has no Nightmare deck.
export const FOREST_GOLDENS: readonly ForestGolden[] = [
  { name: "solo win", seatCount: 1, seed: 3, difficulty: "Normal", decks: "strong", outcome: "won" },
  { name: "two-handed win", seatCount: 2, seed: 3, difficulty: "Normal", decks: "strong", outcome: "won" },
  { name: "Easy solo win", seatCount: 1, seed: 2, difficulty: "Easy", decks: "strong", outcome: "won" },
  { name: "solo loss: threat 50", seatCount: 1, seed: 3, difficulty: "Normal", decks: "weak", outcome: "lost", lossReason: "No seats remain" },
  { name: "two-handed loss: every hero destroyed", seatCount: 2, seed: 1, difficulty: "Normal", decks: "brittle", outcome: "lost", lossReason: "No seats remain" },
];

const game = standaloneGame<ForestDecks, ForestPolicy>({
  campaign: cycle,
  scenario: forest,
  stats: HERO_STATS,
  codes: [...forest.cards.map((card) => card.code)],
  intent: forestIntent,
  policy: DEFAULT_POLICY,
  limit: 6000,
});

export const playGolden = (golden: ForestGolden, ctx: ReduceContext): ForestGame => game.playGolden(golden, ctx);
