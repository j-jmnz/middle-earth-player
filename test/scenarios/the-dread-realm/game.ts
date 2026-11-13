import { emptyLog, type CampaignLog } from "../../../src/campaign/log.ts";
import type { Difficulty } from "../../../src/catalog/scenario-data.ts";
import type { CampaignFacts, ModeCard } from "../../../src/rules/core/campaign-state.ts";
import { legalTargets, type PlayerIntent, type ReduceContext, type ScenarioState } from "../../../src/rules/engine/reduce.ts";

import { loadCampaign, loadScenario } from "../../../scripts/data/load-scenarios.ts";
import { angmarIntent, type AngmarPolicy, type AngmarScenario } from "../../harness/angmar-policy.ts";
import { type PolicyOptions } from "../../harness/auto-player.ts";
import { campaignGame, fillerLoadout, HERO_STATS, type PlayedGame, type StartOptions } from "../../harness/game-kit.ts";

const campaign = loadCampaign("angmar-awakened");
const realm = loadScenario("the-dread-realm");

// Test helper. A whole game of The Dread Realm in Campaign Mode played by the auto-player, true solo or two-handed. The heroes are big numbers (or too small to quest, or too brittle to survive an attack) and the decks free events, so the outcome depends on the engine, the seed and
// the encounter deck, not on player card play. Everyone quests with all they have (stage 1B needs 18 progress, then nothing quests Daechanar away: stage 2B has no quest points and advances only when he is destroyed), nobody engages and the heroes defend nothing (an attack falls on the hero
// with the least damage); every attack goes to Daechanar first, then to the Reanimated Dead and the other enemies in the order listed. The players travel to the first location the engine lists, a choice takes the first option (or the last, as the policy says). The shared Angmar policy
// (test/harness/angmar-policy.ts) does the rest.
export const REALM_POLICY: PolicyOptions = { scout: "", prefer: "", protect: "", play: false, act: false };
// "strong": big-number heroes that win; "weak": heroes too small to quest, so the players lose on threat; "brittle": strong questers that die to an attack.
export type RealmDecks = "strong" | "weak" | "brittle";

export const realmLoadout = fillerLoadout;

// The goldens' world, the plan and start of a game, and the log of a campaign whose earlier parts were won: the seeded game's parts every scenario shares (test/harness/game-kit.ts).
export const realmWorld = (decks: RealmDecks = "strong") => game.world(decks);
export const afterDum = (seatCount: 1 | 2) => game.after(seatCount);
// The campaign card's Setup (10193:A:2) through the Campaign Setup Checklist: each player in turn may take a boon from their deck or the pool into their opening hand; the goldens skip it.
export const boonChoices = (seatCount: 1 | 2): string[] => ["skip", "skip"].slice(0, seatCount);
export const realmPlan = (seatCount: 1 | 2, log: CampaignLog = emptyLog(seatCount), choices: readonly string[] = boonChoices(seatCount)) => game.plan(seatCount, log, choices);
export const realmStart = (seatCount: 1 | 2, seed: number, difficulty: Difficulty, facts?: Omit<CampaignFacts, "modeCard">, log: CampaignLog = emptyLog(seatCount), modeCard?: ModeCard, extra: Pick<StartOptions, "choices" | "standalone" | "loadout"> = {}) => game.start(seatCount, seed, difficulty, { facts, log, modeCard, choices: boonChoices(seatCount), ...extra });

export type RealmPolicy = AngmarPolicy;
export const DEFAULT_POLICY: RealmPolicy = { choose: "first", engage: true, defend: "none", quest: "most" };

// Daechanar is attacked first, the other enemies in the order they are listed.
const REALM: AngmarScenario = { safe: [], rank: (state, enemyId) => (state.cards[enemyId]?.code === "10153" ? 0 : 1) };

// The shared Angmar policy with Daechanar attacked first, and an attack nobody defends falling on the hero with the least damage.
export function realmIntent(state: ScenarioState, ctx: ReduceContext, memory: Set<string>, policy: RealmPolicy = DEFAULT_POLICY, options: PolicyOptions = REALM_POLICY): PlayerIntent {
  // Stage 3 asks how much of the progress goes on the location chosen: all it can take (the last amount offered).
  if (state.window?.kind === "choose" && /^\d+$/.test(state.window.options[0] ?? "")) return { type: "Choose", optionId: state.window.options.at(-1) ?? "" };
  if (state.window?.kind === "defense" && policy.defend === "none") {
    const heroes = legalTargets(state, { type: "Undefended" }, ctx).filter((id) => state.cards[id]?.zone === "heroes");
    const least = [...heroes].sort((left, right) => (state.cards[left]?.damage ?? 0) - (state.cards[right]?.damage ?? 0))[0];
    if (least) return { type: "Undefended", heroId: least };
  }
  return angmarIntent(state, ctx, memory, policy, options, REALM);
}

export type RealmGame = PlayedGame;

// The goldens (src/campaign/scenarios/the-dread-realm/golden.test.ts).
// `after`: the log of a campaign whose earlier parts were won. `upgraded`: the Upgraded sides. `mode`: the Hard or Expert Mode card.
export type RealmGolden = { name: string; seatCount: 1 | 2; seed: number; difficulty: Difficulty; decks: RealmDecks; outcome: "won" | "lost"; policy?: Partial<RealmPolicy>; after?: boolean; upgraded?: boolean; mode?: ModeCard; lossReason?: string };

// Every game is played after The Battle of Carn Dûm's win (`after`), so the campaign card is in play and the pool holds what the earlier parts left (Arnor Ravaged staged, Mysterious Omens, Fend Off Despair and the Losing Time copies in the encounter deck, Thaurdir's burden removed from this game only).
// Wins: true solo and two-handed, each ending on stage 3 with no location left in play at the end of the quest phase (10152:B:3): one hero stays out of the quest and attacks, Daechanar is destroyed on stage 2B once the Sorcery cards that cancel his damage are removed from the game
// (10153:A:3), and stage 3's progress is divided among the locations of the staging area (10152:B:2; the two-handed game divides it more). The ways to lose: the players' threat at 50 (heroes too small to quest) and every hero destroyed (heroes too brittle to survive a Reanimated Dead's attacks).
export const REALM_GOLDENS: readonly RealmGolden[] = [
  { name: "true solo, won, no location left in play at the end of the quest phase", seatCount: 1, seed: 2, difficulty: "Normal", decks: "strong", outcome: "won", after: true },
  { name: "two-handed, won, no location left in play at the end of the quest phase", seatCount: 2, seed: 2, difficulty: "Normal", decks: "strong", outcome: "won", after: true },
  { name: "true solo, lost, threat reaches 50", seatCount: 1, seed: 1, difficulty: "Normal", decks: "weak", outcome: "lost", after: true, lossReason: "No seats remain" },
  { name: "true solo, lost, every hero destroyed", seatCount: 1, seed: 1, difficulty: "Normal", decks: "brittle", outcome: "lost", after: true, lossReason: "No seats remain" },
];

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
