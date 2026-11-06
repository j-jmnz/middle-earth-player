import { emptyLog, type CampaignLog } from "../../../src/campaign/log.ts";
import type { Difficulty } from "../../../src/catalog/scenario-data.ts";
import type { CampaignFacts, ModeCard } from "../../../src/rules/core/campaign-state.ts";
import { legalIntents, type PlayerIntent, type ReduceContext, type ScenarioState } from "../../../src/rules/engine/reduce.ts";

import { checklist } from "../../../src/campaign/checklist.ts";
import { campaignScenario } from "../../../src/catalog/scenario-data.ts";
import { EFFECTS } from "../../../src/effects/index.ts";
import type { PrintedCard } from "../../../src/rules/core/printed.ts";
import { loadScenario } from "../../../scripts/data/load-scenarios.ts";
import { EARLIER_POOL } from "../the-ghost-of-framsburg/scene.ts";
import { TREASURES } from "../the-withered-heath/scene.ts";
import { campaign, gundabad } from "./scene.ts";
import { nextIntent, type PolicyOptions } from "../../harness/auto-player.ts";
import { campaignGame, fillerLoadout, HERO_STATS, type PlayedGame } from "../../harness/game-kit.ts";

// Test helper. A whole game of Mount Gundabad in Campaign Mode played by the auto-player, true solo or two-handed. The heroes are big numbers (or too small to quest, or too brittle to survive an attack) and the decks free
// events, so the outcome depends on the engine, the seed and the encounter deck, not on player card play. TODO: say how the players travel, engage and answer the choices this scenario asks.
export const GUNDABAD_POLICY: PolicyOptions = { scout: "", prefer: "", protect: "", play: false, act: false };
// "strong": big-number heroes that win; "weak": heroes too small to quest, so the players lose on threat; "brittle": strong questers that die to an attack.
export type GundabadDecks = "strong" | "weak" | "brittle";

export const gundabadLoadout = fillerLoadout;

// The goldens' world, the plan and start of a game, and the log of a campaign whose earlier parts were won: the seeded game's parts every scenario shares (test/harness/game-kit.ts).
let worldCards: ReadonlyMap<string, PrintedCard> | null = null;
export const gundabadWorld = async (decks: GundabadDecks = "strong") => {
  const made = await game.world(decks);
  worldCards = made.cards;
  return made;
};

/**
 * The answers the Campaign Setup asks of the players for `log`: with Melanwar's line the first player names 2 non-unique locations of the encounter deck and a location of the Caves deck to remove (12193:A:2), with Beldis's line 3 treacheries,
 * each the first the search offers that an earlier search did not take. The checklist is asked until it needs nothing more.
 */
export function gundabadSetupChoices(seatCount: 1 | 2, log: CampaignLog, difficulty: Difficulty = "Normal", facts?: Omit<CampaignFacts, "modeCard">): string[] {
  if (!worldCards) throw new Error("Call gundabadWorld first");
  const answers: string[] = [];
  for (let guard = 0; guard < 40; guard += 1) {
    const plan = checklist({ log, scenario: campaignScenario(gundabad), seats: gundabadLoadout(seatCount), effects: EFFECTS, cards: worldCards, difficulty, choices: answers, ...(facts ? { facts } : {}) } as Parameters<typeof checklist>[0]);
    if (plan.ok) return answers;
    const needs = plan.needs;
    if (!needs) throw new Error(plan.errors.join("; "));
    const offered = needs.options.filter((option) => option !== "skip");
    answers.push(offered.find((option) => !answers.includes(option)) ?? offered[0] ?? "skip");
  }
  throw new Error("The Campaign Setup keeps asking");
}
export const afterFramsburg = (seatCount: 1 | 2) => game.after(seatCount);
export const gundabadPlan = (seatCount: 1 | 2, log: CampaignLog = emptyLog(seatCount), choices?: readonly string[], difficulty?: Difficulty) => game.plan(seatCount, log, choices, difficulty);
export const gundabadStart = (seatCount: 1 | 2, seed: number, difficulty: Difficulty, facts?: Omit<CampaignFacts, "modeCard">, log: CampaignLog = emptyLog(seatCount), modeCard?: ModeCard, choices?: readonly string[]) => game.start(seatCount, seed, difficulty, facts, log, modeCard, choices);

export type GundabadPolicy = {
  // The option a Choose window with these answers takes: the first or the last.
  choose: "first" | "last";
};
const EARLIER_SCENARIOS = ["journey-up-the-anduin", "lost-in-mirkwood", "the-kings-quest", "the-withered-heath", "roam-across-rhovanion", "fire-in-the-night", "the-ghost-of-framsburg"];
export const DEFAULT_POLICY: GundabadPolicy = { choose: "first" };

// The auto-player's answer (test/harness/auto-player.ts), except: a choice takes the first option, or the last as the policy says. Every intent is one the reducer listed.
// TODO: the scenario's own answers (where the players travel, who defends, which locations they explore) go before the auto-player's.
export function gundabadIntent(state: ScenarioState, ctx: ReduceContext, memory: Set<string>, policy: GundabadPolicy = DEFAULT_POLICY): PlayerIntent {
  if (state.window?.kind === "choose") return { type: "Choose", optionId: (policy.choose === "last" ? state.window.options.at(-1) : state.window.options[0]) ?? "" };
  return nextIntent(state, ctx, GUNDABAD_POLICY, memory, legalIntents(state, ctx));
}

export type GundabadGame = PlayedGame;

// The goldens (src/campaign/scenarios/mount-gundabad/golden.test.ts), also played by the causes and replay tests once test/harness/golden-registry.ts lists them.
// `after`: the log of a campaign whose earlier parts were won. `upgraded`: the Upgraded sides. `mode`: the Hard or Expert Mode card.
export type GundabadGolden = { name: string; seatCount: 1 | 2; seed: number; difficulty: Difficulty; decks: GundabadDecks; outcome: "won" | "lost"; policy?: Partial<GundabadPolicy>; after?: boolean; upgraded?: boolean; mode?: ModeCard; lossReason?: string };

// TODO: the games to pin, a few wins (true solo and two-handed, Normal and Easy, a Mode card, after the earlier parts) and a few losses (each way the scenario can be lost), each on a fixed seed.
export const GUNDABAD_GOLDENS: readonly GundabadGolden[] = [];

const game = campaignGame<GundabadDecks, GundabadPolicy>({
  campaign,
  scenario: gundabad,
  stats: HERO_STATS,
  // The scenario's cards, its campaign card and the cards that card places, and what the earlier parts leave in the pool (the boon allies, the burdens, the Accolade and Song boons, Misplaced Trust and Urdug's Cunning, Gundabad Hunter and Gundabad Stalker, the Hazard cards,
  // any card of their encounter sets) and the treasures a Resolution may offer.
  codes: [...gundabad.cards.map((card) => card.code), ...gundabad.campaignPlaced, gundabad.campaignCard, "19144", ...EARLIER_POOL, "18052", "18070", ...TREASURES, ...EARLIER_SCENARIOS.flatMap((id) => [...loadScenario(id).cards.map((card) => card.code), ...loadScenario(id).campaignPlaced])],
  intent: gundabadIntent,
  policy: DEFAULT_POLICY,
  limit: 6000,
  upgraded: [],
  // TODO: the XP each earlier part gained (in campaign order), the cards they put in the pool and the marks on the cards, as a campaign that won them leaves the log.
  earlier: { xp: [0, 0, 0, 0, 0, 0, 0], pool: [], marks: {} },
});

export const playGolden = (golden: GundabadGolden, ctx: ReduceContext): GundabadGame => game.playGolden(golden, ctx);
