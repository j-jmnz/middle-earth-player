import { emptyLog, type CampaignLog } from "../../../src/campaign/log.ts";
import type { LoadoutSeat } from "../../../src/campaign/loadout.ts";
import type { Difficulty } from "../../../src/catalog/scenario-data.ts";
import type { CampaignFacts, ModeCard } from "../../../src/rules/core/campaign-state.ts";
import { type PlayerIntent, type ReduceContext, type ScenarioState } from "../../../src/rules/engine/reduce.ts";

import { loadCampaign, loadScenario } from "../../../scripts/data/load-scenarios.ts";
import { angmarIntent, type AngmarPolicy } from "../../harness/angmar-policy.ts";
import { type PolicyOptions } from "../../harness/auto-player.ts";
import { campaignGame, HERO_STATS, type PlayedGame } from "../../harness/game-kit.ts";

const campaign = loadCampaign("angmar-awakened");
const gram = loadScenario("escape-from-mount-gram");

// Test helper. A whole game of Escape from Mount Gram in Campaign Mode played by the auto-player, true solo or two-handed. The heroes are big numbers (or too small to quest, or too brittle to survive an attack) and the decks free
// events, so the outcome depends on the engine, the seed and the encounter deck, not on player card play. Each player's starting hero is the first of their heroes and the others are shuffled into the captured deck; the players quest with every hero, defend with none
// (an attack falls on the hero with the least damage), engage nobody, and travel to the first location the engine lists (Southern Gate only once 16 progress is on stage 3B). The shared Angmar policy (test/harness/angmar-policy.ts) does the rest; a choice takes the first option.
export const GRAM_POLICY: PolicyOptions = { scout: "", prefer: "", protect: "", play: false, act: false };
// "strong": big-number heroes that win; "weak": heroes too small to quest, so the players lose on threat; "brittle": strong questers that die to an attack.
export type GramDecks = "strong" | "weak" | "brittle";

// Each player's deck holds three copies of each boon (allies and Items), so each captured deck is made of 18 cards and the two heroes that are not the starting hero; the rest are filler events.
export const BOONS = ["10176", "10177", "10178", "10179", "10180", "10181"];
export function gramLoadout(seatCount: 1 | 2): LoadoutSeat[] {
  const deck = [...BOONS, ...BOONS, ...BOONS, ...Array.from({ length: 12 }, () => "filler")];
  const first = { heroes: ["q1", "q2", "q3"], deck };
  return seatCount === 1 ? [first] : [first, { heroes: ["q4", "q5", "q6"], deck }];
}

// The goldens' world, the plan and start of a game, and the log of a campaign whose earlier parts were won: the seeded game's parts every scenario shares (test/harness/game-kit.ts).
export const gramWorld = (decks: GramDecks = "strong") => game.world(decks);
export const afterEriador = (seatCount: 1 | 2) => game.after(seatCount);
export const gramPlan = (seatCount: 1 | 2, log: CampaignLog = emptyLog(seatCount), choices?: readonly string[]) => game.plan(seatCount, log, choices);
// `choices`: the Campaign Setup Checklist's answers; `standalone`: the scenario alone, with no campaign card.
export const gramStart = (seatCount: 1 | 2, seed: number, difficulty: Difficulty, facts?: Omit<CampaignFacts, "modeCard">, log: CampaignLog = emptyLog(seatCount), modeCard?: ModeCard, loadout?: LoadoutSeat[], extra: { choices?: readonly string[]; standalone?: boolean } = {}) => game.start(seatCount, seed, difficulty, { facts, log, modeCard, ...(loadout ? { loadout } : {}), ...extra });

export type GramPolicy = AngmarPolicy;
export const DEFAULT_POLICY: GramPolicy = { choose: "first", engage: false, defend: "none", quest: "all" };

