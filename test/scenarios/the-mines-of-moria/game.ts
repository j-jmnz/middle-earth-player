import type { Difficulty } from "../../../src/catalog/scenario-data.ts";
import { legalIntents, legalTargets, type PlayerIntent, type ReduceContext, type ScenarioState } from "../../../src/rules/engine/reduce.ts";

import { loadAnyScenario, loadCampaign } from "../../../scripts/data/load-scenarios.ts";
import { nextIntent, type PolicyOptions } from "../../harness/auto-player.ts";
import { attackTogether, engageOneEach, fillerLoadout, HERO_STATS, standaloneGame, type PlayedGame } from "../../harness/game-kit.ts";

const cycle = loadCampaign("standalone-scenarios");
const mines = loadAnyScenario("the-mines-of-moria");

// Test helper. A whole standalone game of The Mines of Moria played by the auto-player, true solo or two-handed. The heroes are big numbers (or too small to quest, or too brittle to survive an attack) and the decks free
// events, so the outcome depends on the engine, the seed and the encounter deck, not on player card play. There is no campaign: no checklist, no log, no earlier part, no Resolution. The players engage the enemies of the staging area one each and attack in turn, The Watcher first (stage 1B cannot be defeated while it is in play); a seat with several heroes sends one to quest and keeps the others to defend. TODO: the policy's stage choices and where the players travel.
export const MINES_POLICY: PolicyOptions = { scout: "", prefer: "", protect: "", play: false, act: false };
// "strong": big-number heroes that win; "weak": heroes too small to quest, so the players lose on threat; "brittle": strong questers that die to an attack.
export type MinesDecks = "strong" | "weak" | "brittle";

export const minesLoadout = fillerLoadout;

// The goldens' world and the start of a game: the seeded game's parts every scenario shares (test/harness/game-kit.ts).
export const minesWorld = (decks: MinesDecks = "strong") => game.world(decks);
export const minesStart = (seatCount: 1 | 2, seed: number, difficulty: Difficulty) => game.start(seatCount, seed, difficulty);

export type MinesPolicy = {
  // The option a Choose window with these answers takes: the first or the last.
  choose: "first" | "last";
};
export const DEFAULT_POLICY: MinesPolicy = { choose: "first" };

// The auto-player's answer (test/harness/auto-player.ts), except: a choice takes the first option, or the last as the policy says. Every intent is one the reducer listed.
// TODO: the scenario's own answers (where the players travel, who defends, which locations they explore) go before the auto-player's.
export function minesIntent(state: ScenarioState, ctx: ReduceContext, memory: Set<string>, policy: MinesPolicy = DEFAULT_POLICY): PlayerIntent {
  if (state.window?.kind === "choose") return { type: "Choose", optionId: (policy.choose === "last" ? state.window.options.at(-1) : state.window.options[0]) ?? "" };
  if (state.window?.kind === "optionalEngage") return engageOneEach(state, ctx) ?? { type: "DeclineEngage" };
  if (state.window?.kind === "playerAttack") {
    // One hero at a time, so the others may attack another enemy in the next window; an enemy is attacked once in a phase (the memory holds the round and the enemy). The Watcher first (stage 1B cannot be defeated while it is in play).
    const seat = state.seats[state.activeSeat];
    const attack = (seat?.heroes ?? []).map((one) => attackTogether(state, ctx, (id) => id === one, (id) => (state.cards[id]?.code === "51210" ? 0 : 1))).find((intent) => intent?.type === "DeclareAttackers" && !memory.has(`${state.round}:${intent.enemyId}`));
    if (attack?.type === "DeclareAttackers") {
      memory.add(`${state.round}:${attack.enemyId}`);
      return attack;
    }
  }
  if (state.window?.kind === "pass" && state.mode === "questCommit" && !Object.values(state.cards).some((card) => card.committed && card.controller === state.activeSeat)) {
    const ids = legalTargets(state, { type: "Commit" }, ctx);
    if (ids.length > 0 && (state.seats[state.activeSeat]?.heroes.length ?? 0) > 1) return { type: "Commit", cardIds: ids.slice(0, 1) };
  }
  if (state.window?.kind === "defense") {
    const heroes = state.seats[state.activeSeat]?.heroes ?? [];
    const attacker = heroes.at(-1);
    const defender = legalTargets(state, { type: "DeclareDefender" }, ctx).find((id) => id !== attacker && heroes.includes(id));
    if (defender) return { type: "DeclareDefender", defenderId: defender };
  }
  return nextIntent(state, ctx, MINES_POLICY, memory, legalIntents(state, ctx));
}

export type MinesGame = PlayedGame;

// The goldens (src/campaign/scenarios/the-mines-of-moria/golden.test.ts). A standalone game has no earlier parts, Upgraded sides or Mode card.
export type MinesGolden = { name: string; seatCount: 1 | 2; seed: number; difficulty: Difficulty; decks: MinesDecks; outcome: "won" | "lost"; policy?: Partial<MinesPolicy>; lossReason?: string };

// TODO: the games to pin (at most 3000 intents in all, .claude/rules/code-standards.md, Test cost), a few wins (true solo and two-handed, Normal and Nightmare) and a few losses (each way the scenario can be lost), each on a fixed seed.
export const MINES_GOLDENS: readonly MinesGolden[] = [];

const game = standaloneGame<MinesDecks, MinesPolicy>({
  campaign: cycle,
  scenario: mines,
  stats: HERO_STATS,
  // TODO: the cards a game loads besides the scenario's piles and its Nightmare deck.
  codes: mines.cards.flatMap((card) => (card.back != null ? [card.code, card.back] : [card.code])),
  intent: minesIntent,
  policy: DEFAULT_POLICY,
  limit: 6000,
});

export const playGolden = (golden: MinesGolden, ctx: ReduceContext): MinesGame => game.playGolden(golden, ctx);
