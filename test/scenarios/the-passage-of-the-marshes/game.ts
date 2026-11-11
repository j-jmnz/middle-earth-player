import { emptyLog, type CampaignLog } from "../../../src/campaign/log.ts";
import type { LoadoutSeat } from "../../../src/campaign/loadout.ts";
import type { Difficulty } from "../../../src/catalog/scenario-data.ts";
import type { CampaignFacts, ModeCard } from "../../../src/rules/core/campaign-state.ts";
import { legalIntents, legalTargets, type PlayerIntent, type ReduceContext, type ScenarioState } from "../../../src/rules/engine/reduce.ts";

import { loadCampaign, loadScenario } from "../../../scripts/data/load-scenarios.ts";
import { nextIntent, type PolicyOptions } from "../../harness/auto-player.ts";
import { attackTogether, campaignGame, fillerLoadout, HERO_STATS, RING_BEARER, type PlayedGame } from "../../harness/game-kit.ts";

const GOLLUM = "144075";
const campaign = loadCampaign("the-two-towers");
const marshes = loadScenario("the-passage-of-the-marshes");

// Test helper. A whole game of The Passage of the Marshes in Campaign Mode played by the auto-player, true solo or two-handed. The heroes are big numbers (or too small to quest, or too brittle to survive an attack) and the decks free
// events, so the outcome depends on the engine, the seed and the encounter deck, not on player card play. The players quest with all but one character of a seat, engage the enemies of the staging area, attack with every ready
// character together (Gollum first: the gate of stage 1B wants him defeated, so the first player controls Sméagol), travel to the first location they may, and answer every choice with the first option, or the last as the policy says.
export const MARSHES_POLICY: PolicyOptions = { scout: "", prefer: "", protect: "", play: false, act: false };
// "strong": big-number heroes that win; "weak": heroes too small to quest, so the players lose on threat; "brittle": strong questers that die to an attack.
export type MarshesDecks = "strong" | "weak" | "brittle";

// The first player holds the Ring-bearer with The One Ring attached (the saga start of scenarios 10 to 12, mec112.setting-up-the-game): Frodo, beside two stand-in heroes; a second seat has three.
export const marshesLoadout = (seatCount: 1 | 2): LoadoutSeat[] => {
  const [, second] = fillerLoadout(2);
  const deck = fillerLoadout(1)[0]!.deck;
  const first = { heroes: [RING_BEARER, "q1", "q2"], deck };
  return seatCount === 1 ? [first] : [first, second!];
};

// The goldens' world, the plan and start of a game, and the log of a campaign whose earlier parts were won: the seeded game's parts every scenario shares (test/harness/game-kit.ts).
// Frodo, the Ring-bearer, takes the numbers of the deck like the stand-in heroes beside him (his printed numbers could not quest or defend a game of auto-played turns).
export const marshesWorld = async (decks: MarshesDecks = "strong") => {
  const world = await game.world(decks);
  world.cards.set(RING_BEARER, { ...world.cards.get(RING_BEARER)!, ...HERO_STATS[decks] });
  return world;
};
export const afterIsengard = (seatCount: 1 | 2) => game.after(seatCount);
export const marshesPlan = (seatCount: 1 | 2, log: CampaignLog = emptyLog(seatCount)) => game.plan(seatCount, log);
export const marshesStart = (seatCount: 1 | 2, seed: number, difficulty: Difficulty, facts?: Omit<CampaignFacts, "modeCard">, log: CampaignLog = emptyLog(seatCount), modeCard?: ModeCard) => game.start(seatCount, seed, difficulty, { facts, log, modeCard });

export type MarshesPolicy = {
  // The option a Choose window or a Resolution question takes: the first or the last.
  choose: "first" | "last";
  // Whether the players engage the enemies of the staging area, one at a time.
  engage: boolean;
  // Whether the ready characters attack the enemies engaged with them together (Gollum first).
  attack: boolean;
  // Whether a character defends every attack ("all") or none: with nobody defending the attack falls on the character with the least damage.
  defend: "none" | "all";
  // The quest: the first ready character of a seat, or every one but the last (a character is left ready to attack Gollum).
  quest: "one" | "most" | "all";
};
export const DEFAULT_POLICY: MarshesPolicy = { choose: "first", engage: false, attack: true, defend: "none", quest: "one" };