// The auto-player's answer (test/harness/auto-player.ts), except: a choice is answered as the policy says; the rest is the shared Angmar policy's (the players engage nobody, a hero is the one who takes an attack, every hero quests). Every intent is one the reducer listed.
export function gramIntent(state: ScenarioState, ctx: ReduceContext, memory: Set<string>, policy: GramPolicy = DEFAULT_POLICY, options: PolicyOptions = GRAM_POLICY): PlayerIntent {
  return angmarIntent(state, ctx, memory, policy, options, { safe: [], rank: () => 1 });
}

export type GramGame = PlayedGame;

// The goldens (src/campaign/scenarios/escape-from-mount-gram/golden.test.ts).
// `after`: the log of a campaign whose earlier parts were won. `upgraded`: the Upgraded sides. `mode`: the Hard or Expert Mode card.
export type GramGolden = { name: string; seatCount: 1 | 2; seed: number; difficulty: Difficulty; decks: GramDecks; outcome: "won" | "lost"; policy?: Partial<GramPolicy>; after?: boolean; upgraded?: boolean; mode?: ModeCard; lossReason?: string };

// Every game is played after The Wastes of Eriador's win (`after`): the pool holds Mysterious Omens, Arnor Ravaged, Amarthiúl's Courage, a burden and Fend Off Despair, which the Campaign Setup deals. Wins: true solo and two-handed, the heroes quest with everything, so the captured cards
// under stage 2A are rescued at once and the players advance to stage 3A together, travel to Southern Gate with 16 progress on the stage and defeat the stage once Southern Gate is explored; a true solo win on Easy (a smaller encounter deck) and a two-handed win in which one player's heroes are all destroyed (that player is out, the other wins). The ways to lose: threat at 50 (heroes too small to
// quest), true solo and two-handed, and the hero destroyed (the player's other heroes still captured: that player stays in the game until threat reaches 50, rr.player-elimination). A stage that separates the players (stage 2B's join) is the tests' (areas.test.ts).
export const GRAM_GOLDENS: readonly GramGolden[] = [
  { name: "true solo, won, Normal", seatCount: 1, seed: 1, difficulty: "Normal", decks: "strong", outcome: "won", after: true },
  { name: "two-handed, won, Normal", seatCount: 2, seed: 2, difficulty: "Normal", decks: "strong", outcome: "won", after: true },
  { name: "two-handed, won, a player's heroes destroyed", seatCount: 2, seed: 4, difficulty: "Normal", decks: "brittle", outcome: "won", after: true },
  { name: "true solo, lost, threat reaches 50", seatCount: 1, seed: 5, difficulty: "Normal", decks: "weak", outcome: "lost", after: true, lossReason: "No seats remain" },
  { name: "true solo, lost, every hero is destroyed", seatCount: 1, seed: 9, difficulty: "Normal", decks: "brittle", outcome: "lost", after: true, lossReason: "No seats remain" },
];

const game = campaignGame<GramDecks, GramPolicy>({
  campaign,
  scenario: gram,
  stats: HERO_STATS,
  // The scenario's cards and the cards its campaign card places (the boons of Loot the Dungeons, Determination and Fend Off Despair among them), added by the kit; the pool holds what The Wastes of Eriador leaves.
  codes: [...gram.cards.map((card) => card.code), "10160", "10161", "10162", "10163", "10164", "10165", "100158", "10157", "10167", "10168", "10169", "10170", "10172", "10173", "10175", ...["10176", "10177", "10178", "10179", "10180", "10181"]],
  loadout: gramLoadout,
  intent: gramIntent,
  policy: DEFAULT_POLICY,
  limit: 6000,
  upgraded: [],
  // Intruders in Chetwood, The Weather Hills, Deadmen's Dike and The Wastes of Eriador were won: no XP in this campaign; in the pool Mysterious Omens, Arnor Ravaged, Amarthiúl's Courage, Thaurdir's Legacy and Fend Off Despair.
  earlier: { xp: [0, 0, 0, 0], pool: [{ code: "10160" }, { code: "100158" }, { code: "10167" }, { code: "10168" }, { code: "10173" }], marks: {} },
});

export const playGolden = (golden: GramGolden, ctx: ReduceContext): GramGame => game.playGolden(golden, ctx);
