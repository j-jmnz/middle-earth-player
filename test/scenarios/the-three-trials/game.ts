import type { Difficulty } from "../../../src/catalog/scenario-data.ts";
import type { PlayerIntent, ReduceContext, ScenarioState } from "../../../src/rules/engine/reduce.ts";

import { loadAnyScenario, loadCampaign } from "../../../scripts/data/load-scenarios.ts";
import type { PolicyOptions } from "../../harness/auto-player.ts";
import { fillerLoadout, HERO_STATS, standaloneGame, type PlayedGame } from "../../harness/game-kit.ts";
import { legalTargets } from "../../../src/rules/engine/reduce.ts";
import { attackAllTogether, chooseFirstOrLast, commitAllBut, declineTravel, engageUpTo, policyIntent, undefendedLeastDamaged, type Policy, type Rule } from "../../harness/policy-kit.ts";

const cycle = loadCampaign("the-ring-maker");
const trials = loadAnyScenario("the-three-trials");

// Test helper. A whole standalone game of The Three Trials played by the auto-player, true solo or two-handed. The heroes are big numbers (or too small to quest, or too brittle to survive an attack) and the decks free
// events, so the outcome depends on the engine, the seed and the encounter deck, not on player card play. There is no campaign: no checklist, no log, no earlier part, no Resolution. Each seat quests with all but one hero and keeps that one home to attack. The players take the first stage 2 offered
// (a Choose window), never travel except to Hallowed Circle or to the Barrow that carries the trial's Key (Perseverance: the Guardian cannot be hurt, so exploring the Barrow frees the Key; a travel to any other location would exhaust the home hero), engage every enemy, attack a Guardian first (a defeated
// Guardian leaves its Key free, so the first player claims it) and defend with nobody.
export const TRIALS_POLICY: PolicyOptions = { scout: "", prefer: "", protect: "", play: false, act: false };
// "strong": big-number heroes that win; "weak": heroes too small to quest, so the players lose on threat; "brittle": strong questers that die to an attack.
export type TrialsDecks = "strong" | "weak" | "brittle";

export const trialsLoadout = fillerLoadout;

// The goldens' world and the start of a game: the seeded game's parts every scenario shares (test/harness/game-kit.ts).
export const trialsWorld = (decks: TrialsDecks = "strong") => game.world(decks);
export const trialsStart = (seatCount: 1 | 2, seed: number, difficulty: Difficulty) => game.start(seatCount, seed, difficulty);

export type TrialsPolicy = {
  // The option a Choose window with these answers takes: the first or the last.
  choose: "first" | "last";
};
export const DEFAULT_POLICY: TrialsPolicy = { choose: "first" };

// The policy (test/harness/policy-kit.ts): a list of rules tried in order, then the auto-player's answer with TRIALS_POLICY. A rule answers its own window and returns null for any other. The kit's rules:
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
const KEYS = ["08043", "08044", "08045"];
const HALLOWED_CIRCLE = "08049";
// A travel window: Hallowed Circle once the players can pay its cost, else the Barrow that carries the trial's Key (at Perseverance the Guardian cannot be hurt, so exploring the Barrow frees the Key), else the location with the fewest quest points.
const travelToKey: Rule = (state, ctx) => {
  if (state.window?.kind !== "travel") return null;
  const targets = legalTargets(state, { type: "Travel" }, ctx);
  const code = (id: string) => state.cards[id]?.code ?? "";
  const holdsKey = (id: string) => Object.values(state.cards).some((card) => card.host === id && KEYS.includes(card.code));
  const best = targets.find((id) => code(id) === HALLOWED_CIRCLE) ?? targets.find(holdsKey);
  return best ? { type: "Travel", locationId: best } : null;
};
// The attack window takes a Guardian first: its Key lies free once it is defeated (at Perseverance it cannot be hurt, so the attack falls to the next enemy).
const guardiansFirst = (state: ScenarioState, enemyId: string): number => (["08040", "08041", "08042"].includes(state.cards[enemyId]?.code ?? "") ? 0 : 1);
const rules = (policy: TrialsPolicy): Policy => [chooseFirstOrLast(policy.choose), travelToKey, declineTravel(), commitAllBut(1), undefendedLeastDamaged(), attackAllTogether(guardiansFirst), engageUpTo(99)];

// Every intent is one the reducer listed.
export function trialsIntent(state: ScenarioState, ctx: ReduceContext, memory: Set<string>, policy: TrialsPolicy = DEFAULT_POLICY): PlayerIntent {
  return policyIntent(rules(policy), TRIALS_POLICY, state, ctx, memory);
}

export type TrialsGame = PlayedGame;

// The goldens (src/campaign/scenarios/the-three-trials/golden.test.ts). A standalone game has no earlier parts, Upgraded sides or Mode card.
export type TrialsGolden = { name: string; seatCount: 1 | 2; seed: number; difficulty: Difficulty; decks: TrialsDecks; outcome: "won" | "lost"; policy?: Partial<TrialsPolicy>; lossReason?: string };

// The games to pin (about 890 intents in all, .claude/rules/code-standards.md, Test cost): wins true solo and two-handed on Normal and Easy, each ending when the last progress on Hallowed Circle defeats The Antlered Crown after the three trials. The scenario has two ways to lose:
// a player's threat reaches 50 (heroes too weak to quest, solo and two-handed) and every hero destroyed (solo and two-handed, heroes with 7 hit points and no defense).
export const TRIALS_GOLDENS: readonly TrialsGolden[] = [
  { name: "solo win", seatCount: 1, seed: 3, difficulty: "Normal", decks: "strong", outcome: "won" },
  { name: "two-handed win", seatCount: 2, seed: 4, difficulty: "Normal", decks: "strong", outcome: "won" },
  { name: "Easy solo win", seatCount: 1, seed: 1, difficulty: "Easy", decks: "strong", outcome: "won" },
  { name: "Easy two-handed win", seatCount: 2, seed: 5, difficulty: "Easy", decks: "strong", outcome: "won" },
  { name: "solo loss: threat", seatCount: 1, seed: 4, difficulty: "Normal", decks: "weak", outcome: "lost", lossReason: "No seats remain" },
  { name: "two-handed loss: threat", seatCount: 2, seed: 1, difficulty: "Normal", decks: "weak", outcome: "lost", lossReason: "No seats remain" },
  { name: "solo loss: every hero destroyed", seatCount: 1, seed: 2, difficulty: "Normal", decks: "brittle", outcome: "lost", lossReason: "No seats remain" },
  { name: "two-handed loss: every hero destroyed", seatCount: 2, seed: 1, difficulty: "Normal", decks: "brittle", outcome: "lost", lossReason: "No seats remain" },
];

const game = standaloneGame<TrialsDecks, TrialsPolicy>({
  campaign: cycle,
  scenario: trials,
  stats: HERO_STATS,
  codes: [...trials.cards.map((card) => card.code)],
  intent: trialsIntent,
  policy: DEFAULT_POLICY,
  limit: 6000,
});

export const playGolden = (golden: TrialsGolden, ctx: ReduceContext): TrialsGame => game.playGolden(golden, ctx);
