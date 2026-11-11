import { emptyLog, type CampaignLog } from "../../../src/campaign/log.ts";
import type { Difficulty } from "../../../src/catalog/scenario-data.ts";
import type { CampaignFacts, ModeCard } from "../../../src/rules/core/campaign-state.ts";
import { legalIntents, legalTargets, type PlayerIntent, type ReduceContext, type ScenarioState } from "../../../src/rules/engine/reduce.ts";

import { loadCampaign, loadScenario } from "../../../scripts/data/load-scenarios.ts";
import { nextIntent, type PolicyOptions } from "../../harness/auto-player.ts";
import { attackTogether, campaignGame, fillerLoadout, HERO_STATS, type PlayedGame } from "../../harness/game-kit.ts";

const campaign = loadCampaign("the-two-towers");
const deep = loadScenario("helms-deep");

// Test helper. A whole game of Helm's Deep in Campaign Mode played by the auto-player, true solo or two-handed. The heroes are big numbers (or too small to quest, or too brittle to survive an attack) and the decks free
// events, so the outcome depends on the engine, the seed and the encounter deck, not on player card play. The first character of a seat quests (the stage's Defense keyword places the Threat that beats the Willpower as progress for the
// encounter deck, so a quest that wins places nothing and a quest that loses never raises the players' threat); the players engage the enemies of the staging area when the policy says, attack with every ready character together,
// travel to the first location they may, and answer every choice with the first option, or the last as the policy says (the Setup choice of 143072 and Night Without End's; the Resolution's choices of 143077 too).
export const DEEP_POLICY: PolicyOptions = { scout: "", prefer: "", protect: "", play: false, act: false };
// "strong": big-number heroes that win; "weak": heroes too small to quest, so the players lose on threat; "brittle": strong questers that die to an attack.
// "hot": strong heroes whose starting threat is 45, so the refresh phase and Deeping Wall raise it to the elimination level (rr.threat-elimination-level) before the players can win.
export type DeepDecks = "strong" | "weak" | "brittle" | "hot";

export const deepLoadout = fillerLoadout;

// The goldens' world, the plan and start of a game, and the log of a campaign whose earlier parts were won: the seeded game's parts every scenario shares (test/harness/game-kit.ts).
export const deepWorld = (decks: DeepDecks = "strong") => game.world(decks);
export const afterHai = (seatCount: 1 | 2) => game.after(seatCount);
export const deepPlan = (seatCount: 1 | 2, log: CampaignLog = emptyLog(seatCount)) => game.plan(seatCount, log);
export const deepStart = (seatCount: 1 | 2, seed: number, difficulty: Difficulty, facts?: Omit<CampaignFacts, "modeCard">, log: CampaignLog = emptyLog(seatCount), modeCard?: ModeCard) => game.start(seatCount, seed, difficulty, { facts, log, modeCard });

export type DeepPolicy = {
  // The option a Choose window or a Resolution question takes: the first or the last.
  choose: "first" | "last";
  // The Setup choice of 143072: Poisoned Counsels shuffled into each deck, or the bypass of stage 1B (stage 2A at once).
  setup: "counsels" | "bypass";
  // Whether the players engage the enemies of the staging area, one at a time, and attack them.
  engage: boolean;
  // Whether a character defends every attack ("all") or none: with nobody defending the attack falls on the character with the least damage.
  defend: "none" | "all";
  // The quest: one character of a seat.
  quest: "one";
};
export const DEFAULT_POLICY: DeepPolicy = { choose: "first", setup: "counsels", engage: true, defend: "none", quest: "one" };

// The auto-player's answer (test/harness/auto-player.ts), except: the Resolution's questions, the travel, an engagement, the attack and a defender are answered as the policy says; a choice takes the first answer, or the last.
// Every intent is one the reducer listed.
export function deepIntent(state: ScenarioState, ctx: ReduceContext, memory: Set<string>, policy: DeepPolicy = DEFAULT_POLICY, options: PolicyOptions = DEEP_POLICY): PlayerIntent {
  const intents = legalIntents(state, ctx);
  if (state.window?.kind === "resolution") {
    const offered = intents.flatMap((intent) => (intent.type === "ChooseResolution" ? [intent.optionId] : []));
    return { type: "ChooseResolution", optionId: (policy.choose === "last" ? offered.at(-1) : offered[0]) ?? "" };
  }
  if (state.window?.kind === "choose" && state.window.options.includes("bypass")) return { type: "Choose", optionId: policy.setup };
  if (state.window?.kind === "choose") return { type: "Choose", optionId: (policy.choose === "last" ? state.window.options.at(-1) : state.window.options[0]) ?? "" };
  if (state.window?.kind === "optionalEngage") {
    const seat = state.seats[state.activeSeat];
    const wanted = legalTargets(state, { type: "Engage" }, ctx)[0];
    return policy.engage && wanted && seat && seat.engaged.length < seat.heroes.length ? { type: "Engage", enemyId: wanted } : { type: "DeclineEngage" };
  }
  if (state.window?.kind === "travel") {
    const wanted = legalTargets(state, { type: "Travel" }, ctx)[0];
    return wanted ? { type: "Travel", locationId: wanted } : { type: "DeclineTravel" };
  }
  if (state.window?.kind === "playerAttack" && policy.engage) {
    const attack = attackTogether(state, ctx);
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
    if (!quested && ids.length > 0) return { type: "Commit", cardIds: ids.slice(0, 1) };
  }
  return nextIntent(state, ctx, options, memory, intents);
}

