import { emptyLog, type CampaignLog } from "../../../src/campaign/log.ts";
import type { Difficulty } from "../../../src/catalog/scenario-data.ts";
import type { CampaignFacts, ModeCard } from "../../../src/rules/core/campaign-state.ts";
import { legalTargets, type PlayerIntent, type ReduceContext, type ScenarioState } from "../../../src/rules/engine/reduce.ts";

import { loadCampaign, loadScenario } from "../../../scripts/data/load-scenarios.ts";
import { angmarIntent, type AngmarPolicy, type AngmarScenario } from "../../harness/angmar-policy.ts";
import { type PolicyOptions } from "../../harness/auto-player.ts";
import { campaignGame, fillerLoadout, HERO_STATS, type PlayedGame } from "../../harness/game-kit.ts";

const campaign = loadCampaign("angmar-awakened");
const rhudaur = loadScenario("the-treachery-of-rhudaur");

// Test helper. A whole game of The Treachery of Rhudaur in Campaign Mode played by the auto-player, true solo or two-handed. The heroes are big numbers (or too small to quest) and the decks free events, so the outcome depends on the engine, the seed and the encounter
// deck, not on player card play. Every hero quests (Amarthiúl stays out: his destruction loses the game), nobody engages (Thaurdir engages by his engagement cost) and the heroes defend nothing, the players travel to the first location the engine lists, the heroes attack Thaurdir first (stage 2B
// cannot be defeated while he has hit points), and a choice is answered as the policy says: "last" makes the last side quest the current quest at the beginning of each quest phase, "first" has no current quest on stage 1 (the main quest card cannot be chosen, 10094:B:3). The shared Angmar
// policy (test/harness/angmar-policy.ts) does the rest. The auto-player claims no Clue (it plays no Action), so no Clue boon is earned here: the campaign test earns them on a table that claims them.
export const RHUDAUR_POLICY: PolicyOptions = { scout: "", prefer: "", protect: "", play: false, act: false };
// "strong": big-number heroes that win; "weak": heroes too small to quest, so the players lose on threat.
export type RhudaurDecks = "strong" | "weak";

export const rhudaurLoadout = fillerLoadout;

// The goldens' world, the plan and start of a game, and the log of a campaign whose earlier parts were won: the seeded game's parts every scenario shares (test/harness/game-kit.ts).
export const rhudaurWorld = (decks: RhudaurDecks = "strong") => game.world(decks);
export const afterEttenmoors = (seatCount: 1 | 2) => game.after(seatCount);
export const rhudaurPlan = (seatCount: 1 | 2, log: CampaignLog = emptyLog(seatCount)) => game.plan(seatCount, log);
export const rhudaurStart = (seatCount: 1 | 2, seed: number, difficulty: Difficulty, facts?: Omit<CampaignFacts, "modeCard">, log: CampaignLog = emptyLog(seatCount), modeCard?: ModeCard, extra: { choices?: readonly string[]; standalone?: boolean } = {}) => game.start(seatCount, seed, difficulty, { facts, log, modeCard, ...extra });

export type RhudaurPolicy = AngmarPolicy;
export const DEFAULT_POLICY: RhudaurPolicy = { choose: "last", engage: false, defend: "none", quest: "one" };

// Thaurdir is attacked first: the second stage cannot be won until 9 damage is on him (10095:B:2); Amarthiúl never attacks.
const RHUDAUR: AngmarScenario = { safe: [], rank: (state, enemyId) => (state.cards[enemyId]?.code === "10098" ? 0 : 1) };

// The shared Angmar policy (test/harness/angmar-policy.ts) with Thaurdir attacked first, and an attack nobody defends falling on the hero with the least damage: Amarthiúl (an objective ally with 3 hit points, whose destruction loses the game) is never the one it falls on.
export function rhudaurIntent(state: ScenarioState, ctx: ReduceContext, memory: Set<string>, policy: RhudaurPolicy = DEFAULT_POLICY, options: PolicyOptions = RHUDAUR_POLICY): PlayerIntent {
  if (state.window?.kind === "defense" && policy.defend === "none") {
    const heroes = legalTargets(state, { type: "Undefended" }, ctx).filter((id) => state.cards[id]?.zone === "heroes");
    const least = [...heroes].sort((left, right) => (state.cards[left]?.damage ?? 0) - (state.cards[right]?.damage ?? 0))[0];
    if (least) return { type: "Undefended", heroId: least };
  }
  return angmarIntent(state, ctx, memory, policy, options, RHUDAUR);
}

