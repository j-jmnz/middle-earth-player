import type { Difficulty } from "../../../src/catalog/scenario-data.ts";
import type { PlayerIntent, ReduceContext, ScenarioState } from "../../../src/rules/engine/reduce.ts";

import { loadAnyScenario, loadCampaign } from "../../../scripts/data/load-scenarios.ts";
import type { LoadoutSeat } from "../../../src/campaign/loadout.ts";
import { legalTargets } from "../../../src/rules/engine/reduce.ts";
import type { PolicyOptions } from "../../harness/auto-player.ts";
import { fillerLoadout, HERO_STATS, standaloneGame, type PlayedGame } from "../../harness/game-kit.ts";
import { attackEach, chooseFirstOrLast, commitAllBut, engageUpTo, policyIntent, undefendedLeastDamaged, type Policy, type Rule } from "../../harness/policy-kit.ts";

const cycle = loadCampaign("the-ring-maker");
const isen = loadAnyScenario("the-fords-of-isen");

// Test helper. A whole standalone game of The Fords of Isen played by the auto-player, true solo or two-handed. The heroes are big numbers (or too small to quest, or too brittle to survive an attack) and the decks free
// events, so the outcome depends on the engine, the seed and the encounter deck, not on player card play. There is no campaign: no checklist, no log, no earlier part, no Resolution. The decks are six filler events: the Fords' cards count the cards in hand, so a long deck only grows X. Each seat quests with one hero and keeps two home to attack (a defender is exhausted, so nobody defends: the damage of an attack goes to the least damaged hero), travels to The Islet first (exploring it frees Gríma, and stage 1B waits until the first player controls him), engages every enemy and attacks one each, so stage 3B (which waits until no enemy is in play) ends. Gríma never quests, attacks or takes damage (one damage destroys him and the players lose).
export const ISEN_POLICY: PolicyOptions = { scout: "", prefer: "", protect: "", play: true, act: false };
// "strong": big-number heroes that win; "steady": strong attackers with a willpower of 6, so the quest never explores The Islet in time; "weak": heroes too small to quest, so the quest never frees Gríma and the time counters run out ("Gríma left play"); "brittle": strong questers that die to an attack.
export type IsenDecks = "strong" | "weak" | "brittle" | "steady";

// The decks are short (six filler events, the opening hand): the Fords' cards count the cards in hand (threat, damage, attacks), and a thirty-card deck that nobody plays grows the hand past what the heroes survive.
export const isenLoadout = (seatCount: 1 | 2): LoadoutSeat[] => fillerLoadout(seatCount).map((seat) => ({ ...seat, deck: seat.deck.slice(0, 6) }));

// The goldens' world and the start of a game: the seeded game's parts every scenario shares (test/harness/game-kit.ts).
export const isenWorld = (decks: IsenDecks = "strong") => game.world(decks);
export const isenStart = (seatCount: 1 | 2, seed: number, difficulty: Difficulty) => game.start(seatCount, seed, difficulty);

export type IsenPolicy = {
  // The option a Choose window with these answers takes: the first or the last.
  choose: "first" | "last";
};
export const DEFAULT_POLICY: IsenPolicy = { choose: "first" };

// The policy (test/harness/policy-kit.ts): a list of rules tried in order, then the auto-player's answer with ISEN_POLICY. A rule answers its own window and returns null for any other. The kit's rules:
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
// The scenario's own answers are the Islet travel rule below, before the kit's.
const ISLET = "07017";
// A travel window: The Islet when it is offered, else the location with the fewest printed quest points, else no travel.
const travelToIslet: Rule = (state, ctx) => {
  if (state.window?.kind !== "travel") return null;
  const options = legalTargets(state, { type: "Travel" }, ctx);
  const points = (id: string): number => ctx.cards.get(state.cards[id]?.code ?? "")?.questPoints ?? 99;
  const best = options.find((id) => state.cards[id]?.code === ISLET) ?? [...options].sort((left, right) => points(left) - points(right))[0];
  return best ? { type: "Travel", locationId: best } : { type: "DeclineTravel" };
};
const GRIMA = "07016";
const isGrima = (state: ScenarioState, id: string): boolean => state.cards[id]?.code === GRIMA;
const rules = (policy: IsenPolicy): Policy => [chooseFirstOrLast(policy.choose), travelToIslet, commitAllBut(2, isGrima), undefendedLeastDamaged((state, id) => isGrima(state, id)), attackEach({ once: true, may: (state, id) => !isGrima(state, id) }), engageUpTo(99)];

// Every intent is one the reducer listed.
export function isenIntent(state: ScenarioState, ctx: ReduceContext, memory: Set<string>, policy: IsenPolicy = DEFAULT_POLICY): PlayerIntent {
  return policyIntent(rules(policy), ISEN_POLICY, state, ctx, memory);
}

export type IsenGame = PlayedGame;

// The goldens (src/campaign/scenarios/the-fords-of-isen/golden.test.ts). A standalone game has no earlier parts, Upgraded sides or Mode card.
export type IsenGolden = { name: string; seatCount: 1 | 2; seed: number; difficulty: Difficulty; decks: IsenDecks; outcome: "won" | "lost"; policy?: Partial<IsenPolicy>; lossReason?: string };

// The games to pin (about 940 intents in all, .claude/rules/code-standards.md, Test cost): wins true solo and two-handed on Normal and Easy, and a loss for each way to lose: Gríma leaves play (solo: heroes too weak to quest; two-handed: heroes that quest too slowly to explore The Islet; either way stage 1B's last time counter goes)
// and no seats remain (heroes too brittle), each solo and two-handed.
export const ISEN_GOLDENS: readonly IsenGolden[] = [
  { name: "solo win", seatCount: 1, seed: 2, difficulty: "Normal", decks: "strong", outcome: "won" },
  { name: "two-handed win", seatCount: 2, seed: 5, difficulty: "Normal", decks: "strong", outcome: "won" },
  { name: "Easy solo win", seatCount: 1, seed: 5, difficulty: "Easy", decks: "strong", outcome: "won" },
  { name: "Easy two-handed win", seatCount: 2, seed: 5, difficulty: "Easy", decks: "strong", outcome: "won" },
  { name: "solo loss: Gríma leaves play", seatCount: 1, seed: 1, difficulty: "Normal", decks: "weak", outcome: "lost", lossReason: "Gríma left play" },
  { name: "two-handed loss: Gríma leaves play", seatCount: 2, seed: 7, difficulty: "Normal", decks: "steady", outcome: "lost", lossReason: "Gríma left play" },
  { name: "solo loss: every hero destroyed", seatCount: 1, seed: 1, difficulty: "Normal", decks: "brittle", outcome: "lost", lossReason: "No seats remain" },
  { name: "two-handed loss: every hero destroyed", seatCount: 2, seed: 1, difficulty: "Normal", decks: "brittle", outcome: "lost", lossReason: "No seats remain" },
];

const game = standaloneGame<IsenDecks, IsenPolicy>({
  campaign: cycle,
  scenario: isen,
  stats: { strong: HERO_STATS.strong, weak: HERO_STATS.weak, brittle: HERO_STATS.brittle, steady: HERO_STATS.steady },
  codes: [...isen.cards.map((card) => card.code)],
  loadout: isenLoadout,
  intent: isenIntent,
  policy: DEFAULT_POLICY,
  limit: 6000,
});

export const playGolden = (golden: IsenGolden, ctx: ReduceContext): IsenGame => game.playGolden(golden, ctx);
