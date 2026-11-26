import type { Difficulty } from "../../../src/catalog/scenario-data.ts";
import type { PlayerIntent, ReduceContext, ScenarioState } from "../../../src/rules/engine/reduce.ts";

import { loadAnyScenario, loadCampaign } from "../../../scripts/data/load-scenarios.ts";
import type { PolicyOptions } from "../../harness/auto-player.ts";
import { fillerLoadout, HERO_STATS, standaloneGame, type PlayedGame } from "../../harness/game-kit.ts";
import { archeryLeastDamaged, attackAllTogether, chooseOption, commitAllBut, engageUpTo, policyIntent, undefendedLeastDamaged, type Policy } from "../../harness/policy-kit.ts";

const cycle = loadCampaign("haradrim");
const mordor = loadAnyScenario("the-long-arm-of-mordor");

// Test helper. A whole standalone game of The Long Arm of Mordor played by the auto-player, true solo or two-handed. The heroes are big numbers (or too small to quest, or too brittle to survive an attack) and the decks free
// events, so the outcome depends on the engine, the seed and the encounter deck, not on player card play. There is no campaign: no checklist, no log, no earlier part, no Resolution. Each player takes the objective-hero with the most Willpower (Firyal, then Yazan, Jubayr, Kahliel), so the quest can place progress on stage 1 at once; the Enforcers' damage and every undefended attack go to a hero that is not an objective-hero (a staged hero at stages 1 and 2, the strongest hero after); every character quests but, from stage 3, the last hero a player controls that is no objective-hero (it attacks the guards and the Orcs together); nobody defends, and every other choice takes its first option.
export const MORDOR_POLICY: PolicyOptions = { scout: "", prefer: "", protect: "", play: false, act: false };
// "strong": big-number heroes that win; "tense": strong heroes that start at a threat of 14 each, so the threat reaches 50; "brittle": strong questers that die to an attack.
export type MordorDecks = "strong" | "tense" | "brittle";

export const mordorLoadout = fillerLoadout;

// The goldens' world and the start of a game: the seeded game's parts every scenario shares (test/harness/game-kit.ts).
export const mordorWorld = (decks: MordorDecks = "strong") => game.world(decks);
export const mordorStart = (seatCount: 1 | 2, seed: number, difficulty: Difficulty) => game.start(seatCount, seed, difficulty);

export type MordorPolicy = {
  // The option a Choose window with these answers takes: the first or the last.
  choose: "first" | "last";
};
export const DEFAULT_POLICY: MordorPolicy = { choose: "first" };

// The policy (test/harness/policy-kit.ts): a list of rules tried in order, then the auto-player's answer with MORDOR_POLICY. A rule answers its own window and returns null for any other. The kit's rules:
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
// A Choose window takes a card that is not an objective-hero when it offers one (the Enforcers' damage goes to a staged hero, never to the objective-hero whose loss eliminates its player).
// When only objective-heroes are offered (the Setup's pick) the one with the most Willpower is first: Firyal (3), then Yazan, Jubayr and Kahliel.
const OBJECTIVE_HEROES: readonly string[] = ["16032", "16033", "16034", "16031"];
const sparingObjective = (state: ScenarioState, options: readonly string[]): string | undefined =>
  options.find((id) => state.cards[id] && !OBJECTIVE_HEROES.includes(state.cards[id].code)) ?? [...options].sort((left, right) => OBJECTIVE_HEROES.indexOf(state.cards[left]?.code ?? "") - OBJECTIVE_HEROES.indexOf(state.cards[right]?.code ?? ""))[0];

const isObjective = (state: ScenarioState, id: string) => OBJECTIVE_HEROES.includes(state.cards[id]?.code ?? "");

// From stage 3 (the guards) the last hero a player controls that is no objective-hero stays home to attack (the others, the objective-hero too, quest).
const stayHome = (state: ScenarioState, id: string): boolean => {
  // Stages 1 and 2 need no attacker: every character quests, so the staged heroes taken back are not left home.
  if ((state.cards[state.questStage ?? ""]?.code ?? "") < "16073") return false;
  const seat = state.seats[state.activeSeat];
  const mine = (seat?.heroes ?? []).filter((hero) => state.cards[hero]?.controller === state.activeSeat && !isObjective(state, hero));
  return mine.length > 0 && mine[mine.length - 1] === id;
};

const rules = (policy: MordorPolicy): Policy => [chooseOption(sparingObjective, policy.choose), commitAllBut(0, stayHome), archeryLeastDamaged(isObjective), undefendedLeastDamaged(isObjective), engageUpTo(), attackAllTogether()];

// Every intent is one the reducer listed.
export function mordorIntent(state: ScenarioState, ctx: ReduceContext, memory: Set<string>, policy: MordorPolicy = DEFAULT_POLICY): PlayerIntent {
  return policyIntent(rules(policy), MORDOR_POLICY, state, ctx, memory);
}

export type MordorGame = PlayedGame;

// The goldens (src/campaign/scenarios/the-long-arm-of-mordor/golden.test.ts). A standalone game has no earlier parts, Upgraded sides or Mode card.
export type MordorGolden = { name: string; seatCount: 1 | 2; seed: number; difficulty: Difficulty; decks: MordorDecks; outcome: "won" | "lost"; policy?: Partial<MordorPolicy>; lossReason?: string };

// The games to pin (.claude/rules/code-standards.md, Test cost): wins true solo and two-handed (the players free the staged heroes, kill the guards and defeat the Uruk Chieftain; Easy deals a smaller encounter deck but the same Setup (standalone.test.ts), and the scenario has no Nightmare deck, so
// neither has a golden of its own) and each way to lose: every player's threat at 50 (heroes that start at a threat of 14) and every player eliminated by heroes destroyed (heroes too brittle for the attacks, the objective-heroes among them).
export const MORDOR_GOLDENS: readonly MordorGolden[] = [
  { name: "true solo, won, Normal", seatCount: 1, seed: 7, difficulty: "Normal", decks: "strong", outcome: "won" },
  { name: "two-handed, won, Normal", seatCount: 2, seed: 7, difficulty: "Normal", decks: "strong", outcome: "won" },
  { name: "true solo, lost, threat reaches 50", seatCount: 1, seed: 2, difficulty: "Normal", decks: "tense", outcome: "lost", lossReason: "No seats remain" },
  { name: "two-handed, lost, threat reaches 50", seatCount: 2, seed: 2, difficulty: "Normal", decks: "tense", outcome: "lost", lossReason: "No seats remain" },
  { name: "true solo, lost, every hero destroyed", seatCount: 1, seed: 1, difficulty: "Normal", decks: "brittle", outcome: "lost", lossReason: "No seats remain" },
  { name: "two-handed, lost, every hero destroyed", seatCount: 2, seed: 7, difficulty: "Normal", decks: "brittle", outcome: "lost", lossReason: "No seats remain" },
];

const game = standaloneGame<MordorDecks, MordorPolicy>({
  campaign: cycle,
  scenario: mordor,
  stats: HERO_STATS,
  codes: [...mordor.cards.map((card) => card.code)],
  intent: mordorIntent,
  policy: DEFAULT_POLICY,
  limit: 6000,
});

export const playGolden = (golden: MordorGolden, ctx: ReduceContext): MordorGame => game.playGolden(golden, ctx);
