import type { Difficulty } from "../../../src/catalog/scenario-data.ts";
import type { PlayerIntent, ReduceContext, ScenarioState } from "../../../src/rules/engine/reduce.ts";

import { loadAnyScenario, loadCampaign } from "../../../scripts/data/load-scenarios.ts";
import type { PolicyOptions } from "../../harness/auto-player.ts";
import { fillerLoadout, HERO_STATS, standaloneGame, type PlayedGame } from "../../harness/game-kit.ts";
import { archeryLeastDamaged, attackAllTogether, chooseFirstOrLast, commitAllBut, policyIntent, travelFewestQuestPoints, undefendedLeastDamaged, type Policy } from "../../harness/policy-kit.ts";

const cycle = loadCampaign("haradrim");
const sands = loadAnyScenario("beneath-the-sands");

// Test helper. A whole standalone game of Beneath the Sands played by the auto-player, true solo or two-handed. The heroes are big numbers (or too small to quest, or too brittle to survive an attack) and the decks free
// events, so the outcome depends on the engine, the seed and the encounter deck, not on player card play. There is no campaign: no checklist, no log, no earlier part, no Resolution. The players commit every hero but one to the quest (the one that stays home attacks), travel to the location with the fewest quest points, nobody defends (the hero with the least damage takes an attack), the first Distribute puts all the archery damage on the least damaged character, the heroes attack together every enemy they reach and every choice takes its first option.
export const SANDS_POLICY: PolicyOptions = { scout: "", prefer: "", protect: "", play: false, act: false };
// "strong": big-number heroes that win; "weak": heroes too small to quest; "brittle": strong questers that die to an attack; "tense": strong heroes that start at a threat of 14, so the threat reaches 50.
export type SandsDecks = "strong" | "weak" | "brittle" | "tense";

export const sandsLoadout = fillerLoadout;

// The goldens' world and the start of a game: the seeded game's parts every scenario shares (test/harness/game-kit.ts).
export const sandsWorld = (decks: SandsDecks = "strong") => game.world(decks);
export const sandsStart = (seatCount: 1 | 2, seed: number, difficulty: Difficulty) => game.start(seatCount, seed, difficulty);

export type SandsPolicy = {
  // The option a Choose window with these answers takes: the first or the last.
  choose: "first" | "last";
};
export const DEFAULT_POLICY: SandsPolicy = { choose: "first" };

// The policy (test/harness/policy-kit.ts): a list of rules tried in order, then the auto-player's answer with SANDS_POLICY. A rule answers its own window and returns null for any other. The kit's rules:
//   chooseFirstOrLast(which)  a Choose window takes the first or the last option
//   chooseOption(wanted, otherwise)  a Choose window takes the option `wanted` names for the options offered, else the first or last
//   commitAllBut(reserve, keepHome)  the quest commit: every character but the last `reserve` heroes (and those `keepHome` names)
//   travelFewestQuestPoints(allow)  a travel window: the location with the fewest quest points (one `allow` permits), else decline
//   declineTravel()  a travel window: decline
//   defendFirst(perRound)  a defense window: the first character who may defends (the first `perRound` attacks of a seat's round), else the first hero is undefended
//   undefendedLeastDamaged(except)  a defense window: nobody defends, the least damaged hero takes the attack (the others stay ready to attack)
//   archeryLeastDamaged(skip)  an archery window: all the damage to the least damaged character
//   attackAllTogether(rank, may)  the player attack window: every ready character attacks the enemy of the lowest `rank` (else the first) together
//   attackEach(options)  the player attack window: the first ready character attacks alone, so each takes a different enemy when `once`
//   declineAttack()  the player attack window: decline to attack
//   engageUpTo(most, options)  the optional engagement step: engage the enemy of the lowest `rank` (`allow` permits) while engaged with fewer than `most`
//   triggerActions(effectIds, oncePerRound)  an Action or Response of the records named, each time (or once a round) the engine offers it and the seat can pay
//   passCommitWhile(when)  the quest commit: pass without committing while `when` holds
const rules = (policy: SandsPolicy): Policy => [chooseFirstOrLast(policy.choose), commitAllBut(1), travelFewestQuestPoints(), archeryLeastDamaged(), undefendedLeastDamaged(), attackAllTogether()];

// Every intent is one the reducer listed.
export function sandsIntent(state: ScenarioState, ctx: ReduceContext, memory: Set<string>, policy: SandsPolicy = DEFAULT_POLICY): PlayerIntent {
  return policyIntent(rules(policy), SANDS_POLICY, state, ctx, memory);
}

export type SandsGame = PlayedGame;

// The goldens (src/campaign/scenarios/beneath-the-sands/golden.test.ts). A standalone game has no earlier parts, Upgraded sides or Mode card.
export type SandsGolden = { name: string; seatCount: 1 | 2; seed: number; difficulty: Difficulty; decks: SandsDecks; outcome: "won" | "lost"; policy?: Partial<SandsPolicy>; lossReason?: string };

// The games to pin (.claude/rules/code-standards.md, Test cost): wins true solo and two-handed on Normal and true solo on Easy, and the two ways to lose (the scenario prints no loss of its own: every hero destroyed or every player at a threat of 50, both the engine's "No seats remain"), true solo, and two-handed once, where one seat's heroes are destroyed while the other seat plays on (a path no solo game reaches).
export const SANDS_GOLDENS: readonly SandsGolden[] = [
  { name: "true solo, won, Normal", seatCount: 1, seed: 6, difficulty: "Normal", decks: "strong", outcome: "won" },
  { name: "two-handed, won, Normal", seatCount: 2, seed: 1, difficulty: "Normal", decks: "strong", outcome: "won" },
  { name: "true solo, won, Easy", seatCount: 1, seed: 5, difficulty: "Easy", decks: "strong", outcome: "won" },
  { name: "true solo, lost, threat reaches 50", seatCount: 1, seed: 1, difficulty: "Normal", decks: "tense", outcome: "lost", lossReason: "No seats remain" },
  { name: "true solo, lost, every hero destroyed", seatCount: 1, seed: 5, difficulty: "Normal", decks: "brittle", outcome: "lost", lossReason: "No seats remain" },
  { name: "two-handed, lost, one seat out while the other plays on", seatCount: 2, seed: 5, difficulty: "Normal", decks: "brittle", outcome: "lost", lossReason: "No seats remain" },
];

const game = standaloneGame<SandsDecks, SandsPolicy>({
  campaign: cycle,
  scenario: sands,
  stats: HERO_STATS,
  // The Search objective's two sides: the staged card is one code and its back another.
  codes: [...sands.cards.map((card) => card.code), "17079", "17080"],
  intent: sandsIntent,
  policy: DEFAULT_POLICY,
  limit: 6000,
});

export const playGolden = (golden: SandsGolden, ctx: ReduceContext): SandsGame => game.playGolden(golden, ctx, { trail: true });
