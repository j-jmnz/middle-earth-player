import { emptyLog, type CampaignLog } from "../../../src/campaign/log.ts";
import type { LoadoutSeat } from "../../../src/campaign/loadout.ts";
import type { Difficulty } from "../../../src/catalog/scenario-data.ts";
import type { CampaignFacts, ModeCard } from "../../../src/rules/core/campaign-state.ts";
import { legalIntents, legalTargets, type PlayerIntent, type ReduceContext, type ScenarioState } from "../../../src/rules/engine/reduce.ts";
import type { StartScenario } from "../../../src/rules/setup/setup.ts";

import { loadCampaign, loadScenario } from "../../../scripts/data/load-scenarios.ts";
import { nextIntent, type PolicyOptions } from "../../harness/auto-player.ts";
import { attackTogether, campaignGame, fillerLoadout, HERO_STATS, type HeroStats, type PlayedGame } from "../../harness/game-kit.ts";

const campaign = loadCampaign("the-return-of-the-king");
const opens = loadScenario("the-black-gate-opens");

// Test helper. A whole game of The Black Gate Opens in Campaign Mode played by the auto-player, true solo or two-handed. The scenario cannot be won: it ends when the last player is eliminated (threat 99 under Dire, or no hero left), and that end runs 146074's Resolution
// (user decision, 2026-11-12), so a "won" golden here is that end, reached by the stand-in heroes' numbers. The heroes are big numbers (or too small to quest, or too brittle to survive an attack) and the decks free events, so the outcome depends on the engine, the seed and the
// encounter deck, not on player card play. The players travel to the first location they may, quest with every ready character but the last (kept to attack), attack the enemies by their hit points, engage what the policy says, defend with nobody (an attack falls on
// the character with the least damage) and answer each choice as the policy says.
export const OPENS_POLICY: PolicyOptions = { scout: "", prefer: "", protect: "", play: false, act: false };
// "strong": big-number heroes that outlast the Black Gate until their threat reaches 99; "tense": strong heroes that start at a high threat, so the end comes in a few rounds; "brittle": strong questers that die to an attack; "weak": heroes too small to quest.
export type OpensDecks = "strong" | "tense" | "brittle" | "weak";

// The starting threats are the goldens' own: the Black Gate's +1 a round and the refresh would take sixty rounds to reach 99 from the usual 3 a hero, so the strong ones start high enough for a short game, and the tense ones start close to it.
const OPENS_STATS = {
  strong: { ...HERO_STATS.strong, threat: 20, attack: 30, defense: 20 },
  tense: { ...HERO_STATS.strong, threat: 30, attack: 30, defense: 20 },
  brittle: { ...HERO_STATS.brittle, threat: 8 },
  weak: { ...HERO_STATS.weak, threat: 20 },
} as const satisfies Record<OpensDecks, HeroStats>;

// The first player holds the saga's Aragorn (146002, mec113.setting-up-the-game) beside three stand-in heroes; a second seat has three.
export const ARAGORN = "146002";
export const opensLoadout = (seatCount: 1 | 2): LoadoutSeat[] => {
  const [, second] = fillerLoadout(2);
  const first = { heroes: [ARAGORN, "q1", "q2", "q3"], deck: fillerLoadout(1)[0]!.deck };
  return seatCount === 1 ? [first] : [first, second!];
};

// The goldens' world, the plan and start of a game, and the log of a campaign whose earlier parts were won: the seeded game's parts every scenario shares (test/harness/game-kit.ts).
// Aragorn takes the numbers of the deck like the stand-in heroes beside him (his printed numbers could not quest or defend a game of auto-played turns).
export const opensWorld = async (decks: OpensDecks = "strong") => {
  const world = await game.world(decks);
  world.cards.set(ARAGORN, { ...world.cards.get(ARAGORN)!, ...OPENS_STATS[decks], threat: OPENS_STATS[decks].threat });
  return world;
};
export const afterUngol = (seatCount: 1 | 2) => game.after(seatCount);
export const opensPlan = (seatCount: 1 | 2, log: CampaignLog = emptyLog(seatCount), choices?: readonly string[]) => game.plan(seatCount, log, choices);
export const opensStart = (seatCount: 1 | 2, seed: number, difficulty: Difficulty, facts?: Omit<CampaignFacts, "modeCard">, log: CampaignLog = emptyLog(seatCount), modeCard?: ModeCard, extra: { choices?: readonly string[] } = {}): StartScenario => game.start(seatCount, seed, difficulty, { facts, log, modeCard, ...extra });

