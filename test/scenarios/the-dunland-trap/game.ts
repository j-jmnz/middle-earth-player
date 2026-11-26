import type { Difficulty } from "../../../src/catalog/scenario-data.ts";
import type { PlayerIntent, ReduceContext, ScenarioState } from "../../../src/rules/engine/reduce.ts";

import { loadAnyScenario, loadCampaign } from "../../../scripts/data/load-scenarios.ts";
import type { PolicyOptions } from "../../harness/auto-player.ts";
import { fillerLoadout, HERO_STATS, standaloneGame, type PlayedGame } from "../../harness/game-kit.ts";
import { attackAllTogether, chooseFirstOrLast, commitAllBut, engageUpTo, policyIntent, travelFewestQuestPoints, undefendedLeastDamaged, type Policy } from "../../harness/policy-kit.ts";

const cycle = loadCampaign("the-ring-maker");
const trap = loadAnyScenario("the-dunland-trap");

// Test helper. A whole standalone game of The Dunland Trap played by the auto-player, true solo or two-handed. The heroes are big numbers (or too small to quest, or too brittle to survive an attack) and the decks free
// events, so the outcome depends on the engine, the seed and the encounter deck, not on player card play. There is no campaign: no checklist, no log, no earlier part, no Resolution. Each seat quests with all but one hero and keeps that one home to attack with the others' help; the players travel to the location with the fewest quest points, engage every enemy (Chief Turch engages the first player at once, and each engagement takes a time counter off the stage), defend with nobody and answer every choice with its first option. A win is the last time counter leaving stage 3B with no hero destroyed by the attacks that follow.
export const TRAP_POLICY: PolicyOptions = { scout: "", prefer: "", protect: "", play: true, act: false };
// "strong": big-number heroes that win; "weak": heroes too small to quest, so the players lose on threat; "brittle": strong questers that die to the first attacks (7 hit points); "fragile": strong questers with 20 hit points and no defense, who reach stage 3B and lose a hero there.
export type TrapDecks = "strong" | "weak" | "brittle" | "fragile";

export const trapLoadout = fillerLoadout;

// The goldens' world and the start of a game: the seeded game's parts every scenario shares (test/harness/game-kit.ts).
export const trapWorld = (decks: TrapDecks = "strong") => game.world(decks);
export const trapStart = (seatCount: 1 | 2, seed: number, difficulty: Difficulty) => game.start(seatCount, seed, difficulty);

export type TrapPolicy = {
  // The option a Choose window with these answers takes: the first or the last.
  choose: "first" | "last";
};
export const DEFAULT_POLICY: TrapPolicy = { choose: "first" };

// The policy (test/harness/policy-kit.ts): a list of rules tried in order, then the auto-player's answer with TRAP_POLICY. A rule answers its own window and returns null for any other. The kit's rules:
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
const rules = (policy: TrapPolicy): Policy => [chooseFirstOrLast(policy.choose), travelFewestQuestPoints(), commitAllBut(1), undefendedLeastDamaged(), attackAllTogether(), engageUpTo(99)];

// Every intent is one the reducer listed.
export function trapIntent(state: ScenarioState, ctx: ReduceContext, memory: Set<string>, policy: TrapPolicy = DEFAULT_POLICY): PlayerIntent {
  return policyIntent(rules(policy), TRAP_POLICY, state, ctx, memory);
}

export type TrapGame = PlayedGame;

// The goldens (src/campaign/scenarios/the-dunland-trap/golden.test.ts). A standalone game has no earlier parts, Upgraded sides or Mode card.
export type TrapGolden = { name: string; seatCount: 1 | 2; seed: number; difficulty: Difficulty; decks: TrapDecks; outcome: "won" | "lost"; policy?: Partial<TrapPolicy>; lossReason?: string };

// The games to pin (about 570 intents in all, .claude/rules/code-standards.md, Test cost): wins true solo and two-handed on Normal and Easy, each by the last time counter leaving stage 3B (Turch's engagements and Old South Road take the counters down) with no hero destroyed
// by the attacks that follow. The losses are the three ways to lose here: every player's threat reaches 50 (heroes too weak to quest, solo and two-handed), a hero destroyed at stage 3B by the attacks after the last counter (solo and two-handed, heroes with 20 hit points and no defense)
// and the last hero destroyed so the seat is eliminated (solo, heroes with 7 hit points).
export const TRAP_GOLDENS: readonly TrapGolden[] = [
  { name: "solo win", seatCount: 1, seed: 1, difficulty: "Normal", decks: "strong", outcome: "won" },
  { name: "two-handed win", seatCount: 2, seed: 2, difficulty: "Normal", decks: "strong", outcome: "won" },
  { name: "Easy solo win", seatCount: 1, seed: 1, difficulty: "Easy", decks: "strong", outcome: "won" },
  { name: "Easy two-handed win", seatCount: 2, seed: 1, difficulty: "Easy", decks: "strong", outcome: "won" },
  { name: "solo loss: threat", seatCount: 1, seed: 2, difficulty: "Normal", decks: "weak", outcome: "lost", lossReason: "No seats remain" },
  { name: "two-handed loss: threat", seatCount: 2, seed: 1, difficulty: "Normal", decks: "weak", outcome: "lost", lossReason: "No seats remain" },
  { name: "solo loss: a hero destroyed by the 3B attacks", seatCount: 1, seed: 2, difficulty: "Normal", decks: "fragile", outcome: "lost", lossReason: "A hero was destroyed" },
  { name: "two-handed loss: a hero destroyed by the 3B attacks", seatCount: 2, seed: 7, difficulty: "Normal", decks: "fragile", outcome: "lost", lossReason: "A hero was destroyed" },
  { name: "solo loss: every hero destroyed", seatCount: 1, seed: 2, difficulty: "Normal", decks: "brittle", outcome: "lost", lossReason: "No seats remain" },
];

const game = standaloneGame<TrapDecks, TrapPolicy>({
  campaign: cycle,
  scenario: trap,
  stats: { ...HERO_STATS, fragile: { threat: 3, willpower: 20, attack: 12, defense: 0, health: 20 } },
  codes: [...trap.cards.map((card) => card.code)],
  intent: trapIntent,
  policy: DEFAULT_POLICY,
  limit: 6000,
});

export const playGolden = (golden: TrapGolden, ctx: ReduceContext): TrapGame => game.playGolden(golden, ctx);