export type RhudaurGame = PlayedGame;

// The goldens (src/campaign/scenarios/the-treachery-of-rhudaur/golden.test.ts).
// `after`: the log of a campaign whose earlier parts were won. `upgraded`: the Upgraded sides. `mode`: the Hard or Expert Mode card.
export type RhudaurGolden = { name: string; seatCount: 1 | 2; seed: number; difficulty: Difficulty; decks: RhudaurDecks; outcome: "won" | "lost"; policy?: Partial<RhudaurPolicy>; after?: boolean; upgraded?: boolean; mode?: ModeCard; lossReason?: string };

// Every game is played after Across the Ettenmoors' win (`after`), so the campaign card is in play (a Determination for each player, Arnor Ravaged staged, Mysterious Omens, Fend Off Despair and the Losing Time copies in the encounter deck, Thaurdir's burden attached to him while he is set aside). One
// hero quests and the others attack Thaurdir (nobody engages: he engages by his engagement cost), every attack falls on a hero undefended. Wins: true solo making the last side quest the current quest each round (two side quests flip over into Clues; the third is removed from the game
// when the last time counter comes off, 10094:B:2), and two-handed with no side quest ever chosen (each round has no current quest and the three side quests are removed when the time runs out). Thaurdir must hold 9 damage and the stage its 30 quest points. The ways to lose: the players' threat at 50
// (heroes too small to quest) and Amarthiúl leaving play (10096's lose line: nobody defends, so an effect that picks him first destroys him). No Clue is claimed (the auto-player plays no Action), so none of the Clue boons is earned in a golden: the campaign test earns them.
export const RHUDAUR_GOLDENS: readonly RhudaurGolden[] = [
  { name: "true solo, won, two side quests flipped and one removed when the time ran out", seatCount: 1, seed: 3, difficulty: "Normal", decks: "strong", outcome: "won", after: true },
  { name: "two-handed, won, no side quest chosen and all three removed when the time ran out", seatCount: 2, seed: 5, difficulty: "Normal", decks: "strong", outcome: "won", after: true, policy: { choose: "first" } },
  { name: "true solo, lost, threat reaches 50", seatCount: 1, seed: 3, difficulty: "Normal", decks: "weak", outcome: "lost", after: true, lossReason: "No seats remain" },
  { name: "true solo, lost, Amarthiúl left play", seatCount: 1, seed: 2, difficulty: "Normal", decks: "strong", outcome: "lost", after: true, lossReason: "Amarthiúl left play" },
];

const game = campaignGame<RhudaurDecks, RhudaurPolicy>({
  campaign,
  scenario: rhudaur,
  stats: HERO_STATS,
  // The scenario's cards; the campaign card's, the cards it places (the boons, Determination, Fend Off Despair, the Clue boons) and the campaign's game codes are added by the kit. The pool holds what Across the Ettenmoors leaves: Mysterious Omens, Arnor Ravaged, Amarthiúl's Courage, a Thaurdir burden, Fend Off Despair and Losing Time.
  codes: [...rhudaur.cards.flatMap((card) => (card.back != null ? [card.code, card.back] : [card.code])), "10160", "100158", "10157", "10167", "10168", "10169", "10170", "10172", "10173", "10183"],
  intent: rhudaurIntent,
  policy: DEFAULT_POLICY,
  limit: 6000,
  upgraded: [],
  // The six earlier parts were won: no XP in this campaign; in the pool Mysterious Omens, Arnor Ravaged, Amarthiúl's Courage, Thaurdir's Legacy, Fend off Despair and Losing Time.
  earlier: { xp: [0, 0, 0, 0, 0, 0], pool: [{ code: "10160" }, { code: "100158" }, { code: "10167" }, { code: "10168" }, { code: "10173" }, { code: "10183" }], marks: {} },
});

export const playGolden = (golden: RhudaurGolden, ctx: ReduceContext): RhudaurGame => game.playGolden(golden, ctx);
