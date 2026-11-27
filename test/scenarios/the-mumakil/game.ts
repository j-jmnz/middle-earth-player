import type { Difficulty } from "../../../src/catalog/scenario-data.ts";
import type { PlayerIntent, ReduceContext, ScenarioState } from "../../../src/rules/engine/reduce.ts";

import { loadAnyScenario, loadCampaign } from "../../../scripts/data/load-scenarios.ts";
import type { PolicyOptions } from "../../harness/auto-player.ts";
import { fillerLoadout, HERO_STATS, standaloneGame, type PlayedGame } from "../../harness/game-kit.ts";
import { archeryLeastDamaged, attackAllTogether, chooseFirstOrLast, commitAllBut, defendFirst, engageUpTo, policyIntent, triggerActions, type Policy } from "../../harness/policy-kit.ts";

const cycle = loadCampaign("haradrim");
const mumakil = loadAnyScenario("the-mumakil");

// Test helper. A whole standalone game of The Mûmakil played by the auto-player, true solo or two-handed. The heroes are big numbers (or too small to quest, or too brittle to survive an attack) and the decks free
// events, so the outcome depends on the engine, the seed and the encounter deck, not on player card play. There is no campaign: no checklist, no log, no earlier part, no Resolution. Every character quests; the first character who may defends every attack (the Noose of Vines needs a defender), the players engage whatever their threat lets them (the Wild Mûmak at 40) and attack it together; a Choose window takes its last option (the engaged Wild Mûmak makes its immediate attack and stays engaged); the Captures' Responses are used each time the engine offers one.
export const MUMAKIL_POLICY: PolicyOptions = { scout: "", prefer: "", protect: "", play: false, act: false };
// "strong": big-number heroes that win; "weak": heroes too small to quest, so the players lose on threat; "brittle": strong questers that die to an attack.
export type MumakilDecks = "strong" | "weak" | "brittle" | "bold";
// "bold": strong heroes that start at a threat of 10 each, so the players reach the Wild Mûmak's engagement cost of 40 when stage 1 is done.
const STATS = { ...HERO_STATS, bold: { ...HERO_STATS.strong, threat: 10 } };

export const mumakilLoadout = fillerLoadout;

// The goldens' world and the start of a game: the seeded game's parts every scenario shares (test/harness/game-kit.ts).
export const mumakilWorld = (decks: MumakilDecks = "strong") => game.world(decks);
export const mumakilStart = (seatCount: 1 | 2, seed: number, difficulty: Difficulty) => game.start(seatCount, seed, difficulty);

export type MumakilPolicy = {
  // The option a Choose window with these answers takes: the first or the last.
  choose: "first" | "last";
};
export const DEFAULT_POLICY: MumakilPolicy = { choose: "last" };

// The policy (test/harness/policy-kit.ts): a list of rules tried in order, then the auto-player's answer with MUMAKIL_POLICY. A rule answers its own window and returns null for any other. The kit's rules:
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
// Used: the Capture Responses first, then the commit, the archery, the defense, the engagement and the attack; the auto-player answers the rest (travel included).
const CAPTURES = ["17011:response:1", "17012:response:1", "17013:response:1", "17014:response:1"];
const rules = (policy: MumakilPolicy): Policy => [chooseFirstOrLast(policy.choose), triggerActions(CAPTURES), commitAllBut(0), archeryLeastDamaged(), defendFirst(), engageUpTo(), attackAllTogether()];

// Every intent is one the reducer listed.
export function mumakilIntent(state: ScenarioState, ctx: ReduceContext, memory: Set<string>, policy: MumakilPolicy = DEFAULT_POLICY): PlayerIntent {
  return policyIntent(rules(policy), MUMAKIL_POLICY, state, ctx, memory);
}

export type MumakilGame = PlayedGame;

// The goldens (src/campaign/scenarios/the-mumakil/golden.test.ts). A standalone game has no earlier parts, Upgraded sides or Mode card.
export type MumakilGolden = { name: string; seatCount: 1 | 2; seed: number; difficulty: Difficulty; decks: MumakilDecks; outcome: "won" | "lost"; policy?: Partial<MumakilPolicy>; lossReason?: string };

// The games to pin (.claude/rules/code-standards.md, Test cost): wins true solo and two-handed (the players explore until the Wild Mûmak are in play, engage them, and a Capture takes one into the victory display; Easy deals the same Setup (standalone.test.ts) and the scenario
// has no Nightmare deck, so neither has a golden of its own) and each way to lose: every player's threat at 50 (heroes that start at a threat of 10, so the Wild Mûmak's engagement cost of 40 is reached and the Mûmakil are engaged) and every player eliminated by destroyed heroes (heroes too brittle for the attacks).
export const MUMAKIL_GOLDENS: readonly MumakilGolden[] = [
  { name: "true solo, won, Normal", seatCount: 1, seed: 4, difficulty: "Normal", decks: "bold", outcome: "won" },
  { name: "two-handed, won, Normal", seatCount: 2, seed: 3, difficulty: "Normal", decks: "bold", outcome: "won" },
  { name: "true solo, lost, threat reaches 50", seatCount: 1, seed: 2, difficulty: "Normal", decks: "bold", outcome: "lost", lossReason: "No seats remain" },
  { name: "two-handed, lost, threat reaches 50", seatCount: 2, seed: 2, difficulty: "Normal", decks: "bold", outcome: "lost", lossReason: "No seats remain" },
  { name: "true solo, lost, every hero destroyed", seatCount: 1, seed: 1, difficulty: "Normal", decks: "brittle", outcome: "lost", lossReason: "No seats remain" },
  { name: "two-handed, lost, every hero destroyed", seatCount: 2, seed: 1, difficulty: "Normal", decks: "brittle", outcome: "lost", lossReason: "No seats remain" },
];

const game = standaloneGame<MumakilDecks, MumakilPolicy>({
  campaign: cycle,
  scenario: mumakil,
  stats: STATS,
  codes: [...mumakil.cards.map((card) => card.code)],
  intent: mumakilIntent,
  policy: DEFAULT_POLICY,
  limit: 6000,
});

export const playGolden = (golden: MumakilGolden, ctx: ReduceContext): MumakilGame => game.playGolden(golden, ctx);
