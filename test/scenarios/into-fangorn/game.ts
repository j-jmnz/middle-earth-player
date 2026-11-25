import type { Difficulty } from "../../../src/catalog/scenario-data.ts";
import { legalTargets } from "../../../src/rules/engine/reduce.ts";
import type { PlayerIntent, ReduceContext, ScenarioState } from "../../../src/rules/engine/reduce.ts";

import { loadAnyScenario, loadCampaign } from "../../../scripts/data/load-scenarios.ts";
import type { PolicyOptions } from "../../harness/auto-player.ts";
import { fillerLoadout, HERO_STATS, standaloneGame, type PlayedGame } from "../../harness/game-kit.ts";
import { attackAllTogether, chooseFirstOrLast, commitAllBut, engageUpTo, policyIntent, triggerActions, undefendedLeastDamaged, type Policy, type Rule } from "../../harness/policy-kit.ts";

const cycle = loadCampaign("the-ring-maker");
const fangorn = loadAnyScenario("into-fangorn");

// Test helper. A whole standalone game of Into Fangorn played by the auto-player, true solo or two-handed. The heroes are big numbers (or too small to quest, or too brittle to survive) and the decks free
// events, so the outcome depends on the engine, the seed and the encounter deck, not on player card play. There is no campaign: no checklist, no log, no earlier part, no Resolution. Each seat quests with all but one hero and keeps that one home to attack with the others' help: a ready hero claims Mugash when he lies free in the staging area (his host is then exhausted and never takes an undefended attack, so Mugash stays), the players travel to Edge of Fangorn first (it guards Mugash), engage every enemy (the Hinder Huorns included: they make no attack and take no shadow card, and each takes progress off the quest) and defend with nobody.
export const FANGORN_POLICY: PolicyOptions = { scout: "", prefer: "", protect: "", play: true, act: false };
// "strong": big-number heroes that win; "weak": heroes too small to quest, so the players lose on threat; "brittle": slow questers with 3 hit points; "steady": slow questers (willpower 6) that survive.
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

// The games to pin (about 450 intents in all, .claude/rules/code-standards.md, Test cost): wins true solo and two-handed on Normal and Easy, every one by defeating stage 2 with Mugash on a hero (stage 3 cannot win). The strong heroes win in 3 rounds; the
// steady ones (willpower 6) are slow, so the Easy games run their Time out: stage 3, back to stage 2 and the win. The losses are the two ways to lose here, each solo and two-handed: every player's threat reaches 50 (heroes too weak to quest) and every hero destroyed (heroes too brittle).
export const FANGORN_GOLDENS: readonly FangornGolden[] = [
  { name: "solo win", seatCount: 1, seed: 1, difficulty: "Normal", decks: "strong", outcome: "won" },
  { name: "two-handed win", seatCount: 2, seed: 3, difficulty: "Normal", decks: "steady", outcome: "won" },
  { name: "Easy solo win through stage 3", seatCount: 1, seed: 7, difficulty: "Easy", decks: "steady", outcome: "won" },
  { name: "Easy two-handed win through stage 3", seatCount: 2, seed: 3, difficulty: "Easy", decks: "steady", outcome: "won" },
  { name: "solo loss: threat", seatCount: 1, seed: 2, difficulty: "Normal", decks: "weak", outcome: "lost", lossReason: "No seats remain" },
  { name: "two-handed loss: threat", seatCount: 2, seed: 1, difficulty: "Normal", decks: "weak", outcome: "lost", lossReason: "No seats remain" },
  { name: "solo loss: every hero destroyed", seatCount: 1, seed: 6, difficulty: "Normal", decks: "brittle", outcome: "lost", lossReason: "No seats remain" },
  { name: "two-handed loss: every hero destroyed", seatCount: 2, seed: 2, difficulty: "Normal", decks: "brittle", outcome: "lost", lossReason: "No seats remain" },
];

const game = standaloneGame<FangornDecks, FangornPolicy>({
  campaign: cycle,
  scenario: fangorn,
  stats: { ...HERO_STATS, brittle: { threat: 3, willpower: 6, attack: 12, defense: 0, health: 3 } },
  codes: [...fangorn.cards.map((card) => card.code)],
  intent: fangornIntent,
  policy: DEFAULT_POLICY,
  limit: 6000,
});

export const playGolden = (golden: FangornGolden, ctx: ReduceContext): FangornGame => game.playGolden(golden, ctx);
