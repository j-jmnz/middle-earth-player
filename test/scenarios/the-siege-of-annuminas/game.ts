import type { Difficulty } from "../../../src/catalog/scenario-data.ts";
import { legalIntents, legalTargets, type PlayerIntent, type ReduceContext, type ScenarioState } from "../../../src/rules/engine/reduce.ts";

import { loadAnyScenario, loadCampaign } from "../../../scripts/data/load-scenarios.ts";
import { nextIntent, type PolicyOptions } from "../../harness/auto-player.ts";
import { attackTogether, engageOneEach, fillerLoadout, HERO_STATS, standaloneGame, type PlayedGame } from "../../harness/game-kit.ts";

const cycle = loadCampaign("standalone-scenarios");
const annuminas = loadAnyScenario("the-siege-of-annuminas");

// Test helper. A whole standalone game of The Siege of Annúminas played by the auto-player, true solo or two-handed. The heroes are big numbers (or too small to quest, or too brittle to survive an attack) and the decks free
// events, so the outcome depends on the engine, the seed and the encounter deck, not on player card play. There is no campaign: no checklist, no log, no earlier part, no Resolution. The players travel to the Battering Ram first (stage 3A leaves it active, its progress bar lifts when it is explored), quest with one hero, engage the enemies of the staging area one each and attack in turn, the Lieutenant of Angmar first, and take every Response (the +10 city strength of stage 1B).
export const ANNUMINAS_POLICY: PolicyOptions = { scout: "", prefer: "50814", protect: "", play: false, act: true };
// "strong": big-number heroes that win; "weak": heroes too small to quest, so the players lose on threat; "brittle": strong questers that die to an attack.
export type AnnuminasDecks = "strong" | "weak" | "brittle";

export const annuminasLoadout = fillerLoadout;

// The goldens' world and the start of a game: the seeded game's parts every scenario shares (test/harness/game-kit.ts).
export const annuminasWorld = (decks: AnnuminasDecks = "strong") => game.world(decks);
export const annuminasStart = (seatCount: 1 | 2, seed: number, difficulty: Difficulty) => game.start(seatCount, seed, difficulty);

export type AnnuminasPolicy = {
  // The option a Choose window with these answers takes: the first or the last.
  choose: "first" | "last";
  // The heroes a seat sends to the quest: the others defend and attack.
  questers: number;
};
export const DEFAULT_POLICY: AnnuminasPolicy = { choose: "first", questers: 1 };

// The auto-player's answer (test/harness/auto-player.ts), except: a choice takes the first option, or the last as the policy says; the players engage the enemies of the staging area one each and every hero attacks in turn. Every intent is one the reducer listed.
// The enemies attacked first: the Lieutenant of Angmar the players must destroy, then the Host of Angmar (each in the victory display lowers stage 2B's quest points), then any other.
const rankOf = (state: ScenarioState, enemyId: string): number => {
  const code = state.cards[enemyId]?.code;
  return code === "50813" ? 0 : code === "50817" ? 1 : 2;
};

export function annuminasIntent(state: ScenarioState, ctx: ReduceContext, memory: Set<string>, policy: AnnuminasPolicy = DEFAULT_POLICY): PlayerIntent {
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
  // The first heroes of a seat quest, the next defends and the last attacks (a character that quested or defended is exhausted, so a hero that does neither is ready for the combat phase).
  if (state.window?.kind === "pass" && state.mode === "questCommit" && !Object.values(state.cards).some((card) => card.committed && card.controller === state.activeSeat)) {
    const ids = legalTargets(state, { type: "Commit" }, ctx);
    if (ids.length > 0) return { type: "Commit", cardIds: ids.slice(0, policy.questers) };
  }
  if (state.window?.kind === "defense") {
    const heroes = state.seats[state.activeSeat]?.heroes ?? [];
    const attacker = heroes.at(-1);
    const defender = legalTargets(state, { type: "DeclareDefender" }, ctx).find((id) => id !== attacker && heroes.includes(id));
    if (defender) return { type: "DeclareDefender", defenderId: defender };
    const least = [...legalTargets(state, { type: "Undefended" }, ctx)].sort((left, right) => (state.cards[left]?.damage ?? 0) - (state.cards[right]?.damage ?? 0))[0];
    if (least) return { type: "Undefended", heroId: least };
  }
  return nextIntent(state, ctx, ANNUMINAS_POLICY, memory, legalIntents(state, ctx));
}

export type AnnuminasGame = PlayedGame;

// The goldens (src/campaign/scenarios/the-siege-of-annuminas/golden.test.ts). A standalone game has no earlier parts, Upgraded sides or Mode card.
export type AnnuminasGolden = { name: string; seatCount: 1 | 2; seed: number; difficulty: Difficulty; decks: AnnuminasDecks; outcome: "won" | "lost"; policy?: Partial<AnnuminasPolicy>; lossReason?: string };

// The games to pin (about 1100 intents in all, .claude/rules/code-standards.md, Test cost): wins true solo and two-handed on Normal (one hero quests, the others engage and attack, so the Lieutenant of Angmar is destroyed at stage 3B once
// the Battering Ram is explored and 10 progress stands), and the three ways to lose: the city strength at 0 (strong heroes, two-handed, that cannot kill the Lieutenant in time), every player's threat at 50 (heroes too small to quest) and
// every hero destroyed (brittle heroes). The scenario has no Nightmare deck.
export const ANNUMINAS_GOLDENS: readonly AnnuminasGolden[] = [
  { name: "solo win", seatCount: 1, seed: 1, difficulty: "Normal", decks: "strong", outcome: "won" },
  { name: "two-handed win", seatCount: 2, seed: 5, difficulty: "Normal", decks: "strong", outcome: "won" },
  { name: "two-handed loss: city strength 0", seatCount: 2, seed: 6, difficulty: "Normal", decks: "strong", outcome: "lost", lossReason: "The city of Annúminas was overrun: its city strength reached 0" },
  { name: "solo loss: threat 50", seatCount: 1, seed: 3, difficulty: "Normal", decks: "weak", outcome: "lost", lossReason: "No seats remain" },
  { name: "two-handed loss: every hero destroyed", seatCount: 2, seed: 2, difficulty: "Normal", decks: "brittle", outcome: "lost", lossReason: "No seats remain" },
];

const game = standaloneGame<AnnuminasDecks, AnnuminasPolicy>({
  campaign: cycle,
  scenario: annuminas,
  stats: HERO_STATS,
  codes: [...annuminas.cards.map((card) => card.code)],
  intent: annuminasIntent,
  policy: DEFAULT_POLICY,
  limit: 6000,
});

export const playGolden = (golden: AnnuminasGolden, ctx: ReduceContext): AnnuminasGame => game.playGolden(golden, ctx);
