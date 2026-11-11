import { emptyLog, type CampaignLog } from "../../../src/campaign/log.ts";
import type { Difficulty } from "../../../src/catalog/scenario-data.ts";
import type { LoadoutSeat } from "../../../src/campaign/loadout.ts";
import type { CampaignFacts, ModeCard } from "../../../src/rules/core/campaign-state.ts";
import { legalIntents, legalTargets, type PlayerIntent, type ReduceContext, type ScenarioState } from "../../../src/rules/engine/reduce.ts";

import { loadCampaign, loadScenario } from "../../../scripts/data/load-scenarios.ts";
import { nextIntent, type PolicyOptions } from "../../harness/auto-player.ts";
import { attackTogether, campaignGame, fillerLoadout, HERO_STATS, type PlayedGame } from "../../harness/game-kit.ts";

const campaign = loadCampaign("the-return-of-the-king");
const company = loadScenario("the-passing-of-the-grey-company");

// Test helper. A whole game of The Passing of the Grey Company in Campaign Mode played by the auto-player, true solo or two-handed. The heroes are big numbers (or too small to quest, or too brittle to survive an attack) and the decks free
// events, so the outcome depends on the engine, the seed and the encounter deck, not on player card play. The players engage nothing they need not, travel to the first location they may, quest with every ready character but the
// last (kept to attack whatever the players engage), defend with nobody (an attack falls on the character with the least damage, a Phantom attack on a character raising the threat instead) and answer each choice with the policy's answer.
export const COMPANY_POLICY: PolicyOptions = { scout: "", prefer: "", protect: "", play: false, act: false };
// "strong": big-number heroes that win; "weak": heroes too small to quest, so the players lose on threat; "brittle": strong questers that die to an attack.
export type CompanyDecks = "strong" | "weak" | "brittle";

const ARAGORN = "145001";
// The first player starts with the saga's Aragorn (145001, mec113.setting-up-the-game) beside two stand-in heroes; a second seat has three.
export const companyLoadout = (seatCount: 1 | 2): LoadoutSeat[] => {
  const [, second] = fillerLoadout(2);
  const first = { heroes: [ARAGORN, "q1", "q2"], deck: fillerLoadout(1)[0]!.deck };
  return seatCount === 1 ? [first] : [first, second!];
};

// The goldens' world, the plan and start of a game, and the log of a campaign whose earlier parts were won: the seeded game's parts every scenario shares (test/harness/game-kit.ts).
// Aragorn takes the numbers of the deck like the stand-in heroes beside him (his printed numbers could not quest or defend a game of auto-played turns).
export const companyWorld = async (decks: CompanyDecks = "strong") => {
  const world = await game.world(decks);
  world.cards.set(ARAGORN, { ...world.cards.get(ARAGORN)!, ...HERO_STATS[decks] });
  return world;
};
export const companyPlan = (seatCount: 1 | 2, log: CampaignLog = emptyLog(seatCount)) => game.plan(seatCount, log);
// `extra`: the Campaign Setup's answers (the first player's search for Andúril: its code, or "skip") and the seats' own decks.
export const companyStart = (seatCount: 1 | 2, seed: number, difficulty: Difficulty, facts?: Omit<CampaignFacts, "modeCard">, log: CampaignLog = emptyLog(seatCount), modeCard?: ModeCard, extra: { choices?: readonly string[]; loadout?: LoadoutSeat[] } = {}) => game.start(seatCount, seed, difficulty, { facts, log, modeCard, ...extra });

/** The first seat's deck holds one Andúril (142014), so the campaign card's Setup asks the first player about the search. */
export const andurilLoadout = (seatCount: 1 | 2): LoadoutSeat[] => companyLoadout(seatCount).map((seat, index) => (index === 0 ? { ...seat, deck: ["142014", ...seat.deck.slice(1)] } : seat));

export type CompanyPolicy = {
  // The option a Choose window takes: the first, the last, or the first of SAFE_CHOICES that is offered (the choices that cost the players no threat and no card).
  choose: "first" | "last" | "safe";
  // Whether the players engage the enemies of the staging area, one at a time.
  engage: boolean;
  // Whether a character defends every attack ("all") or none: with nobody defending the attack falls on the character with the least damage.
  defend: "none" | "all";
  // The quest: the first ready character of a seat, or every one but the last, or all.
  quest: "one" | "most" | "all";
};
// An option that attaches Overcome by Fear is a cost taken to keep the other (threat or cards), so "safe" prefers the other options a record names.
const SAFE_CHOICES = ["decline", "keep", "staging", "discard", "attack", "reveal", "search", "raise", "add"];
export const DEFAULT_POLICY: CompanyPolicy = { choose: "safe", engage: false, defend: "none", quest: "most" };

