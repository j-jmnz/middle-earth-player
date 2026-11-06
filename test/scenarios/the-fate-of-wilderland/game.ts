import { checklist } from "../../../src/campaign/checklist.ts";
import { NO_COPY_LIMITS } from "../../../src/campaign/wilderland.ts";
import type { LoadoutSeat } from "../../../src/campaign/loadout.ts";
import { applyResolution, emptyLog, type CampaignLog } from "../../../src/campaign/log.ts";
import { campaignScenario, type Difficulty } from "../../../src/catalog/scenario-data.ts";
import { EFFECTS } from "../../../src/effects/index.ts";
import type { PrintedCard } from "../../../src/rules/core/printed.ts";
import type { CampaignFacts, ModeCard } from "../../../src/rules/core/campaign-state.ts";
import { legalIntents, type PlayerIntent, type ReduceContext, type ScenarioState } from "../../../src/rules/engine/reduce.ts";

import type { FramsburgVariant } from "../the-ghost-of-framsburg/game.ts";
import { GUNDABAD_GOLDENS, gundabadWorld, logBeforeGolden as logBeforeGundabad, playGolden as playGundabad } from "../mount-gundabad/game.ts";
import { EARLIER_POOL } from "../the-ghost-of-framsburg/scene.ts";
import { TREASURES } from "../the-withered-heath/scene.ts";
import { campaign, wilderland } from "./scene.ts";
import { loadScenario } from "../../../scripts/data/load-scenarios.ts";
import { nextIntent, type PolicyOptions } from "../../harness/auto-player.ts";
import { campaignGame, fillerLoadout, HERO_STATS, type PlayedGame } from "../../harness/game-kit.ts";

// Test helper. A whole game of The Fate of Wilderland in Campaign Mode played by the auto-player, true solo or two-handed. The heroes are big numbers (or too small to quest, or too brittle to survive an attack) and the decks free
// events, so the outcome depends on the engine, the seed and the encounter deck, not on player card play. TODO: say how the players travel, engage and answer the choices this scenario asks.
export const WILDERLAND_POLICY: PolicyOptions = { scout: "", prefer: "", protect: "", play: false, act: false };
// "strong": big-number heroes that win; "weak": heroes too small to quest, so the players lose on threat; "brittle": strong questers that die to an attack.
export type WilderlandDecks = "strong" | "weak" | "brittle";

export const wilderlandLoadout = fillerLoadout;

// The goldens' world, the plan and start of a game, and the log of a campaign whose earlier parts were won: the seeded game's parts every scenario shares (test/harness/game-kit.ts).
let loaded: ReadonlyMap<string, PrintedCard> | null = null;
const worldCards = (): ReadonlyMap<string, PrintedCard> => {
  if (!loaded) throw new Error("Call wilderlandWorld first");
  return loaded;
};
export const wilderlandWorld = async (decks: WilderlandDecks = "strong") => {
  const made = await game.world(decks);
  loaded = made.cards;
  return made;
};
export const wilderlandPlan = (seatCount: 1 | 2, log: CampaignLog = emptyLog(seatCount), choices?: readonly string[], difficulty?: Difficulty, loadout?: LoadoutSeat[]) => game.plan(seatCount, log, choices, difficulty, loadout);
export const wilderlandStart = (seatCount: 1 | 2, seed: number, difficulty: Difficulty, facts?: Omit<CampaignFacts, "modeCard">, log: CampaignLog = emptyLog(seatCount), modeCard?: ModeCard, choices?: readonly string[], loadout?: LoadoutSeat[]) => game.start(seatCount, seed, difficulty, facts, log, modeCard, choices, loadout);

/**
 * The answers the Campaign Setup asks of the players for `log`: the search for a boon or treasure card (each player may take one, 12195:A:2), then the 3 non-unique enemies Turayn's line removes and the 3 treacheries Beldis's line removes,
 * each the first the search offers that an earlier search did not take. The checklist is asked until it needs nothing more.
 */
export function wilderlandSetupChoices(seatCount: 1 | 2, log: CampaignLog, difficulty: Difficulty = "Normal", loadout: LoadoutSeat[] = fillerLoadout(seatCount)): string[] {
  const answers: string[] = [];
  for (let guard = 0; guard < 40; guard += 1) {
    const plan = checklist({ log, scenario: campaignScenario(wilderland), seats: loadout, effects: EFFECTS, cards: worldCards(), difficulty, choices: answers });
    if (plan.ok) return answers;
    const needs = plan.needs;
    if (!needs) throw new Error(plan.errors.join("; "));
    const offered = needs.options.filter((option) => option !== "skip");
    answers.push(offered.find((option) => !answers.includes(option)) ?? offered[0] ?? "skip");
  }
  throw new Error("The Campaign Setup keeps asking");
}

export type WilderlandPolicy = {
  // The option a Choose window with these answers takes: the first or the last.
  choose: "first" | "last";
};
export const DEFAULT_POLICY: WilderlandPolicy = { choose: "first" };

// The auto-player's answer (test/harness/auto-player.ts), except: a choice takes the first option, or the last as the policy says. Every intent is one the reducer listed.
// TODO: the scenario's own answers (where the players travel, who defends, which locations they explore) go before the auto-player's.
export function wilderlandIntent(state: ScenarioState, ctx: ReduceContext, memory: Set<string>, policy: WilderlandPolicy = DEFAULT_POLICY): PlayerIntent {
  if (state.window?.kind === "choose") return { type: "Choose", optionId: (policy.choose === "last" ? state.window.options.at(-1) : state.window.options[0]) ?? "" };
  return nextIntent(state, ctx, WILDERLAND_POLICY, memory, legalIntents(state, ctx));
}

