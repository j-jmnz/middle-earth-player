import type { Difficulty } from "../../../src/catalog/scenario-data.ts";
import type { PlayerIntent, ReduceContext, ScenarioState } from "../../../src/rules/engine/reduce.ts";

import { loadAnyScenario, loadCampaign } from "../../../scripts/data/load-scenarios.ts";
import type { PolicyOptions } from "../../harness/auto-player.ts";
import { fillerLoadout, HERO_STATS, playToEnd, standaloneGame, type PlayedGame } from "../../harness/game-kit.ts";
import { attackAllTogether, chooseOption, commitAllBut, declineAttack, defendFirst, engageUpTo, policyIntent, travelFewestQuestPoints, triggerActions, type Policy } from "../../harness/policy-kit.ts";

const cycle = loadCampaign("against-the-shadow");
const vale = loadAnyScenario("the-morgul-vale");

// Test helper. A whole standalone game of The Morgul Vale played by the auto-player, true solo or two-handed. The heroes are big numbers (or too small to quest, or too brittle to survive an attack) and the decks free
// events, so the outcome depends on the engine, the seed and the encounter deck, not on player card play. There is no campaign: no checklist, no log, no earlier part, no Resolution. The policy: the choices take the answers
// the policy names for each card (the Sorcerer's, Impenetrable Fog's, Sleepless Malice's, Morgul Road's), the players travel to the location with the fewest quest points (The White Bridge never, as long as `bridge` is
// false), quest with every hero but the reserve, engage the Captain of the stage first and then the enemies that offer themselves, defend with the first hero who may, and attack together, the Captain first.
export const VALE_POLICY: PolicyOptions = { scout: "", prefer: "", protect: "", play: false, act: false };
// "strong": big-number heroes that win; "steady": strong attackers with a willpower of 6, so the quest is slow and the staging area grows; "weak": heroes too small to quest, so the players lose on threat; "brittle": strong questers that die to an attack.
export type ValeDecks = "strong" | "steady" | "weak" | "brittle";

export const valeLoadout = fillerLoadout;

// The goldens' world and the start of a game: the seeded game's parts every scenario shares (test/harness/game-kit.ts).
export const valeWorld = (decks: ValeDecks = "strong") => game.world(decks);
export const valeStart = (seatCount: 1 | 2, seed: number, difficulty: Difficulty) => game.start(seatCount, seed, difficulty);

export type ValePolicy = {
  // The answer to a choice that none of the next four owns: the first option or the last.
  choose: "first" | "last";
  // Morgul Sorcerer's shadow: a token on To the Tower, or the attack undefended.
  sorcerer: "place" | "undefended";
  // Impenetrable Fog: 3 tokens on To the Tower, or a card revealed for each player.
  fog: "tokens" | "reveal";
  // Sleepless Malice, for each player: a token, or 3 random cards of the hand discarded.
  malice: "token" | "discard";
  // Morgul Road (response): a token removed from To the Tower, or 1 damage on an enemy; "" leaves the Response unused.
  road: "remove" | "damage" | "";
  // Heroes of each seat kept out of the quest, so they can defend and attack.
  reserve: number;
  // The attacks a seat defends in a round, the first ones; the others go undefended, so a hero stays ready to attack.
  defend: number;
  // The most enemies a seat engages by choice.
  engage: number;
  // The Captain of the stage is engaged first by choice when true; the other enemies only.
  captain: boolean;
  // The seats play the cards of their hands and use their Actions (a saved decklist's allies and events); the stand-in heroes' decks hold only free events.
  play: boolean;
  act: boolean;
};
export const DEFAULT_POLICY: ValePolicy = { choose: "first", sorcerer: "undefended", fog: "reveal", malice: "discard", road: "remove", reserve: 2, defend: 1, engage: 3, captain: true, play: false, act: false };

export const REARGUARD = "06144";
export const BETRAYAL = "06145";
export const RIDER = "06146";
export const TOWER = "06147";
export const BODYGUARD = "06148";
export const SORCERER = "06149";
export const TRACKER = "06150";
export const MURZAG = "06151";
export const ALCARON = "06152";
export const NAZGUL = "06153";
export const ROAD = "06154";
export const VALE_LOCATION = "06155";
export const BRIDGE = "06156";
export const POWER = "05061";
export const FOG = "06157";
export const MALICE = "06158";
export const TERROR = "06159";
export const DEAD_CITY = "06160";
export const CAPTAINS: readonly string[] = [MURZAG, ALCARON, NAZGUL];
const codeOf = (state: ScenarioState, id: string | null | undefined): string => state.cards[id ?? ""]?.code ?? "";

