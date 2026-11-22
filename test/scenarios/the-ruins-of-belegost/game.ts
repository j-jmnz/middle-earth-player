import type { Difficulty } from "../../../src/catalog/scenario-data.ts";
import { legalIntents, legalTargets, type PlayerIntent, type ReduceContext, type ScenarioState } from "../../../src/rules/engine/reduce.ts";

import { loadAnyScenario, loadCampaign } from "../../../scripts/data/load-scenarios.ts";
import { nextIntent, type PolicyOptions } from "../../harness/auto-player.ts";
import { attackTogether, engageOneEach, fillerLoadout, HERO_STATS, standaloneGame, type PlayedGame } from "../../harness/game-kit.ts";

const cycle = loadCampaign("standalone-scenarios");
const belegost = loadAnyScenario("the-ruins-of-belegost");

// Test helper. A whole standalone game of The Ruins of Belegost played by the auto-player, true solo or two-handed. The heroes are big numbers (or too small to quest, or too brittle to survive an attack) and the decks free
// events, so the outcome depends on the engine, the seed and the encounter deck, not on player card play. There is no campaign: no checklist, no log, no earlier part, no Resolution. The players travel to the first location they
// may and quest with everyone; Discover attaches the first Loot objective offered. They engage the enemies of the staging area one each, and every hero attacks in turn: Lurker of the Depths first (stage 2A needs it in the victory
// display), then Naurlhûg, then the rest. The auto-player alone never attacks, so it never kills Lurker and never wins.
export const BELEGOST_POLICY: PolicyOptions = { scout: "", prefer: "", protect: "", play: false, act: false };
// "strong": big-number heroes that win; "weak": heroes too small to quest, so the players lose on threat; "brittle": strong questers that die to an attack.
export type BelegostDecks = "strong" | "weak" | "brittle";

export const belegostLoadout = fillerLoadout;

// The goldens' world and the start of a game: the seeded game's parts every scenario shares (test/harness/game-kit.ts).
export const belegostWorld = (decks: BelegostDecks = "strong") => game.world(decks);
export const belegostStart = (seatCount: 1 | 2, seed: number, difficulty: Difficulty) => game.start(seatCount, seed, difficulty);

export type BelegostPolicy = {
  // The option a Choose window with these answers takes: the first or the last.
  choose: "first" | "last";
};
export const DEFAULT_POLICY: BelegostPolicy = { choose: "first" };

// The auto-player's answer (test/harness/auto-player.ts), except: a choice takes the first option, or the last as the policy says. Every intent is one the reducer listed.
// The enemies attacked first: the Lurker the stage needs destroyed, then Naurlhûg, then any other.
const rankOf = (state: ScenarioState, enemyId: string): number => {
  const code = state.cards[enemyId]?.code;
  return code === "50616" ? 0 : code === "50615" ? 1 : 2;
};

export function belegostIntent(state: ScenarioState, ctx: ReduceContext, memory: Set<string>, policy: BelegostPolicy = DEFAULT_POLICY): PlayerIntent {
  if (state.window?.kind === "choose") return { type: "Choose", optionId: (policy.choose === "last" ? state.window.options.at(-1) : state.window.options[0]) ?? "" };
  if (state.window?.kind === "optionalEngage") return engageOneEach(state, ctx) ?? { type: "DeclineEngage" };
  if (state.window?.kind === "playerAttack") {
    // One hero at a time, so the others may attack another enemy in the next window; an enemy is attacked once in a phase (the memory holds the round and the enemy).
    const seat = state.seats[state.activeSeat];
    const attack = (seat?.heroes ?? []).map((one) => attackTogether(state, ctx, (id) => id === one, (id) => rankOf(state, id))).find((intent) => intent?.type === "DeclareAttackers" && !memory.has(`${state.round}:${intent.enemyId}`));
    if (attack?.type === "DeclareAttackers") {
      memory.add(`${state.round}:${attack.enemyId}`);
      return attack;
    }
  }
  // The first hero of a seat quests, the second defends and the last attacks (a character that quested or defended is exhausted, so a hero that does neither is ready for the combat phase).
  if (state.window?.kind === "pass" && state.mode === "questCommit" && !Object.values(state.cards).some((card) => card.committed && card.controller === state.activeSeat)) {
    const ids = legalTargets(state, { type: "Commit" }, ctx);
    if (ids.length > 0) return { type: "Commit", cardIds: ids.slice(0, 1) };
  }
  if (state.window?.kind === "defense") {
    const heroes = state.seats[state.activeSeat]?.heroes ?? [];
    const attacker = heroes.at(-1);
    const defender = legalTargets(state, { type: "DeclareDefender" }, ctx).find((id) => id !== attacker && heroes.includes(id));
    if (defender) return { type: "DeclareDefender", defenderId: defender };
    const least = [...legalTargets(state, { type: "Undefended" }, ctx)].sort((left, right) => (state.cards[left]?.damage ?? 0) - (state.cards[right]?.damage ?? 0))[0];
    if (least) return { type: "Undefended", heroId: least };
  }
  return nextIntent(state, ctx, BELEGOST_POLICY, memory, legalIntents(state, ctx));
}

export type BelegostGame = PlayedGame;

// The goldens (src/campaign/scenarios/the-ruins-of-belegost/golden.test.ts). A standalone game has no earlier parts, Upgraded sides or Mode card.
export type BelegostGolden = { name: string; seatCount: 1 | 2; seed: number; difficulty: Difficulty; decks: BelegostDecks; outcome: "won" | "lost"; policy?: Partial<BelegostPolicy>; lossReason?: string };

// The games to pin (about 2300 intents in all, .claude/rules/code-standards.md, Test cost): wins true solo and two-handed on Normal (a hero quests, one defends and one attacks, so Lurker of the Depths is destroyed for stage 2A and
// Naurlhûg at stage 4A), and the two ways to lose: every player's threat at 50 (heroes too small to quest) and every hero destroyed (brittle heroes). No card of the scenario ends the game itself and it has no Nightmare deck.
export const BELEGOST_GOLDENS: readonly BelegostGolden[] = [
  { name: "solo win", seatCount: 1, seed: 4, difficulty: "Normal", decks: "strong", outcome: "won" },
  { name: "two-handed win", seatCount: 2, seed: 5, difficulty: "Normal", decks: "strong", outcome: "won" },
  { name: "solo loss: threat 50", seatCount: 1, seed: 3, difficulty: "Normal", decks: "weak", outcome: "lost", lossReason: "No seats remain" },
  { name: "two-handed loss: every hero destroyed", seatCount: 2, seed: 2, difficulty: "Normal", decks: "brittle", outcome: "lost", lossReason: "No seats remain" },
];

const game = standaloneGame<BelegostDecks, BelegostPolicy>({
  campaign: cycle,
  scenario: belegost,
  stats: HERO_STATS,
  codes: [...belegost.cards.map((card) => card.code)],
  intent: belegostIntent,
  policy: DEFAULT_POLICY,
  limit: 6000,
});

export const playGolden = (golden: BelegostGolden, ctx: ReduceContext): BelegostGame => game.playGolden(golden, ctx);
