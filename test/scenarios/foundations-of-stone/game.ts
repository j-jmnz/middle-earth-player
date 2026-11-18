import type { Difficulty } from "../../../src/catalog/scenario-data.ts";
import { legalIntents, legalTargets, type PlayerIntent, type ReduceContext, type ScenarioState } from "../../../src/rules/engine/reduce.ts";

import { loadAnyScenario, loadCampaign } from "../../../scripts/data/load-scenarios.ts";
import { nextIntent, type PolicyOptions } from "../../harness/auto-player.ts";
import { engageOneEach, fillerLoadout, HERO_STATS, standaloneGame, type PlayedGame } from "../../harness/game-kit.ts";

const cycle = loadCampaign("dwarrowdelf");
const stone = loadAnyScenario("foundations-of-stone");

// Test helper. A whole standalone game of Foundations of Stone played by the auto-player, true solo or two-handed. The heroes are big numbers (or too small to quest, or too brittle to survive an attack) and the decks free
// events, so the outcome depends on the engine, the seed and the encounter deck, not on player card play. There is no campaign: no checklist, no log, no earlier part, no Resolution.
// The policy: the third hero of the first player (q3) stays out of the quest and attacks; nobody defends; the players engage the enemies one each after the quest and attack them; the travel, the engagement and every choice are the auto-player's (a choice takes its first option, or the last as the
// policy says). Washed Away! gives each player a stage 4 of his own: with two players the area of the one who completes first is joined to the other's at the beginning of the travel phase, and when no area is left to join the players go on to stage 5 together.
export const STONE_POLICY: PolicyOptions = { scout: "q3", prefer: "", protect: "", play: false, act: false };
// "strong": big-number heroes that win; "weak": heroes too small to quest, so the players lose on threat; "brittle": strong questers that die to an attack; "slow": heroes that quest for little, so the game runs on into the separate stages.
export type StoneDecks = "strong" | "weak" | "brittle" | "slow";

export const stoneLoadout = fillerLoadout;

// The goldens' world and the start of a game: the seeded game's parts every scenario shares (test/harness/game-kit.ts).
export const stoneWorld = (decks: StoneDecks = "strong") => game.world(decks);
export const stoneStart = (seatCount: 1 | 2, seed: number, difficulty: Difficulty) => game.start(seatCount, seed, difficulty);

export type StonePolicy = {
  // The option a Choose window with these answers takes: the first or the last.
  choose: "first" | "last";
};
export const DEFAULT_POLICY: StonePolicy = { choose: "first" };

// The auto-player's answer (test/harness/auto-player.ts), except: a choice takes the first option, or the last as the policy says; nobody defends (the damage of an undefended attack goes to the seat's least damaged hero); the players engage one enemy each and attack with one hero.
// Every intent is one the reducer listed.
export function stoneIntent(state: ScenarioState, ctx: ReduceContext, memory: Set<string>, policy: StonePolicy = DEFAULT_POLICY): PlayerIntent {
  if (state.window?.kind === "choose") return { type: "Choose", optionId: (policy.choose === "last" ? state.window.options.at(-1) : state.window.options[0]) ?? "" };
  if (state.window?.kind === "defense") {
    const heroes = (state.seats[state.window.seat]?.heroes ?? []).filter((id) => state.cards[id]?.zone === "heroes");
    const least = [...heroes].sort((left, right) => (state.cards[left]?.damage ?? 0) - (state.cards[right]?.damage ?? 0))[0];
    if (least) return { type: "Undefended", heroId: least };
  }
  if (state.window?.kind === "playerAttack" && legalIntents(state, ctx).some((intent) => intent.type === "DeclareAttackers")) {
    for (const hero of state.seats[state.activeSeat]?.heroes ?? []) {
      const enemy = legalTargets(state, { type: "DeclareAttackers", cardId: hero }, ctx)[0];
      if (enemy) return { type: "DeclareAttackers", enemyId: enemy, attackerIds: [hero] };
    }
  }
  const engage = engageOneEach(state, ctx, 6);
  if (engage) return engage;
  return nextIntent(state, ctx, STONE_POLICY, memory, legalIntents(state, ctx));
}

export type StoneGame = PlayedGame;

// The goldens (src/campaign/scenarios/foundations-of-stone/golden.test.ts). A standalone game has no earlier parts, Upgraded sides or Mode card.
export type StoneGolden = { name: string; seatCount: 1 | 2; seed: number; difficulty: Difficulty; decks: StoneDecks; outcome: "won" | "lost"; policy?: Partial<StonePolicy>; lossReason?: string };

// The games to pin (about 850 intents in all, .claude/rules/code-standards.md, Test cost): wins true solo (a player alone goes from his stage 4 straight to stage 5) and two-handed (the stage 4 cards separate the players, one joins the other and the rest go on together) on Normal, Easy and
// Nightmare (the Nightmare cards that bear the Foundations of Stone icon reach the new deck), and the ways to lose: the threat of every player at 50 (heroes too weak to quest), every hero destroyed (heroes too brittle), and every hero lost (Drowned Treasury's discards) while the stage 4 areas are separate.
export const STONE_GOLDENS: readonly StoneGolden[] = [
  { name: "solo win", seatCount: 1, seed: 2, difficulty: "Normal", decks: "strong", outcome: "won" },
  { name: "two-handed win", seatCount: 2, seed: 1, difficulty: "Normal", decks: "strong", outcome: "won" },
  { name: "Easy solo win", seatCount: 1, seed: 2, difficulty: "Easy", decks: "strong", outcome: "won" },
  { name: "Easy two-handed win", seatCount: 2, seed: 3, difficulty: "Easy", decks: "strong", outcome: "won" },
  { name: "Nightmare solo win", seatCount: 1, seed: 2, difficulty: "Nightmare", decks: "strong", outcome: "won" },
  { name: "Nightmare two-handed win", seatCount: 2, seed: 4, difficulty: "Nightmare", decks: "strong", outcome: "won" },
  { name: "solo loss: threat 50", seatCount: 1, seed: 4, difficulty: "Normal", decks: "weak", outcome: "lost", lossReason: "No seats remain" },
  { name: "two-handed loss: threat 50", seatCount: 2, seed: 2, difficulty: "Normal", decks: "weak", outcome: "lost", lossReason: "No seats remain" },
  { name: "solo loss: every hero destroyed", seatCount: 1, seed: 21, difficulty: "Normal", decks: "brittle", outcome: "lost", lossReason: "No seats remain" },
  { name: "two-handed loss: every hero lost at the separate stages", seatCount: 2, seed: 10, difficulty: "Normal", decks: "slow", outcome: "lost", lossReason: "No seats remain" },
];

const game = standaloneGame<StoneDecks, StonePolicy>({
  campaign: cycle,
  scenario: stone,
  stats: { ...HERO_STATS, slow: { ...HERO_STATS.strong, willpower: 5 } },
  codes: [...stone.cards.map((card) => card.code)],
  intent: stoneIntent,
  policy: DEFAULT_POLICY,
  limit: 6000,
});

export const playGolden = (golden: StoneGolden, ctx: ReduceContext): StoneGame => game.playGolden(golden, ctx);