export type OpensPolicy = {
  // The option a Choose window takes: the first or the last (the Embassy's discard or play; Gwaihir's control or the enemy; the Nazgul's threat or its return).
  choose: "first" | "last";
  // Whether the players engage the enemies of the staging area, one at a time.
  engage: boolean;
  // The quest: the first ready character of a seat, or every one but the last, or all.
  quest: "one" | "most" | "all";
};
export const DEFAULT_POLICY: OpensPolicy = { choose: "first", engage: true, quest: "most" };

// The auto-player's answer (test/harness/auto-player.ts), except: the travel goes to the first location the stage lets the players reach, an engagement and the attack are answered as the policy says, a choice takes the first option or the last, and an attack falls on
// the character with the least damage. Every intent is one the reducer listed.
export function opensIntent(state: ScenarioState, ctx: ReduceContext, memory: Set<string>, policy: OpensPolicy = DEFAULT_POLICY): PlayerIntent {
  const intents = legalIntents(state, ctx);
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
  if (state.window?.kind === "playerAttack") {
    // One character at a time, so the others are left to attack another enemy; the enemy with the fewest hit points first.
    const seat = state.seats[state.activeSeat];
    const seen = (enemyId: string) => memory.has(`${state.round}:${enemyId}`);
    const rank = (enemyId: string) => (seen(enemyId) ? 1000 : (ctx.cards.get(state.cards[enemyId]?.code ?? "")?.health ?? 99));
    const attack = [...(seat?.heroes ?? []), ...(seat?.play ?? [])].map((one) => attackTogether(state, ctx, (id) => id === one, rank)).find((intent) => intent?.type === "DeclareAttackers" && !seen(intent.enemyId));
    if (attack?.type === "DeclareAttackers") {
      memory.add(`${state.round}:${attack.enemyId}`);
      return attack;
    }
  }
  if (state.window?.kind === "defense") {
    const least = [...legalTargets(state, { type: "Undefended" }, ctx)].sort((left, right) => (state.cards[left]?.damage ?? 0) - (state.cards[right]?.damage ?? 0))[0];
    if (least) return { type: "Undefended", heroId: least };
  }
  if (state.window?.kind === "pass" && state.mode === "questCommit") {
    const quested = Object.values(state.cards).some((card) => card.committed && card.controller === state.activeSeat);
    const ids = legalTargets(state, { type: "Commit" }, ctx);
    if (!quested && ids.length > 0) return { type: "Commit", cardIds: policy.quest === "all" ? ids : policy.quest === "most" ? ids.slice(0, Math.max(1, ids.length - 1)) : ids.slice(0, 1) };
  }
  return nextIntent(state, ctx, OPENS_POLICY, memory, intents);
}

export type OpensGame = PlayedGame;

// The goldens (src/campaign/scenarios/the-black-gate-opens/golden.test.ts).
// `after`: the log of the earlier parts. `upgraded`: the Upgraded sides. `mode`: the Hard or Expert Mode card. `standalone`: played as a standalone adventure, where the last player's elimination is a plain loss.
export type OpensGolden = { name: string; seatCount: 1 | 2; seed: number; difficulty: Difficulty; decks: OpensDecks; outcome: "won" | "lost"; policy?: Partial<OpensPolicy>; after?: boolean; upgraded?: boolean; mode?: ModeCard; lossReason?: string; standalone?: boolean };

