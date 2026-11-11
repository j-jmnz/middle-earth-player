import { emptyLog, type CampaignLog } from "../../../src/campaign/log.ts";
import type { Difficulty } from "../../../src/catalog/scenario-data.ts";
import type { CampaignFacts, ModeCard } from "../../../src/rules/core/campaign-state.ts";
import type { LoadoutSeat } from "../../../src/campaign/loadout.ts";
import { legalIntents, legalTargets, type PlayerIntent, type ReduceContext, type ScenarioState } from "../../../src/rules/engine/reduce.ts";

import { loadCampaign, loadScenario } from "../../../scripts/data/load-scenarios.ts";
import { nextIntent, type PolicyOptions } from "../../harness/auto-player.ts";
import { attackTogether, campaignGame, fillerLoadout, HERO_STATS, RING_BEARER, type PlayedGame } from "../../harness/game-kit.ts";

const campaign = loadCampaign("the-two-towers");
const lair = loadScenario("shelobs-lair");
const SHELOB = "144040";
const GOLLUM = "144075";

// Test helper. A whole game of Shelob's Lair in Campaign Mode played by the auto-player, true solo or two-handed. The heroes are big numbers (or too small to quest, or too brittle to survive an attack) and the decks free
// events, so the outcome depends on the engine, the seed and the encounter deck, not on player card play. The players engage nothing they need not, travel to the first location they may, quest with every ready character
// but the last (kept to attack Gollum and Shelob once stage 3 brings them to the players) and answer each choice with the policy's first or last option.
export const LAIR_POLICY: PolicyOptions = { scout: "", prefer: "", protect: "", play: false, act: false };
// "strong": big-number heroes that win; "weak": heroes too small to quest, so the players lose on threat; "brittle": strong questers that die to an attack.
export type LairDecks = "strong" | "weak" | "brittle";

// The first player holds the Ring-bearer with The One Ring attached (the saga start of scenarios 10 to 12, mec112.setting-up-the-game): Frodo, beside two stand-in heroes; a second seat has three.
export const lairLoadout = (seatCount: 1 | 2): LoadoutSeat[] => {
  const [, second] = fillerLoadout(2);
  const deck = fillerLoadout(1)[0]!.deck;
  const first = { heroes: [RING_BEARER, "q1", "q2"], deck };
  return seatCount === 1 ? [first] : [first, second!];
};

// The goldens' world, the plan and start of a game, and the log of a campaign whose earlier parts were won: the seeded game's parts every scenario shares (test/harness/game-kit.ts).
// Frodo, the Ring-bearer, takes the numbers of the deck like the stand-in heroes beside him (his printed numbers could not quest or defend a game of auto-played turns).
export const lairWorld = async (decks: LairDecks = "strong") => {
  const world = await game.world(decks);
  world.cards.set(RING_BEARER, { ...world.cards.get(RING_BEARER)!, ...HERO_STATS[decks] });
  return world;
};
export const afterRoads = (seatCount: 1 | 2) => game.after(seatCount);
export const lairPlan = (seatCount: 1 | 2, log: CampaignLog = emptyLog(seatCount)) => game.plan(seatCount, log);
export const lairStart = (seatCount: 1 | 2, seed: number, difficulty: Difficulty, facts?: Omit<CampaignFacts, "modeCard">, log: CampaignLog = emptyLog(seatCount), modeCard?: ModeCard) => game.start(seatCount, seed, difficulty, { facts, log, modeCard });

export type LairPolicy = {
  // The option a Choose window takes: the first, the last, or the first of SAFE_CHOICES that is offered (cards from the hand and an attack by Shelob in place of resources on her, which only make the quest harder).
  choose: "first" | "last" | "safe";
  // Whether the players engage the enemies of the staging area, one at a time.
  engage: boolean;
  // Whether a character defends every attack ("all") or none: with nobody defending the attack falls on the character with the least damage.
  defend: "none" | "all";
  // The quest: the first ready character of a seat, or every one but the last, or all.
  quest: "one" | "most" | "all";
};
const SAFE_CHOICES = ["discard", "attack", "threat", "flip", "reveal", "search", "exhaust", "place"];
export const DEFAULT_POLICY: LairPolicy = { choose: "safe", engage: false, defend: "none", quest: "most" };

