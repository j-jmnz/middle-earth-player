import { emptyLog, type CampaignLog } from "../../../src/campaign/log.ts";
import type { Difficulty } from "../../../src/catalog/scenario-data.ts";
import type { CampaignFacts, ModeCard } from "../../../src/rules/core/campaign-state.ts";
import { legalTargets, type PlayerIntent, type ReduceContext, type ScenarioState } from "../../../src/rules/engine/reduce.ts";

import { loadCampaign, loadScenario } from "../../../scripts/data/load-scenarios.ts";
import { angmarIntent, type AngmarPolicy, type AngmarScenario } from "../../harness/angmar-policy.ts";
import { type PolicyOptions } from "../../harness/auto-player.ts";
import { campaignGame, fillerLoadout, HERO_STATS, type PlayedGame } from "../../harness/game-kit.ts";

const campaign = loadCampaign("angmar-awakened");
const dum = loadScenario("the-battle-of-carn-dum");

// Test helper. A whole game of The Battle of Carn Dûm in Campaign Mode played by the auto-player, true solo or two-handed. The heroes are big numbers (or too small to quest, or too brittle to survive an attack) and the decks free events, so the outcome depends on the engine, the seed and
// the encounter deck, not on player card play. One hero quests (the main quest card counts Attack in place of Willpower while Accursed Battlefield is the active location), nobody engages (Thaurdir cannot be engaged and the Garrison's engagement cost is 30 or 50), the heroes defend nothing (an attack
// falls on the hero with the least damage) and attack Thaurdir first: on stage 2B he is considered engaged with each player and is destroyed by damage once 15 progress is on the stage (10126:B:2, 10126:B:3). The players travel to the first location the engine lists, a choice takes the first option
// (or the last, as the policy says). The shared Angmar policy (test/harness/angmar-policy.ts) does the rest.
export const DUM_POLICY: PolicyOptions = { scout: "", prefer: "", protect: "", play: false, act: false };
// "strong": big-number heroes that win; "weak": heroes too small to quest, so the players lose on threat; "brittle": strong questers that die to an attack.
export type DumDecks = "strong" | "weak" | "brittle";

export const dumLoadout = fillerLoadout;

// The goldens' world, the plan and start of a game, and the log of a campaign whose earlier parts were won: the seeded game's parts every scenario shares (test/harness/game-kit.ts).
export const dumWorld = (decks: DumDecks = "strong") => game.world(decks);
export const afterRhudaur = (seatCount: 1 | 2) => game.after(seatCount);
// The campaign card's Setup (10188:A:2) through the Campaign Setup Checklist: each seat in turn takes one of the four boons into its opening hand (skipping is allowed); seat 1 takes Elrond's Champion, seat 2 Lore of Ancient Arnor.
export const boonChoices = (seatCount: 1 | 2): string[] => ["10189", "10190"].slice(0, seatCount);
export const dumPlan = (seatCount: 1 | 2, log: CampaignLog = emptyLog(seatCount), choices: readonly string[] = boonChoices(seatCount)) => game.plan(seatCount, log, choices);
export const dumStart = (seatCount: 1 | 2, seed: number, difficulty: Difficulty, facts?: Omit<CampaignFacts, "modeCard">, log: CampaignLog = emptyLog(seatCount), modeCard?: ModeCard, extra: { choices?: readonly string[]; standalone?: boolean } = {}) => game.start(seatCount, seed, difficulty, { facts, log, modeCard, choices: boonChoices(seatCount), ...extra });

export type DumPolicy = AngmarPolicy;
export const DEFAULT_POLICY: DumPolicy = { choose: "first", engage: false, defend: "none", quest: "one" };

// Thaurdir is attacked first (either side), the other enemies in the order they are listed.
const DUM: AngmarScenario = { safe: [], rank: (state, enemyId) => (["10127", "10128"].includes(state.cards[enemyId]?.code ?? "") ? 0 : 1) };

