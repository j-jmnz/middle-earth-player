import type { Difficulty } from "../../../src/catalog/scenario-data.ts";
import type { PlayerIntent, ReduceContext, ScenarioState } from "../../../src/rules/engine/reduce.ts";

import { loadAnyScenario, loadCampaign } from "../../../scripts/data/load-scenarios.ts";
import type { PolicyOptions } from "../../harness/auto-player.ts";
import { fillerLoadout, HERO_STATS, standaloneGame, type PlayedGame } from "../../harness/game-kit.ts";
import { attackAllTogether, chooseFirstOrLast, commitAllBut, declineAttack, engageUpTo, travelFewestQuestPoints, undefendedLeastDamaged, policyIntent, type Policy } from "../../harness/policy-kit.ts";

const cycle = loadCampaign("the-ring-maker");
const secret = loadAnyScenario("celebrimbors-secret");

// Test helper. A whole standalone game of Celebrimbor's Secret played by the auto-player, true solo or two-handed. The heroes are big numbers (or too small to quest, or too brittle to survive an attack) and the decks hold free events, so the outcome depends on the
// engine, the seed and the encounter deck, not on player card play. There is no campaign: no checklist, no log, no earlier part, no Resolution. The scenario needs answers of its own, which the auto-player does not give: (1) the quest commit keeps one hero home, so a
// ready hero can attack Bellach (a hero that quested is exhausted, and the 08123 stage cannot be won while Celebrimbor's Mould lies on Bellach: 08123:A:1 attaches it, 08123:B:4); (2) the players engage Bellach by choice as soon as it can be engaged (08123:B:3, 12
// progress on the stage), and only Bellach (the encounter deck's other enemies engage by their engagement checks), and every ready hero attacks it first, so that the Mould returns to the staging area, is claimed again and the stage can be defeated; (3) nobody defends
// (a hero has 100 hit points), so the heroes that attack stay ready. `reserve: 0` is the one way the policy loses on purpose: every hero quests, nobody attacks, Bellach is never defeated and the threat rises (08125:A:2) to the elimination level.
export const SECRET_POLICY: PolicyOptions = { scout: "", prefer: "", protect: "", play: false, act: false };
// "strong": big-number heroes that win; "weak": heroes too small to quest (unused by the goldens: threat only rises through The Orcs' Search); "brittle": strong questers that die to an attack, so the hero that holds the Mould can leave play.
export type SecretDecks = "strong" | "weak" | "brittle";

export const secretLoadout = fillerLoadout;

// The goldens' world and the start of a game: the seeded game's parts every scenario shares (test/harness/game-kit.ts).
export const secretWorld = (decks: SecretDecks = "strong") => game.world(decks);
export const secretStart = (seatCount: 1 | 2, seed: number, difficulty: Difficulty) => game.start(seatCount, seed, difficulty);

export type SecretPolicy = {
  // The option a Choose window with these answers takes: the first or the last.
  choose: "first" | "last";
  // The heroes that stay home from the quest, ready to attack.
  reserve: number;
};
export const DEFAULT_POLICY: SecretPolicy = { choose: "first", reserve: 1 };

// The policy (test/harness/policy-kit.ts): a list of rules tried in order, then the auto-player's answer with SECRET_POLICY. A rule answers its own window and returns null for any other. The kit's rules:
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
// Bellach (08124) is engaged and attacked by choice; the other enemies come by their engagement checks.
const BELLACH = "08124";
const rules = (policy: SecretPolicy): Policy => [chooseFirstOrLast(policy.choose), commitAllBut(policy.reserve), travelFewestQuestPoints(), undefendedLeastDamaged(), engageUpTo(99, { allow: (state, id) => state.cards[id]?.code === BELLACH }), attackAllTogether((state, id) => (state.cards[id]?.code === BELLACH ? 0 : 1)), declineAttack()];

// Every intent is one the reducer listed.
export function secretIntent(state: ScenarioState, ctx: ReduceContext, memory: Set<string>, policy: SecretPolicy = DEFAULT_POLICY): PlayerIntent {
  return policyIntent(rules(policy), SECRET_POLICY, state, ctx, memory);
}

export type SecretGame = PlayedGame;

// The goldens (src/campaign/scenarios/celebrimbors-secret/golden.test.ts). A standalone game has no earlier parts, Upgraded sides or Mode card.
export type SecretGolden = { name: string; seatCount: 1 | 2; seed: number; difficulty: Difficulty; decks: SecretDecks; outcome: "won" | "lost"; policy?: Partial<SecretPolicy>; lossReason?: string };

// The games to pin (.claude/rules/code-standards.md, Test cost): a standalone scenario has no Resolution, so Easy mode adds no game, and it has no Nightmare deck. Wins true solo and two-handed (the Mould is claimed from The Secret Chamber, attached to Bellach on stage 2 and
// claimed again once Bellach is defeated). The ways to lose: the threat at the elimination level, the hero that holds the Mould leaving play (08127:A:2) and The Secret Chamber going under The Orcs' Search (08126:A:3).
export const SECRET_GOLDENS: readonly SecretGolden[] = [
  { name: "solo win", seatCount: 1, seed: 6, difficulty: "Normal", decks: "strong", outcome: "won" },
  { name: "two-handed win", seatCount: 2, seed: 6, difficulty: "Normal", decks: "strong", outcome: "won" },
  { name: "solo loss: threat at the elimination level", seatCount: 1, seed: 1, difficulty: "Normal", decks: "strong", policy: { reserve: 0 }, outcome: "lost", lossReason: "No seats remain" },
  { name: "solo loss: the Mould's hero leaves play", seatCount: 1, seed: 2, difficulty: "Normal", decks: "brittle", outcome: "lost", lossReason: "q1 left play" },
  { name: "solo loss: The Secret Chamber goes under The Orcs' Search", seatCount: 1, seed: 7, difficulty: "Normal", decks: "strong", outcome: "lost", lossReason: "The Secret Chamber left play" },
];

const game = standaloneGame<SecretDecks, SecretPolicy>({
  campaign: cycle,
  scenario: secret,
  stats: HERO_STATS,
  codes: [...secret.cards.map((card) => card.code)],
  intent: secretIntent,
  policy: DEFAULT_POLICY,
  limit: 6000,
});

export const playGolden = (golden: SecretGolden, ctx: ReduceContext): SecretGame => game.playGolden(golden, ctx);
