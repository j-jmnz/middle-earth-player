import { emptyLog, type CampaignLog } from "../../../src/campaign/log.ts";
import type { Difficulty } from "../../../src/catalog/scenario-data.ts";
import type { CampaignFacts, ModeCard } from "../../../src/rules/core/campaign-state.ts";
import { legalIntents, type PlayerIntent, type ReduceContext, type ScenarioState } from "../../../src/rules/engine/reduce.ts";

import { loadCampaign, loadScenario } from "../../../scripts/data/load-scenarios.ts";
import { nextIntent, type PolicyOptions } from "../../harness/auto-player.ts";
import { campaignGame, fillerLoadout, HERO_STATS, type PlayedGame, type StartOptions } from "../../harness/game-kit.ts";

const campaign = loadCampaign("angmar-awakened");
const realm = loadScenario("the-dread-realm");

// Test helper. A whole game of The Dread Realm in Campaign Mode played by the auto-player, true solo or two-handed. The heroes are big numbers (or too small to quest, or too brittle to survive an attack) and the decks free
// events, so the outcome depends on the engine, the seed and the encounter deck, not on player card play. TODO: say how the players travel, engage and answer the choices this scenario asks.
export const REALM_POLICY: PolicyOptions = { scout: "", prefer: "", protect: "", play: false, act: false };
// "strong": big-number heroes that win; "weak": heroes too small to quest, so the players lose on threat; "brittle": strong questers that die to an attack.
export type RealmDecks = "strong" | "weak" | "brittle";

export const realmLoadout = fillerLoadout;

// The goldens' world, the plan and start of a game, and the log of a campaign whose earlier parts were won: the seeded game's parts every scenario shares (test/harness/game-kit.ts).
export const realmWorld = (decks: RealmDecks = "strong") => game.world(decks);
export const afterDum = (seatCount: 1 | 2) => game.after(seatCount);
// The campaign card's Setup (10193:A:2) through the Campaign Setup Checklist: each player in turn may take a boon from their deck or the pool into their opening hand; the games skip it unless they name a card.
export const boonChoices = (seatCount: 1 | 2): string[] => ["skip", "skip"].slice(0, seatCount);
export const realmPlan = (seatCount: 1 | 2, log: CampaignLog = emptyLog(seatCount), choices: readonly string[] = boonChoices(seatCount)) => game.plan(seatCount, log, choices);
export const realmStart = (seatCount: 1 | 2, seed: number, difficulty: Difficulty, facts?: Omit<CampaignFacts, "modeCard">, log: CampaignLog = emptyLog(seatCount), modeCard?: ModeCard, extra: Pick<StartOptions, "choices" | "standalone" | "loadout"> = {}) => game.start(seatCount, seed, difficulty, { facts, log, modeCard, choices: boonChoices(seatCount), ...extra });

export type RealmPolicy = {
  // The option a Choose window with these answers takes: the first or the last.
  choose: "first" | "last";
};
export const DEFAULT_POLICY: RealmPolicy = { choose: "first" };

// The auto-player's answer (test/harness/auto-player.ts), except: a choice takes the first option, or the last as the policy says. Every intent is one the reducer listed.
// TODO: the scenario's own answers (where the players travel, who defends, which locations they explore) go before the auto-player's.
export function realmIntent(state: ScenarioState, ctx: ReduceContext, memory: Set<string>, policy: RealmPolicy = DEFAULT_POLICY): PlayerIntent {
  if (state.window?.kind === "choose") return { type: "Choose", optionId: (policy.choose === "last" ? state.window.options.at(-1) : state.window.options[0]) ?? "" };
  return nextIntent(state, ctx, REALM_POLICY, memory, legalIntents(state, ctx));
}

export type RealmGame = PlayedGame;

// The goldens (src/campaign/scenarios/the-dread-realm/golden.test.ts).
// `after`: the log of a campaign whose earlier parts were won. `upgraded`: the Upgraded sides. `mode`: the Hard or Expert Mode card.
export type RealmGolden = { name: string; seatCount: 1 | 2; seed: number; difficulty: Difficulty; decks: RealmDecks; outcome: "won" | "lost"; policy?: Partial<RealmPolicy>; after?: boolean; upgraded?: boolean; mode?: ModeCard; lossReason?: string };

// TODO: the games to pin (at most 3000 intents in all, .claude/rules/code-standards.md, Test cost), a few wins (true solo and two-handed, Normal and Easy, a Mode card, after the earlier parts) and a few losses (each way the scenario can be lost), each on a fixed seed.
export const REALM_GOLDENS: readonly RealmGolden[] = [];

const game = campaignGame<RealmDecks, RealmPolicy>({
  campaign,
  scenario: realm,
  stats: HERO_STATS,
  // The scenario's cards; the campaign card's, the cards it places (Determination, Fend Off Despair, the Loot and Clue boons, the four Carn Dûm boons) and the campaign's game codes are added by the kit. The pool holds what The Battle of Carn Dûm leaves: Mysterious Omens, Arnor Ravaged, Amarthiúl's Courage, a Thaurdir burden, Fend Off Despair, Losing Time and the boon the first player took.
  codes: [...realm.cards.flatMap((card) => (card.back != null ? [card.code, card.back] : [card.code])), "10160", "100158", "10157", "10167", "10168", "10169", "10170", "10172", "10173", "10183", "10185", "10186", "10187", "10189", "10190", "10191", "10192", "10115"],
  intent: realmIntent,
  policy: DEFAULT_POLICY,
  limit: 6000,
  upgraded: [],
  // The eight earlier parts were won: no XP in this campaign; in the pool Mysterious Omens, Arnor Ravaged, Amarthiúl's Courage, Thaurdir's Legacy, Fend off Despair, Losing Time and Elrond's Champion.
  earlier: { xp: [0, 0, 0, 0, 0, 0, 0, 0], pool: [{ code: "10160" }, { code: "100158" }, { code: "10167" }, { code: "10168" }, { code: "10173" }, { code: "10183" }, { code: "10189", seat: 0 }], marks: {} },
});

export const playGolden = (golden: RealmGolden, ctx: ReduceContext): RealmGame => game.playGolden(golden, ctx, boonChoices(golden.seatCount));