// The auto-player's answer (test/harness/auto-player.ts), except: the travel, an engagement, the attack and a defender are answered as the policy says; a choice takes the first option, or the last. Every intent is one the reducer listed.
// The Ring-bearer is never put in the way of an attack (Frodo destroyed takes The One Ring out of play and the players lose, 144063:A:3); Gollum, then Shelob, are attacked first.
export function lairIntent(state: ScenarioState, ctx: ReduceContext, memory: Set<string>, policy: LairPolicy = DEFAULT_POLICY, options: PolicyOptions = LAIR_POLICY): PlayerIntent {
  const intents = legalIntents(state, ctx);
  if (state.window?.kind === "choose") {
    const options = state.window.options;
    const safe = SAFE_CHOICES.find((id) => options.includes(id));
    return { type: "Choose", optionId: (policy.choose === "last" ? options.at(-1) : policy.choose === "safe" ? (safe ?? options[0]) : options[0]) ?? "" };
  }
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
    // One character at a time, so the others are left to attack another enemy in the next window.
    const seat = state.seats[state.activeSeat];
    const rank = (id: string): number => (state.cards[id]?.code === GOLLUM ? 0 : state.cards[id]?.code === SHELOB ? 1 : 2);
    const attack = [...(seat?.heroes ?? []), ...(seat?.play ?? [])].map((one) => attackTogether(state, ctx, (id) => id === one, rank)).find((intent) => intent?.type === "DeclareAttackers" && !memory.has(`${state.round}:${intent.enemyId}`));
    if (attack?.type === "DeclareAttackers") {
      // An enemy is attacked once in a phase (the memory holds the round and the enemy).
      memory.add(`${state.round}:${attack.enemyId}`);
      return attack;
    }
  }
  if (state.window?.kind === "defense") {
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

export type LairGame = PlayedGame;

// The goldens (src/campaign/scenarios/shelobs-lair/golden.test.ts), also played by the causes and replay tests once test/harness/golden-registry.ts lists them.
// `after`: the log of a campaign whose earlier parts were won. `upgraded`: the Upgraded sides. `mode`: the Hard or Expert Mode card.
export type LairGolden = { name: string; seatCount: 1 | 2; seed: number; difficulty: Difficulty; decks: LairDecks; outcome: "won" | "lost"; policy?: Partial<LairPolicy>; after?: boolean; upgraded?: boolean; mode?: ModeCard; lossReason?: string };

// Wins (true solo and two-handed, Normal and Easy) and the ways to lose that a game of stand-ins reaches: the players' threat at 50 (heroes too small to quest), every hero destroyed (heroes too brittle to survive) and the Ring-bearer's seat
// eliminated (The One Ring leaves play). The wins quest with all but the last character of a seat, travel to the first location they may (the Secret Way by exhausting Sméagol or discarding a card, Cleft and the Den of Night by resources on
// Shelob), take the first of SAFE_CHOICES when a card asks (cards from the hand and an attack by Shelob rather than resources on her, which would keep the quest from the stage 3 threat) and attack Gollum, then Shelob, with one
// character at a time until Cleft's Attack and engagement have made her a target and her resources are spent.
export const LAIR_GOLDENS: readonly LairGolden[] = [
  { name: "true solo, won, Normal", seatCount: 1, seed: 2, difficulty: "Normal", decks: "strong", outcome: "won", after: true },
  { name: "true solo, won, Easy", seatCount: 1, seed: 23, difficulty: "Easy", decks: "strong", outcome: "won", after: true },
  { name: "two-handed, won, Normal", seatCount: 2, seed: 9, difficulty: "Normal", decks: "strong", outcome: "won", after: true },
  { name: "two-handed, won, Easy", seatCount: 2, seed: 13, difficulty: "Easy", decks: "strong", outcome: "won", after: true },
  { name: "true solo, lost, threat reaches 50", seatCount: 1, seed: 1, difficulty: "Normal", decks: "weak", outcome: "lost", after: true, lossReason: "No seats remain" },
  { name: "two-handed, lost, threat reaches 50", seatCount: 2, seed: 3, difficulty: "Normal", decks: "weak", outcome: "lost", after: true, lossReason: "No seats remain" },
  { name: "true solo, lost, every hero is destroyed", seatCount: 1, seed: 1, difficulty: "Normal", decks: "brittle", outcome: "lost", after: true, lossReason: "No seats remain" },
  { name: "two-handed, lost, every hero is destroyed", seatCount: 2, seed: 2, difficulty: "Normal", decks: "brittle", outcome: "lost", after: true, lossReason: "No seats remain" },
  { name: "two-handed, lost, the Ring-bearer's seat is eliminated", seatCount: 2, seed: 3, difficulty: "Normal", decks: "brittle", outcome: "lost", after: true, lossReason: "The One Ring left play" },
];

const game = campaignGame<LairDecks, LairPolicy>({
  campaign,
  scenario: lair,
  stats: HERO_STATS,
  loadout: lairLoadout,
  // The scenario's cards, the Ring-bearer with The One Ring (144063), A Heavy Burden (144052, the campaign card's Setup puts it on the Ring-bearer), The Searching Eye (144015) and the Helm's Deep and Isengard burden and player cards a Two Towers log removes or earns.
  codes: [...lair.cards.map((card) => card.code), RING_BEARER, "144063", "144052", "144075", "144076", "144015", "144014", "143015", "143016", "143017", "143018", "143019", "143020", "143021", "143068"],
  intent: lairIntent,
  policy: DEFAULT_POLICY,
  limit: 6000,
  upgraded: [],
  // The earlier parts leave no XP, pool card or mark in a golden's log: a game that wants their real Resolutions reads scripts/e2e/shelobs-lair.ts (roadsWonLog).
  earlier: { xp: [0, 0, 0, 0, 0], pool: [], marks: {} },
});

export const playGolden = (golden: LairGolden, ctx: ReduceContext): LairGame => game.playGolden(golden, ctx);
