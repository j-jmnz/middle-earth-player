import type { Difficulty } from "../../../src/catalog/scenario-data.ts";
import { legalIntents, type PlayerIntent, type ReduceContext, type ScenarioState } from "../../../src/rules/engine/reduce.ts";

import { loadAnyScenario, loadCampaign } from "../../../scripts/data/load-scenarios.ts";
import { nextIntent, type PolicyOptions } from "../../harness/auto-player.ts";
import { attackTogether, engageOneEach, fillerLoadout, HERO_STATS, standaloneGame, type PlayedGame } from "../../harness/game-kit.ts";

const cycle = loadCampaign("shadows-of-mirkwood");
const muil = loadAnyScenario("the-hills-of-emyn-muil");

// Test helper. A whole standalone game of The Hills of Emyn Muil played by the auto-player, true solo or two-handed. The heroes are big numbers (or too small to quest, or too brittle to survive an attack) and the decks free
// events, so the outcome depends on the engine, the seed and the encounter deck, not on player card play. There is no campaign: no checklist, no log, no earlier part, no Resolution. TODO: say how the players travel, engage and answer the choices this scenario asks.
export const MUIL_POLICY: PolicyOptions = { scout: "", prefer: "", protect: "", play: false, act: true };
// "strong": big-number heroes that win; "weak": heroes too small to quest, so the players lose on threat; "brittle": strong questers that die to an attack.
export type MuilDecks = "strong" | "weak" | "brittle";

export const muilLoadout = fillerLoadout;

// The goldens' world and the start of a game: the seeded game's parts every scenario shares (test/harness/game-kit.ts).
export const muilWorld = (decks: MuilDecks = "strong") => game.world(decks);
export const muilStart = (seatCount: 1 | 2, seed: number, difficulty: Difficulty) => game.start(seatCount, seed, difficulty);

export type MuilPolicy = {
  // The option a Choose window with these answers takes: the first or the last.
  choose: "first" | "last";
};
export const DEFAULT_POLICY: MuilPolicy = { choose: "first" };

// The auto-player's answer (test/harness/auto-player.ts), except: a choice takes the first option, or the last as the policy says. Every intent is one the reducer listed.
// The players clear the Emyn Muil locations: every character quests, so the progress lands on the active location and the quest card; each seat engages every enemy it may, one at a time, and the ready characters attack the first enemy any can reach
// together, so the Orcs do not pile up in the staging area (the Orc Horse Thieves' Attack grows with the locations there); a defender takes every attack he can; the travel phase goes to the first location offered. `options` are the auto-player's for everything
// else (the Maestro fixtures play real decklists with `play: true`).
export function muilIntent(state: ScenarioState, ctx: ReduceContext, memory: Set<string>, policy: MuilPolicy = DEFAULT_POLICY, options: PolicyOptions = MUIL_POLICY): PlayerIntent {
  if (state.window?.kind === "choose") return { type: "Choose", optionId: (policy.choose === "last" ? state.window.options.at(-1) : state.window.options[0]) ?? "" };
  const engage = engageOneEach(state, ctx, 8);
  if (engage) return engage;
  const attack = attackTogether(state, ctx);
  if (attack) return attack;
  return nextIntent(state, ctx, options, memory, legalIntents(state, ctx));
}

export type MuilGame = PlayedGame;

// The goldens (src/campaign/scenarios/the-hills-of-emyn-muil/golden.test.ts). A standalone game has no earlier parts, Upgraded sides or Mode card.
export type MuilGolden = { name: string; seatCount: 1 | 2; seed: number; difficulty: Difficulty; decks: MuilDecks; outcome: "won" | "lost"; policy?: Partial<MuilPolicy>; lossReason?: string };

// The games to pin (the first is the longest win the reader parity test plays, src/play/reader-play/games.ts; about 700 intents in all, .claude/rules/code-standards.md, Test cost): wins true solo and two-handed on Normal, one on Easy and one two-handed on
// Nightmare, and the two ways the scenario is lost: every player's threat at 50 (heroes too weak to quest) and every hero destroyed (heroes that die to an attack), solo and two-handed. A win needs the quest's one progress, no Emyn Muil location in play and
// 20 Victory points in the display.
export const MUIL_GOLDENS: readonly MuilGolden[] = [
  { name: "two-handed win", seatCount: 2, seed: 1, difficulty: "Normal", decks: "strong", outcome: "won" },
  { name: "solo win", seatCount: 1, seed: 1, difficulty: "Normal", decks: "strong", outcome: "won" },
  { name: "Easy solo win", seatCount: 1, seed: 3, difficulty: "Easy", decks: "strong", outcome: "won" },
  { name: "Nightmare two-handed win", seatCount: 2, seed: 5, difficulty: "Nightmare", decks: "strong", outcome: "won" },
  { name: "solo loss: threat 50", seatCount: 1, seed: 1, difficulty: "Normal", decks: "weak", outcome: "lost", lossReason: "No seats remain" },
  { name: "solo loss: every hero destroyed", seatCount: 1, seed: 2, difficulty: "Normal", decks: "brittle", outcome: "lost", lossReason: "No seats remain" },
  { name: "two-handed loss: every hero destroyed", seatCount: 2, seed: 2, difficulty: "Normal", decks: "brittle", outcome: "lost", lossReason: "No seats remain" },
];

const game = standaloneGame<MuilDecks, MuilPolicy>({
  campaign: cycle,
  scenario: muil,
  stats: HERO_STATS,
  codes: [...muil.cards.map((card) => card.code)],
  intent: muilIntent,
  policy: DEFAULT_POLICY,
  limit: 6000,
});

export const playGolden = (golden: MuilGolden, ctx: ReduceContext): MuilGame => game.playGolden(golden, ctx);
