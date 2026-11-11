import { emptyLog, type CampaignLog } from "../../../src/campaign/log.ts";
import type { Difficulty } from "../../../src/catalog/scenario-data.ts";
import type { CampaignFacts, ModeCard } from "../../../src/rules/core/campaign-state.ts";
import type { LoadoutSeat } from "../../../src/campaign/loadout.ts";
import { legalIntents, legalTargets, type PlayerIntent, type ReduceContext, type ScenarioState } from "../../../src/rules/engine/reduce.ts";

import { loadCampaign, loadScenario } from "../../../scripts/data/load-scenarios.ts";
import { nextIntent, type PolicyOptions } from "../../harness/auto-player.ts";
import { attackTogether, campaignGame, fillerLoadout, HERO_STATS, RING_BEARER, type PlayedGame } from "../../harness/game-kit.ts";

const campaign = loadCampaign("the-two-towers");
const roads = loadScenario("journey-to-the-cross-roads");

// Test helper. A whole game of Journey to the Cross-roads in Campaign Mode played by the auto-player, true solo or two-handed. The heroes are big numbers (or too small to quest, or too brittle to survive an attack) and the decks free
// events, so the outcome depends on the engine, the seed and the encounter deck, not on player card play. TODO: say how the players travel, engage and answer the choices this scenario asks.
export const ROADS_POLICY: PolicyOptions = { scout: "", prefer: "", protect: "", play: false, act: false };
// "strong": big-number heroes that win; "weak": heroes too small to quest, so the players lose on threat; "brittle": strong questers that die to an attack; "tense": strong, with a starting threat the Haradrim's engagement costs fall below, so
// the engagement checks put every enemy but the Oliphaunt into play against them.
// The numbers of the stand-in heroes: "tense" starts 13 a hero (39 for a seat of three), so the engagement checks put the Man and the Captain of Harad into play at once and the others as the threat rises.
export const ROADS_STATS = { ...HERO_STATS, tense: { ...HERO_STATS.tense, threat: 13 } };
export type RoadsDecks = "strong" | "weak" | "brittle" | "tense";

// The first player holds the Ring-bearer with The One Ring attached (the saga start of scenarios 10 to 12, mec112.setting-up-the-game): Frodo, beside two stand-in heroes; a second seat has three.
export const roadsLoadout = (seatCount: 1 | 2): LoadoutSeat[] => {
  const [, second] = fillerLoadout(2);
  const deck = fillerLoadout(1)[0]!.deck;
  const first = { heroes: [RING_BEARER, "q1", "q2"], deck };
  return seatCount === 1 ? [first] : [first, second!];
};

// The goldens' world, the plan and start of a game, and the log of a campaign whose earlier parts were won: the seeded game's parts every scenario shares (test/harness/game-kit.ts).
// Frodo, the Ring-bearer, takes the numbers of the deck like the stand-in heroes beside him (his printed numbers could not quest or defend a game of auto-played turns).
export const roadsWorld = async (decks: RoadsDecks = "strong") => {
  const world = await game.world(decks);
  world.cards.set(RING_BEARER, { ...world.cards.get(RING_BEARER)!, ...ROADS_STATS[decks] });
  return world;
};
export const afterMarshes = (seatCount: 1 | 2) => game.after(seatCount);
// 144069's Campaign Setup asks each player for a copy of Brace of Coneys or a resource on each hero: the goldens' players take the resources.
export const ROADS_CHOICES: readonly string[] = ["resources", "resources"];
export const roadsPlan = (seatCount: 1 | 2, log: CampaignLog = emptyLog(seatCount), choices: readonly string[] = ROADS_CHOICES) => game.plan(seatCount, log, choices);
export const roadsStart = (seatCount: 1 | 2, seed: number, difficulty: Difficulty, facts?: Omit<CampaignFacts, "modeCard">, log: CampaignLog = emptyLog(seatCount), modeCard?: ModeCard, choices: readonly string[] = ROADS_CHOICES) => game.start(seatCount, seed, difficulty, { facts, log, modeCard, choices });

export type RoadsPolicy = {
  // The option a Choose window takes: the first or the last.
  choose: "first" | "last";
  // Whether the players engage the enemies of the staging area, one at a time (an enemy left in the staging area at the end of the planning phase goes under The Black Gate).
  engage: boolean;
  // Whether a character defends every attack ("all") or none: with nobody defending the attack falls on the character with the least damage.
  defend: "none" | "all";
  // The quest: the first ready character of a seat, or every one but the last, or all.
  quest: "one" | "most" | "all";
  // Whether the players travel to the first location they may.
  travel: boolean;
};
export const DEFAULT_POLICY: RoadsPolicy = { choose: "last", engage: true, defend: "none", quest: "all", travel: true };

