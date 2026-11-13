import { emptyLog, type CampaignLog } from "../../../src/campaign/log.ts";
import type { Difficulty } from "../../../src/catalog/scenario-data.ts";
import type { CampaignFacts, ModeCard } from "../../../src/rules/core/campaign-state.ts";
import { legalIntents, legalTargets, type PlayerIntent, type ReduceContext, type ScenarioState } from "../../../src/rules/engine/reduce.ts";

import { loadCampaign, loadScenario } from "../../../scripts/data/load-scenarios.ts";
import { nextIntent, type PolicyOptions } from "../../harness/auto-player.ts";
import { attackTogether, campaignGame, fillerLoadout, HERO_STATS, type PlayedGame } from "../../harness/game-kit.ts";

const campaign = loadCampaign("angmar-awakened");
const chetwood = loadScenario("intruders-in-chetwood");

// Test helper. A whole game of Intruders in Chetwood in Campaign Mode played by the auto-player, true solo or two-handed. The heroes are big numbers (or too small to quest, or too brittle to survive an attack) and the decks free
// events, so the outcome depends on the engine, the seed and the encounter deck, not on player card play. The players engage the enemies of the staging area one at a time (no enemy makes an engagement check, 09068:B:1, and the Orc War
// Parties must be killed before the stage can be defeated, 09017:A:3), travel to the first location they may, quest with every ready character but the last (kept to attack), defend with nobody, and answer each choice with the policy's
// answer: the safe options keep Iârion in play, add no damage to Protect the Innocent and reveal rather than discard an ally.
export const CHETWOOD_POLICY: PolicyOptions = { scout: "", prefer: "", protect: "", play: false, act: false };
// "strong": big-number heroes that win; "weak": heroes too small to quest, so the players lose on threat; "brittle": strong questers that die to an attack.
export type ChetwoodDecks = "strong" | "weak" | "brittle";

export const chetwoodLoadout = fillerLoadout;

// The goldens' world, the plan and start of a game, and the log of a campaign whose earlier parts were won: the seeded game's parts every scenario shares (test/harness/game-kit.ts).
export const chetwoodWorld = (decks: ChetwoodDecks = "strong") => game.world(decks);
export const chetwoodPlan = (seatCount: 1 | 2, log: CampaignLog = emptyLog(seatCount)) => game.plan(seatCount, log);
// `choices`: the Campaign Setup Checklist's answers; `standalone`: the scenario alone, with no campaign card.
export const chetwoodStart = (seatCount: 1 | 2, seed: number, difficulty: Difficulty, facts?: Omit<CampaignFacts, "modeCard">, log: CampaignLog = emptyLog(seatCount), modeCard?: ModeCard, extra: { choices?: readonly string[]; standalone?: boolean } = {}) => game.start(seatCount, seed, difficulty, { facts, log, modeCard, ...extra });

export type ChetwoodPolicy = {
  // The option a Choose window takes: the first, the last, or the first of SAFE_CHOICES that is offered.
  choose: "first" | "last" | "safe";
  // Whether the players engage the enemies of the staging area, one at a time.
  engage: boolean;
  // Whether a character defends every attack ("all") or none: with nobody defending the attack falls on the character with the least damage.
  defend: "none" | "all";
  // The quest: the first ready character of a seat, or every one but the last, or all.
  quest: "one" | "most" | "all";
};
// The options that keep what the players have: no damage on Protect the Innocent, the attacker back in the staging area rather than a hero exhausted, no ally discarded, a card revealed or searched for.
const SAFE_CHOICES = ["keep", "staging", "reveal", "search", "main"];
export const DEFAULT_POLICY: ChetwoodPolicy = { choose: "safe", engage: true, defend: "none", quest: "most" };

