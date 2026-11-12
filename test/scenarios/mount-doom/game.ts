import { emptyLog, type CampaignLog } from "../../../src/campaign/log.ts";
import type { Difficulty } from "../../../src/catalog/scenario-data.ts";
import type { CampaignFacts, ModeCard } from "../../../src/rules/core/campaign-state.ts";
import { legalIntents, type PlayerIntent, type ReduceContext, type ScenarioState } from "../../../src/rules/engine/reduce.ts";

import { loadCampaign, loadScenario } from "../../../scripts/data/load-scenarios.ts";
import { nextIntent, type PolicyOptions } from "../../harness/auto-player.ts";
import type { LoadoutSeat } from "../../../src/campaign/loadout.ts";
import { campaignGame, fillerLoadout, HERO_STATS, RING_BEARER, type HeroStats, type PlayedGame } from "../../harness/game-kit.ts";

const campaign = loadCampaign("the-return-of-the-king");
const doom = loadScenario("mount-doom");

// Test helper. A whole game of Mount Doom in Campaign Mode played by the auto-player, true solo or two-handed. The heroes are big numbers (or too small to quest, or too brittle to survive an attack) and the decks free
// events, so the outcome depends on the engine, the seed and the encounter deck, not on player card play. TODO: say how the players travel, engage and answer the choices this scenario asks.
export const DOOM_POLICY: PolicyOptions = { scout: "", prefer: "", protect: "", play: false, act: false };
// "strong": big-number heroes that win; "weak": heroes too small to quest, so the players lose on threat; "brittle": strong questers that die to an attack.
export type DoomDecks = "strong" | "weak" | "brittle";

// The strong stand-ins start at a threat of 20 each and Frodo, the Ring-bearer, takes the numbers of the deck like them (his printed numbers could not quest or defend a game of auto-played turns).
const DOOM_STATS = { strong: { ...HERO_STATS.strong, threat: 20, attack: 30, defense: 20 }, weak: HERO_STATS.weak, brittle: { ...HERO_STATS.brittle, threat: 8 } } as const satisfies Record<DoomDecks, HeroStats>;

// The first player holds the Ring-bearer with The One Ring attached (the saga start of scenario 18, mec113.setting-up-the-game), beside three stand-in heroes; a second seat has three.
export const doomLoadout = (seatCount: 1 | 2): LoadoutSeat[] => {
  const [, second] = fillerLoadout(2);
  const first = { heroes: [RING_BEARER, "q1", "q2", "q3"], deck: fillerLoadout(1)[0]!.deck };
  return seatCount === 1 ? [first] : [first, second!];
};

// The goldens' world, the plan and start of a game, and the log of a campaign whose earlier parts were won: the seeded game's parts every scenario shares (test/harness/game-kit.ts).
export const doomWorld = async (decks: DoomDecks = "strong") => {
  const world = await game.world(decks);
  world.cards.set(RING_BEARER, { ...world.cards.get(RING_BEARER)!, ...DOOM_STATS[decks], threat: 0 });
  return world;
};
export const afterOpens = (seatCount: 1 | 2) => game.after(seatCount);
export const doomPlan = (seatCount: 1 | 2, log: CampaignLog = emptyLog(seatCount)) => game.plan(seatCount, log);
export const doomStart = (seatCount: 1 | 2, seed: number, difficulty: Difficulty, facts?: Omit<CampaignFacts, "modeCard">, log: CampaignLog = emptyLog(seatCount), modeCard?: ModeCard) => game.start(seatCount, seed, difficulty, { facts, log, modeCard });

export type DoomPolicy = {
  // The option a Choose window with these answers takes: the first or the last.
  choose: "first" | "last";
};
export const DEFAULT_POLICY: DoomPolicy = { choose: "first" };

// The auto-player's answer (test/harness/auto-player.ts), except: a choice takes the first option, or the last as the policy says. Every intent is one the reducer listed.
// TODO: the scenario's own answers (where the players travel, who defends, which locations they explore) go before the auto-player's.
export function doomIntent(state: ScenarioState, ctx: ReduceContext, memory: Set<string>, policy: DoomPolicy = DEFAULT_POLICY): PlayerIntent {
  if (state.window?.kind === "choose") return { type: "Choose", optionId: (policy.choose === "last" ? state.window.options.at(-1) : state.window.options[0]) ?? "" };
  return nextIntent(state, ctx, DOOM_POLICY, memory, legalIntents(state, ctx));
}

export type DoomGame = PlayedGame;

// The goldens (src/campaign/scenarios/mount-doom/golden.test.ts).
// `after`: the log of a campaign whose earlier parts were won. `upgraded`: the Upgraded sides. `mode`: the Hard or Expert Mode card.
export type DoomGolden = { name: string; seatCount: 1 | 2; seed: number; difficulty: Difficulty; decks: DoomDecks; outcome: "won" | "lost"; policy?: Partial<DoomPolicy>; after?: boolean; upgraded?: boolean; mode?: ModeCard; lossReason?: string };

// TODO: the games to pin (at most 3000 intents in all, .claude/rules/code-standards.md, Test cost), a few wins (true solo and two-handed, Normal and Easy, a Mode card, after the earlier parts) and a few losses (each way the scenario can be lost), each on a fixed seed.
export const DOOM_GOLDENS: readonly DoomGolden[] = [];

const game = campaignGame<DoomDecks, DoomPolicy>({
  campaign,
  scenario: doom,
  stats: DOOM_STATS,
  loadout: doomLoadout,
  // TODO: the cards a game loads besides the scenario's piles, its campaign card's and the campaign's game codes.
  codes: [...doom.cards.map((card) => card.code), RING_BEARER, "146065", "145014", "145015", "145016", "145062", "143020", "143021"],
  intent: doomIntent,
  policy: DEFAULT_POLICY,
  limit: 6000,
  upgraded: [],
  // TODO: the XP each earlier part gained (in campaign order), the cards they put in the pool and the marks on the cards, as a campaign that won them leaves the log.
  earlier: { xp: [0, 0, 0, 0, 0], pool: [], marks: {} },
});

export const playGolden = (golden: DoomGolden, ctx: ReduceContext): DoomGame => game.playGolden(golden, ctx);