// The shared Angmar policy with Thaurdir attacked first, and an attack nobody defends falling on the hero with the least damage.
export function dumIntent(state: ScenarioState, ctx: ReduceContext, memory: Set<string>, policy: DumPolicy = DEFAULT_POLICY, options: PolicyOptions = DUM_POLICY): PlayerIntent {
  if (state.window?.kind === "defense" && policy.defend === "none") {
    const heroes = legalTargets(state, { type: "Undefended" }, ctx).filter((id) => state.cards[id]?.zone === "heroes");
    const least = [...heroes].sort((left, right) => (state.cards[left]?.damage ?? 0) - (state.cards[right]?.damage ?? 0))[0];
    if (least) return { type: "Undefended", heroId: least };
  }
  return angmarIntent(state, ctx, memory, policy, options, DUM);
}

export type DumGame = PlayedGame;

// The goldens (src/campaign/scenarios/the-battle-of-carn-dum/golden.test.ts).
// `after`: the log of a campaign whose earlier parts were won. `upgraded`: the Upgraded sides. `mode`: the Hard or Expert Mode card.
export type DumGolden = { name: string; seatCount: 1 | 2; seed: number; difficulty: Difficulty; decks: DumDecks; outcome: "won" | "lost"; policy?: Partial<DumPolicy>; after?: boolean; upgraded?: boolean; mode?: ModeCard; lossReason?: string };

// Every game is played after The Treachery of Rhudaur's win (`after`), so the campaign card is in play (the four boons offered, the first seat taking Elrond's Champion and the second Lore of Ancient Arnor into its opening hand, Amarthiúl allowed as a hero) and the pool holds what the earlier parts left
// (Arnor Ravaged staged, Mysterious Omens, Fend Off Despair and the Losing Time copies in the encounter deck, Thaurdir's burden attached to him). One hero quests and the others attack Thaurdir (nobody engages: he cannot be engaged, and the Garrison costs 30 or 50 to engage), every attack falls on a hero
// undefended. Wins: true solo, and two-handed (a second Garrison copy, and Thaurdir attacking each player on stage 2B); both end with Thaurdir destroyed on stage 2B once 15 progress took his Indestructible away. The ways to lose: the players' threat at 50 (heroes too small to quest) and every hero destroyed
// (heroes too brittle to survive Thaurdir's attacks). The first Resolution note (the damage on each hero) and a Determination mark are the Resolution's; the campaign test reads the rest.
export const DUM_GOLDENS: readonly DumGolden[] = [
  { name: "true solo, won, Thaurdir destroyed on stage 2B", seatCount: 1, seed: 1, difficulty: "Normal", decks: "strong", outcome: "won", after: true },
  { name: "two-handed, won, Thaurdir destroyed on stage 2B", seatCount: 2, seed: 1, difficulty: "Normal", decks: "strong", outcome: "won", after: true },
  { name: "true solo, lost, threat reaches 50", seatCount: 1, seed: 1, difficulty: "Normal", decks: "weak", outcome: "lost", after: true, lossReason: "No seats remain" },
  { name: "true solo, lost, every hero destroyed", seatCount: 1, seed: 1, difficulty: "Normal", decks: "brittle", outcome: "lost", after: true, lossReason: "No seats remain" },
];

const game = campaignGame<DumDecks, DumPolicy>({
  campaign,
  scenario: dum,
  stats: HERO_STATS,
  // The scenario's cards; the campaign card's, the cards it places (the four boons, Determination, Fend Off Despair, the Loot and Clue boons) and the campaign's game codes are added by the kit. The pool holds what The Treachery of Rhudaur leaves: Mysterious Omens, Arnor Ravaged, Amarthiúl's Courage, a Thaurdir burden, Fend Off Despair and Losing Time.
  codes: [...dum.cards.flatMap((card) => (card.back != null ? [card.code, card.back] : [card.code])), "10160", "100158", "10157", "10167", "10168", "10169", "10170", "10172", "10173", "10183", "10185", "10186", "10187"],
  intent: dumIntent,
  policy: DEFAULT_POLICY,
  limit: 6000,
  upgraded: [],
  // The seven earlier parts were won: no XP in this campaign; in the pool Mysterious Omens, Arnor Ravaged, Amarthiúl's Courage, Thaurdir's Legacy, Fend off Despair and Losing Time.
  earlier: { xp: [0, 0, 0, 0, 0, 0, 0], pool: [{ code: "10160" }, { code: "100158" }, { code: "10167" }, { code: "10168" }, { code: "10173" }, { code: "10183" }], marks: {} },
});

export const playGolden = (golden: DumGolden, ctx: ReduceContext): DumGame => game.playGolden(golden, ctx, boonChoices(golden.seatCount));
