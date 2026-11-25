import type { Difficulty } from "../../../src/catalog/scenario-data.ts";
import { legalIntents, legalTargets, type PlayerIntent, type ReduceContext, type ScenarioState } from "../../../src/rules/engine/reduce.ts";

import { loadAnyScenario, loadCampaign } from "../../../scripts/data/load-scenarios.ts";
import { nextIntent, type PolicyOptions } from "../../harness/auto-player.ts";
import { attackTogether, engageOneEach, fillerLoadout, HERO_STATS, standaloneGame, type HeroStats, type PlayedGame } from "../../harness/game-kit.ts";

const cycle = loadCampaign("against-the-shadow");
const andros = loadAnyScenario("the-siege-of-cair-andros");

// Test helper. A whole standalone game of The Siege of Cair Andros played by the auto-player, true solo or two-handed. The heroes are big numbers (or too small to quest, or too brittle to survive an attack) and the decks free
// events, so the outcome depends on the engine, the seed and the encounter deck, not on player card play. There is no campaign: no checklist, no log, no earlier part, no Resolution. The last hero of each seat stays out of the quest
// (`reserve`), so a ready hero is left to defend and attack: an undefended attack on stage 1 damages a Battleground location instead of a hero. Every seat commits its other characters, and the engine counts the stat the stage names
// (Defense on the Siege stages 1, 4 and 5, Attack on the Battle stage 3 and on stage 5 after 4 victory points, Willpower on stage 2), so the heroes' Defense and Attack are both big. A seat engages one enemy for each hero, attacks
// together, defends with the first hero who can and answers every choice with its first option. Archery damage goes to the least damaged hero.
export const ANDROS_POLICY: PolicyOptions = { scout: "", prefer: "", protect: "", play: false, act: true };
// "strong": big-number heroes that win; "weak": heroes too small to quest, so the players lose on threat; "brittle": strong questers that die to an attack.
export type AndrosDecks = "strong" | "weak" | "brittle";
// The numbers of the stand-in heroes: the shared ones, with a Defense big enough to quest through a Siege stage.
const ANDROS_STATS = { strong: { ...HERO_STATS.strong, defense: 14 }, weak: HERO_STATS.weak, brittle: { ...HERO_STATS.brittle, defense: 14 } } as const satisfies Record<AndrosDecks, HeroStats>;

export const androsLoadout = fillerLoadout;

// The goldens' world and the start of a game: the seeded game's parts every scenario shares (test/harness/game-kit.ts).
export const androsWorld = (decks: AndrosDecks = "strong") => game.world(decks);
export const androsStart = (seatCount: 1 | 2, seed: number, difficulty: Difficulty) => game.start(seatCount, seed, difficulty);

export type AndrosPolicy = {
  // The option a Choose window with these answers takes: the first or the last.
  choose: "first" | "last";
  // Heroes of each seat kept out of the quest, so they can defend and attack.
  reserve: number;
  // Whether the players travel to a location when they may. Without it the progress of every quest goes to the stage, so no Battleground location is explored and no stage is removed.
  travel: boolean;
};
export const DEFAULT_POLICY: AndrosPolicy = { choose: "first", reserve: 1, travel: true };

/** The archery policy of every game of this scenario (the goldens and the saved fixtures): the damage goes to the least damaged character. Null outside an archery window. */
export function archeryAnswer(state: ScenarioState, ctx: ReduceContext): PlayerIntent | null {
  if (state.window?.kind !== "archery") return null;
  const targets = legalTargets(state, { type: "Distribute" }, ctx);
  const least = [...targets].sort((left, right) => (state.cards[left]?.damage ?? 0) - (state.cards[right]?.damage ?? 0))[0];
  return least ? { type: "Distribute", assignments: [{ cardId: least, amount: state.window.total }] } : null;
}

/** The quest commit of the seat: its characters but the last `reserve` heroes. Null outside the commit, or when the seat has committed. */
export function commitAnswer(state: ScenarioState, ctx: ReduceContext, reserve: number): PlayerIntent | null {
  if (state.mode !== "questCommit" || state.window?.kind !== "pass") return null;
  if (Object.values(state.cards).some((card) => card.committed && card.controller === state.activeSeat)) return null;
  const home = new Set((state.seats[state.activeSeat]?.heroes ?? []).slice(-reserve));
  const ids = legalTargets(state, { type: "Commit" }, ctx).filter((id) => !home.has(id));
  return ids.length > 0 ? { type: "Commit", cardIds: ids } : null;
}

