import type { Difficulty } from "../../../src/catalog/scenario-data.ts";
import { legalIntents, legalTargets, type PlayerIntent, type ReduceContext, type ScenarioState } from "../../../src/rules/engine/reduce.ts";

import { loadAnyScenario, loadCampaign } from "../../../scripts/data/load-scenarios.ts";
import { nextIntent, type PolicyOptions } from "../../harness/auto-player.ts";
import { attackTogether, engageOneEach, fillerLoadout, HERO_STATS, standaloneGame, type PlayedGame } from "../../harness/game-kit.ts";

const cycle = loadCampaign("shadows-of-mirkwood");
const deadmarshes = loadAnyScenario("the-dead-marshes");

// Test helper. A whole standalone game of The Dead Marshes played by the auto-player, true solo or two-handed. The heroes are big numbers (or too small to quest, or too brittle to survive an attack) and the decks free
// events, so the outcome depends on the engine, the seed and the encounter deck, not on player card play. There is no campaign: no checklist, no log, no earlier part, no Resolution. The players quest with all but one hero of a seat, that one staying ready for the escape tests; they engage and attack together, the travel phase goes to the first location offered, and a choice takes the first option.
export const DEADMARSHES_POLICY: PolicyOptions = { scout: "", prefer: "", protect: "", play: false, act: true };
// "strong": big-number heroes that win; "weak": heroes too small to quest, so the players lose on threat; "brittle": strong questers that die to an attack.
export type DeadmarshesDecks = "strong" | "weak" | "brittle";

export const deadmarshesLoadout = fillerLoadout;

// The goldens' world and the start of a game: the seeded game's parts every scenario shares (test/harness/game-kit.ts).
export const deadmarshesWorld = (decks: DeadmarshesDecks = "strong") => game.world(decks);
export const deadmarshesStart = (seatCount: 1 | 2, seed: number, difficulty: Difficulty) => game.start(seatCount, seed, difficulty);

export type DeadmarshesPolicy = {
  // The option a Choose window with these answers takes: the first or the last.
  choose: "first" | "last";
};
export const DEFAULT_POLICY: DeadmarshesPolicy = { choose: "first" };

// The auto-player's answer (test/harness/auto-player.ts), except: a choice takes the first option, or the last as the policy says; each seat's last hero stays home from the quest, ready to commit to the escape tests (a character that quested is exhausted and
// cannot commit, so a party that quests with everyone fails every test and Gollum fills up); each seat engages every enemy it may and the ready characters attack together. Every intent is one the reducer listed.
export function deadmarshesIntent(state: ScenarioState, ctx: ReduceContext, memory: Set<string>, policy: DeadmarshesPolicy = DEFAULT_POLICY, options: PolicyOptions = DEADMARSHES_POLICY): PlayerIntent {
  if (state.window?.kind === "choose") return { type: "Choose", optionId: (policy.choose === "last" ? state.window.options.at(-1) : state.window.options[0]) ?? "" };
  if (state.window?.kind === "pass" && state.mode === "questCommit" && !Object.values(state.cards).some((card) => card.committed && card.controller === state.activeSeat)) {
    const ids = legalTargets(state, { type: "Commit" }, ctx);
    if (ids.length > 1) return { type: "Commit", cardIds: ids.slice(0, -1) };
  }
  const engage = engageOneEach(state, ctx, 8);
  if (engage) return engage;
  const attack = attackTogether(state, ctx);
  if (attack) return attack;
  return nextIntent(state, ctx, options, memory, legalIntents(state, ctx));
}

export type DeadmarshesGame = PlayedGame;

// The goldens (src/campaign/scenarios/the-dead-marshes/golden.test.ts). A standalone game has no earlier parts, Upgraded sides or Mode card.
export type DeadmarshesGolden = { name: string; seatCount: 1 | 2; seed: number; difficulty: Difficulty; decks: DeadmarshesDecks; outcome: "won" | "lost"; policy?: Partial<DeadmarshesPolicy>; lossReason?: string };

// The games to pin (the first is the longest Normal win the reader parity test plays, src/play/reader-play/games.ts; about 600 intents in all, .claude/rules/code-standards.md, Test cost): wins true solo and two-handed on Normal (each with a quest deck reset after a failed
// capture), one on Easy and one two-handed on Nightmare, and the two ways the scenario is lost: every player's threat at 50 (heroes too weak to quest) and every hero destroyed (heroes that die to an attack), solo and two-handed Nightmare.
export const DEADMARSHES_GOLDENS: readonly DeadmarshesGolden[] = [
  { name: "two-handed win", seatCount: 2, seed: 4, difficulty: "Normal", decks: "strong", outcome: "won" },
  { name: "solo win", seatCount: 1, seed: 3, difficulty: "Normal", decks: "strong", outcome: "won" },
  { name: "Easy solo win", seatCount: 1, seed: 2, difficulty: "Easy", decks: "strong", outcome: "won" },
  { name: "Nightmare two-handed win", seatCount: 2, seed: 5, difficulty: "Nightmare", decks: "strong", outcome: "won" },
  { name: "solo loss: threat 50", seatCount: 1, seed: 1, difficulty: "Normal", decks: "weak", outcome: "lost", lossReason: "No seats remain" },
  { name: "solo loss: every hero destroyed", seatCount: 1, seed: 3, difficulty: "Normal", decks: "brittle", outcome: "lost", lossReason: "No seats remain" },
  { name: "Nightmare two-handed loss: every hero destroyed", seatCount: 2, seed: 1, difficulty: "Nightmare", decks: "brittle", outcome: "lost", lossReason: "No seats remain" },
];

const game = standaloneGame<DeadmarshesDecks, DeadmarshesPolicy>({
  campaign: cycle,
  scenario: deadmarshes,
  stats: HERO_STATS,
  codes: [...deadmarshes.cards.map((card) => card.code)],
  intent: deadmarshesIntent,
  policy: DEFAULT_POLICY,
  limit: 6000,
});

export const playGolden = (golden: DeadmarshesGolden, ctx: ReduceContext): DeadmarshesGame => game.playGolden(golden, ctx);
