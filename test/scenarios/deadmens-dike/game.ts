import { emptyLog, type CampaignLog } from "../../../src/campaign/log.ts";
import type { Difficulty } from "../../../src/catalog/scenario-data.ts";
import type { CampaignFacts, ModeCard } from "../../../src/rules/core/campaign-state.ts";
import type { PlayerIntent, ReduceContext, ScenarioState } from "../../../src/rules/engine/reduce.ts";

import { loadCampaign, loadScenario } from "../../../scripts/data/load-scenarios.ts";
import { angmarIntent, type AngmarPolicy, type AngmarScenario } from "../../harness/angmar-policy.ts";
import type { PolicyOptions } from "../../harness/auto-player.ts";
import { campaignGame, fillerLoadout, HERO_STATS, type PlayedGame } from "../../harness/game-kit.ts";

const campaign = loadCampaign("angmar-awakened");
const dike = loadScenario("deadmens-dike");
const THAURDIR = "09033";

// Test helper. A whole game of Deadmen's Dike in Campaign Mode played by the auto-player, true solo or two-handed. The heroes are big numbers (or too small to quest, or too brittle to survive an attack) and the decks free
// events, so the outcome depends on the engine, the seed and the encounter deck, not on player card play. The players engage the enemies of the staging area one at a time (Thaurdir too: stage 2B needs 9 damage on him), travel to the first
// location they may, quest with every ready character but the last (kept to attack), defend as the policy says, and answer each choice with the policy's answer: the safe options return Thaurdir rather than discard 3 cards, and take the first
// boon Mysterious Omens offers.
export const DIKE_POLICY: PolicyOptions = { scout: "", prefer: "", protect: "", play: false, act: false };
// "strong": big-number heroes that win; "weak": heroes too small to quest, so the players lose on threat; "brittle": strong questers that die to an attack.
export type DikeDecks = "strong" | "weak" | "brittle";

export const dikeLoadout = fillerLoadout;

// The goldens' world, the plan and start of a game, and the log of a campaign whose earlier parts were won: the seeded game's parts every scenario shares (test/harness/game-kit.ts).
export const dikeWorld = (decks: DikeDecks = "strong") => game.world(decks);
export const afterHills = (seatCount: 1 | 2) => game.after(seatCount);
export const dikePlan = (seatCount: 1 | 2, log: CampaignLog = emptyLog(seatCount)) => game.plan(seatCount, log);
// `choices`: the Campaign Setup Checklist's answers; `standalone`: the scenario alone, with no campaign card.
export const dikeStart = (seatCount: 1 | 2, seed: number, difficulty: Difficulty, facts?: Omit<CampaignFacts, "modeCard">, log: CampaignLog = emptyLog(seatCount), modeCard?: ModeCard, extra: { choices?: readonly string[]; standalone?: boolean } = {}) => game.start(seatCount, seed, difficulty, { facts, log, modeCard, ...extra });

export type DikePolicy = AngmarPolicy;
// The options that keep what the players have: Thaurdir returned to the staging area rather than 3 cards discarded after he destroys a character, and the cards of Unnatural Fog discarded rather than every character removed from the quest.
const SAFE_CHOICES = ["return", "discard"];
export const DEFAULT_POLICY: DikePolicy = { choose: "safe", engage: false, defend: "none", quest: "one" };

// Thaurdir is attacked first: the second stage cannot be won until 9 damage is on him (09074:B:2); Iârion never attacks.
const DIKE: AngmarScenario = { safe: SAFE_CHOICES, rank: (state, enemyId) => (state.cards[enemyId]?.code === THAURDIR ? 0 : 1) };

// The shared Angmar policy (test/harness/angmar-policy.ts) with Thaurdir attacked first.
export const dikeIntent = (state: ScenarioState, ctx: ReduceContext, memory: Set<string>, policy: DikePolicy = DEFAULT_POLICY, options: PolicyOptions = DIKE_POLICY): PlayerIntent => angmarIntent(state, ctx, memory, policy, options, DIKE);

export type DikeGame = PlayedGame;

