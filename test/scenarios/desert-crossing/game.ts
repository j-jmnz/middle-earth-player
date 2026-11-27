import type { Difficulty } from "../../../src/catalog/scenario-data.ts";
import type { PlayerIntent, ReduceContext, ScenarioState } from "../../../src/rules/engine/reduce.ts";

import { loadAnyScenario, loadCampaign } from "../../../scripts/data/load-scenarios.ts";
import type { PolicyOptions } from "../../harness/auto-player.ts";
import { fillerLoadout, HERO_STATS, standaloneGame, type PlayedGame } from "../../harness/game-kit.ts";
import { archeryLeastDamaged, attackAllTogether, chooseFirstOrLast, commitAllBut, engageUpTo, policyIntent, undefendedLeastDamaged, type Policy } from "../../harness/policy-kit.ts";

const cycle = loadCampaign("haradrim");
const crossing = loadAnyScenario("desert-crossing");

// Test helper. A whole standalone game of Desert Crossing played by the auto-player, true solo or two-handed. The heroes are big numbers (or too small to quest, or too brittle to survive an attack) and the decks free
// events, so the outcome depends on the engine, the seed and the encounter deck, not on player card play. There is no campaign: no checklist, no log, no earlier part, no Resolution. The players commit every hero but one to the quest (the one that stays home attacks), nobody defends (the hero with the least damage takes an attack), the first Distribute puts all the archery damage on the least damaged character, the heroes attack together every enemy they reach and every choice takes its first option.
export const CROSSING_POLICY: PolicyOptions = { scout: "", prefer: "", protect: "", play: false, act: false };
// "strong": big-number heroes that win; "brittle": strong questers that die to an attack; "tense": strong heroes that start at a threat of 16 each, so the threat reaches 50.
export type CrossingDecks = "strong" | "brittle" | "tense";

// The heroes start at a threat of 8 (24 in all), so the players can engage a Were-worm (engagement cost 22), which stage 3B needs defeated; "tense" starts at 16 each, so the threat reaches 50.
export const CROSSING_STATS = { ...HERO_STATS, strong: { ...HERO_STATS.strong, threat: 8 }, brittle: { ...HERO_STATS.brittle, threat: 8 }, tense: { ...HERO_STATS.tense, threat: 16 } } as const;

export const crossingLoadout = fillerLoadout;

// The goldens' world and the start of a game: the seeded game's parts every scenario shares (test/harness/game-kit.ts).
export const crossingWorld = (decks: CrossingDecks = "strong") => game.world(decks);
export const crossingStart = (seatCount: 1 | 2, seed: number, difficulty: Difficulty) => game.start(seatCount, seed, difficulty);

export type CrossingPolicy = {
  // The option a Choose window with these answers takes: the first or the last.
  choose: "first" | "last";
};
export const DEFAULT_POLICY: CrossingPolicy = { choose: "first" };

// The policy (test/harness/policy-kit.ts): a list of rules tried in order, then the auto-player's answer with CROSSING_POLICY. A rule answers its own window and returns null for any other. The kit's rules:
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
const rules = (policy: CrossingPolicy): Policy => [chooseFirstOrLast(policy.choose), commitAllBut(1), archeryLeastDamaged(), undefendedLeastDamaged(), engageUpTo(), attackAllTogether()];

// Every intent is one the reducer listed.
export function crossingIntent(state: ScenarioState, ctx: ReduceContext, memory: Set<string>, policy: CrossingPolicy = DEFAULT_POLICY): PlayerIntent {
  return policyIntent(rules(policy), CROSSING_POLICY, state, ctx, memory);
}

export type CrossingGame = PlayedGame;

// The goldens (src/campaign/scenarios/desert-crossing/golden.test.ts). A standalone game has no earlier parts, Upgraded sides or Mode card.
export type CrossingGolden = { name: string; seatCount: 1 | 2; seed: number; difficulty: Difficulty; decks: CrossingDecks; outcome: "won" | "lost"; policy?: Partial<CrossingPolicy>; lossReason?: string };

// The games to pin (.claude/rules/code-standards.md, Test cost): wins true solo and two-handed (the players engage and defeat the Were-worms of stage 3B before the temperature reaches 60; Easy does not change a standalone game, so it has no golden of its own), and each way to lose: the temperature
// at 60 (a long game of strong heroes the stages' +4 and the cards' +2 outrun), every player's threat at 50 (heroes that start at a threat of 16) and every hero destroyed (heroes too brittle for the attacks).
export const CROSSING_GOLDENS: readonly CrossingGolden[] = [
  { name: "true solo, won, Normal", seatCount: 1, seed: 1, difficulty: "Normal", decks: "strong", outcome: "won" },
  { name: "two-handed, won, Normal", seatCount: 2, seed: 1, difficulty: "Normal", decks: "strong", outcome: "won" },
  { name: "true solo, lost, temperature reaches 60", seatCount: 1, seed: 9, difficulty: "Normal", decks: "strong", outcome: "lost", policy: { choose: "last" }, lossReason: "The temperature reached 60" },
  { name: "two-handed, lost, temperature reaches 60", seatCount: 2, seed: 4, difficulty: "Normal", decks: "strong", outcome: "lost", lossReason: "The temperature reached 60" },
  { name: "true solo, lost, threat reaches 50", seatCount: 1, seed: 1, difficulty: "Normal", decks: "tense", outcome: "lost", lossReason: "No seats remain" },
  { name: "two-handed, lost, threat reaches 50", seatCount: 2, seed: 1, difficulty: "Normal", decks: "tense", outcome: "lost", lossReason: "No seats remain" },
  { name: "true solo, lost, every hero destroyed", seatCount: 1, seed: 1, difficulty: "Normal", decks: "brittle", outcome: "lost", lossReason: "No seats remain" },
  { name: "two-handed, lost, every hero destroyed", seatCount: 2, seed: 1, difficulty: "Normal", decks: "brittle", outcome: "lost", lossReason: "No seats remain" },
];

const game = standaloneGame<CrossingDecks, CrossingPolicy>({
  campaign: cycle,
  scenario: crossing,
  stats: CROSSING_STATS,
  codes: [...crossing.cards.map((card) => card.code)],
  intent: crossingIntent,
  policy: DEFAULT_POLICY,
  limit: 6000,
});

export const playGolden = (golden: CrossingGolden, ctx: ReduceContext): CrossingGame => game.playGolden(golden, ctx);
