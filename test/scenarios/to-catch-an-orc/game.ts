import type { Difficulty } from "../../../src/catalog/scenario-data.ts";
import { legalTargets } from "../../../src/rules/engine/reduce.ts";
import type { PlayerIntent, ReduceContext, ScenarioState } from "../../../src/rules/engine/reduce.ts";

import { loadAnyScenario, loadCampaign } from "../../../scripts/data/load-scenarios.ts";
import type { PolicyOptions } from "../../harness/auto-player.ts";
import { fillerLoadout, HERO_STATS, standaloneGame, type PlayedGame } from "../../harness/game-kit.ts";
import { attackAllTogether, chooseOption, commitAllBut, engageUpTo, policyIntent, travelFewestQuestPoints, triggerActions, undefendedLeastDamaged, type Policy, type Rule } from "../../harness/policy-kit.ts";

const cycle = loadCampaign("the-ring-maker");
const orc = loadAnyScenario("to-catch-an-orc");

// Test helper. A whole standalone game of To Catch an Orc played by the auto-player, true solo or two-handed. The heroes are big numbers (or too small to quest, or too brittle to survive an attack) and the decks free
// events, so the outcome depends on the engine, the seed and the encounter deck, not on player card play. There is no campaign: no checklist, no log, no earlier part, no Resolution. Each seat quests with one hero and keeps two home to attack together: Mugash first (the hero Mugash attaches to is exhausted for good, so the seat keeps fewer attackers), travels to the location with the fewest quest points, engages every enemy and defends with nobody (the stand-in heroes have huge Willpower, attack and health, so the damage matters only for the "brittle" and "frail" heroes). Searching for Mugash's Response is taken once Mugash is in play, advancing to stage 3; the decks are the 30 filler events (20 go out of play at Setup, so the hand stays small).
export const ORC_POLICY: PolicyOptions = { scout: "", prefer: "", protect: "", play: true, act: false };
// "strong": big-number heroes that win; "brittle": strong questers that die to an attack; "frail": strong questers with 15 hit points, so the hero that holds Mugash falls when every attack goes to it.
export type OrcDecks = "strong" | "brittle" | "frail";

export const orcLoadout = fillerLoadout;

// The goldens' world and the start of a game: the seeded game's parts every scenario shares (test/harness/game-kit.ts).
export const orcWorld = (decks: OrcDecks = "strong") => game.world(decks);
export const orcStart = (seatCount: 1 | 2, seed: number, difficulty: Difficulty) => game.start(seatCount, seed, difficulty);

export type OrcPolicy = {
  // The option a Choose window with these answers takes: the first or the last.
  choose: "first" | "last";
  // Who takes an undefended attack: the least damaged hero, or the hero that holds Mugash (so the players lose when it falls).
  hit: "least" | "host";
};
export const DEFAULT_POLICY: OrcPolicy = { choose: "first", hit: "least" };

// The policy (test/harness/policy-kit.ts): a list of rules tried in order, then the auto-player's answer with ORC_POLICY. A rule answers its own window and returns null for any other. The kit's rules:
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
// The scenario's own answers are the Response rule, the Choose rule, the host rule and the attack order below, before the kit's.
const MUGASH = "07024";
// Searching for Mugash's Response is taken once Mugash is in play (staging, engaged or attached): the "advance" option (the Choose rule below) and never the one that adds a time counter.
const mugashInPlay = (state: ScenarioState): boolean => Object.values(state.cards).some((card) => card.code === MUGASH && ["staging", "engaged", "attached", "play"].includes(card.zone));
const advanceWhenMugash: Rule = (state, ctx, memory) => (mugashInPlay(state) ? triggerActions(["07063:response:1"])(state, ctx, memory) : null);
// A defense window: nobody defends, the hero that holds Mugash takes the attack (else the least damaged hero).
const undefendedHost: Rule = (state, ctx, memory) => {
  if (state.window?.kind !== "defense") return null;
  const holder = legalTargets(state, { type: "Undefended" }, ctx).find((id) => Object.values(state.cards).some((card) => card.code === MUGASH && card.host === id));
  return holder ? { type: "Undefended", heroId: holder } : leastDamaged(state, ctx, memory);
};
const leastDamaged = undefendedLeastDamaged();
const rules = (policy: OrcPolicy): Policy => [advanceWhenMugash, chooseOption((_state, options) => options.find((id) => id.endsWith("advance")), policy.choose), travelFewestQuestPoints(), commitAllBut(2), policy.hit === "host" ? undefendedHost : leastDamaged, attackAllTogether((state, id) => (state.cards[id]?.code === MUGASH ? 0 : 1)), engageUpTo(99)];

