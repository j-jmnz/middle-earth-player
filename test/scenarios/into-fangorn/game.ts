import type { Difficulty } from "../../../src/catalog/scenario-data.ts";
import { legalTargets } from "../../../src/rules/engine/reduce.ts";
import type { PlayerIntent, ReduceContext, ScenarioState } from "../../../src/rules/engine/reduce.ts";

import { loadAnyScenario, loadCampaign } from "../../../scripts/data/load-scenarios.ts";
import type { PolicyOptions } from "../../harness/auto-player.ts";
import { fillerLoadout, HERO_STATS, standaloneGame, type PlayedGame } from "../../harness/game-kit.ts";
import { attackAllTogether, chooseFirstOrLast, commitAllBut, engageUpTo, policyIntent, triggerActions, undefendedLeastDamaged, type Policy, type Rule } from "../../harness/policy-kit.ts";

const cycle = loadCampaign("the-ring-maker");
const fangorn = loadAnyScenario("into-fangorn");

// Test helper. A whole standalone game of Into Fangorn played by the auto-player, true solo or two-handed. The heroes are big numbers (or too small to quest, or too brittle to survive an attack) and the decks free
// events, so the outcome depends on the engine, the seed and the encounter deck, not on player card play. There is no campaign: no checklist, no log, no earlier part, no Resolution. Each seat quests with all but one hero and keeps that one home to attack with the others' help: a ready hero claims Mugash when he lies free in the staging area (his host is then exhausted and never takes an undefended attack, so Mugash stays), the players travel to Edge of Fangorn first (it guards Mugash), engage every enemy (the Hinder Huorns included: they make no attack and take no shadow card, and each takes progress off the quest) and defend with nobody.
export const FANGORN_POLICY: PolicyOptions = { scout: "", prefer: "", protect: "", play: true, act: false };
// "strong": big-number heroes that win; "weak": heroes too small to quest, so the players lose on threat; "brittle": strong questers that die to an attack.
export type FangornDecks = "strong" | "weak" | "brittle" | "steady";

export const fangornLoadout = fillerLoadout;

// The goldens' world and the start of a game: the seeded game's parts every scenario shares (test/harness/game-kit.ts).
export const fangornWorld = (decks: FangornDecks = "strong") => game.world(decks);
export const fangornStart = (seatCount: 1 | 2, seed: number, difficulty: Difficulty) => game.start(seatCount, seed, difficulty);

export type FangornPolicy = {
  // The option a Choose window with these answers takes: the first or the last.
  choose: "first" | "last";
};
export const DEFAULT_POLICY: FangornPolicy = { choose: "first" };

// The policy (test/harness/policy-kit.ts): a list of rules tried in order, then the auto-player's answer with FANGORN_POLICY. A rule answers its own window and returns null for any other. The kit's rules:
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
// The scenario's own answers are the claim of Mugash, the travel rule and the host rule below, before the kit's.
const MUGASH = "07031";
const EDGE = "07032";
const isMugashHost = (state: ScenarioState, id: string): boolean => Object.values(state.cards).some((card) => card.code === MUGASH && card.host === id);
// A travel window: Edge of Fangorn when it is offered (it guards Mugash), else the location with the fewest printed quest points, else no travel.
const travelToEdge: Rule = (state, ctx) => {
  if (state.window?.kind !== "travel") return null;
  const options = legalTargets(state, { type: "Travel" }, ctx);
  const points = (id: string): number => ctx.cards.get(state.cards[id]?.code ?? "")?.questPoints ?? 99;
  const best = options.find((id) => state.cards[id]?.code === EDGE) ?? [...options].sort((left, right) => points(left) - points(right))[0];
  return best ? { type: "Travel", locationId: best } : { type: "DeclineTravel" };
};
const claimMugash = triggerActions(["07031:action:1"]);
const rules = (policy: FangornPolicy): Policy => [claimMugash, chooseFirstOrLast(policy.choose), travelToEdge, commitAllBut(1, isMugashHost), undefendedLeastDamaged(isMugashHost), attackAllTogether(), engageUpTo(99)];

// Every intent is one the reducer listed.
export function fangornIntent(state: ScenarioState, ctx: ReduceContext, memory: Set<string>, policy: FangornPolicy = DEFAULT_POLICY): PlayerIntent {
  return policyIntent(rules(policy), FANGORN_POLICY, state, ctx, memory);
}

export type FangornGame = PlayedGame;

// The goldens (src/campaign/scenarios/into-fangorn/golden.test.ts). A standalone game has no earlier parts, Upgraded sides or Mode card.
export type FangornGolden = { name: string; seatCount: 1 | 2; seed: number; difficulty: Difficulty; decks: FangornDecks; outcome: "won" | "lost"; policy?: Partial<FangornPolicy>; lossReason?: string };

// TODO: the games to pin (at most 3000 intents in all, .claude/rules/code-standards.md, Test cost), a few wins (true solo and two-handed, Normal and Nightmare) and a few losses (each way the scenario can be lost), each on a fixed seed.
export const FANGORN_GOLDENS: readonly FangornGolden[] = [];

const game = standaloneGame<FangornDecks, FangornPolicy>({
  campaign: cycle,
  scenario: fangorn,
  stats: HERO_STATS,
  // TODO: the cards a game loads besides the scenario's piles and its Nightmare deck.
  codes: [...fangorn.cards.map((card) => card.code)],
  intent: fangornIntent,
  policy: DEFAULT_POLICY,
  limit: 6000,
});

export const playGolden = (golden: FangornGolden, ctx: ReduceContext): FangornGame => game.playGolden(golden, ctx);