export type DeepGame = PlayedGame;

// The goldens (src/campaign/scenarios/helms-deep/golden.test.ts).
// `after`: the log of a campaign whose earlier parts were won. `upgraded`: the Upgraded sides. `mode`: the Hard or Expert Mode card.
export type DeepGolden = { name: string; seatCount: 1 | 2; seed: number; difficulty: Difficulty; decks: DeepDecks; outcome: "won" | "lost"; policy?: Partial<DeepPolicy>; after?: boolean; upgraded?: boolean; mode?: ModeCard; lossReason?: string };

// A few wins (true solo and two-handed, Normal and Easy, the bypass of stage 1B) and the ways to lose: the Defense stages beaten (heroes too small to quest, so the encounter deck's progress defeats stage 4B and The Wall is Breached! loses,
// 143075:B:3), the players' threat at 50 (a starting threat of 45), and every hero destroyed (heroes too brittle to survive the Soldiers of Isengard). The wins sit through the 8 tokens on The Defense of Helm's Deep to stage 5A and defeat every enemy.
export const DEEP_GOLDENS: readonly DeepGolden[] = [
  { name: "true solo, won, Normal", seatCount: 1, seed: 1, difficulty: "Normal", decks: "strong", outcome: "won" },
  { name: "true solo, won, Easy", seatCount: 1, seed: 2, difficulty: "Easy", decks: "strong", outcome: "won" },
  { name: "true solo, won, bypassing stage 1B", seatCount: 1, seed: 3, difficulty: "Normal", decks: "strong", outcome: "won", policy: { setup: "bypass" } },
  { name: "two-handed, won, Normal", seatCount: 2, seed: 8, difficulty: "Normal", decks: "strong", outcome: "won" },
  { name: "two-handed, won, Easy", seatCount: 2, seed: 2, difficulty: "Easy", decks: "strong", outcome: "won" },
  { name: "true solo, lost, stage 4B is defeated", seatCount: 1, seed: 1, difficulty: "Normal", decks: "weak", outcome: "lost", lossReason: "The Wall is Breached!: Saruman's army captured Helm's Deep" },
  { name: "two-handed, lost, stage 4B is defeated", seatCount: 2, seed: 2, difficulty: "Normal", decks: "weak", outcome: "lost", lossReason: "The Wall is Breached!: Saruman's army captured Helm's Deep" },
  { name: "true solo, lost, threat reaches 50", seatCount: 1, seed: 1, difficulty: "Normal", decks: "hot", outcome: "lost", lossReason: "No seats remain" },
  { name: "two-handed, lost, threat reaches 50", seatCount: 2, seed: 2, difficulty: "Normal", decks: "hot", outcome: "lost", lossReason: "No seats remain" },
  { name: "true solo, lost, every hero is destroyed", seatCount: 1, seed: 1, difficulty: "Normal", decks: "brittle", outcome: "lost", lossReason: "No seats remain" },
  { name: "two-handed, lost, every hero is destroyed", seatCount: 2, seed: 1, difficulty: "Normal", decks: "brittle", outcome: "lost", lossReason: "No seats remain" },
];

const game = campaignGame<DeepDecks, DeepPolicy>({
  campaign,
  scenario: deep,
  stats: { ...HERO_STATS, hot: { ...HERO_STATS.strong, threat: 15 } },
  // The scenario's own cards and the boons The Uruk-hai's Resolution leaves in the pool (the Skill boons and Beyond All Hope); the campaign card's and the campaign's game codes are added by the kit.
  codes: [...deep.cards.map((card) => card.code), "143015", "143016", "143017", "143018", "143019"],
  intent: deepIntent,
  policy: DEFAULT_POLICY,
  limit: 6000,
  upgraded: [],
  // The Uruk-hai's players earned no XP in the golden (the Two Towers award none) and no card; the Resolution's boons are the campaign test's.
  earlier: { xp: [0], pool: [], marks: {} },
});

export const playGolden = (golden: DeepGolden, ctx: ReduceContext): DeepGame => game.playGolden(golden, ctx);
