import type { Difficulty } from "../../../src/catalog/scenario-data.ts";
import type { PlayerIntent, ReduceContext, ScenarioState } from "../../../src/rules/engine/reduce.ts";

import { loadAnyScenario, loadCampaign } from "../../../scripts/data/load-scenarios.ts";
import type { PolicyOptions } from "../../harness/auto-player.ts";
import { fillerLoadout, HERO_STATS, standaloneGame, type PlayedGame } from "../../harness/game-kit.ts";
import { archeryLeastDamaged, attackAllTogether, chooseFirstOrLast, commitAllBut, engageUpTo, policyIntent, undefendedLeastDamaged, type Policy } from "../../harness/policy-kit.ts";

const cycle = loadCampaign("haradrim");
const serpent = loadAnyScenario("the-black-serpent");

// Test helper. A whole standalone game of The Black Serpent played by the auto-player, true solo or two-handed. The heroes are big numbers (or too small to quest, or too brittle to survive an attack) and the decks free
// events, so the outcome depends on the engine, the seed and the encounter deck, not on player card play. There is no campaign: no checklist, no log, no earlier part, no Resolution. All but one character quest (the one kept home attacks, so nobody defends: the least damaged hero takes each attack), the players engage every enemy but The Black Serpent until stage 3B holds 6 progress (it cannot leave the staging area before) and attack it first; a Choose window takes its last option (the Serpent's end-of-phase choice makes it attack, so the progress stays); the auto-player travels.
export const SERPENT_POLICY: PolicyOptions = { scout: "", prefer: "", protect: "", play: false, act: false };
// "strong": big-number heroes that win; "weak": heroes too small to quest, so the players lose on threat; "brittle": strong questers that die to an attack.
export type SerpentDecks = "strong" | "weak" | "brittle";

export const serpentLoadout = fillerLoadout;

// The goldens' world and the start of a game: the seeded game's parts every scenario shares (test/harness/game-kit.ts).
export const serpentWorld = (decks: SerpentDecks = "strong") => game.world(decks);
export const serpentStart = (seatCount: 1 | 2, seed: number, difficulty: Difficulty) => game.start(seatCount, seed, difficulty);

export type SerpentPolicy = {
  // The option a Choose window with these answers takes: the first or the last.
  choose: "first" | "last";
};
export const DEFAULT_POLICY: SerpentPolicy = { choose: "last" };

// The policy (test/harness/policy-kit.ts): a list of rules tried in order, then the auto-player's answer with SERPENT_POLICY. A rule answers its own window and returns null for any other. The kit's rules:
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
const SERPENT = "17094";
// The Serpent cannot leave the staging area until stage 3B holds 6 progress, so it is engaged then and not before (stage 2B only considers it engaged with the claimers).
const serpentMayEngage = (state: ScenarioState, id: string): boolean => state.cards[id]?.code !== SERPENT || (state.questStage != null && state.cards[state.questStage]?.code === "17108" && (state.cards[state.questStage]?.progress ?? 0) >= 6);
// Used: the commit, the archery, the defense, the engagement and the attack; the auto-player answers the rest (travel included).
const rules = (policy: SerpentPolicy): Policy => [chooseFirstOrLast(policy.choose), commitAllBut(1), archeryLeastDamaged(), undefendedLeastDamaged(), engageUpTo(undefined, { allow: serpentMayEngage }), attackAllTogether((state, id) => (state.cards[id]?.code === SERPENT ? 0 : 1))];

// Every intent is one the reducer listed.
export function serpentIntent(state: ScenarioState, ctx: ReduceContext, memory: Set<string>, policy: SerpentPolicy = DEFAULT_POLICY): PlayerIntent {
  return policyIntent(rules(policy), SERPENT_POLICY, state, ctx, memory);
}

export type SerpentGame = PlayedGame;

// The goldens (src/campaign/scenarios/the-black-serpent/golden.test.ts). A standalone game has no earlier parts, Upgraded sides or Mode card.
export type SerpentGolden = { name: string; seatCount: 1 | 2; seed: number; difficulty: Difficulty; decks: SerpentDecks; outcome: "won" | "lost"; policy?: Partial<SerpentPolicy>; lossReason?: string };

// The games to pin (.claude/rules/code-standards.md, Test cost): wins true solo and two-handed (Easy deals the same Setup, standalone.test.ts, and the scenario has no Nightmare deck, so neither has a golden of its own) and each way to lose: every player's threat at 50
// (heroes that cannot quest, so the staging area's Threat is the shortfall each round) and every hero destroyed (heroes too brittle for the attacks). The first player eliminated while his hero holds an objective is a scene-kit test (lines.test.ts).
export const SERPENT_GOLDENS: readonly SerpentGolden[] = [
  { name: "true solo, won, Normal", seatCount: 1, seed: 4, difficulty: "Normal", decks: "strong", outcome: "won" },
  { name: "two-handed, won, Normal", seatCount: 2, seed: 7, difficulty: "Normal", decks: "strong", outcome: "won" },
  { name: "true solo, lost, threat reaches 50", seatCount: 1, seed: 1, difficulty: "Normal", decks: "weak", outcome: "lost", lossReason: "No seats remain" },
  { name: "true solo, lost, every hero destroyed", seatCount: 1, seed: 1, difficulty: "Normal", decks: "brittle", outcome: "lost", lossReason: "No seats remain" },
];

const game = standaloneGame<SerpentDecks, SerpentPolicy>({
  campaign: cycle,
  scenario: serpent,
  stats: HERO_STATS,
  codes: [...serpent.cards.map((card) => card.code)],
  intent: serpentIntent,
  policy: DEFAULT_POLICY,
  limit: 6000,
});

export const playGolden = (golden: SerpentGolden, ctx: ReduceContext): SerpentGame => game.playGolden(golden, ctx, { trail: true });