// The auto-player's answer (test/harness/auto-player.ts), except: the travel, an engagement and a defender are answered as the policy says; a choice takes the first option, or the last. Every intent is one the reducer listed.
// The players engage the enemies of the staging area (the Harad enemies go under The Black Gate otherwise), travel to the first location they may and attack with every ready character; the Ring-bearer is never put in the way
// of an attack (Frodo destroyed takes The One Ring out of play and the players lose, 144063:A:3).
export function roadsIntent(state: ScenarioState, ctx: ReduceContext, memory: Set<string>, policy: RoadsPolicy = DEFAULT_POLICY, options: PolicyOptions = ROADS_POLICY): PlayerIntent {
  const intents = legalIntents(state, ctx);
  if (state.window?.kind === "choose") return { type: "Choose", optionId: (policy.choose === "last" ? state.window.options.at(-1) : state.window.options[0]) ?? "" };
  if (state.window?.kind === "optionalEngage") {
    const seat = state.seats[state.activeSeat];
    const wanted = legalTargets(state, { type: "Engage" }, ctx)[0];
    return policy.engage && wanted && seat && seat.engaged.length < seat.heroes.length ? { type: "Engage", enemyId: wanted } : { type: "DeclineEngage" };
  }
  if (state.window?.kind === "travel") {
    const order = ["144033", "144035", "144032", "144034", "144031"];
    const all = policy.travel ? legalTargets(state, { type: "Travel" }, ctx) : [];
    const wanted = [...all].sort((a, b) => order.indexOf(state.cards[a]?.code ?? "") - order.indexOf(state.cards[b]?.code ?? ""))[0];
    return wanted ? { type: "Travel", locationId: wanted } : { type: "DeclineTravel" };
  }
  if (state.window?.kind === "playerAttack") {
    const seat = state.seats[state.activeSeat];
    const attack = [...(seat?.heroes ?? []), ...(seat?.play ?? [])].map((one) => attackTogether(state, ctx, (id) => id === one)).find((intent) => intent?.type === "DeclareAttackers" && !memory.has(`${state.round}:${intent.enemyId}`));
    if (attack?.type === "DeclareAttackers") {
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

export type RoadsGame = PlayedGame;

// The goldens (src/campaign/scenarios/journey-to-the-cross-roads/golden.test.ts), also played by the causes and replay tests once test/harness/golden-registry.ts lists them.
// `after`: the log of a campaign whose earlier parts were won. `upgraded`: the Upgraded sides. `mode`: the Hard or Expert Mode card.
export type RoadsGolden = { name: string; seatCount: 1 | 2; seed: number; difficulty: Difficulty; decks: RoadsDecks; outcome: "won" | "lost"; policy?: Partial<RoadsPolicy>; after?: boolean; upgraded?: boolean; mode?: ModeCard; lossReason?: string };

// Wins (true solo and two-handed, Normal and Easy) and the ways to lose that a game of stand-ins reaches: the facedown cards under The Black Gate reaching the players + 3 (strong heroes that take the Choose's first option, the one
// that places an enemy under the Gate, and engage one enemy a round), the players' threat at 50 (heroes too small to quest), and every hero destroyed (heroes too brittle to survive). The wins start the players' threat high enough
// that the Haradrim are engaged as they arrive, take each Choose's last option (an attack or a search in place of a card under the Gate), travel to the first location they may, and play the Harad deck out
// to the 20 progress and the empty deck that The Cross-roads needs.
export const ROADS_GOLDENS: readonly RoadsGolden[] = [
  { name: "true solo, won, Normal", seatCount: 1, seed: 1, difficulty: "Normal", decks: "tense", outcome: "won", after: true },
  { name: "true solo, won, Easy", seatCount: 1, seed: 3, difficulty: "Easy", decks: "tense", outcome: "won", after: true },
  { name: "two-handed, won, Normal", seatCount: 2, seed: 1, difficulty: "Normal", decks: "tense", outcome: "won", after: true },
  { name: "two-handed, won, Easy", seatCount: 2, seed: 1, difficulty: "Easy", decks: "tense", outcome: "won", after: true },
  { name: "true solo, lost, the Harad enemies under The Black Gate", seatCount: 1, seed: 1, difficulty: "Normal", decks: "strong", outcome: "lost", policy: { choose: "first" }, after: true, lossReason: "The Black Gate has taken too many Harad enemies" },
  { name: "two-handed, lost, the Harad enemies under The Black Gate", seatCount: 2, seed: 1, difficulty: "Normal", decks: "strong", outcome: "lost", policy: { choose: "first" }, after: true, lossReason: "The Black Gate has taken too many Harad enemies" },
  { name: "true solo, lost, threat reaches 50", seatCount: 1, seed: 1, difficulty: "Normal", decks: "weak", outcome: "lost", after: true, lossReason: "No seats remain" },
  { name: "two-handed, lost, threat reaches 50", seatCount: 2, seed: 1, difficulty: "Normal", decks: "weak", outcome: "lost", after: true, lossReason: "No seats remain" },
  { name: "true solo, lost, every hero is destroyed", seatCount: 1, seed: 1, difficulty: "Normal", decks: "brittle", outcome: "lost", after: true, lossReason: "No seats remain" },
  { name: "two-handed, lost, the Ring-bearer's seat is eliminated", seatCount: 2, seed: 2, difficulty: "Normal", decks: "brittle", outcome: "lost", after: true, lossReason: "The One Ring left play" },
];

const game = campaignGame<RoadsDecks, RoadsPolicy>({
  campaign,
  scenario: roads,
  stats: ROADS_STATS,
  loadout: roadsLoadout,
  // TODO: the cards a game loads besides the scenario's piles, its campaign card's and the campaign's game codes.
  codes: [...roads.cards.map((card) => card.code), RING_BEARER, "144063", "144014", "144015", "143015", "143016", "143017", "143018", "143019", "143020", "143021", "143068"],
  intent: roadsIntent,
  policy: DEFAULT_POLICY,
  limit: 6000,
  upgraded: [],
  // TODO: the XP each earlier part gained (in campaign order), the cards they put in the pool and the marks on the cards, as a campaign that won them leaves the log.
  earlier: { xp: [0, 0, 0, 0], pool: [], marks: {} },
});

export const playGolden = (golden: RoadsGolden, ctx: ReduceContext): RoadsGame => game.playGolden(golden, ctx, ROADS_CHOICES);

// A golden played with other answers to the Campaign Setup (144069:A:2): the card's code for a copy of Brace of Coneys, or `resources`, one for each seat.
export const playGoldenWith = (golden: RoadsGolden, ctx: ReduceContext, choices: readonly string[]): RoadsGame => game.playGolden(golden, ctx, choices);