/** The rank of an enemy for the attack and the engagement: the Captains first, the Bodyguards (they take the Captains' damage) next. */
const rank = (state: ScenarioState, id: string): number => (CAPTAINS.includes(codeOf(state, id)) ? 0 : codeOf(state, id) === BODYGUARD ? 1 : 2);

// The policy (test/harness/policy-kit.ts; POLICY_KIT_RULES lists the rules), in the order they are tried: the choices (the options tell the card, any other choice the first or last), Morgul Road's Response (the first
// player's, each time the engine offers it, after the location was explored), the travel (the fewest quest points; The White Bridge has none printed, so it comes last), the defense, the quest commit (every character
// but the last `reserve` heroes), the attack (every ready character together, the Captain first), the engagement (the best rank the seat may take while it is engaged with fewer than `engage` enemies), no attack.
const rules = (policy: ValePolicy): Policy => [
  chooseOption((_state, options) => (options.includes("place") ? policy.sorcerer : options.includes("tokens") ? policy.fog : options.includes("discard") ? policy.malice : options.includes("remove") ? policy.road || undefined : undefined), policy.choose),
  ...(policy.road ? [triggerActions([`${ROAD}:response:1`])] : []),
  travelFewestQuestPoints(),
  defendFirst(policy.defend),
  commitAllBut(policy.reserve),
  attackAllTogether(rank),
  engageUpTo(policy.engage, { allow: (state, id) => policy.captain || !CAPTAINS.includes(codeOf(state, id)), rank }),
  declineAttack(),
];

// The auto-player's answer (test/harness/auto-player.ts) for a window no rule owns. Every intent is one the reducer listed.
export function valeIntent(state: ScenarioState, ctx: ReduceContext, memory: Set<string>, policy: ValePolicy = DEFAULT_POLICY): PlayerIntent {
  return policyIntent(rules(policy), { ...VALE_POLICY, play: policy.play, act: policy.act }, state, ctx, memory);
}

export type ValeGame = PlayedGame;

// The goldens (src/campaign/scenarios/the-morgul-vale/golden.test.ts). A standalone game has no earlier parts, Upgraded sides or Mode card.
export type ValeGolden = { name: string; seatCount: 1 | 2; seed: number; difficulty: Difficulty; decks: ValeDecks; outcome: "won" | "lost"; policy?: Partial<ValePolicy>; lossReason?: string };

export const TOKENS: Partial<ValePolicy> = { sorcerer: "place", fog: "tokens", malice: "token", road: "damage" };
export const VALE_GOLDENS: readonly ValeGolden[] = [
  { name: "solo win", seatCount: 1, seed: 83, difficulty: "Normal", decks: "strong", outcome: "won" },
  { name: "two-handed win", seatCount: 2, seed: 38, difficulty: "Normal", decks: "strong", outcome: "won" },
  { name: "Easy solo win", seatCount: 1, seed: 7, difficulty: "Easy", decks: "strong", outcome: "won" },
  { name: "solo loss: 10 tokens on To the Tower", seatCount: 1, seed: 17, difficulty: "Normal", decks: "strong", outcome: "lost", policy: TOKENS, lossReason: "10 progress tokens" },
  { name: "solo loss: every hero destroyed", seatCount: 1, seed: 6, difficulty: "Normal", decks: "brittle", outcome: "lost", lossReason: "No seats remain" },
  { name: "solo loss: threat 50", seatCount: 1, seed: 5, difficulty: "Normal", decks: "weak", outcome: "lost", lossReason: "No seats remain" },
];

const game = standaloneGame<ValeDecks, ValePolicy>({
  campaign: cycle,
  scenario: vale,
  stats: HERO_STATS,
  codes: [...vale.cards.map((card) => card.code)],
  intent: valeIntent,
  policy: DEFAULT_POLICY,
  limit: 6000,
});

// A golden keeps the state after each intent (`trail`), so the suite's checks read the moments between intents from the one play.
export const playGolden = (golden: ValeGolden, ctx: ReduceContext): ValeGame => {
  const policy = { ...DEFAULT_POLICY, ...golden.policy };
  return playToEnd(game.start(golden.seatCount, golden.seed, golden.difficulty), ctx, (state, memory) => valeIntent(state, ctx, memory, policy), 6000, { trail: true });
};
