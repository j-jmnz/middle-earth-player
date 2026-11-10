import { emptyLog, type CampaignLog } from "../../../src/campaign/log.ts";
import type { Difficulty } from "../../../src/catalog/scenario-data.ts";
import type { CampaignFacts, ModeCard } from "../../../src/rules/core/campaign-state.ts";
import { legalIntents, legalTargets, type PlayerIntent, type ReduceContext, type ScenarioState } from "../../../src/rules/engine/reduce.ts";

import { loadCampaign, loadScenario } from "../../../scripts/data/load-scenarios.ts";
import { nextIntent, type PolicyOptions } from "../../harness/auto-player.ts";
import { attackTogether, campaignGame, fillerLoadout, HERO_STATS, type PlayedGame } from "../../harness/game-kit.ts";

const campaign = loadCampaign("the-two-towers");
const hai = loadScenario("the-uruk-hai");

// Test helper. A whole game of The Uruk-hai in Campaign Mode played by the auto-player, true solo or two-handed. The heroes are big numbers (or too small to quest, or too brittle to survive an attack) and the decks free
// events, so the outcome depends on the engine, the seed and the encounter deck, not on player card play. The first character of a seat quests (one hero of each seat is a Captive, and the other attacks); the players engage the enemies of the staging area when the policy says
// (Uglúk first: stage 2 cannot be defeated while he is in play), attack with every ready character together (Uglúk first, once stage 2 allows it), travel to the first location they may, and answer every choice with the first
// option, or the last as the policy says; the Resolution's choices (143071) with the first or the last option too.
export const HAI_POLICY: PolicyOptions = { scout: "", prefer: "", protect: "", play: false, act: false };
// "strong": big-number heroes that win; "weak": heroes too small to quest, so the players lose on threat; "brittle": strong questers that die to an attack.
export type HaiDecks = "strong" | "weak" | "brittle";

export const haiLoadout = fillerLoadout;

// The goldens' world, the plan and start of a game, and the log of a campaign whose earlier parts were won: the seeded game's parts every scenario shares (test/harness/game-kit.ts).
export const haiWorld = (decks: HaiDecks = "strong") => game.world(decks);
export const haiPlan = (seatCount: 1 | 2, log: CampaignLog = emptyLog(seatCount)) => game.plan(seatCount, log);
export const haiStart = (seatCount: 1 | 2, seed: number, difficulty: Difficulty, facts?: Omit<CampaignFacts, "modeCard">, log: CampaignLog = emptyLog(seatCount), modeCard?: ModeCard) => game.start(seatCount, seed, difficulty, { facts, log, modeCard });

export type HaiPolicy = {
  // The option a Choose window or a Resolution question takes: the first or the last.
  choose: "first" | "last";
  // Whether the players engage the enemies of the staging area, one at a time, and attack them (Uglúk first).
  engage: boolean;
  // Whether a character defends every attack ("all") or none: with nobody defending the attack falls on the character with the least damage.
  defend: "none" | "all";
  // The quest: one character of a seat ("one", the goldens' heroes have willpower far above the staging area's threat) or all but one, who stays ready to attack ("most", the saved decklists' real heroes).
  quest: "one" | "most";
};
export const DEFAULT_POLICY: HaiPolicy = { choose: "first", engage: true, defend: "none", quest: "one" };

const UGLUK = "143023";
/** Uglúk is attacked and engaged first; the stage cannot be defeated while he is in play. */
const rankOf = (state: ScenarioState) => (id: string): number => (state.cards[id]?.code === UGLUK ? 0 : 1);