// The auto-player's answer (test/harness/auto-player.ts), except: the travel, an engagement, the attack and a defender are answered as the policy says; a choice takes the first option, the last, or the first safe one. Every intent is one the reducer listed.
export function chetwoodIntent(state: ScenarioState, ctx: ReduceContext, memory: Set<string>, policy: ChetwoodPolicy = DEFAULT_POLICY, options: PolicyOptions = CHETWOOD_POLICY): PlayerIntent {
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
    // Iârion never defends: he would be destroyed and the players lose with him (09016:A:4).
    const defender = policy.defend === "all" && intents.some((intent) => intent.type === "DeclareDefender") ? byDamage(legalTargets(state, { type: "DeclareDefender" }, ctx).filter((id) => state.cards[id]?.code !== "09016")) : undefined;
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

export type ChetwoodGame = PlayedGame;

// The goldens (src/campaign/scenarios/intruders-in-chetwood/golden.test.ts).
// `after`: the log of a campaign whose earlier parts were won. `upgraded`: the Upgraded sides. `mode`: the Hard or Expert Mode card.
export type ChetwoodGolden = { name: string; seatCount: 1 | 2; seed: number; difficulty: Difficulty; decks: ChetwoodDecks; outcome: "won" | "lost"; policy?: Partial<ChetwoodPolicy>; after?: boolean; upgraded?: boolean; mode?: ModeCard; lossReason?: string };

// Wins (true solo, true solo answering every choice with its first option, two-handed: the ones that defend send one character to defend each attack and quest with one, so Protect the Innocent takes little damage; each player trades 4 damage on
// Protect the Innocent for resources at the Setup) and the ways to lose: Protect the Innocent holding 10 damage, Iârion leaving play (Rescue Iârion's last time counter, Angmar Orc's discard), the players' threat at 50 (heroes too small to quest) and every hero destroyed.
const SAFE_DEFENDING = { defend: "all", quest: "one" } as const;
export const CHETWOOD_GOLDENS: readonly ChetwoodGolden[] = [
  { name: "true solo, won, Normal", seatCount: 1, seed: 5, difficulty: "Normal", decks: "strong", outcome: "won", policy: SAFE_DEFENDING },
  { name: "true solo, won, every choice the first option", seatCount: 1, seed: 5, difficulty: "Normal", decks: "strong", outcome: "won", policy: { ...SAFE_DEFENDING, choose: "first" } },
  { name: "two-handed, won, Normal", seatCount: 2, seed: 1, difficulty: "Normal", decks: "strong", outcome: "won" },
  { name: "true solo, lost, Protect the Innocent holds 10 damage", seatCount: 1, seed: 1, difficulty: "Normal", decks: "strong", outcome: "lost", lossReason: "Protect the Innocent holds 10 damage" },
  { name: "two-handed, lost, Rescue Iârion runs out of time", seatCount: 2, seed: 5, difficulty: "Normal", decks: "strong", outcome: "lost", policy: SAFE_DEFENDING, lossReason: "Iârion left play" },
  { name: "two-handed, lost, Angmar Orc discards Iârion", seatCount: 2, seed: 1, difficulty: "Normal", decks: "strong", outcome: "lost", policy: { ...SAFE_DEFENDING, choose: "first" }, lossReason: "Iârion left play" },
  { name: "true solo, lost, threat reaches 50", seatCount: 1, seed: 2, difficulty: "Normal", decks: "weak", outcome: "lost", lossReason: "No seats remain" },
  { name: "true solo, lost, every hero destroyed", seatCount: 1, seed: 1, difficulty: "Normal", decks: "brittle", outcome: "lost", lossReason: "No seats remain" },
];

const game = campaignGame<ChetwoodDecks, ChetwoodPolicy>({
  campaign,
  scenario: chetwood,
  stats: HERO_STATS,
  // The scenario's cards; the campaign card's, the cards it places (the Pendant, Protect the Innocent) and the campaign's game codes are added by the kit.
  codes: [...chetwood.cards.map((card) => card.code)],
  intent: chetwoodIntent,
  policy: DEFAULT_POLICY,
  limit: 6000,
  upgraded: [],
});

export const playGolden = (golden: ChetwoodGolden, ctx: ReduceContext): ChetwoodGame => game.playGolden(golden, ctx);