export type WilderlandGame = PlayedGame;

// The Mount Gundabad goldens that The Fate of Wilderland follows, by the seats and the way the earlier parts were won: each is played from the log the parts before it wrote (test/scenarios/mount-gundabad/game.ts).
const EARLIER_SCENARIOS = ["journey-up-the-anduin", "lost-in-mirkwood", "the-kings-quest", "the-withered-heath", "roam-across-rhovanion", "fire-in-the-night", "the-ghost-of-framsburg", "mount-gundabad"];
const EARLIER: Readonly<Record<string, string>> = {
  "1:pool": "true solo, won, after the earlier parts, no stage bypassed",
  "1:beldis": "true solo, won, after the earlier parts, Beldis's line, Dagnir hunted and engaged",
  "1:oathline": "true solo, Easy, won, Melanwar's and Isolde's lines, a stage bypassed",
  "2:pool": "two-handed, won, after the earlier parts, Misplaced Trust, no stage bypassed",
  "2:cunning": "two-handed, won, after the earlier parts, Urdug's Cunning, Dragon-sickness in the encounter deck",
  "2:oath": "two-handed, Easy, won, the oath and guidance lines, a stage bypassed",
};
const earlierLogs = new Map<string, CampaignLog>();
const rawLogs = new Map<string, CampaignLog>();
const keyOf = (seatCount: 1 | 2, variant: FramsburgVariant = "pool") => `${seatCount}:${variant}`;

/** Plays the Mount Gundabad goldens that follow the first seven parts and writes their Resolutions onto the log those parts wrote, once for each (seats, variant): what The Fate of Wilderland is handed. */
export async function prepareEarlier(): Promise<void> {
  const gundabad = await gundabadWorld("strong");
  for (const [key, name] of Object.entries(EARLIER)) {
    if (rawLogs.has(key)) continue;
    const golden = GUNDABAD_GOLDENS.find((item) => item.name === name);
    if (!golden) throw new Error(`No Mount Gundabad golden named ${name}`);
    const played = playGundabad(golden, gundabad.ctx).state;
    const written = applyResolution(logBeforeGundabad(golden), played.scenarioId, played, gundabad.cards, NO_COPY_LIMITS);
    rawLogs.set(key, written);
    // The stand-in heroes of the golden seats are not the heroes the earlier games lost or carried: they start fresh, and what hangs on a hero stays behind.
    const blank = emptyLog(golden.seatCount);
    earlierLogs.set(key, { ...written, heroesBySeat: blank.heroesBySeat, fallenHeroesBySeat: blank.fallenHeroesBySeat, campaignPool: written.campaignPool.filter((card) => card.attachedTo == null) });
  }
}

/** The log of a campaign that won the first eight parts, their real Resolutions chained: the fresh heroes' log the next game starts from. */
export function afterGundabad(seatCount: 1 | 2, variant: FramsburgVariant = "pool"): CampaignLog {
  const log = earlierLogs.get(keyOf(seatCount, variant));
  if (!log) throw new Error("Call prepareEarlier first: it plays the earlier parts");
  return log;
}

/** The log the eight earlier parts' real Resolutions write, with the heroes of their games still on it (what the campaign test reads). */
export function rawEarlier(seatCount: 1 | 2, variant: FramsburgVariant = "pool"): CampaignLog {
  const log = rawLogs.get(keyOf(seatCount, variant));
  if (!log) throw new Error("Call prepareEarlier first: it plays the earlier parts");
  return log;
}

// The goldens (src/campaign/scenarios/the-fate-of-wilderland/golden.test.ts), also played by the causes and replay tests once test/harness/golden-registry.ts lists them.
// `after`: the log of a campaign whose earlier parts were won. `upgraded`: the Upgraded sides. `mode`: the Hard or Expert Mode card.
export type WilderlandGolden = { name: string; seatCount: 1 | 2; seed: number; difficulty: Difficulty; decks: WilderlandDecks; outcome: "won" | "lost"; policy?: Partial<WilderlandPolicy>; after?: boolean; upgraded?: boolean; mode?: ModeCard; lossReason?: string };

// TODO: the games to pin, a few wins (true solo and two-handed, Normal and Easy, a Mode card, after the earlier parts) and a few losses (each way the scenario can be lost), each on a fixed seed.
export const WILDERLAND_GOLDENS: readonly WilderlandGolden[] = [];

const game = campaignGame<WilderlandDecks, WilderlandPolicy>({
  campaign,
  scenario: wilderland,
  stats: HERO_STATS,
  // The scenario's cards, and what the earlier parts leave in the pool (the boon allies, the burdens, the Accolade and Song boons, Misplaced Trust and Urdug's Cunning, Gundabad Hunter and Gundabad Stalker, Dragon-sickness) and the treasures a
  // deck may hold or a Resolution may offer.
  codes: [...wilderland.cards.map((card) => card.code), ...EARLIER_POOL, "12191", "12192", "12194", "18052", "18070", ...TREASURES, ...EARLIER_SCENARIOS.flatMap((id) => [...loadScenario(id).cards.map((card) => card.code), ...loadScenario(id).campaignPlaced])],
  intent: wilderlandIntent,
  policy: DEFAULT_POLICY,
  limit: 6000,
  upgraded: [],
  // TODO: the XP each earlier part gained (in campaign order), the cards they put in the pool and the marks on the cards, as a campaign that won them leaves the log.
  earlier: { xp: [0, 0, 0, 0, 0, 0, 0, 0], pool: [], marks: {} },
});

export const playGolden = (golden: WilderlandGolden, ctx: ReduceContext): WilderlandGame => game.playGolden(golden, ctx);