// The auto-player's answer (test/harness/auto-player.ts), except: the travel, an engagement, the attack and a defender are answered as the policy says; a choice takes the first option, the last, or the first safe one. Every intent is one the reducer listed.
export function companyIntent(state: ScenarioState, ctx: ReduceContext, memory: Set<string>, policy: CompanyPolicy = DEFAULT_POLICY, options: PolicyOptions = COMPANY_POLICY): PlayerIntent {
  const intents = legalIntents(state, ctx);
  if (state.window?.kind === "choose") {
    const offered = state.window.options;
    const safe = SAFE_CHOICES.find((id) => offered.includes(id));
    return { type: "Choose", optionId: (policy.choose === "last" ? offered.at(-1) : policy.choose === "safe" ? (safe ?? offered[0]) : offered[0]) ?? "" };
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
    // One character at a time, so the others are left to attack another enemy in the next window; an enemy is attacked once in a phase (the memory holds the round and the enemy).
    const seat = state.seats[state.activeSeat];
    const attack = [...(seat?.heroes ?? []), ...(seat?.play ?? [])].map((one) => attackTogether(state, ctx, (id) => id === one)).find((intent) => intent?.type === "DeclareAttackers" && !memory.has(`${state.round}:${intent.enemyId}`));
    if (attack?.type === "DeclareAttackers") {
      memory.add(`${state.round}:${attack.enemyId}`);
      return attack;
    }
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
    if (!quested && ids.length > 0) return { type: "Commit", cardIds: policy.quest === "all" ? ids : policy.quest === "most" ? ids.slice(0, Math.max(1, ids.length - 1)) : ids.slice(0, 1) };
  }
  return nextIntent(state, ctx, options, memory, intents);
}

export type CompanyGame = PlayedGame;

// The goldens (src/campaign/scenarios/the-passing-of-the-grey-company/golden.test.ts).
// `after`: the log of a campaign whose earlier parts were won. `upgraded`: the Upgraded sides. `mode`: the Hard or Expert Mode card.
export type CompanyGolden = { name: string; seatCount: 1 | 2; seed: number; difficulty: Difficulty; decks: CompanyDecks; outcome: "won" | "lost"; policy?: Partial<CompanyPolicy>; after?: boolean; upgraded?: boolean; mode?: ModeCard; lossReason?: string };

// Wins (true solo and two-handed, Normal and Easy; two win with the players engaging the Oathbreakers, defending with a character and answering every choice with its first option, so the Overcome by Fear copies are attached) and the ways to lose that a game
// of stand-ins reaches: the players' threat at 50 (heroes too small to quest, so a failed quest and the stages raise it unopposed) and, two-handed, Phantom attacks on defenders raising the first player's threat until Aragorn leaves play. No enemy of this
// scenario deals damage while it has Phantom, so no game loses by heroes destroyed.
export const COMPANY_GOLDENS: readonly CompanyGolden[] = [
  { name: "true solo, won, Normal", seatCount: 1, seed: 1, difficulty: "Normal", decks: "strong", outcome: "won" },
  { name: "true solo, won, Easy", seatCount: 1, seed: 1, difficulty: "Easy", decks: "strong", outcome: "won" },
  { name: "true solo, won, engaging and defending", seatCount: 1, seed: 3, difficulty: "Normal", decks: "strong", outcome: "won", policy: { engage: true, defend: "all", choose: "first" } },
  { name: "two-handed, won, Normal", seatCount: 2, seed: 5, difficulty: "Normal", decks: "strong", outcome: "won" },
  { name: "two-handed, won, Easy", seatCount: 2, seed: 1, difficulty: "Easy", decks: "strong", outcome: "won" },
  { name: "two-handed, won, engaging and defending", seatCount: 2, seed: 2, difficulty: "Normal", decks: "strong", outcome: "won", policy: { engage: true, defend: "all", choose: "first" } },
  { name: "true solo, lost, threat reaches 50", seatCount: 1, seed: 1, difficulty: "Normal", decks: "weak", outcome: "lost", lossReason: "No seats remain" },
  { name: "two-handed, lost, threat reaches 50", seatCount: 2, seed: 2, difficulty: "Normal", decks: "weak", outcome: "lost", lossReason: "No seats remain" },
  { name: "two-handed, lost, Phantom attacks raise the first player's threat to 50 and Aragorn leaves play", seatCount: 2, seed: 12, difficulty: "Normal", decks: "strong", outcome: "lost", policy: { engage: true, defend: "all", choose: "first" }, lossReason: "Aragorn left play" },
];

const game = campaignGame<CompanyDecks, CompanyPolicy>({
  campaign,
  scenario: company,
  stats: HERO_STATS,
  loadout: companyLoadout,
  // The scenario's cards and Overcome by Fear, Andúril and the Army of the Dead boon the campaign card places or earns; the campaign card's and the campaign's game codes are added by the kit.
  codes: [...company.cards.map((card) => card.code), "145016", "142014", "145001", "145068", "144052", "144014", "144075", "144076", "144015", "143015", "143016", "143017", "143018", "143019", "143020", "143021", "143068"],
  intent: companyIntent,
  policy: DEFAULT_POLICY,
  limit: 6000,
  upgraded: [],
});

export const playGolden = (golden: CompanyGolden, ctx: ReduceContext): CompanyGame => game.playGolden(golden, ctx);