// The auto-player's answer (test/harness/auto-player.ts), except: the Resolution's questions, the travel, an engagement, the attack and a defender are answered as the policy says; a choice takes the first answer, or the last.
// Every intent is one the reducer listed.
export function marshesIntent(state: ScenarioState, ctx: ReduceContext, memory: Set<string>, policy: MarshesPolicy = DEFAULT_POLICY, options: PolicyOptions = MARSHES_POLICY): PlayerIntent {
  const intents = legalIntents(state, ctx);
  if (state.window?.kind === "resolution") {
    const offered = intents.flatMap((intent) => (intent.type === "ChooseResolution" ? [intent.optionId] : []));
    return { type: "ChooseResolution", optionId: (policy.choose === "last" ? offered.at(-1) : offered[0]) ?? "" };
  }
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
  if (state.window?.kind === "playerAttack" && policy.attack) {
    // One character at a time, so the others are left to attack another enemy in the next window.
    const seat = state.seats[state.activeSeat];
    const rank = (id: string): number => (state.cards[id]?.code === GOLLUM ? 0 : 1);
    const attack = [...(seat?.heroes ?? []), ...(seat?.play ?? [])].map((one) => attackTogether(state, ctx, (id) => id === one, rank)).find((intent) => intent?.type === "DeclareAttackers" && !memory.has(`${state.round}:${intent.enemyId}`));
    if (attack?.type === "DeclareAttackers") {
      // An enemy is attacked once in a phase (the memory holds the round and the enemy).
      memory.add(`${state.round}:${attack.enemyId}`);
      return attack;
    }
  }
  if (state.window?.kind === "defense") {
    // The Ring-bearer is never put in the way: Frodo destroyed takes The One Ring out of play, and the players lose (144063:A:3).
    const byDamage = (ids: readonly string[]) => {
      const others = ids.filter((id) => state.cards[id]?.code !== RING_BEARER);
      return [...(others.length > 0 ? others : ids)].sort((left, right) => (state.cards[left]?.damage ?? 0) - (state.cards[right]?.damage ?? 0))[0];
    };
    const defender = policy.defend === "all" && intents.some((intent) => intent.type === "DeclareDefender") ? byDamage(legalTargets(state, { type: "DeclareDefender" }, ctx)) : undefined;
    if (defender) return { type: "DeclareDefender", defenderId: defender };
    const least = byDamage(legalTargets(state, { type: "Undefended" }, ctx));
    if (least) return { type: "Undefended", heroId: least };
  }
  if (state.window?.kind === "pass" && state.mode === "questCommit") {
    const quested = Object.values(state.cards).some((card) => card.committed && card.controller === state.activeSeat);
    const ids = legalTargets(state, { type: "Commit" }, ctx);
    if (!quested && ids.length > 0) return { type: "Commit", cardIds: policy.quest === "all" ? ids : policy.quest === "most" ? ids.slice(0, Math.max(1, ids.length - 1)) : ids.slice(0, 1) };
  }
  return nextIntent(state, ctx, options, memory, intents);
}

export type MarshesGame = PlayedGame;

// The goldens (src/campaign/scenarios/the-passage-of-the-marshes/golden.test.ts), also played by the causes and replay tests once test/harness/golden-registry.ts lists them.
// `after`: the log of a campaign whose earlier parts were won. `upgraded`: the Upgraded sides. `mode`: the Hard or Expert Mode card.
export type MarshesGolden = { name: string; seatCount: 1 | 2; seed: number; difficulty: Difficulty; decks: MarshesDecks; outcome: "won" | "lost"; policy?: Partial<MarshesPolicy>; after?: boolean; upgraded?: boolean; mode?: ModeCard; lossReason?: string };

// A few wins (true solo and two-handed, Normal and Easy) and the ways to lose that a game of stand-ins reaches: the players' threat at 50 (heroes too small to quest, with the Ring-bearer's seat eliminated first in one), and every hero
// destroyed (heroes too brittle to survive). The wins quest with the first hero of a seat, attack Gollum with the others (stage 1B's gate wants him defeated, so the first player controls Sméagol), travel to the first location they may
// (stage 2B wants 4 locations in the victory display), and then attack the Undead enemies one at a time so that progress can be placed on stage 3B.
export const MARSHES_GOLDENS: readonly MarshesGolden[] = [
  { name: "true solo, won, Normal", seatCount: 1, seed: 5, difficulty: "Normal", decks: "strong", outcome: "won", after: true },
  { name: "true solo, won, Easy", seatCount: 1, seed: 3, difficulty: "Easy", decks: "strong", outcome: "won", after: true },
  { name: "two-handed, won, Normal", seatCount: 2, seed: 1, difficulty: "Normal", decks: "strong", outcome: "won", after: true },
  { name: "two-handed, won, Easy", seatCount: 2, seed: 4, difficulty: "Easy", decks: "strong", outcome: "won", after: true },
  { name: "true solo, lost, threat reaches 50", seatCount: 1, seed: 1, difficulty: "Normal", decks: "weak", outcome: "lost", after: true, lossReason: "No seats remain" },
  { name: "two-handed, lost, threat reaches 50", seatCount: 2, seed: 1, difficulty: "Normal", decks: "weak", outcome: "lost", after: true, lossReason: "No seats remain" },
  { name: "two-handed, lost, the Ring-bearer's seat is eliminated", seatCount: 2, seed: 3, difficulty: "Normal", decks: "weak", outcome: "lost", after: true, lossReason: "The One Ring left play" },
  { name: "true solo, lost, every hero is destroyed", seatCount: 1, seed: 1, difficulty: "Normal", decks: "brittle", outcome: "lost", after: true, lossReason: "No seats remain" },
  { name: "two-handed, lost, every hero is destroyed", seatCount: 2, seed: 1, difficulty: "Normal", decks: "brittle", outcome: "lost", after: true, lossReason: "No seats remain" },
];

const game = campaignGame<MarshesDecks, MarshesPolicy>({
  campaign,
  scenario: marshes,
  stats: HERO_STATS,
  // The scenario's own cards, Sméagol (the back of Gollum), the Ring-bearer with The One Ring and The Searching Eye, which the campaign card shuffles into each deck; the campaign card's and the campaign's game codes are added by the kit.
  codes: [...marshes.cards.map((card) => card.code), RING_BEARER, "144063", "144015", "144076"],
  intent: marshesIntent,
  loadout: marshesLoadout,
  policy: DEFAULT_POLICY,
  limit: 6000,
  upgraded: [],
  // The earlier parts' players earned no XP in the golden (the Two Towers award none) and no card; the Resolutions' boons and burdens are the campaign test's.
  earlier: { xp: [0, 0, 0], pool: [], marks: {} },
});

export const playGolden = (golden: MarshesGolden, ctx: ReduceContext): MarshesGame => game.playGolden(golden, ctx);
