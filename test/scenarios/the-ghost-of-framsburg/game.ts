import { checklist } from "../../../src/campaign/checklist.ts";
import { emptyLog, type CampaignLog } from "../../../src/campaign/log.ts";
import { campaignScenario, type Difficulty } from "../../../src/catalog/scenario-data.ts";
import { EFFECTS } from "../../../src/effects/index.ts";
import type { PrintedCard } from "../../../src/rules/core/printed.ts";
import type { CampaignFacts, ModeCard } from "../../../src/rules/core/campaign-state.ts";
import { legalIntents, type PlayerIntent, type ReduceContext, type ScenarioState } from "../../../src/rules/engine/reduce.ts";

import { loadScenario } from "../../../scripts/data/load-scenarios.ts";
import { TREASURES } from "../the-withered-heath/scene.ts";
import { campaign, EARLIER_POOL, framsburg } from "./scene.ts";
import { nextIntent, type PolicyOptions } from "../../harness/auto-player.ts";
import { campaignGame, fillerLoadout, HERO_STATS, type PlayedGame } from "../../harness/game-kit.ts";

// Test helper. A whole game of The Ghost of Framsburg in Campaign Mode played by the auto-player, true solo or two-handed. The heroes are big numbers (or too small to quest, or too brittle to survive an attack) and the decks free
// events, so the outcome depends on the engine, the seed and the encounter deck, not on player card play. TODO: say how the players travel, engage and answer the choices this scenario asks.
export const FRAMSBURG_POLICY: PolicyOptions = { scout: "", prefer: "", protect: "", play: false, act: false };
// "strong": big-number heroes that win; "weak": heroes too small to quest, so the players lose on threat; "brittle": strong questers that die to an attack.
export type FramsburgDecks = "strong" | "weak" | "brittle";

export const framsburgLoadout = fillerLoadout;

// The goldens' world, the plan and start of a game, and the log of a campaign whose earlier parts were won: the seeded game's parts every scenario shares (test/harness/game-kit.ts).
let worldCards: ReadonlyMap<string, PrintedCard> | null = null;
export const framsburgWorld = async (decks: FramsburgDecks = "strong") => {
  const made = await game.world(decks);
  worldCards = made.cards;
  return made;
};
export const afterNight = (seatCount: 1 | 2) => game.after(seatCount);

/**
 * The answers the Campaign Setup asks of the players for `log`: with Isolde's line the first player names 3 treacheries to remove (12189:A:2), with Beldis's line 3 non-unique locations, each the first the search offers.
 * The checklist is asked until it needs nothing more.
 */
export function framsburgSetupChoices(seatCount: 1 | 2, log: CampaignLog, difficulty: Difficulty = "Normal"): string[] {
  if (!worldCards) throw new Error("Call framsburgWorld first");
  const answers: string[] = [];
  for (let guard = 0; guard < 40; guard += 1) {
    const plan = checklist({ log, scenario: campaignScenario(framsburg), seats: framsburgLoadout(seatCount), effects: EFFECTS, cards: worldCards, difficulty, choices: answers });
    if (plan.ok) return answers;
    const needs = plan.needs;
    if (!needs) throw new Error(plan.errors.join("; "));
    const offered = needs.options.filter((option) => option !== "skip");
    // Each search takes a different card.
    answers.push(offered.find((option) => !answers.includes(option)) ?? offered[0] ?? "skip");
  }
  throw new Error("The Campaign Setup keeps asking");
}
export const framsburgPlan = (seatCount: 1 | 2, log: CampaignLog = emptyLog(seatCount), choices?: readonly string[], difficulty?: Difficulty) => game.plan(seatCount, log, choices, difficulty);
export const framsburgStart = (seatCount: 1 | 2, seed: number, difficulty: Difficulty, facts?: Omit<CampaignFacts, "modeCard">, log: CampaignLog = emptyLog(seatCount), modeCard?: ModeCard, choices?: readonly string[]) => game.start(seatCount, seed, difficulty, facts, log, modeCard, choices);

export type FramsburgPolicy = {
  // The option a Choose window with these answers takes: the first or the last.
  choose: "first" | "last";
};
export const DEFAULT_POLICY: FramsburgPolicy = { choose: "first" };

// The auto-player's answer (test/harness/auto-player.ts), except: a choice takes the first option, or the last as the policy says. Every intent is one the reducer listed.
// TODO: the scenario's own answers (where the players travel, who defends, which locations they explore) go before the auto-player's.
export function framsburgIntent(state: ScenarioState, ctx: ReduceContext, memory: Set<string>, policy: FramsburgPolicy = DEFAULT_POLICY): PlayerIntent {
  if (state.window?.kind === "choose") return { type: "Choose", optionId: (policy.choose === "last" ? state.window.options.at(-1) : state.window.options[0]) ?? "" };
  return nextIntent(state, ctx, FRAMSBURG_POLICY, memory, legalIntents(state, ctx));
}

export type FramsburgGame = PlayedGame;

// The goldens (src/campaign/scenarios/the-ghost-of-framsburg/golden.test.ts), also played by the causes and replay tests once test/harness/golden-registry.ts lists them.
// `after`: the log of a campaign whose earlier parts were won. `upgraded`: the Upgraded sides. `mode`: the Hard or Expert Mode card.
export type FramsburgGolden = { name: string; seatCount: 1 | 2; seed: number; difficulty: Difficulty; decks: FramsburgDecks; outcome: "won" | "lost"; policy?: Partial<FramsburgPolicy>; after?: boolean; upgraded?: boolean; mode?: ModeCard; lossReason?: string };

// TODO: the games to pin, a few wins (true solo and two-handed, Normal and Easy, a Mode card, after the earlier parts) and a few losses (each way the scenario can be lost), each on a fixed seed.
export const FRAMSBURG_GOLDENS: readonly FramsburgGolden[] = [];

const PART_CODES = [framsburg.campaignCard];
const EARLIER_CARDS = [
  ...EARLIER_POOL, "18052", "18070",
  ...["journey-up-the-anduin", "lost-in-mirkwood", "the-kings-quest", "the-withered-heath", "roam-across-rhovanion", "fire-in-the-night"].flatMap((id) => loadScenario(id).cards.map((card) => card.code)),
];

const game = campaignGame<FramsburgDecks, FramsburgPolicy>({
  campaign,
  scenario: framsburg,
  stats: HERO_STATS,
  // The scenario's cards, its campaign card and the cards that card places, and what the earlier parts leave in the pool (the boon allies, the burdens, the Accolade and Song boons, Misplaced Trust and Urdug's Cunning, any card of their encounter sets) and the treasures a Resolution may offer.
  codes: [...framsburg.cards.map((card) => card.code), ...framsburg.campaignPlaced, ...PART_CODES, ...EARLIER_CARDS, ...TREASURES],
  intent: framsburgIntent,
  policy: DEFAULT_POLICY,
  limit: 6000,
  upgraded: [],
  // TODO: the XP each earlier part gained (in campaign order), the cards they put in the pool and the marks on the cards, as a campaign that won them leaves the log.
  earlier: { xp: [0, 0, 0, 0, 0, 0], pool: [], marks: {} },
});

export const playGolden = (golden: FramsburgGolden, ctx: ReduceContext): FramsburgGame => game.playGolden(golden, ctx);
