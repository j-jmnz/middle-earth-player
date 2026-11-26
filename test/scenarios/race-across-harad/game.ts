import type { Difficulty } from "../../../src/catalog/scenario-data.ts";
import type { PlayerIntent, ReduceContext, ScenarioState } from "../../../src/rules/engine/reduce.ts";

import { loadAnyScenario, loadCampaign } from "../../../scripts/data/load-scenarios.ts";
import type { PolicyOptions } from "../../harness/auto-player.ts";
import { fillerLoadout, HERO_STATS, standaloneGame, type PlayedGame } from "../../harness/game-kit.ts";
import { archeryLeastDamaged, attackAllTogether, chooseFirstOrLast, commitAllBut, defendFirst, engageUpTo, policyIntent, type Policy } from "../../harness/policy-kit.ts";

const cycle = loadCampaign("haradrim");
const harad = loadAnyScenario("race-across-harad");

// Test helper. A whole standalone game of Race Across Harad played by the auto-player, true solo or two-handed. The heroes are big numbers (or too small to quest, or too brittle to survive an attack) and the decks free
// events, so the outcome depends on the engine, the seed and the encounter deck, not on player card play. There is no campaign: no checklist, no log, no earlier part, no Resolution. Every character but the last `reserve` heroes of a seat quests (those stay home and defend, the first one who may defends each attack, so the Tamed Mûmak is never undefended unless the seat has more attacks than defenders); the players engage whatever their threat lets them and attack together; a Choose window takes its first option (the Warg-rider goes to the staging area).
export const HARAD_POLICY: PolicyOptions = { scout: "", prefer: "", protect: "", play: false, act: false };
// "strong": big-number heroes that win; "weak": heroes too small to quest, so the players lose on threat; "brittle": strong questers that die to an attack.
export type HaradDecks = "strong" | "weak" | "brittle";

export const haradLoadout = fillerLoadout;

// The goldens' world and the start of a game: the seeded game's parts every scenario shares (test/harness/game-kit.ts).
export const haradWorld = (decks: HaradDecks = "strong") => game.world(decks);
export const haradStart = (seatCount: 1 | 2, seed: number, difficulty: Difficulty) => game.start(seatCount, seed, difficulty);

export type HaradPolicy = {
  // The option a Choose window with these answers takes: the first or the last.
  choose: "first" | "last";
  // The heroes that stay home from the quest to defend.
  reserve: number;
};
export const DEFAULT_POLICY: HaradPolicy = { choose: "first", reserve: 2 };

// The policy (test/harness/policy-kit.ts): a list of rules tried in order, then the auto-player's answer with HARAD_POLICY. A rule answers its own window and returns null for any other. The kit's rules:
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
// Used: the Choose window, the commit, the archery, the defense, the engagement and the attack; the auto-player answers the rest (travel included).
const rules = (policy: HaradPolicy): Policy => [chooseFirstOrLast(policy.choose), commitAllBut(policy.reserve), archeryLeastDamaged(), defendFirst(), engageUpTo(), attackAllTogether()];

// Every intent is one the reducer listed.
export function haradIntent(state: ScenarioState, ctx: ReduceContext, memory: Set<string>, policy: HaradPolicy = DEFAULT_POLICY): PlayerIntent {
  return policyIntent(rules(policy), HARAD_POLICY, state, ctx, memory);
}

export type HaradGame = PlayedGame;

// The goldens (src/campaign/scenarios/race-across-harad/golden.test.ts). A standalone game has no earlier parts, Upgraded sides or Mode card.
export type HaradGolden = { name: string; seatCount: 1 | 2; seed: number; difficulty: Difficulty; decks: HaradDecks; outcome: "won" | "lost"; policy?: Partial<HaradPolicy>; lossReason?: string };

// The games to pin (.claude/rules/code-standards.md, Test cost): wins true solo and two-handed (Easy deals the same Setup (standalone.test.ts) and the scenario has no Nightmare deck, so neither has a golden of its own) and each way to lose: the Orcs fill
// their stage 2D, 3D or 4D (the races that the quest loses), the Tamed Mûmak leaves play (true solo and two-handed), every player's threat at 50 and every hero destroyed. The "weak" and "brittle" games keep all three heroes of a seat home (reserve 3), so
// the Mûmak is the only character that quests and the defenders take every attack.
const HOME: Partial<HaradPolicy> = { reserve: 3 };
export const HARAD_GOLDENS: readonly HaradGolden[] = [
  { name: "true solo, won, Normal", seatCount: 1, seed: 85, difficulty: "Normal", decks: "strong", outcome: "won" },
  { name: "two-handed, won, Normal", seatCount: 2, seed: 10, difficulty: "Normal", decks: "strong", outcome: "won" },
  { name: "true solo, lost, the Orcs fill stage 2D", seatCount: 1, seed: 1, difficulty: "Normal", decks: "weak", outcome: "lost", policy: HOME, lossReason: "The Orcs completed Racing North (stage 2) while the players were at stage 2" },
  { name: "true solo, lost, the Orcs fill stage 3D", seatCount: 1, seed: 4, difficulty: "Normal", decks: "strong", outcome: "lost", lossReason: "The Orcs completed Hunted in Harad (stage 3) while the players were at stage 3" },
  { name: "true solo, lost, the Orcs fill stage 4D", seatCount: 1, seed: 12, difficulty: "Normal", decks: "strong", outcome: "lost", lossReason: "The Orcs have caught you" },
  { name: "true solo, lost, the Tamed Mûmak leaves play", seatCount: 1, seed: 6, difficulty: "Normal", decks: "strong", outcome: "lost", lossReason: "Tamed Mûmak was destroyed: Player 1 is eliminated" },
  { name: "two-handed, lost, both Tamed Mûmakil leave play", seatCount: 2, seed: 1, difficulty: "Normal", decks: "strong", outcome: "lost", lossReason: "Tamed Mûmak was destroyed: Player 2 is eliminated" },
  { name: "true solo, lost, threat reaches 50", seatCount: 1, seed: 11, difficulty: "Normal", decks: "weak", outcome: "lost", policy: HOME, lossReason: "No seats remain" },
  { name: "true solo, lost, every hero destroyed", seatCount: 1, seed: 3, difficulty: "Normal", decks: "brittle", outcome: "lost", policy: HOME, lossReason: "No seats remain" },
];

const game = standaloneGame<HaradDecks, HaradPolicy>({
  campaign: cycle,
  scenario: harad,
  stats: HERO_STATS,
  codes: [...harad.cards.map((card) => card.code)],
  intent: haradIntent,
  policy: DEFAULT_POLICY,
  limit: 6000,
});

export const playGolden = (golden: HaradGolden, ctx: ReduceContext): HaradGame => game.playGolden(golden, ctx);