// The scenario cannot be won: in Campaign Mode it ends when the last player is eliminated and that end runs 146074's Resolution, so a golden whose `outcome` is "won" is that end (the threat at 99 under Dire, or every hero gone), and "lost" is a loss that writes nothing: Aragorn leaving
// play, or the same end played as a standalone adventure. The starting threats are the goldens' own (OPENS_STATS), so the games differ in the rounds they survive (the resources on The Black Gate the Resolution records), in who holds Gwaihir at the end (only the first player earns him, 146074:B:1),
// in the first player eliminated first or last and in the Embassy's discard or play (the policy's first or last option).
export const OPENS_GOLDENS: readonly OpensGolden[] = [
  { name: "true solo, ended, Normal, after the earlier parts, three rounds, Gwaihir held", seatCount: 1, seed: 4, difficulty: "Normal", decks: "strong", outcome: "won", after: true },
  { name: "true solo, ended, Easy, after the earlier parts, the Embassy played", seatCount: 1, seed: 8, difficulty: "Easy", decks: "strong", outcome: "won", after: true, policy: { choose: "last" } },
  { name: "true solo, ended, Normal, after the earlier parts, every hero destroyed", seatCount: 1, seed: 5, difficulty: "Normal", decks: "brittle", outcome: "won", after: true },
  { name: "true solo, ended, Normal, with no earlier log, threat 99 in the first round", seatCount: 1, seed: 8, difficulty: "Normal", decks: "weak", outcome: "won" },
  { name: "two-handed, ended, Normal, after the earlier parts, the first player out first", seatCount: 2, seed: 3, difficulty: "Normal", decks: "strong", outcome: "won", after: true },
  { name: "two-handed, ended, Normal, after the earlier parts, Gwaihir held by the first player", seatCount: 2, seed: 13, difficulty: "Normal", decks: "strong", outcome: "won", after: true },
  { name: "two-handed, ended, Easy, after the earlier parts, the Embassy played", seatCount: 2, seed: 7, difficulty: "Easy", decks: "strong", outcome: "won", after: true, policy: { choose: "last" } },
  { name: "two-handed, ended, Normal, after the earlier parts, every hero destroyed", seatCount: 2, seed: 7, difficulty: "Normal", decks: "brittle", outcome: "won", after: true },
  { name: "true solo, lost, Aragorn leaves play", seatCount: 1, seed: 3, difficulty: "Normal", decks: "brittle", outcome: "lost", after: true, lossReason: "Aragorn left play" },
  { name: "two-handed, lost, Aragorn leaves play", seatCount: 2, seed: 3, difficulty: "Normal", decks: "brittle", outcome: "lost", after: true, lossReason: "Aragorn left play" },
  { name: "true solo, lost, standalone, the last player is eliminated", seatCount: 1, seed: 1, difficulty: "Normal", decks: "strong", outcome: "lost", standalone: true, lossReason: "No seats remain" },
  { name: "two-handed, lost, standalone, the last player is eliminated", seatCount: 2, seed: 1, difficulty: "Normal", decks: "weak", outcome: "lost", standalone: true, lossReason: "No seats remain" },
];

const game = campaignGame<OpensDecks, OpensPolicy>({
  campaign,
  scenario: opens,
  stats: OPENS_STATS,
  // The cards a game loads besides the scenario's piles, its campaign card's and the campaign's game codes.
  codes: [...opens.cards.map((card) => card.code), ARAGORN, "142014", "145062", "146041", "143020", "143021", "145014", "145015", "145016"],
  loadout: opensLoadout,
  intent: opensIntent,
  policy: DEFAULT_POLICY,
  limit: 6000,
  upgraded: [],
  // The four earlier parts earn no XP. What the chain leaves in the pool: an Overcome by Fear for each seat, a Wraith on Wings for each seat and the two Esquires on the first seat's heroes (the Pelennor's), Poisoned Counsels for each seat and the Palantir of Orthanc (the Two Towers').
  earlier: { xp: [0, 0, 0, 0], pool: [{ code: "143021", seat: 0 }, { code: "143021", seat: 1 }, { code: "143020", seat: 0 }, { code: "145016", seat: 0 }, { code: "145016", seat: 1 }, { code: "145062", seat: 0 }, { code: "145062", seat: 1 }, { code: "145014", seat: 0 }, { code: "145015", seat: 0 }], marks: {} },
});

export const playGolden = (golden: OpensGolden, ctx: ReduceContext): OpensGame => game.playGolden(golden, ctx);
