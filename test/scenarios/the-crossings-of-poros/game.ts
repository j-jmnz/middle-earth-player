import type { Difficulty } from "../../../src/catalog/scenario-data.ts";
import type { PlayerIntent, ReduceContext, ScenarioState } from "../../../src/rules/engine/reduce.ts";

import { loadAnyScenario, loadCampaign } from "../../../scripts/data/load-scenarios.ts";
import type { PolicyOptions } from "../../harness/auto-player.ts";
import { fillerLoadout, HERO_STATS, standaloneGame, type PlayedGame } from "../../harness/game-kit.ts";
import { archeryLeastDamaged, attackAllTogether, chooseFirstOrLast, commitAllBut, engageUpTo, policyIntent, undefendedLeastDamaged, type Policy } from "../../harness/policy-kit.ts";

const cycle = loadCampaign("haradrim");
const poros = loadAnyScenario("the-crossings-of-poros");

// Test helper. A whole standalone game of The Crossings of Poros played by the auto-player, true solo or two-handed. The heroes are big numbers (or too small to quest, or too brittle to survive an attack) and the decks free
// events, so the outcome depends on the engine, the seed and the encounter deck, not on player card play. There is no campaign: no checklist, no log, no earlier part, no Resolution. TODO: say how the players travel, engage and answer the choices this scenario asks.
export const POROS_POLICY: PolicyOptions = { scout: "", prefer: "", protect: "", play: false, act: false };
// "strong": big-number heroes that win; "weak": heroes too small to quest, so the players lose on threat; "brittle": strong questers that die to an attack.
export type PorosDecks = "strong" | "weak" | "brittle";

export const porosLoadout = fillerLoadout;

// The goldens' world and the start of a game: the seeded game's parts every scenario shares (test/harness/game-kit.ts).
export const porosWorld = (decks: PorosDecks = "strong") => game.world(decks);
export const porosStart = (seatCount: 1 | 2, seed: number, difficulty: Difficulty) => game.start(seatCount, seed, difficulty);

export type PorosPolicy = {
  // The option a Choose window with these answers takes: the first or the last.
  choose: "first" | "last";
};
export const DEFAULT_POLICY: PorosPolicy = { choose: "first" };

// The policy (test/harness/policy-kit.ts): a list of rules tried in order, then the auto-player's answer with POROS_POLICY. A rule answers its own window and returns null for any other. The kit's rules:
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
const rules = (policy: PorosPolicy): Policy => [chooseFirstOrLast(policy.choose), commitAllBut(1), archeryLeastDamaged(), undefendedLeastDamaged(), engageUpTo(), attackAllTogether()];

// Every intent is one the reducer listed.
export function porosIntent(state: ScenarioState, ctx: ReduceContext, memory: Set<string>, policy: PorosPolicy = DEFAULT_POLICY): PlayerIntent {
  return policyIntent(rules(policy), POROS_POLICY, state, ctx, memory);
}

export type PorosGame = PlayedGame;

// The goldens (src/campaign/scenarios/the-crossings-of-poros/golden.test.ts). A standalone game has no earlier parts, Upgraded sides or Mode card.
export type PorosGolden = { name: string; seatCount: 1 | 2; seed: number; difficulty: Difficulty; decks: PorosDecks; outcome: "won" | "lost"; policy?: Partial<PorosPolicy>; lossReason?: string };

// The games pinned (at most 3000 intents in all, .claude/rules/code-standards.md, Test cost): the wins play each stage 2 and each stage 3 once between them (solo: 17158 then 17162, 17159 then 17160; two-handed: 17159 then 17161), and a loss for each way to lose, each on a fixed seed.
export const POROS_GOLDENS: readonly PorosGolden[] = [
  { name: "true solo, won, Normal, Desert Path then Orc Patrols", seatCount: 1, seed: 3, difficulty: "Normal", decks: "strong", outcome: "won" },
  { name: "true solo, won, Normal, Ephel Duath then Deadly Creatures", seatCount: 1, seed: 1, difficulty: "Normal", decks: "strong", outcome: "won" },
  { name: "two-handed, won, Normal, Ephel Duath then Southron Pursuit", seatCount: 2, seed: 8, difficulty: "Normal", decks: "strong", outcome: "won" },
  { name: "true solo, lost, threat reaches 50", seatCount: 1, seed: 1, difficulty: "Normal", decks: "weak", outcome: "lost", lossReason: "No seats remain" },
  { name: "true solo, lost, every hero destroyed", seatCount: 1, seed: 1, difficulty: "Normal", decks: "brittle", outcome: "lost", lossReason: "No seats remain" },
  { name: "true solo, lost, Poros Garrison leaves play", seatCount: 1, seed: 2, difficulty: "Normal", decks: "strong", outcome: "lost", lossReason: "Poros Garrison left play" },
];

const game = standaloneGame<PorosDecks, PorosPolicy>({
  campaign: cycle,
  scenario: poros,
  stats: HERO_STATS,
  // TODO: the cards a game loads besides the scenario's piles and its Nightmare deck.
  codes: [...poros.cards.map((card) => card.code)],
  intent: porosIntent,
  policy: DEFAULT_POLICY,
  limit: 6000,
});

export const playGolden = (golden: PorosGolden, ctx: ReduceContext): PorosGame => game.playGolden(golden, ctx, { trail: true });
