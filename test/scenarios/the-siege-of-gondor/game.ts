import { emptyLog, type CampaignLog } from "../../../src/campaign/log.ts";
import type { Difficulty } from "../../../src/catalog/scenario-data.ts";
import type { LoadoutSeat } from "../../../src/campaign/loadout.ts";
import type { CampaignFacts, ModeCard } from "../../../src/rules/core/campaign-state.ts";
import { legalIntents, legalTargets, type PlayerIntent, type ReduceContext, type ScenarioState } from "../../../src/rules/engine/reduce.ts";

import { loadCampaign, loadScenario } from "../../../scripts/data/load-scenarios.ts";
import { nextIntent, type PolicyOptions } from "../../harness/auto-player.ts";
import { attackTogether, campaignGame, fillerLoadout, HERO_STATS, type PlayedGame } from "../../harness/game-kit.ts";

const campaign = loadCampaign("the-return-of-the-king");
const gondor = loadScenario("the-siege-of-gondor");

// Test helper. A whole game of The Siege of Gondor in Campaign Mode played by the auto-player, true solo or two-handed. The heroes are big numbers (or too small to quest, or too brittle to survive an attack) and the decks free
// events, so the outcome depends on the engine, the seed and the encounter deck, not on player card play. The players engage nothing they need not, travel to the first location they may (Great Corsair Ship once 3 Ship locations
// are in the victory display), quest with every ready character but the last (kept to attack whatever the players engage), defend with nobody (an attack falls on the character with the least damage) and answer each choice as the policy
// says: the first option (The Corsair Fleet's reveal) or the last (its damage).
export const GONDOR_POLICY: PolicyOptions = { scout: "", prefer: "", protect: "", play: false, act: false };
// "strong": big-number heroes that win; "weak": heroes too small to quest, so the players lose on threat; "brittle": strong questers that die to an attack or to the Fleet's damage.
export type GondorDecks = "strong" | "weak" | "brittle";

const ARAGORN = "145001";
// The first player starts with the saga's Aragorn (145001, mec113.setting-up-the-game) beside two stand-in heroes; a second seat has three.
export const gondorLoadout = (seatCount: 1 | 2): LoadoutSeat[] => {
  const [, second] = fillerLoadout(2);
  const first = { heroes: [ARAGORN, "q1", "q2"], deck: fillerLoadout(1)[0]!.deck };
  return seatCount === 1 ? [first] : [first, second!];
};

// The goldens' world, the plan and start of a game, and the log of a campaign whose earlier part was won: the seeded game's parts every scenario shares (test/harness/game-kit.ts).
// Aragorn takes the numbers of the deck like the stand-in heroes beside him (his printed numbers could not quest or defend a game of auto-played turns).
export const gondorWorld = async (decks: GondorDecks = "strong") => {
  const world = await game.world(decks);
  world.cards.set(ARAGORN, { ...world.cards.get(ARAGORN)!, ...HERO_STATS[decks] });
  return world;
};
export const afterCompany = (seatCount: 1 | 2) => game.after(seatCount);
export const gondorPlan = (seatCount: 1 | 2, log: CampaignLog = emptyLog(seatCount), choices?: readonly string[], loadout?: LoadoutSeat[]) => game.plan(seatCount, log, choices, undefined, loadout);
// `extra`: the Campaign Setup's answers (the first player's search for Andúril: its code, or "skip") and the seats' own decks.
export const gondorStart = (seatCount: 1 | 2, seed: number, difficulty: Difficulty, facts?: Omit<CampaignFacts, "modeCard">, log: CampaignLog = emptyLog(seatCount), modeCard?: ModeCard, extra: { choices?: readonly string[]; loadout?: LoadoutSeat[] } = {}) => game.start(seatCount, seed, difficulty, { facts, log, modeCard, ...extra });

/** The first seat's deck holds one Andúril (142014), so the campaign card's Setup asks the first player about the search. */
export const andurilLoadout = (seatCount: 1 | 2): LoadoutSeat[] => gondorLoadout(seatCount).map((seat, index) => (index === 0 ? { ...seat, deck: ["142014", ...seat.deck.slice(1)] } : seat));

export type GondorPolicy = {
  // The option a Choose window takes: the first or the last (The Corsair Fleet: reveal, or damage).
  choose: "first" | "last";
  // Whether the players engage the enemies of the staging area, one at a time.
  engage: boolean;
  // The quest: the first ready character of a seat, or every one but the last, or all.
  quest: "one" | "most" | "all";
};
export const DEFAULT_POLICY: GondorPolicy = { choose: "first", engage: false, quest: "most" };

