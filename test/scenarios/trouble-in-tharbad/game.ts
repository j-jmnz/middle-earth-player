import type { Difficulty } from "../../../src/catalog/scenario-data.ts";
import type { PlayerIntent, ReduceContext, ScenarioState } from "../../../src/rules/engine/reduce.ts";

import { loadAnyScenario, loadCampaign } from "../../../scripts/data/load-scenarios.ts";
import type { PolicyOptions } from "../../harness/auto-player.ts";
import { fillerLoadout, HERO_STATS, standaloneGame, type PlayedGame } from "../../harness/game-kit.ts";
import { chooseFirstOrLast, commitAllBut, defendFirst, policyIntent, type Policy } from "../../harness/policy-kit.ts";

const cycle = loadCampaign("the-ring-maker");
const tharbad = loadAnyScenario("trouble-in-tharbad");

// Test helper. A whole standalone game of Trouble in Tharbad played by the auto-player, true solo or two-handed. The heroes have a willpower of 6 (the "steady" numbers of HERO_STATS: a quest of 12 a round, so the Time counters, the lowered threat
// elimination level and the redirect to The Crossing at Tharbad all come into play) and the decks free events, so the outcome depends on the engine, the seed and the encounter deck, not on player card play. There is no campaign: no checklist, no log, no
// earlier part, no Resolution. The scenario needs one answer of its own: the players lose the game when Nalir leaves play and every attack made against him (Get That Dwarf!, Bellach, a shadow) sends its undefended damage to him, so each seat keeps one
// hero home from the quest (`commitAllBut(1)`) and a ready hero defends (`defendFirst()`); the auto-player's own policy commits every hero and leaves Nalir to die in the first Get That Dwarf!. Threat is lowered only by stage 1B's cancelled progress, so the
// players quest every round (no stalling) and the game is won through the Crossing or lost to the threat elimination level (50, then 40, 30, 20 as stage 1B runs out of Time) or to Nalir.
export const THARBAD_POLICY: PolicyOptions = { scout: "", prefer: "", protect: "", play: false, act: false };
// "strong" is the one deck: heroes with a willpower of 6 (below), so the game takes several rounds and can be won or lost.
export type TharbadDecks = "strong";

export const tharbadLoadout = fillerLoadout;

// The goldens' world and the start of a game: the seeded game's parts every scenario shares (test/harness/game-kit.ts).
export const tharbadWorld = (decks: TharbadDecks = "strong") => game.world(decks);
export const tharbadStart = (seatCount: 1 | 2, seed: number, difficulty: Difficulty) => game.start(seatCount, seed, difficulty);

export type TharbadPolicy = {
  // The option a Choose window with these answers takes: the first or the last.
  choose: "first" | "last";
};
export const DEFAULT_POLICY: TharbadPolicy = { choose: "first" };

// The policy (test/harness/policy-kit.ts): a list of rules tried in order, then the auto-player's answer with THARBAD_POLICY. A rule answers its own window and returns null for any other. The kit's rules:
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
const rules = (policy: TharbadPolicy): Policy => [chooseFirstOrLast(policy.choose), commitAllBut(1), defendFirst()];

// Every intent is one the reducer listed.
export function tharbadIntent(state: ScenarioState, ctx: ReduceContext, memory: Set<string>, policy: TharbadPolicy = DEFAULT_POLICY): PlayerIntent {
  return policyIntent(rules(policy), THARBAD_POLICY, state, ctx, memory);
}

export type TharbadGame = PlayedGame;

// The goldens (src/campaign/scenarios/trouble-in-tharbad/golden.test.ts). A standalone game has no earlier parts, Upgraded sides or Mode card.
export type TharbadGolden = { name: string; seatCount: 1 | 2; seed: number; difficulty: Difficulty; decks: TharbadDecks; outcome: "won" | "lost"; policy?: Partial<TharbadPolicy>; lossReason?: string };

// The games to pin (about 600 intents in all, .claude/rules/code-standards.md, Test cost): wins true solo and two-handed on Normal and Easy (one solo win with the elimination level lowered to 40 by stage 1B's Time), each ending when the
// progress that stage 2B redirects explores The Crossing at Tharbad. The ways to lose are a threat at the elimination level (50, or 30 once stage 1B has run out of Time twice) and Nalir leaving play, each true solo and two-handed.
export const THARBAD_GOLDENS: readonly TharbadGolden[] = [
  { name: "solo win", seatCount: 1, seed: 2, difficulty: "Normal", decks: "strong", outcome: "won" },
  { name: "solo win, elimination level lowered", seatCount: 1, seed: 4, difficulty: "Normal", decks: "strong", outcome: "won" },
  { name: "two-handed win", seatCount: 2, seed: 8, difficulty: "Normal", decks: "strong", outcome: "won" },
  { name: "Easy solo win", seatCount: 1, seed: 7, difficulty: "Easy", decks: "strong", outcome: "won" },
  { name: "Easy two-handed win", seatCount: 2, seed: 1, difficulty: "Easy", decks: "strong", outcome: "won" },
  { name: "solo loss: threat at the lowered level", seatCount: 1, seed: 3, difficulty: "Normal", decks: "strong", outcome: "lost", lossReason: "No seats remain" },
  { name: "solo loss: Nalir leaves play", seatCount: 1, seed: 5, difficulty: "Normal", decks: "strong", outcome: "lost", lossReason: "Nalir left play" },
  { name: "two-handed loss: threat", seatCount: 2, seed: 4, difficulty: "Normal", decks: "strong", outcome: "lost", lossReason: "No seats remain" },
  { name: "two-handed loss: Nalir leaves play", seatCount: 2, seed: 2, difficulty: "Normal", decks: "strong", outcome: "lost", lossReason: "Nalir left play" },
];

const game = standaloneGame<TharbadDecks, TharbadPolicy>({
  campaign: cycle,
  scenario: tharbad,
  stats: { strong: HERO_STATS.steady },
  codes: [...tharbad.cards.map((card) => card.code)],
  intent: tharbadIntent,
  policy: DEFAULT_POLICY,
  limit: 6000,
});

export const playGolden = (golden: TharbadGolden, ctx: ReduceContext): TharbadGame => game.playGolden(golden, ctx);
