import { emptyLog, type CampaignLog } from "../../../src/campaign/log.ts";
import type { Difficulty } from "../../../src/catalog/scenario-data.ts";
import type { CampaignFacts, ModeCard } from "../../../src/rules/core/campaign-state.ts";
import { legalIntents, type PlayerIntent, type ReduceContext, type ScenarioState } from "../../../src/rules/engine/reduce.ts";

import { loadCampaign, loadScenario } from "../../../scripts/data/load-scenarios.ts";
import { nextIntent, type PolicyOptions } from "../../harness/auto-player.ts";
import type { LoadoutSeat } from "../../../src/campaign/loadout.ts";
import { campaignGame, fillerLoadout, HERO_STATS, RING_BEARER, type PlayedGame } from "../../harness/game-kit.ts";

const campaign = loadCampaign("the-return-of-the-king");
// The Item boons a pool can hold (Sting, the Mithril shirt, Glamdring, Andúril, the Lórien gifts): the campaign card's Setup sets one aside for each player (146069:A:1; Andúril is not offered).
export const ITEM_BOONS = ["142011", "142012", "142013", "142014", "142015", "142016", "142017", "142018"] as const;
const ungol = loadScenario("the-tower-of-cirith-ungol");

// Test helper. A whole game of The Tower of Cirith Ungol in Campaign Mode played by the auto-player, true solo or two-handed. The heroes are big numbers (or too small to quest, or too brittle to survive an attack) and the decks free
// events, so the outcome depends on the engine, the seed and the encounter deck, not on player card play. TODO: say how the players travel, engage and answer the choices this scenario asks.
export const UNGOL_POLICY: PolicyOptions = { scout: "", prefer: "", protect: "", play: false, act: false };
// "strong": big-number heroes that win; "weak": heroes too small to quest, so the players lose on threat; "brittle": strong questers that die to an attack.
export type UngolDecks = "strong" | "weak" | "brittle";

// The first player holds the Ring-bearer with The One Ring attached (the saga start of scenario 16, mec113.setting-up-the-game): Frodo, beside three stand-in heroes (Setup lays him under Topmost Chamber and gives Last of the Company to one of them); a second seat has three.
export const ungolLoadout = (seatCount: 1 | 2): LoadoutSeat[] => {
  const [, second] = fillerLoadout(2);
  const first = { heroes: [RING_BEARER, "q1", "q2", "q3"], deck: fillerLoadout(1)[0]!.deck };
  return seatCount === 1 ? [first] : [first, second!];
};

// The goldens' world, the plan and start of a game, and the log of a campaign whose earlier parts were won: the seeded game's parts every scenario shares (test/harness/game-kit.ts).
// Frodo, the Ring-bearer, takes the numbers of the deck like the stand-in heroes beside him (his printed numbers could not quest or defend a game of auto-played turns).
export const ungolWorld = async (decks: UngolDecks = "strong") => {
  const world = await game.world(decks);
  world.cards.set(RING_BEARER, { ...world.cards.get(RING_BEARER)!, ...HERO_STATS[decks] });
  return world;
};
export const afterFields = (seatCount: 1 | 2) => game.after(seatCount);
export const ungolPlan = (seatCount: 1 | 2, log: CampaignLog = emptyLog(seatCount), choices?: readonly string[]) => game.plan(seatCount, log, choices);
export const ungolStart = (seatCount: 1 | 2, seed: number, difficulty: Difficulty, facts?: Omit<CampaignFacts, "modeCard">, log: CampaignLog = emptyLog(seatCount), modeCard?: ModeCard, extra: { choices?: readonly string[] } = {}) => game.start(seatCount, seed, difficulty, { facts, log, modeCard, ...extra });

export type UngolPolicy = {
  // The option a Choose window with these answers takes: the first or the last.
  choose: "first" | "last";
};
export const DEFAULT_POLICY: UngolPolicy = { choose: "first" };

// The auto-player's answer (test/harness/auto-player.ts), except: a choice takes the first option, or the last as the policy says. Every intent is one the reducer listed.
// TODO: the scenario's own answers (where the players travel, who defends, which locations they explore) go before the auto-player's.
export function ungolIntent(state: ScenarioState, ctx: ReduceContext, memory: Set<string>, policy: UngolPolicy = DEFAULT_POLICY): PlayerIntent {
  if (state.window?.kind === "choose") return { type: "Choose", optionId: (policy.choose === "last" ? state.window.options.at(-1) : state.window.options[0]) ?? "" };
  return nextIntent(state, ctx, UNGOL_POLICY, memory, legalIntents(state, ctx));
}

export type UngolGame = PlayedGame;

// The goldens (src/campaign/scenarios/the-tower-of-cirith-ungol/golden.test.ts).
// `after`: the log of a campaign whose earlier parts were won. `upgraded`: the Upgraded sides. `mode`: the Hard or Expert Mode card.
export type UngolGolden = { name: string; seatCount: 1 | 2; seed: number; difficulty: Difficulty; decks: UngolDecks; outcome: "won" | "lost"; policy?: Partial<UngolPolicy>; after?: boolean; upgraded?: boolean; mode?: ModeCard; lossReason?: string };

// TODO: the games to pin (at most 3000 intents in all, .claude/rules/code-standards.md, Test cost), a few wins (true solo and two-handed, Normal and Easy, a Mode card, after the earlier parts) and a few losses (each way the scenario can be lost), each on a fixed seed.
export const UNGOL_GOLDENS: readonly UngolGolden[] = [];

const game = campaignGame<UngolDecks, UngolPolicy>({
  campaign,
  scenario: ungol,
  stats: HERO_STATS,
  // TODO: the cards a game loads besides the scenario's piles, its campaign card's and the campaign's game codes.
  codes: [...ungol.cards.map((card) => card.code), RING_BEARER, "144052", "146065", ...ITEM_BOONS],
  loadout: ungolLoadout,
  intent: ungolIntent,
  policy: DEFAULT_POLICY,
  limit: 6000,
  upgraded: [],
  // TODO: the XP each earlier part gained (in campaign order), the cards they put in the pool and the marks on the cards, as a campaign that won them leaves the log.
  earlier: { xp: [0, 0, 0], pool: [], marks: {} },
});

export const playGolden = (golden: UngolGolden, ctx: ReduceContext): UngolGame => game.playGolden(golden, ctx);
