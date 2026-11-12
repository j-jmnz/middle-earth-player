import { emptyLog, type CampaignLog } from "../../../src/campaign/log.ts";
import type { Difficulty } from "../../../src/catalog/scenario-data.ts";
import type { CampaignFacts, ModeCard } from "../../../src/rules/core/campaign-state.ts";
import { legalIntents, legalTargets, type PlayerIntent, type ReduceContext, type ScenarioState } from "../../../src/rules/engine/reduce.ts";

import { loadCampaign, loadScenario } from "../../../scripts/data/load-scenarios.ts";
import { nextIntent, type PolicyOptions } from "../../harness/auto-player.ts";
import { attackTogether, campaignGame, fillerLoadout, HERO_STATS, type PlayedGame } from "../../harness/game-kit.ts";

const campaign = loadCampaign("angmar-awakened");
const hills = loadScenario("the-weather-hills");

// Test helper. A whole game of The Weather Hills in Campaign Mode played by the auto-player, true solo or two-handed. The heroes are big numbers (or too small to quest, or too brittle to survive an attack) and the decks free
// events, so the outcome depends on the engine, the seed and the encounter deck, not on player card play. The players engage the enemies of the staging area one at a time (each defeated enemy puts a token on Hunting the Orcs, 09071:A:1),
// travel to the first location they may, quest with every ready character but the last (kept to attack), defend as the policy says, and answer each choice with the policy's answer: the safe options reveal an additional card rather
// than remove a token from Savage Counter-attack, and take the first boon Mysterious Omens offers.
export const HILLS_POLICY: PolicyOptions = { scout: "", prefer: "", protect: "", play: false, act: false };
// "strong": big-number heroes that win; "weak": heroes too small to quest, so the players lose on threat; "brittle": strong questers that die to an attack.
export type HillsDecks = "strong" | "weak" | "brittle";

export const hillsLoadout = fillerLoadout;

// The goldens' world, the plan and start of a game, and the log of a campaign whose earlier parts were won: the seeded game's parts every scenario shares (test/harness/game-kit.ts).
export const hillsWorld = (decks: HillsDecks = "strong") => game.world(decks);
export const afterChetwood = (seatCount: 1 | 2) => game.after(seatCount);
export const hillsPlan = (seatCount: 1 | 2, log: CampaignLog = emptyLog(seatCount)) => game.plan(seatCount, log);
// `choices`: the Campaign Setup Checklist's answers; `standalone`: the scenario alone, with no campaign card.
export const hillsStart = (seatCount: 1 | 2, seed: number, difficulty: Difficulty, facts?: Omit<CampaignFacts, "modeCard">, log: CampaignLog = emptyLog(seatCount), modeCard?: ModeCard, extra: { choices?: readonly string[]; standalone?: boolean } = {}) => game.start(seatCount, seed, difficulty, { facts, log, modeCard, ...extra });

export type HillsPolicy = {
  // The option a Choose window takes: the first, the last, or the first of SAFE_CHOICES that is offered.
  choose: "first" | "last" | "safe";
  // Whether the players engage the enemies of the staging area, one at a time.
  engage: boolean;
  // Whether a character defends every attack ("all") or none: with nobody defending the attack falls on the character with the least damage.
  defend: "none" | "all";
  // The quest: the first ready character of a seat, or every one but the last, or all.
  quest: "one" | "most" | "all";
};
// The options that keep what the players have: an additional card revealed rather than a token off Savage Counter-attack, no ally discarded, a card revealed or searched for.
const SAFE_CHOICES = ["reveal", "keep", "staging", "search", "main"];
export const DEFAULT_POLICY: HillsPolicy = { choose: "safe", engage: true, defend: "none", quest: "most" };

// The auto-player's answer (test/harness/auto-player.ts), except: the travel, an engagement, the attack and a defender are answered as the policy says; a choice takes the first option, the last, or the first safe one. Every intent is one the reducer listed.
export function hillsIntent(state: ScenarioState, ctx: ReduceContext, memory: Set<string>, policy: HillsPolicy = DEFAULT_POLICY, options: PolicyOptions = HILLS_POLICY): PlayerIntent {
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

export type HillsGame = PlayedGame;

// The goldens (src/campaign/scenarios/the-weather-hills/golden.test.ts).
// `after`: the log of a campaign whose earlier parts were won. `upgraded`: the Upgraded sides. `mode`: the Hard or Expert Mode card.
export type HillsGolden = { name: string; seatCount: 1 | 2; seed: number; difficulty: Difficulty; decks: HillsDecks; outcome: "won" | "lost"; policy?: Partial<HillsPolicy>; after?: boolean; upgraded?: boolean; mode?: ModeCard; lossReason?: string };

// Every game is played after Intruders in Chetwood's win (`after`): Protect the Innocent lies in the pool (a fresh log would deal it twice), Mysterious Omens joins it at the Setup. Wins: true solo, true solo answering every choice with its first
// option, and two-handed with one character defending and one questing for each player. The ways to lose: Protect the Innocent holding 10 damage, Savage Counter-attack holding no token (the first option of Cornered Animals' choice removes one each round),
// the players' threat at 50 (heroes too small to quest) and every hero destroyed. The default policy answers the choices safely (an additional card revealed, never a token removed).
const SAFE_DEFENDING = { defend: "all", quest: "one" } as const;
export const HILLS_GOLDENS: readonly HillsGolden[] = [
  { name: "true solo, won, Normal", seatCount: 1, seed: 5, difficulty: "Normal", decks: "strong", outcome: "won", after: true },
  { name: "true solo, won, every choice the first option", seatCount: 1, seed: 19, difficulty: "Normal", decks: "strong", outcome: "won", after: true, policy: { choose: "first" } },
  { name: "two-handed, won, Normal", seatCount: 2, seed: 39, difficulty: "Normal", decks: "strong", outcome: "won", after: true, policy: SAFE_DEFENDING },
  { name: "true solo, lost, Protect the Innocent holds 10 damage", seatCount: 1, seed: 1, difficulty: "Normal", decks: "strong", outcome: "lost", after: true, lossReason: "Protect the Innocent holds 10 damage" },
  { name: "true solo, lost, Savage Counter-attack holds no token", seatCount: 1, seed: 4, difficulty: "Normal", decks: "strong", outcome: "lost", after: true, policy: { choose: "first" }, lossReason: "Savage Counter-attack held no resource token" },
  { name: "true solo, lost, threat reaches 50", seatCount: 1, seed: 2, difficulty: "Normal", decks: "weak", outcome: "lost", after: true, lossReason: "No seats remain" },
  { name: "true solo, lost, every hero destroyed", seatCount: 1, seed: 2, difficulty: "Normal", decks: "brittle", outcome: "lost", after: true, lossReason: "No seats remain" },
];

const game = campaignGame<HillsDecks, HillsPolicy>({
  campaign,
  scenario: hills,
  stats: HERO_STATS,
  // The scenario's cards; the campaign card's, the cards it places (Protect the Innocent, Mysterious Omens, the boons) and the campaign's game codes are added by the kit.
  codes: [...hills.cards.map((card) => card.code), "09072", "10160", "10161", "10162", "10163", "10164", "10165"],
  intent: hillsIntent,
  policy: DEFAULT_POLICY,
  limit: 6000,
  upgraded: [],
  // Intruders in Chetwood was won: no XP in this campaign, Protect the Innocent (with the damage the log notes) in the pool.
  earlier: { xp: [0], pool: [{ code: "10158" }], marks: {} },
});

export const playGolden = (golden: HillsGolden, ctx: ReduceContext): HillsGame => game.playGolden(golden, ctx);
