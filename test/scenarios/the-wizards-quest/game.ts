import type { Difficulty } from "../../../src/catalog/scenario-data.ts";
import { legalIntents, legalTargets, type PlayerIntent, type ReduceContext, type ScenarioState } from "../../../src/rules/engine/reduce.ts";

import { loadAnyScenario, loadCampaign } from "../../../scripts/data/load-scenarios.ts";
import { nextIntent, type PolicyOptions } from "../../harness/auto-player.ts";
import { attackTogether, engageOneEach, fillerLoadout, HERO_STATS, standaloneGame, type PlayedGame } from "../../harness/game-kit.ts";

const cycle = loadCampaign("standalone-scenarios");
const quest = loadAnyScenario("the-wizards-quest");

// Test helper. A whole standalone game of The Wizard's Quest played by the auto-player, true solo or two-handed. The heroes are big numbers (or too small to quest, or too brittle to survive an attack) and the decks free
// events, so the outcome depends on the engine, the seed and the encounter deck, not on player card play. There is no campaign: no checklist, no log, no earlier part, no Resolution. TODO: say how the players travel, engage and answer the choices this scenario asks.
export const QUEST_POLICY: PolicyOptions = { scout: "", prefer: "", protect: "", play: false, act: false };
// "strong": big-number heroes that win; "weak": heroes too small to quest, so the players lose on threat; "brittle": strong questers that die to an attack.
export type QuestDecks = "strong" | "weak" | "brittle";

export const questLoadout = fillerLoadout;

// The goldens' world and the start of a game: the seeded game's parts every scenario shares (test/harness/game-kit.ts).
export const questWorld = (decks: QuestDecks = "strong") => game.world(decks);
export const questStart = (seatCount: 1 | 2, seed: number, difficulty: Difficulty) => game.start(seatCount, seed, difficulty);

export type QuestPolicy = {
  // The option a Choose window with these answers takes: the first, the middle one (of three: the second) or the last. The first player's choices of the stage 2 and the stage 3 card are such windows.
  choose: "first" | "middle" | "last";
};
export const DEFAULT_POLICY: QuestPolicy = { choose: "first" };

// The auto-player's answer (test/harness/auto-player.ts), except: a choice takes the first option, the middle one or the last as the policy says (the stage choices). Every intent is one the reducer listed.
// The players travel to the first location they may, quest with one hero of a seat that has two (a seat with one hero keeps it to fight), engage the enemies of the staging area one each and attack in turn: the enemy that
// guards a hero first (Dungeons of the Necromancer cannot be defeated while one does), then Rider of Mirkwood (Return to Rhosgobel cannot be defeated while it is in play), then the rest.
const rankOf = (state: ScenarioState, enemyId: string): number => {
  if (Object.values(state.cards).some((card) => card.guardedHero === true && card.host === enemyId)) return 0;
  return state.cards[enemyId]?.code === "51011" ? 1 : 2;
};

export function questIntent(state: ScenarioState, ctx: ReduceContext, memory: Set<string>, policy: QuestPolicy = DEFAULT_POLICY): PlayerIntent {
  if (state.window?.kind === "choose") {
    const options = state.window.options;
    return { type: "Choose", optionId: (policy.choose === "last" ? options.at(-1) : policy.choose === "middle" ? options[Math.min(1, options.length - 1)] : options[0]) ?? "" };
  }
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
  if (state.window?.kind === "pass" && state.mode === "questCommit" && !Object.values(state.cards).some((card) => card.committed && card.controller === state.activeSeat)) {
    const ids = legalTargets(state, { type: "Commit" }, ctx);
    if (ids.length > 0 && (state.seats[state.activeSeat]?.heroes.length ?? 0) > 1) return { type: "Commit", cardIds: ids.slice(0, 1) };
  }
  if (state.window?.kind === "defense") {
    const heroes = state.seats[state.activeSeat]?.heroes ?? [];
    const attacker = heroes.at(-1);
    const defender = legalTargets(state, { type: "DeclareDefender" }, ctx).find((id) => id !== attacker && heroes.includes(id));
    if (defender) return { type: "DeclareDefender", defenderId: defender };
    const least = [...legalTargets(state, { type: "Undefended" }, ctx)].sort((left, right) => (state.cards[left]?.damage ?? 0) - (state.cards[right]?.damage ?? 0))[0];
    if (least) return { type: "Undefended", heroId: least };
  }
  return nextIntent(state, ctx, QUEST_POLICY, memory, legalIntents(state, ctx));
}

export type QuestGame = PlayedGame;

// The goldens (src/campaign/scenarios/the-wizards-quest/golden.test.ts). A standalone game has no earlier parts, Upgraded sides or Mode card.
export type QuestGolden = { name: string; seatCount: 1 | 2; seed: number; difficulty: Difficulty; decks: QuestDecks; outcome: "won" | "lost"; policy?: Partial<QuestPolicy>; lossReason?: string };

// The games to pin (a few hundred intents in all, .claude/rules/code-standards.md, Test cost): wins true solo and two-handed, each with another pair of stage cards (the policy's `choose` takes the first, the middle or the last option
// of the first player's stage 2 and stage 3 choices: A Fork in the Road and The Necromancer's Tower, Carried Away and Dungeons of the Necromancer, A New Terror Abroad and Return to Rhosgobel), and the two ways to lose: every player's
// threat at 50 (heroes too small to quest) and every hero destroyed (brittle heroes). No card of the scenario ends the game itself, it has no Easy twin and no Nightmare deck.
export const QUEST_GOLDENS: readonly QuestGolden[] = [
  { name: "solo win: A Fork in the Road, The Necromancer's Tower", seatCount: 1, seed: 1, difficulty: "Normal", decks: "strong", outcome: "won", policy: { choose: "first" } },
  { name: "two-handed win: Carried Away, Dungeons of the Necromancer", seatCount: 2, seed: 2, difficulty: "Normal", decks: "strong", outcome: "won", policy: { choose: "middle" } },
  { name: "solo win: A New Terror Abroad, Return to Rhosgobel", seatCount: 1, seed: 1, difficulty: "Normal", decks: "strong", outcome: "won", policy: { choose: "last" } },
  { name: "two-handed win: A New Terror Abroad, Return to Rhosgobel", seatCount: 2, seed: 2, difficulty: "Normal", decks: "strong", outcome: "won", policy: { choose: "last" } },
  { name: "solo loss: threat 50", seatCount: 1, seed: 2, difficulty: "Normal", decks: "weak", outcome: "lost", lossReason: "No seats remain" },
  { name: "two-handed loss: every hero destroyed", seatCount: 2, seed: 1, difficulty: "Normal", decks: "brittle", outcome: "lost", lossReason: "No seats remain" },
];

const game = standaloneGame<QuestDecks, QuestPolicy>({
  campaign: cycle,
  scenario: quest,
  stats: HERO_STATS,
  // TODO: the cards a game loads besides the scenario's piles and its Nightmare deck.
  codes: [...quest.cards.map((card) => card.code)],
  intent: questIntent,
  policy: DEFAULT_POLICY,
  limit: 6000,
});

export const playGolden = (golden: QuestGolden, ctx: ReduceContext): QuestGame => game.playGolden(golden, ctx);