// The goldens (src/campaign/scenarios/deadmens-dike/golden.test.ts).
// `after`: the log of a campaign whose earlier parts were won. `upgraded`: the Upgraded sides. `mode`: the Hard or Expert Mode card.
export type DikeGolden = { name: string; seatCount: 1 | 2; seed: number; difficulty: Difficulty; decks: DikeDecks; outcome: "won" | "lost"; policy?: Partial<DikePolicy>; after?: boolean; upgraded?: boolean; mode?: ModeCard; lossReason?: string };

// Every game is played after The Weather Hills' win (`after`): Protect the Innocent lies in the pool and is staged with the damage the log noted for it (a fresh log stages it with none), and Mysterious Omens, left in the pool, is shuffled into the encounter deck.
// Wins: true solo, true solo answering every choice with its first option, and two-handed; one hero quests and the others attack Thaurdir (the players engage nobody: he engages them by his engagement cost), every attack falls on a hero undefended,
// and each seed gives Thaurdir a different burden (the random pick of 10166:A:3: Thaurdir's Legacy, Majesty and Spite, one for each win), which joins the pool. The ways to lose: Protect the Innocent holding 10 damage, the players' threat at 50 (heroes too small to quest),
// every hero destroyed (by Thaurdir's attack, so that 09074:B:1 asks the controller) and, two-handed with every attack defended, a player's deck running out (the stage eliminates him) while he controls Iârion, whose leaving play loses the game.
// A deck running out in a solo game is not played here: the scene-kit tests of lines.test.ts show the elimination at each settle.
const DEFENDING = { defend: "all", quest: "one" } as const;
export const DIKE_GOLDENS: readonly DikeGolden[] = [
  { name: "true solo, won, Normal", seatCount: 1, seed: 4, difficulty: "Normal", decks: "strong", outcome: "won", after: true },
  { name: "true solo, won, every choice the first option", seatCount: 1, seed: 8, difficulty: "Normal", decks: "strong", outcome: "won", after: true, policy: { choose: "first" } },
  { name: "two-handed, won, Normal", seatCount: 2, seed: 4, difficulty: "Normal", decks: "strong", outcome: "won", after: true },
  { name: "true solo, lost, Protect the Innocent holds 10 damage", seatCount: 1, seed: 6, difficulty: "Normal", decks: "strong", outcome: "lost", after: true, lossReason: "Protect the Innocent holds 10 damage" },
  { name: "true solo, lost, threat reaches 50", seatCount: 1, seed: 3, difficulty: "Normal", decks: "weak", outcome: "lost", after: true, lossReason: "No seats remain" },
  { name: "true solo, lost, every hero destroyed", seatCount: 1, seed: 1, difficulty: "Normal", decks: "brittle", outcome: "lost", after: true, lossReason: "No seats remain" },
  { name: "two-handed, lost, a deck runs out and Iârion leaves play", seatCount: 2, seed: 5, difficulty: "Normal", decks: "strong", outcome: "lost", after: true, policy: DEFENDING, lossReason: "Iârion left play" },
];

const game = campaignGame<DikeDecks, DikePolicy>({
  campaign,
  scenario: dike,
  stats: HERO_STATS,
  // The scenario's cards; the campaign card's, the cards it places (Protect the Innocent, the burdens, Iârion's Pendant) and the campaign's game codes are added by the kit. Mysterious Omens and its boons lie in the pool.
  codes: [...dike.cards.map((card) => card.code), "10160", "10161", "10162", "10163", "10164", "10165"],
  intent: dikeIntent,
  policy: DEFAULT_POLICY,
  limit: 6000,
  upgraded: [],
  // Intruders in Chetwood and The Weather Hills were won: no XP in this campaign, Protect the Innocent (with the damage the log notes) and Mysterious Omens in the pool.
  earlier: { xp: [0, 0], pool: [{ code: "10158" }, { code: "10160" }], marks: {} },
});

export const playGolden = (golden: DikeGolden, ctx: ReduceContext): DikeGame => game.playGolden(golden, ctx);
