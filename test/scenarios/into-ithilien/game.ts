import type { Difficulty } from "../../../src/catalog/scenario-data.ts";
import { legalIntents, legalTargets, type PlayerIntent, type ReduceContext, type ScenarioState } from "../../../src/rules/engine/reduce.ts";

import { loadAnyScenario, loadCampaign } from "../../../scripts/data/load-scenarios.ts";
import { nextIntent, type PolicyOptions } from "../../harness/auto-player.ts";
import { attackTogether, engageOneEach, fillerLoadout, HERO_STATS, standaloneGame, type PlayedGame } from "../../harness/game-kit.ts";

const cycle = loadCampaign("against-the-shadow");
const ithilien = loadAnyScenario("into-ithilien");

// Test helper. A whole standalone game of Into Ithilien played by the auto-player, true solo or two-handed. The heroes are big numbers (or too small to quest, or too brittle to survive an attack) and the decks free
// events, so the outcome depends on the engine, the seed and the encounter deck, not on player card play. There is no campaign: no checklist, no log, no earlier part, no Resolution. The third hero of the first player (q3) stays out of the quest, so a ready hero is left to defend and attack. Every seat commits its other characters (the Battle and Siege stages count Attack and Defense, and the stand-in heroes are strong in all three), defends with the first hero who can, engages one enemy each, attacks together, and answers every choice with its first option. Archery damage goes to the least damaged hero: never to Celador or an Ithilien Guardian in the staging area (the stage skips only while Celador is in the staging area, and he leaves play at 3 damage).
export const ITHILIEN_POLICY: PolicyOptions = { scout: "q3", prefer: "", protect: "", play: false, act: true };
// "strong": big-number heroes that win; "weak": heroes too small to quest, so the players lose on threat; "brittle": strong questers that die to an attack.
export type IthilienDecks = "strong" | "weak" | "brittle";

export const ithilienLoadout = fillerLoadout;

// The goldens' world and the start of a game: the seeded game's parts every scenario shares (test/harness/game-kit.ts).
export const ithilienWorld = (decks: IthilienDecks = "strong") => game.world(decks);
export const ithilienStart = (seatCount: 1 | 2, seed: number, difficulty: Difficulty) => game.start(seatCount, seed, difficulty);

export type IthilienPolicy = {
  // The option a Choose window with these answers takes: the first or the last.
  choose: "first" | "last";
  // The seats commit nobody on stage 1 (Ambush in Ithilien) in this many first rounds, so Celador alone quests with his Attack of 2: the stage is not defeated at once and, if Celador is destroyed
  // in the staging area meanwhile, the quest card is not bypassed and stage 2 is played.
  holdRounds: number;
};
export const DEFAULT_POLICY: IthilienPolicy = { choose: "first", holdRounds: 0 };

/** The archery policy of every game of this scenario (the goldens and the saved fixtures): the damage goes to the least damaged character, never to a staged ally objective (Celador, an Ithilien Guardian). Null outside an archery window. */
export function archeryAnswer(state: ScenarioState, ctx: ReduceContext): PlayerIntent | null {
  if (state.window?.kind !== "archery") return null;
  const heroes = legalTargets(state, { type: "Distribute" }, ctx).filter((id) => !["05025", "05026"].includes(state.cards[id]?.code ?? ""));
  const least = [...heroes].sort((left, right) => (state.cards[left]?.damage ?? 0) - (state.cards[right]?.damage ?? 0))[0];
  return least ? { type: "Distribute", assignments: [{ cardId: least, amount: state.window.total }] } : null;
}

// The auto-player's answer (test/harness/auto-player.ts), except: a choice takes the first option, or the last as the policy says. Every intent is one the reducer listed.
export function ithilienIntent(state: ScenarioState, ctx: ReduceContext, memory: Set<string>, policy: IthilienPolicy = DEFAULT_POLICY): PlayerIntent {
  if (state.window?.kind === "choose") return { type: "Choose", optionId: (policy.choose === "last" ? state.window.options.at(-1) : state.window.options[0]) ?? "" };
  const archery = archeryAnswer(state, ctx);
  if (archery) return archery;
  if (state.round <= policy.holdRounds && state.mode === "questCommit" && state.window?.kind === "pass" && state.cards[state.questStage ?? ""]?.code === "05068") return { type: "Pass" };
  const attack = attackTogether(state, ctx);
  if (attack) return attack;
  const engage = engageOneEach(state, ctx, 6);
  if (engage) return engage;
  return nextIntent(state, ctx, ITHILIEN_POLICY, memory, legalIntents(state, ctx));
}

export type IthilienGame = PlayedGame;

// The goldens (src/campaign/scenarios/into-ithilien/golden.test.ts). A standalone game has no earlier parts, Upgraded sides or Mode card.
export type IthilienGolden = { name: string; seatCount: 1 | 2; seed: number; difficulty: Difficulty; decks: IthilienDecks; outcome: "won" | "lost"; policy?: Partial<IthilienPolicy>; lossReason?: string };

// The games to pin (.claude/rules/code-standards.md, Test cost): the four Normal wins, true solo and two-handed, through both paths of stage 1B (it skips stage 2 only while Celador is in the staging area), one Easy win and one loss for each way to lose:
// "skip" games quest with every seat at once, so Celador is in the staging area when Ambush in Ithilien is defeated and Southron Counter-attack is bypassed; "stage 2" games hold the heroes back for two rounds (`holdRounds`), so Celador is
// destroyed in the staging area first and Southron Counter-attack is played. The losses are the two ways to lose here: the threat of every player at 50 (heroes too weak to quest, solo) and every hero destroyed (heroes too brittle, two-handed).
// The scenario has no Nightmare deck and no card that loses the game.
export const ITHILIEN_GOLDENS: readonly IthilienGolden[] = [
  { name: "solo win, stage 2 bypassed", seatCount: 1, seed: 5, difficulty: "Normal", decks: "strong", outcome: "won" },
  { name: "two-handed win, stage 2 bypassed", seatCount: 2, seed: 4, difficulty: "Normal", decks: "strong", outcome: "won" },
  { name: "solo win, stage 2 played", seatCount: 1, seed: 11, difficulty: "Normal", decks: "strong", outcome: "won", policy: { holdRounds: 2 } },
  { name: "two-handed win, stage 2 played", seatCount: 2, seed: 1, difficulty: "Normal", decks: "strong", outcome: "won", policy: { holdRounds: 2 } },
  { name: "Easy solo win, stage 2 played", seatCount: 1, seed: 2, difficulty: "Easy", decks: "strong", outcome: "won", policy: { holdRounds: 2 } },
  { name: "solo loss: threat 50", seatCount: 1, seed: 2, difficulty: "Normal", decks: "weak", outcome: "lost", lossReason: "No seats remain" },
  { name: "two-handed loss: every hero destroyed", seatCount: 2, seed: 11, difficulty: "Normal", decks: "brittle", outcome: "lost", lossReason: "No seats remain", policy: { holdRounds: 99 } },
];

const game = standaloneGame<IthilienDecks, IthilienPolicy>({
  campaign: cycle,
  scenario: ithilien,
  stats: HERO_STATS,
  codes: [...ithilien.cards.map((card) => card.code)],
  intent: ithilienIntent,
  policy: DEFAULT_POLICY,
  limit: 6000,
});

export const playGolden = (golden: IthilienGolden, ctx: ReduceContext): IthilienGame => game.playGolden(golden, ctx);
