import type { Difficulty } from "../../../src/catalog/scenario-data.ts";
import type { PlayerIntent, ReduceContext, ScenarioState } from "../../../src/rules/engine/reduce.ts";

import { loadAnyScenario, loadCampaign } from "../../../scripts/data/load-scenarios.ts";
import type { PolicyOptions } from "../../harness/auto-player.ts";
import { fillerLoadout, HERO_STATS, standaloneGame, type PlayedGame } from "../../harness/game-kit.ts";
import { chooseFirstOrLast, policyIntent, type Policy } from "../../harness/policy-kit.ts";

const cycle = loadCampaign("the-ring-maker");
const crown = loadAnyScenario("the-antlered-crown");

// Test helper. A whole standalone game of The Antlered Crown played by the auto-player, true solo or two-handed. The heroes are big numbers (or too small to quest, or too brittle to survive an attack) and the decks free
// events, so the outcome depends on the engine, the seed and the encounter deck, not on player card play. There is no campaign: no checklist, no log, no earlier part, no Resolution. TODO: say how the players travel, engage and answer the choices this scenario asks.
export const CROWN_POLICY: PolicyOptions = { scout: "", prefer: "", protect: "", play: false, act: false };
// "strong": big-number heroes that win; "weak": heroes too small to quest, so the players lose on threat; "brittle": strong questers that die to an attack.
export type CrownDecks = "strong" | "weak" | "brittle";

export const crownLoadout = fillerLoadout;

// The goldens' world and the start of a game: the seeded game's parts every scenario shares (test/harness/game-kit.ts).
export const crownWorld = (decks: CrownDecks = "strong") => game.world(decks);
export const crownStart = (seatCount: 1 | 2, seed: number, difficulty: Difficulty) => game.start(seatCount, seed, difficulty);

export type CrownPolicy = {
  // The option a Choose window with these answers takes: the first or the last.
  choose: "first" | "last";
};
export const DEFAULT_POLICY: CrownPolicy = { choose: "first" };

// The policy (test/harness/policy-kit.ts): a list of rules tried in order, then the auto-player's answer with CROWN_POLICY. A rule answers its own window and returns null for any other. The kit's rules:
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
// TODO: the scenario's own answers (where the players travel, who defends, which locations they explore) go in the list, before the auto-player's.
const rules = (policy: CrownPolicy): Policy => [chooseFirstOrLast(policy.choose)];

// Every intent is one the reducer listed.
export function crownIntent(state: ScenarioState, ctx: ReduceContext, memory: Set<string>, policy: CrownPolicy = DEFAULT_POLICY): PlayerIntent {
  return policyIntent(rules(policy), CROWN_POLICY, state, ctx, memory);
}

export type CrownGame = PlayedGame;

// The goldens (src/campaign/scenarios/the-antlered-crown/golden.test.ts). A standalone game has no earlier parts, Upgraded sides or Mode card.
export type CrownGolden = { name: string; seatCount: 1 | 2; seed: number; difficulty: Difficulty; decks: CrownDecks; outcome: "won" | "lost"; policy?: Partial<CrownPolicy>; lossReason?: string };

// TODO: the games to pin (at most 3000 intents in all, .claude/rules/code-standards.md, Test cost), a few wins (true solo and two-handed, Normal and Nightmare) and a few losses (each way the scenario can be lost), each on a fixed seed.
export const CROWN_GOLDENS: readonly CrownGolden[] = [];

const game = standaloneGame<CrownDecks, CrownPolicy>({
  campaign: cycle,
  scenario: crown,
  stats: HERO_STATS,
  // TODO: the cards a game loads besides the scenario's piles and its Nightmare deck.
  codes: [...crown.cards.map((card) => card.code)],
  intent: crownIntent,
  policy: DEFAULT_POLICY,
  limit: 6000,
});

export const playGolden = (golden: CrownGolden, ctx: ReduceContext): CrownGame => game.playGolden(golden, ctx);