// The auto-player's answer (test/harness/auto-player.ts), except: a choice takes the first option, or the last as the policy says, the seat keeps its reserve out of the quest, attacks together and engages one enemy for each hero.
// Every intent is one the reducer listed.
export function androsIntent(state: ScenarioState, ctx: ReduceContext, memory: Set<string>, policy: AndrosPolicy = DEFAULT_POLICY): PlayerIntent {
  if (state.window?.kind === "choose") return { type: "Choose", optionId: (policy.choose === "last" ? state.window.options.at(-1) : state.window.options[0]) ?? "" };
  if (state.window?.kind === "travel" && !policy.travel) return { type: "DeclineTravel" };
  const archery = archeryAnswer(state, ctx);
  if (archery) return archery;
  const commit = commitAnswer(state, ctx, policy.reserve);
  if (commit) return commit;
  const attack = attackTogether(state, ctx);
  if (attack) return attack;
  const engage = engageOneEach(state, ctx, 6);
  if (engage) return engage;
  return nextIntent(state, ctx, ANDROS_POLICY, memory, legalIntents(state, ctx));
}

export type AndrosGame = PlayedGame;

// The goldens (src/campaign/scenarios/the-siege-of-cair-andros/golden.test.ts). A standalone game has no earlier parts, Upgraded sides or Mode card.
export type AndrosGolden = { name: string; seatCount: 1 | 2; seed: number; difficulty: Difficulty; decks: AndrosDecks; outcome: "won" | "lost"; policy?: Partial<AndrosPolicy>; lossReason?: string };

// The games to pin (.claude/rules/code-standards.md, Test cost): three wins on three paths through the five stages and one Easy win, and a loss for each way to lose. The paths:
// - "all five stages": the players never travel (`travel: false`), so no Battleground location is explored, no stage is removed and The Last Battle (Siege, no victory points) ends the game;
// - "Banks destroyed": The Banks takes 3 damage and is removed from the game (no victory points, no stage set aside by it), and The Citadel is explored: its Response removes stage 4 (Breakthrough at the Citadel), so The Last Battle follows stage 3 as a Siege stage with 3 victory points;
// - "Last Battle as Battle": the three Battleground locations are explored (6 victory points). The Citadel's Response removes stage 4; the Responses of The Approach and The Banks find stages 3 and 2 already played, so they remove nothing, and The Last Battle counts Attack.
// The Easy win follows the same path as "Last Battle as Battle". The losses are the two ways to lose here: the threat of every player at 50 (heroes too weak to quest, solo) and every hero destroyed (heroes too brittle, two-handed).
export const ANDROS_GOLDENS: readonly AndrosGolden[] = [
  { name: "solo win, all five stages", seatCount: 1, seed: 3, difficulty: "Normal", decks: "strong", outcome: "won", policy: { travel: false } },
  { name: "two-handed win, Banks destroyed", seatCount: 2, seed: 9, difficulty: "Normal", decks: "strong", outcome: "won" },
  { name: "two-handed win, Last Battle as Battle", seatCount: 2, seed: 6, difficulty: "Normal", decks: "strong", outcome: "won" },
  { name: "Easy solo win, all three locations explored", seatCount: 1, seed: 2, difficulty: "Easy", decks: "strong", outcome: "won" },
  { name: "solo loss: threat 50", seatCount: 1, seed: 2, difficulty: "Normal", decks: "weak", outcome: "lost", lossReason: "No seats remain" },
  { name: "two-handed loss: every hero destroyed", seatCount: 2, seed: 4, difficulty: "Normal", decks: "brittle", outcome: "lost", lossReason: "No seats remain" },
];

const game = standaloneGame<AndrosDecks, AndrosPolicy>({
  campaign: cycle,
  scenario: andros,
  stats: ANDROS_STATS,
  codes: [...andros.cards.map((card) => card.code)],
  intent: androsIntent,
  policy: DEFAULT_POLICY,
  limit: 6000,
});

export const playGolden = (golden: AndrosGolden, ctx: ReduceContext): AndrosGame => game.playGolden(golden, ctx);
