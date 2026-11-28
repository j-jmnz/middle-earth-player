import type { Difficulty } from "../../../src/catalog/scenario-data.ts";
import type { PlayerIntent, ReduceContext, ScenarioState } from "../../../src/rules/engine/reduce.ts";

import { loadAnyScenario, loadCampaign } from "../../../scripts/data/load-scenarios.ts";
import type { PolicyOptions } from "../../harness/auto-player.ts";
import { fillerLoadout, HERO_STATS, standaloneGame, type PlayedGame } from "../../harness/game-kit.ts";
import { archeryLeastDamaged, attackAllTogether, chooseFirstOrLast, commitAllBut, engageUpTo, policyIntent, undefendedLeastDamaged, type Policy } from "../../harness/policy-kit.ts";

const cycle = loadCampaign("vengeance-of-mordor");
const dorwinion = loadAnyScenario("danger-in-dorwinion");

// Test helper. A whole standalone game of Danger in Dorwinion played by the auto-player, true solo or two-handed. The heroes are big numbers (or too small to quest, or too brittle to survive an attack) and the decks free
// events, so the outcome depends on the engine, the seed and the encounter deck, not on player card play. There is no campaign: no checklist, no log, no earlier part, no Resolution. The players quest with all but one character, engage the enemies of the staging area, the hero kept home attacks, and each Choose window takes the option the policy names (the first or the last).
export const DORWINION_POLICY: PolicyOptions = { scout: "", prefer: "", protect: "", play: false, act: false };
// "strong": big-number heroes that win; "weak": heroes too small to quest, so the players lose on threat; "brittle": strong questers that die to an attack.
export type DorwinionDecks = "strong" | "weak" | "brittle";

export const dorwinionLoadout = fillerLoadout;

// The goldens' world and the start of a game: the seeded game's parts every scenario shares (test/harness/game-kit.ts).
export const dorwinionWorld = (decks: DorwinionDecks = "strong") => game.world(decks);
export const dorwinionStart = (seatCount: 1 | 2, seed: number, difficulty: Difficulty) => game.start(seatCount, seed, difficulty);

export type DorwinionPolicy = {
  // The option a Choose window with these answers takes: the first or the last.
  choose: "first" | "last";
};
export const DEFAULT_POLICY: DorwinionPolicy = { choose: "first" };

// The policy (test/harness/policy-kit.ts): a list of rules tried in order, then the auto-player's answer with DORWINION_POLICY. A rule answers its own window and returns null for any other. The kit's rules:
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
const rules = (policy: DorwinionPolicy): Policy => [chooseFirstOrLast(policy.choose), commitAllBut(1), archeryLeastDamaged(), undefendedLeastDamaged(), engageUpTo(), attackAllTogether()];

// Every intent is one the reducer listed.
export function dorwinionIntent(state: ScenarioState, ctx: ReduceContext, memory: Set<string>, policy: DorwinionPolicy = DEFAULT_POLICY): PlayerIntent {
  return policyIntent(rules(policy), DORWINION_POLICY, state, ctx, memory);
}

export type DorwinionGame = PlayedGame;

// The goldens (src/campaign/scenarios/danger-in-dorwinion/golden.test.ts). A standalone game has no earlier parts, Upgraded sides or Mode card.
export type DorwinionGolden = { name: string; seatCount: 1 | 2; seed: number; difficulty: Difficulty; decks: DorwinionDecks; outcome: "won" | "lost"; policy?: Partial<DorwinionPolicy>; lossReason?: string };

// The games pinned (at most 3000 intents in all, .claude/rules/code-standards.md, Test cost): wins true solo (the first and the last option of each Choose) and two-handed on Normal and Easy, and a loss for each way to lose, each on a fixed seed.
export const DORWINION_GOLDENS: readonly DorwinionGolden[] = [
  { name: "true solo, won, Normal", seatCount: 1, seed: 1, difficulty: "Normal", decks: "strong", outcome: "won" },
  { name: "true solo, won, Normal, every choice the last option", seatCount: 1, seed: 1, difficulty: "Normal", decks: "strong", outcome: "won", policy: { choose: "last" } },
  { name: "two-handed, won, Normal", seatCount: 2, seed: 5, difficulty: "Normal", decks: "strong", outcome: "won" },
  { name: "two-handed, won, Easy", seatCount: 2, seed: 5, difficulty: "Easy", decks: "strong", outcome: "won" },
  { name: "true solo, lost, threat reaches 50", seatCount: 1, seed: 1, difficulty: "Normal", decks: "weak", outcome: "lost", lossReason: "No seats remain" },
  { name: "true solo, lost, every hero destroyed", seatCount: 1, seed: 1, difficulty: "Normal", decks: "brittle", outcome: "lost", lossReason: "No seats remain" },
];

const game = standaloneGame<DorwinionDecks, DorwinionPolicy>({
  campaign: cycle,
  scenario: dorwinion,
  stats: HERO_STATS,
  codes: [...dorwinion.cards.map((card) => card.code)],
  intent: dorwinionIntent,
  policy: DEFAULT_POLICY,
  limit: 6000,
});

export const playGolden = (golden: DorwinionGolden, ctx: ReduceContext): DorwinionGame => game.playGolden(golden, ctx);
