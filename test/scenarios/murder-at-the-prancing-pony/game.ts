import type { Difficulty } from "../../../src/catalog/scenario-data.ts";
import { legalIntents, legalTargets, type PlayerIntent, type ReduceContext, type ScenarioState } from "../../../src/rules/engine/reduce.ts";

import { loadAnyScenario, loadCampaign } from "../../../scripts/data/load-scenarios.ts";
import { nextIntent, type PolicyOptions } from "../../harness/auto-player.ts";
import { attackTogether, engageOneEach, fillerLoadout, HERO_STATS, standaloneGame, type PlayedGame } from "../../harness/game-kit.ts";

const cycle = loadCampaign("standalone-scenarios");
const pony = loadAnyScenario("murder-at-the-prancing-pony");

// Test helper. A whole standalone game of Murder at the Prancing Pony played by the auto-player, true solo or two-handed. The heroes are big numbers (or too small to quest, or too brittle to survive an attack) and the decks free
// events, so the outcome depends on the engine, the seed and the encounter deck, not on player card play. There is no campaign: no checklist, no log, no earlier part, no Resolution. The players travel to the first location they may and quest with the first hero of each seat. At stage 2B the first player makes the accusation (the first name offered); they engage the enemies of the staging area one each, the second hero defends and the last attacks, the Suspects first, so stage 3B ends when no Suspect is in play. Every other choice takes the last option (the one that costs no threat).
export const PONY_POLICY: PolicyOptions = { scout: "", prefer: "", protect: "", play: false, act: false };
// "strong": big-number heroes that win; "weak": heroes too small to quest, so the players lose on threat; "brittle": strong questers that die to an attack.
export type PonyDecks = "strong" | "weak" | "brittle";

export const ponyLoadout = fillerLoadout;

// The goldens' world and the start of a game: the seeded game's parts every scenario shares (test/harness/game-kit.ts).
export const ponyWorld = (decks: PonyDecks = "strong") => game.world(decks);
export const ponyStart = (seatCount: 1 | 2, seed: number, difficulty: Difficulty) => game.start(seatCount, seed, difficulty);

export type PonyPolicy = {
  // The option a Choose window with these answers takes: the first or the last.
  choose: "first" | "last";
};
export const DEFAULT_POLICY: PonyPolicy = { choose: "last" };

// The auto-player's answer (test/harness/auto-player.ts), except: a choice takes the first option, or the last as the policy says. Every intent is one the reducer listed.
// The enemies attacked first: a Suspect (stage 3B needs none in play), then any other.
const rankOf = (state: ScenarioState, ctx: ReduceContext, enemyId: string): number => (ctx.cards.get(state.cards[enemyId]?.code ?? "")?.traits?.includes("Suspect") ? 0 : 1);

export function ponyIntent(state: ScenarioState, ctx: ReduceContext, memory: Set<string>, policy: PonyPolicy = DEFAULT_POLICY): PlayerIntent {
  if (state.window?.kind === "choose") return { type: "Choose", optionId: (state.window.options.includes("accuse") ? "accuse" : policy.choose === "last" ? state.window.options.at(-1) : state.window.options[0]) ?? "" };
  if (state.window?.kind === "optionalEngage") return engageOneEach(state, ctx) ?? { type: "DeclineEngage" };
  if (state.window?.kind === "playerAttack") {
    const seat = state.seats[state.activeSeat];
    const attack = (seat?.heroes ?? []).map((one) => attackTogether(state, ctx, (id) => id === one, (id) => rankOf(state, ctx, id))).find((intent) => intent?.type === "DeclareAttackers" && !memory.has(`${state.round}:${intent.enemyId}`));
    if (attack?.type === "DeclareAttackers") {
      memory.add(`${state.round}:${attack.enemyId}`);
      return attack;
    }
  }
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
  return nextIntent(state, ctx, PONY_POLICY, memory, legalIntents(state, ctx));
}

export type PonyGame = PlayedGame;

// The goldens (src/campaign/scenarios/murder-at-the-prancing-pony/golden.test.ts). A standalone game has no earlier parts, Upgraded sides or Mode card.
export type PonyGolden = { name: string; seatCount: 1 | 2; seed: number; difficulty: Difficulty; decks: PonyDecks; outcome: "won" | "lost"; policy?: Partial<PonyPolicy>; lossReason?: string };

// The games to pin (at most 3000 intents in all, .claude/rules/code-standards.md, Test cost): wins true solo and two-handed on Normal, and the two ways to lose (threat 50, every hero destroyed). No Nightmare deck exists.
export const PONY_GOLDENS: readonly PonyGolden[] = [
  { name: "solo win", seatCount: 1, seed: 1, difficulty: "Normal", decks: "strong", outcome: "won" },
  { name: "two-handed win", seatCount: 2, seed: 2, difficulty: "Normal", decks: "strong", outcome: "won" },
  { name: "solo loss: threat 50", seatCount: 1, seed: 3, difficulty: "Normal", decks: "weak", outcome: "lost", lossReason: "No seats remain" },
  { name: "two-handed loss: every hero destroyed", seatCount: 2, seed: 4, difficulty: "Normal", decks: "brittle", outcome: "lost", lossReason: "No seats remain" },
];

const game = standaloneGame<PonyDecks, PonyPolicy>({
  campaign: cycle,
  scenario: pony,
  stats: HERO_STATS,
  codes: [...pony.cards.map((card) => card.code)],
  intent: ponyIntent,
  policy: DEFAULT_POLICY,
  limit: 6000,
});

export const playGolden = (golden: PonyGolden, ctx: ReduceContext): PonyGame => game.playGolden(golden, ctx);