// The auto-player's answer (test/harness/auto-player.ts), except: the travel, an engagement and the attack are answered as the policy says; a choice takes the first option or the last; an attack falls on the character with the least damage. Every intent is one the reducer listed.
export function gondorIntent(state: ScenarioState, ctx: ReduceContext, memory: Set<string>, policy: GondorPolicy = DEFAULT_POLICY, options: PolicyOptions = GONDOR_POLICY): PlayerIntent {
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
    // One character at a time, so the others are left to attack another enemy in the next window; an enemy is attacked once in a phase (the memory holds the round and the enemy).
    const seat = state.seats[state.activeSeat];
    const attack = [...(seat?.heroes ?? []), ...(seat?.play ?? [])].map((one) => attackTogether(state, ctx, (id) => id === one)).find((intent) => intent?.type === "DeclareAttackers" && !memory.has(`${state.round}:${intent.enemyId}`));
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
  return nextIntent(state, ctx, options, memory, intents);
}

export type GondorGame = PlayedGame;

// The goldens (src/campaign/scenarios/the-siege-of-gondor/golden.test.ts).
// `after`: the log of a campaign whose earlier part was won. `upgraded`: the Upgraded sides. `mode`: the Hard or Expert Mode card.
export type GondorGolden = { name: string; seatCount: 1 | 2; seed: number; difficulty: Difficulty; decks: GondorDecks; outcome: "won" | "lost"; policy?: Partial<GondorPolicy>; after?: boolean; upgraded?: boolean; mode?: ModeCard; lossReason?: string };

// Wins (true solo and two-handed, Normal and Easy; two-handed after The Passing of the Grey Company with the Army of the Dead in play, once with the players answering The Corsair Fleet with its damage, which destroys the Army, and once engaging)
// and the ways to lose that a game of stand-ins reaches: the players' threat at 50 (heroes too small to quest) and every hero destroyed by the Fleet's damage and the attacks, with Aragorn's leaving play two-handed.
export const GONDOR_GOLDENS: readonly GondorGolden[] = [
  { name: "true solo, won, Normal", seatCount: 1, seed: 1, difficulty: "Normal", decks: "strong", outcome: "won" },
  { name: "true solo, won, Easy", seatCount: 1, seed: 1, difficulty: "Easy", decks: "strong", outcome: "won" },
  { name: "true solo, won, after the Grey Company, answering the Fleet with damage", seatCount: 1, seed: 2, difficulty: "Normal", decks: "strong", outcome: "won", after: true, policy: { choose: "last" } },
  { name: "two-handed, won, Normal", seatCount: 2, seed: 3, difficulty: "Normal", decks: "strong", outcome: "won" },
  { name: "two-handed, won, Easy", seatCount: 2, seed: 3, difficulty: "Easy", decks: "strong", outcome: "won" },
  { name: "two-handed, won, after the Grey Company, engaging", seatCount: 2, seed: 1, difficulty: "Normal", decks: "strong", outcome: "won", after: true, policy: { engage: true } },
  { name: "two-handed, won, after the Grey Company, answering the Fleet with damage", seatCount: 2, seed: 1, difficulty: "Normal", decks: "strong", outcome: "won", after: true, policy: { choose: "last" } },
  { name: "true solo, lost, threat reaches 50", seatCount: 1, seed: 1, difficulty: "Normal", decks: "weak", outcome: "lost", lossReason: "No seats remain" },
  { name: "two-handed, lost, threat reaches 50", seatCount: 2, seed: 2, difficulty: "Normal", decks: "weak", outcome: "lost", lossReason: "No seats remain" },
  { name: "true solo, lost, every hero destroyed", seatCount: 1, seed: 1, difficulty: "Normal", decks: "brittle", outcome: "lost", policy: { choose: "last" }, lossReason: "No seats remain" },
  { name: "two-handed, lost, Aragorn leaves play", seatCount: 2, seed: 1, difficulty: "Normal", decks: "brittle", outcome: "lost", policy: { choose: "last" }, lossReason: "Aragorn left play" },
];

const game = campaignGame<GondorDecks, GondorPolicy>({
  campaign,
  scenario: gondor,
  stats: HERO_STATS,
  loadout: gondorLoadout,
  // The scenario's cards, Andúril, Aragorn, the Army of the Dead boon and Overcome by Fear the campaign card places or the earlier part earned, A Heavy Burden of Shelob's Lair (a burden the Setup leaves out) and the pool cards the Two Towers' log carries over; the campaign card's and the campaign's game codes are added by the kit.
  codes: [...gondor.cards.map((card) => card.code), "142014", "145001", "145068", "145016", "144052", "144014", "144075", "144076", "144015", "143015", "143016", "143017", "143018", "143019", "143020", "143021", "143068"],
  intent: gondorIntent,
  policy: DEFAULT_POLICY,
  limit: 6000,
  upgraded: [],
  // The Passing of the Grey Company earns no XP; it leaves the Army of the Dead boon in the pool (earned when the Army of the Dead enemy is in its victory display) and an Overcome by Fear for each seat whose dial held one (145066:B:1;
  // a true solo game reads both rows for its one seat, and the second copy stays set aside).
  earlier: { xp: [0], pool: [{ code: "145068" }, { code: "145016", seat: 0 }, { code: "145016", seat: 1 }], marks: {} },
});

export const playGolden = (golden: GondorGolden, ctx: ReduceContext): GondorGame => game.playGolden(golden, ctx);
