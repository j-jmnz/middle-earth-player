import type { Difficulty } from "../../../src/catalog/scenario-data.ts";
import { legalIntents, type PlayerIntent, type ReduceContext, type ScenarioState } from "../../../src/rules/engine/reduce.ts";

import { loadAnyScenario, loadCampaign } from "../../../scripts/data/load-scenarios.ts";
import { nextIntent, type PolicyOptions } from "../../harness/auto-player.ts";
import { fillerLoadout, HERO_STATS, standaloneGame, type PlayedGame } from "../../harness/game-kit.ts";

const cycle = loadCampaign("shadows-of-mirkwood");
const gollum = loadAnyScenario("the-hunt-for-gollum");

// Test helper. A whole standalone game of The Hunt for Gollum played by the auto-player, true solo or two-handed. The heroes are big numbers (or too small to quest, or too brittle to survive an attack) and the decks free
// events, so the outcome depends on the engine, the seed and the encounter deck, not on player card play. There is no campaign: no checklist, no log, no earlier part, no Resolution.
export const GOLLUM_POLICY: PolicyOptions = { scout: "", prefer: "", protect: "", play: false, act: true };
// "strong": big-number heroes that win; "weak": heroes too small to quest, so the players lose on threat; "brittle": strong questers that die to an attack.
export type GollumDecks = "strong" | "weak" | "brittle";

export const gollumLoadout = fillerLoadout;

// The goldens' world and the start of a game: the seeded game's parts every scenario shares (test/harness/game-kit.ts).
export const gollumWorld = (decks: GollumDecks = "strong") => game.world(decks);
export const gollumStart = (seatCount: 1 | 2, seed: number, difficulty: Difficulty) => game.start(seatCount, seed, difficulty);

export type GollumPolicy = {
  // The option a Choose window with these answers takes: the first or the last.
  choose: "first" | "last";
};
export const DEFAULT_POLICY: GollumPolicy = { choose: "first" };

// The auto-player's answer (test/harness/auto-player.ts), except: a choice takes the first option, or the last as the policy says. Every intent is one the reducer listed.
// The auto-player answers each Response it can pay for (`act`): it claims a Signs of Gollum after a successful quest, naming the first committed hero. The players engage and defeat the guards as the auto-player does by default.
export function gollumIntent(state: ScenarioState, ctx: ReduceContext, memory: Set<string>, policy: GollumPolicy = DEFAULT_POLICY): PlayerIntent {
  if (state.window?.kind === "choose") return { type: "Choose", optionId: (policy.choose === "last" ? state.window.options.at(-1) : state.window.options[0]) ?? "" };
  return nextIntent(state, ctx, GOLLUM_POLICY, memory, legalIntents(state, ctx));
}

export type GollumGame = PlayedGame;

// The goldens (src/campaign/scenarios/the-hunt-for-gollum/golden.test.ts). A standalone game has no earlier parts, Upgraded sides or Mode card.
export type GollumGolden = { name: string; seatCount: 1 | 2; seed: number; difficulty: Difficulty; decks: GollumDecks; outcome: "won" | "lost"; policy?: Partial<GollumPolicy>; lossReason?: string };

// The games to pin (about 600 intents in all, .claude/rules/code-standards.md, Test cost): wins true solo and two-handed, on Normal, Easy and Nightmare, and the losses: the threat of every player at 50, every hero destroyed, and (Nightmare) the
// fourth Clue in the hands of a Mordor enemy. The strong heroes quest and claim a Clue at once, so a win is a few rounds; the weak ones cannot quest, so the threat rises; the brittle ones die to the staged enemies.
export const GOLLUM_GOLDENS: readonly GollumGolden[] = [
  { name: "solo win", seatCount: 1, seed: 1, difficulty: "Normal", decks: "strong", outcome: "won" },
  { name: "two-handed win", seatCount: 2, seed: 1, difficulty: "Normal", decks: "strong", outcome: "won" },
  { name: "Easy two-handed win", seatCount: 2, seed: 1, difficulty: "Easy", decks: "strong", outcome: "won" },
  { name: "Nightmare two-handed win", seatCount: 2, seed: 4, difficulty: "Nightmare", decks: "strong", outcome: "won" },
  { name: "solo loss: threat 50", seatCount: 1, seed: 4, difficulty: "Normal", decks: "weak", outcome: "lost", lossReason: "No seats remain" },
  { name: "two-handed loss: every hero destroyed", seatCount: 2, seed: 3, difficulty: "Normal", decks: "brittle", outcome: "lost", lossReason: "No seats remain" },
  { name: "Nightmare two-handed loss: four Signs with the hunters", seatCount: 2, seed: 6, difficulty: "Nightmare", decks: "strong", outcome: "lost", lossReason: "Four Signs of Gollum" },
];

const game = standaloneGame<GollumDecks, GollumPolicy>({
  campaign: cycle,
  scenario: gollum,
  stats: HERO_STATS,
  codes: [...gollum.cards.map((card) => card.code)],
  intent: gollumIntent,
  policy: DEFAULT_POLICY,
  limit: 6000,
});

export const playGolden = (golden: GollumGolden, ctx: ReduceContext): GollumGame => game.playGolden(golden, ctx);
