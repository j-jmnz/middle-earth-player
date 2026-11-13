import { emptyLog, type CampaignLog } from "../../../src/campaign/log.ts";
import type { Difficulty } from "../../../src/catalog/scenario-data.ts";
import type { CampaignFacts, ModeCard } from "../../../src/rules/core/campaign-state.ts";
import { type PlayerIntent, type ReduceContext, type ScenarioState } from "../../../src/rules/engine/reduce.ts";

import { loadCampaign, loadScenario } from "../../../scripts/data/load-scenarios.ts";
import { angmarIntent, type AngmarPolicy } from "../../harness/angmar-policy.ts";
import { type PolicyOptions } from "../../harness/auto-player.ts";
import { campaignGame, fillerLoadout, HERO_STATS, type PlayedGame } from "../../harness/game-kit.ts";

const campaign = loadCampaign("angmar-awakened");
const ettenmoors = loadScenario("across-the-ettenmoors");

// Test helper. A whole game of Across the Ettenmoors in Campaign Mode played by the auto-player, true solo or two-handed. The heroes are big numbers (or too small to quest, or too brittle to survive an attack) and the decks free
// events, so the outcome depends on the engine, the seed and the encounter deck, not on player card play. Every hero quests (Amarthiúl stays out: his destruction loses the game), nobody engages or defends (an attack falls on the hero with the least damage), the players travel to the
// first location the engine lists, and a choice takes the first option. The shared Angmar policy (test/harness/angmar-policy.ts) does the rest.
export const ETTENMOORS_POLICY: PolicyOptions = { scout: "", prefer: "", protect: "", play: false, act: false };
// "strong": big-number heroes that win; "weak": heroes too small to quest, so the players lose on threat; "brittle": strong questers that die to an attack.
export type EttenmoorsDecks = "strong" | "weak" | "brittle" | "steady";

export const ettenmoorsLoadout = fillerLoadout;

// The goldens' world, the plan and start of a game, and the log of a campaign whose earlier parts were won: the seeded game's parts every scenario shares (test/harness/game-kit.ts).
export const ettenmoorsWorld = (decks: EttenmoorsDecks = "strong") => game.world(decks);
export const afterGram = (seatCount: 1 | 2) => game.after(seatCount);
export const ettenmoorsPlan = (seatCount: 1 | 2, log: CampaignLog = emptyLog(seatCount)) => game.plan(seatCount, log);
export const ettenmoorsStart = (seatCount: 1 | 2, seed: number, difficulty: Difficulty, facts?: Omit<CampaignFacts, "modeCard">, log: CampaignLog = emptyLog(seatCount), modeCard?: ModeCard, extra: { choices?: readonly string[]; standalone?: boolean } = {}) => game.start(seatCount, seed, difficulty, { facts, log, modeCard, ...extra });

export type EttenmoorsPolicy = AngmarPolicy;
export const DEFAULT_POLICY: EttenmoorsPolicy = { choose: "first", engage: false, defend: "none", quest: "all" };

// The auto-player's answer (test/harness/auto-player.ts), except: a choice is answered as the policy says; the rest is the shared Angmar policy's. Every intent is one the reducer listed.
export function ettenmoorsIntent(state: ScenarioState, ctx: ReduceContext, memory: Set<string>, policy: EttenmoorsPolicy = DEFAULT_POLICY, options: PolicyOptions = ETTENMOORS_POLICY): PlayerIntent {
  return angmarIntent(state, ctx, memory, policy, options, { safe: [], rank: () => 1 });
}

export type EttenmoorsGame = PlayedGame;

// The goldens (src/campaign/scenarios/across-the-ettenmoors/golden.test.ts).
// `after`: the log of a campaign whose earlier parts were won. `upgraded`: the Upgraded sides. `mode`: the Hard or Expert Mode card.
export type EttenmoorsGolden = { name: string; seatCount: 1 | 2; seed: number; difficulty: Difficulty; decks: EttenmoorsDecks; outcome: "won" | "lost"; policy?: Partial<EttenmoorsPolicy>; after?: boolean; upgraded?: boolean; mode?: ModeCard; lossReason?: string };

// Every game is played after Escape from Mount Gram's win (`after`), so the campaign card is in play: its five Losing Time are set aside and one is revealed every third quest phase. The wins are the "steady" heroes (a Willpower of 6, so the quest takes several rounds and the
// players meet the encounter deck: a safe location they travel to, explore for refuge and leave in the victory display), true solo and two-handed; the loss is the heroes too small to quest, whose threat reaches 50. A quick win with the strong heroes would not travel anywhere, so
// it is not pinned. The way to lose that no seed reaches is Amarthiúl's destruction (10067:A:1's lose line, a spec row), and every hero destroyed needs an attack the policy never lets fall (the heroes defend nothing and the enemies stay out of reach of the stand-ins).
export const ETTENMOORS_GOLDENS: readonly EttenmoorsGolden[] = [
  { name: "true solo, won, a safe location in the victory display", seatCount: 1, seed: 3, difficulty: "Normal", decks: "steady", outcome: "won", after: true },
  { name: "two-handed, won, a safe location in the victory display", seatCount: 2, seed: 5, difficulty: "Normal", decks: "steady", outcome: "won", after: true },
  { name: "true solo, lost, threat reaches 50", seatCount: 1, seed: 5, difficulty: "Normal", decks: "weak", outcome: "lost", after: true, lossReason: "No seats remain" },
];

const game = campaignGame<EttenmoorsDecks, EttenmoorsPolicy>({
  campaign,
  scenario: ettenmoors,
  stats: HERO_STATS,
  // The scenario's cards; the campaign card's, the cards it places (Losing Time, the boons, Determination, Fend Off Despair) and the campaign's game codes are added by the kit. The pool holds what Escape from Mount Gram leaves: Mysterious Omens, Arnor Ravaged, Amarthiúl's Courage and a burden.
  codes: [...ettenmoors.cards.map((card) => card.code), "10160", "100158", "10157", "10167", "10168", "10169", "10170", "10172", "10173"],
  intent: ettenmoorsIntent,
  policy: DEFAULT_POLICY,
  limit: 6000,
  upgraded: [],
  // Intruders in Chetwood, The Weather Hills, Deadmen's Dike, The Wastes of Eriador and Escape from Mount Gram were won: no XP in this campaign; in the pool Mysterious Omens, Arnor Ravaged, Amarthiúl's Courage, Thaurdir's Legacy and Fend off Despair.
  earlier: { xp: [0, 0, 0, 0, 0], pool: [{ code: "10160" }, { code: "100158" }, { code: "10167" }, { code: "10168" }, { code: "10173" }], marks: {} },
});

export const playGolden = (golden: EttenmoorsGolden, ctx: ReduceContext): EttenmoorsGame => game.playGolden(golden, ctx);
