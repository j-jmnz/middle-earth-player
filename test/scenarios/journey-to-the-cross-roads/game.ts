import { emptyLog, type CampaignLog } from "../../../src/campaign/log.ts";
import type { Difficulty } from "../../../src/catalog/scenario-data.ts";
import type { CampaignFacts, ModeCard } from "../../../src/rules/core/campaign-state.ts";
import type { LoadoutSeat } from "../../../src/campaign/loadout.ts";
import { legalIntents, type PlayerIntent, type ReduceContext, type ScenarioState } from "../../../src/rules/engine/reduce.ts";

import { loadCampaign, loadScenario } from "../../../scripts/data/load-scenarios.ts";
import { nextIntent, type PolicyOptions } from "../../harness/auto-player.ts";
import { campaignGame, fillerLoadout, HERO_STATS, RING_BEARER, type PlayedGame } from "../../harness/game-kit.ts";

const campaign = loadCampaign("the-two-towers");
const roads = loadScenario("journey-to-the-cross-roads");

// Test helper. A whole game of Journey to the Cross-roads in Campaign Mode played by the auto-player, true solo or two-handed. The heroes are big numbers (or too small to quest, or too brittle to survive an attack) and the decks free
// events, so the outcome depends on the engine, the seed and the encounter deck, not on player card play. TODO: say how the players travel, engage and answer the choices this scenario asks.
export const ROADS_POLICY: PolicyOptions = { scout: "", prefer: "", protect: "", play: false, act: false };
// "strong": big-number heroes that win; "weak": heroes too small to quest, so the players lose on threat; "brittle": strong questers that die to an attack.
export type RoadsDecks = "strong" | "weak" | "brittle";

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
  world.cards.set(RING_BEARER, { ...world.cards.get(RING_BEARER)!, ...HERO_STATS[decks] });
  return world;
};
export const afterMarshes = (seatCount: 1 | 2) => game.after(seatCount);
// 144069's Campaign Setup asks each player for a copy of Brace of Coneys or a resource on each hero: the goldens' players take the resources.
export const ROADS_CHOICES: readonly string[] = ["resources", "resources"];
export const roadsPlan = (seatCount: 1 | 2, log: CampaignLog = emptyLog(seatCount), choices: readonly string[] = ROADS_CHOICES) => game.plan(seatCount, log, choices);
export const roadsStart = (seatCount: 1 | 2, seed: number, difficulty: Difficulty, facts?: Omit<CampaignFacts, "modeCard">, log: CampaignLog = emptyLog(seatCount), modeCard?: ModeCard, choices: readonly string[] = ROADS_CHOICES) => game.start(seatCount, seed, difficulty, { facts, log, modeCard, choices });

export type RoadsPolicy = {
  // The option a Choose window with these answers takes: the first or the last.
  choose: "first" | "last";
};
export const DEFAULT_POLICY: RoadsPolicy = { choose: "first" };

// The auto-player's answer (test/harness/auto-player.ts), except: a choice takes the first option, or the last as the policy says. Every intent is one the reducer listed.
// TODO: the scenario's own answers (where the players travel, who defends, which locations they explore) go before the auto-player's.
export function roadsIntent(state: ScenarioState, ctx: ReduceContext, memory: Set<string>, policy: RoadsPolicy = DEFAULT_POLICY): PlayerIntent {
  if (state.window?.kind === "choose") return { type: "Choose", optionId: (policy.choose === "last" ? state.window.options.at(-1) : state.window.options[0]) ?? "" };
  return nextIntent(state, ctx, ROADS_POLICY, memory, legalIntents(state, ctx));
}

export type RoadsGame = PlayedGame;

// The goldens (src/campaign/scenarios/journey-to-the-cross-roads/golden.test.ts), also played by the causes and replay tests once test/harness/golden-registry.ts lists them.
// `after`: the log of a campaign whose earlier parts were won. `upgraded`: the Upgraded sides. `mode`: the Hard or Expert Mode card.
export type RoadsGolden = { name: string; seatCount: 1 | 2; seed: number; difficulty: Difficulty; decks: RoadsDecks; outcome: "won" | "lost"; policy?: Partial<RoadsPolicy>; after?: boolean; upgraded?: boolean; mode?: ModeCard; lossReason?: string };

// TODO: the games to pin, a few wins (true solo and two-handed, Normal and Easy, a Mode card, after the earlier parts) and a few losses (each way the scenario can be lost), each on a fixed seed.
export const ROADS_GOLDENS: readonly RoadsGolden[] = [];

const game = campaignGame<RoadsDecks, RoadsPolicy>({
  campaign,
  scenario: roads,
  stats: HERO_STATS,
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

export const playGolden = (golden: RoadsGolden, ctx: ReduceContext): RoadsGame => game.playGolden(golden, ctx);