// Every intent is one the reducer listed.
export function orcIntent(state: ScenarioState, ctx: ReduceContext, memory: Set<string>, policy: OrcPolicy = DEFAULT_POLICY): PlayerIntent {
  return policyIntent(rules(policy), ORC_POLICY, state, ctx, memory);
}

export type OrcGame = PlayedGame;

// The goldens (src/campaign/scenarios/to-catch-an-orc/golden.test.ts). A standalone game has no earlier parts, Upgraded sides or Mode card.
export type OrcGolden = { name: string; seatCount: 1 | 2; seed: number; difficulty: Difficulty; decks: OrcDecks; outcome: "won" | "lost"; policy?: Partial<OrcPolicy>; lossReason?: string };

// The games to pin (about 1300 intents in all, .claude/rules/code-standards.md, Test cost): wins true solo and two-handed on Normal and Easy (the Normal wins reach Time refills and the Guard), and a loss for each way to lose: the hero that holds Mugash leaves play (frail heroes, every
// undefended attack on the holder: solo and two-handed) and no seats remain (brittle heroes, solo and two-handed).
export const ORC_GOLDENS: readonly OrcGolden[] = [
  { name: "solo win", seatCount: 1, seed: 1, difficulty: "Normal", decks: "strong", outcome: "won" },
  { name: "two-handed win", seatCount: 2, seed: 2, difficulty: "Normal", decks: "strong", outcome: "won" },
  { name: "Easy solo win", seatCount: 1, seed: 4, difficulty: "Easy", decks: "strong", outcome: "won" },
  { name: "Easy two-handed win", seatCount: 2, seed: 2, difficulty: "Easy", decks: "strong", outcome: "won" },
  { name: "solo loss: Mugash's hero leaves play", seatCount: 1, seed: 5, difficulty: "Normal", decks: "frail", outcome: "lost", lossReason: "left play", policy: { hit: "host" } },
  { name: "two-handed loss: Mugash's hero leaves play", seatCount: 2, seed: 1, difficulty: "Normal", decks: "frail", outcome: "lost", lossReason: "left play", policy: { hit: "host" } },
  { name: "solo loss: every hero destroyed", seatCount: 1, seed: 1, difficulty: "Normal", decks: "brittle", outcome: "lost", lossReason: "No seats remain" },
  { name: "two-handed loss: every hero destroyed", seatCount: 2, seed: 1, difficulty: "Normal", decks: "brittle", outcome: "lost", lossReason: "No seats remain" },
];

const game = standaloneGame<OrcDecks, OrcPolicy>({
  campaign: cycle,
  scenario: orc,
  stats: { strong: { threat: 3, willpower: 30, attack: 30, defense: 0, health: 1000 }, brittle: HERO_STATS.brittle, frail: { threat: 3, willpower: 30, attack: 30, defense: 0, health: 15 } },
  codes: [...orc.cards.map((card) => card.code)],
  intent: orcIntent,
  policy: DEFAULT_POLICY,
  limit: 6000,
});

export const playGolden = (golden: OrcGolden, ctx: ReduceContext): OrcGame => game.playGolden(golden, ctx);