// The auto-player's answer (test/harness/auto-player.ts), except: the Resolution's questions, the travel, an engagement, the attack and a defender are answered as the policy says; a choice takes the first answer, or the last.
// Every intent is one the reducer listed.
export function haiIntent(state: ScenarioState, ctx: ReduceContext, memory: Set<string>, policy: HaiPolicy = DEFAULT_POLICY, options: PolicyOptions = HAI_POLICY): PlayerIntent {
  const intents = legalIntents(state, ctx);
  if (state.window?.kind === "resolution") {
    const offered = intents.flatMap((intent) => (intent.type === "ChooseResolution" ? [intent.optionId] : []));
    return { type: "ChooseResolution", optionId: (policy.choose === "last" ? offered.at(-1) : offered[0]) ?? "" };
  }
  if (state.window?.kind === "choose") return { type: "Choose", optionId: (policy.choose === "last" ? state.window.options.at(-1) : state.window.options[0]) ?? "" };
  if (state.window?.kind === "optionalEngage") {
    const seat = state.seats[state.activeSeat];
    const targets = legalTargets(state, { type: "Engage" }, ctx);
    const wanted = [...targets].sort((left, right) => rankOf(state)(left) - rankOf(state)(right))[0];
    return policy.engage && wanted && seat && seat.engaged.length < seat.heroes.length ? { type: "Engage", enemyId: wanted } : { type: "DeclineEngage" };
  }
  if (state.window?.kind === "travel") {
    const wanted = legalTargets(state, { type: "Travel" }, ctx)[0];
    return wanted ? { type: "Travel", locationId: wanted } : { type: "DeclineTravel" };
  }
  if (state.window?.kind === "playerAttack" && policy.engage) {
    const attack = attackTogether(state, ctx, undefined, rankOf(state));
    if (attack) return attack;
  }
  if (state.window?.kind === "defense") {
    const byDamage = (ids: readonly string[]) => [...ids].sort((left, right) => (state.cards[left]?.damage ?? 0) - (state.cards[right]?.damage ?? 0))[0];
    const defender = policy.defend === "all" && intents.some((intent) => intent.type === "DeclareDefender") ? byDamage(legalTargets(state, { type: "DeclareDefender" }, ctx)) : undefined;
    if (defender) return { type: "DeclareDefender", defenderId: defender };
    const least = byDamage(legalTargets(state, { type: "Undefended" }, ctx));
    if (least) return { type: "Undefended", heroId: least };
  }
  if (state.window?.kind === "pass" && state.mode === "questCommit") {
    const quested = Object.values(state.cards).some((card) => card.committed && card.controller === state.activeSeat);
    const ids = legalTargets(state, { type: "Commit" }, ctx);
    if (!quested && ids.length > 0) return { type: "Commit", cardIds: policy.quest === "most" ? ids.slice(0, Math.max(1, ids.length - 1)) : ids.slice(0, 1) };
  }
  return nextIntent(state, ctx, options, memory, intents);
}

export type HaiGame = PlayedGame;

// The goldens (src/campaign/scenarios/the-uruk-hai/golden.test.ts), also played by the causes and replay tests once test/harness/golden-registry.ts lists them.
// `after`: the log of a campaign whose earlier parts were won. `upgraded`: the Upgraded sides. `mode`: the Hard or Expert Mode card.
export type HaiGolden = { name: string; seatCount: 1 | 2; seed: number; difficulty: Difficulty; decks: HaiDecks; outcome: "won" | "lost"; policy?: Partial<HaiPolicy>; after?: boolean; upgraded?: boolean; mode?: ModeCard; lossReason?: string };

// A few wins (true solo and two-handed, Normal and Easy, brittle heroes that still win) and the ways to lose: heroes too small to quest (the players are eliminated on threat), and players who never engage or attack, so the pursuit value
// reaches 30 (143022:A:2). The wins engage and attack Uglúk first; with one Captive for each seat the other characters quest and attack.
export const HAI_GOLDENS: readonly HaiGolden[] = [
  { name: "true solo, won, Normal", seatCount: 1, seed: 1, difficulty: "Normal", decks: "strong", outcome: "won" },
  { name: "true solo, won, Easy", seatCount: 1, seed: 3, difficulty: "Easy", decks: "strong", outcome: "won" },
  { name: "true solo, won, brittle heroes", seatCount: 1, seed: 1, difficulty: "Normal", decks: "brittle", outcome: "won" },
  { name: "two-handed, won, Normal", seatCount: 2, seed: 2, difficulty: "Normal", decks: "strong", outcome: "won" },
  { name: "two-handed, won, Easy", seatCount: 2, seed: 5, difficulty: "Easy", decks: "strong", outcome: "won" },
  { name: "true solo, lost, heroes too small to quest", seatCount: 1, seed: 1, difficulty: "Normal", decks: "weak", outcome: "lost", lossReason: "No seats remain" },
  { name: "two-handed, lost, heroes too small to quest", seatCount: 2, seed: 2, difficulty: "Normal", decks: "weak", outcome: "lost", lossReason: "No seats remain" },
  { name: "true solo, lost, the pursuit value reaches 30", seatCount: 1, seed: 1, difficulty: "Normal", decks: "strong", outcome: "lost", policy: { engage: false }, lossReason: "To Isengard!: the pursuit value reached 30" },
  { name: "two-handed, lost, the pursuit value reaches 30", seatCount: 2, seed: 2, difficulty: "Normal", decks: "strong", outcome: "lost", policy: { engage: false }, lossReason: "To Isengard!: the pursuit value reached 30" },
];

const game = campaignGame<HaiDecks, HaiPolicy>({
  campaign,
  scenario: hai,
  stats: HERO_STATS,
  // The scenario's own cards; the campaign card's and the campaign's game codes are added by the kit.
  codes: [...hai.cards.map((card) => card.code)],
  intent: haiIntent,
  policy: DEFAULT_POLICY,
  limit: 6000,
  upgraded: [],
});

export const playGolden = (golden: HaiGolden, ctx: ReduceContext): HaiGame => game.playGolden(golden, ctx);
