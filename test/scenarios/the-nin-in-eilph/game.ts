import type { LoadoutSeat } from "../../../src/campaign/loadout.ts";
import type { Difficulty } from "../../../src/catalog/scenario-data.ts";
import type { PlayerIntent, ReduceContext, ScenarioState } from "../../../src/rules/engine/reduce.ts";

import { loadAnyScenario, loadCampaign } from "../../../scripts/data/load-scenarios.ts";
import type { PolicyOptions } from "../../harness/auto-player.ts";
import { definePrinted } from "../../../src/rules/core/printed.ts";
import { fillerLoadout, HERO_STATS, standaloneGame, type PlayedGame } from "../../harness/game-kit.ts";
import { attackAllTogether, chooseOption, commitAllBut, declineAttack, engageUpTo, undefendedLeastDamaged, policyIntent, type Policy } from "../../harness/policy-kit.ts";

const cycle = loadCampaign("the-ring-maker");
const eilph = loadAnyScenario("the-nin-in-eilph");

// Test helper. A whole standalone game of The Nîn-in-Eilph played by the auto-player, true solo or two-handed. The heroes have a willpower of 6 and a threat of 8 (so the stages take several rounds, their Time can run out and replace them, and the
// threat can reach the elimination level) and the decks hold free events and free allies, so the outcome depends on the engine, the seed and the encounter deck, not on player card play. There is no campaign: no checklist, no log, no earlier part, no
// Resolution. The scenario needs answers of its own, which the auto-player does not give: (1) Nalir (3 hit points) leaves play when Neekerbreekers (08105:A:1) deal 2 damage to an ally twice and he is the only one, and when he quests and defends he is exhausted, so a deck
// holds spare allies, Nalir stays home from the quest and a Choose or Pick that offers him is answered with another card; (2) two heroes of each seat stay home from the quest and nobody defends (a hero has 100 hit points), so the heroes that attack are
// ready: Ancient Marsh-dweller (defense 4, 9 hit points) needs two of them together; (3) stage 4B ends the game when Ancient Marsh-dweller is defeated, so the players engage it by choice on stage 4 (its engagement cost is 45) and attack it first.
const NALIR = "08102";
const MARSH_DWELLER = "08103";
export const EILPH_POLICY: PolicyOptions = { scout: "", prefer: "", protect: NALIR, play: true, act: false };
// "strong" is the one deck: heroes with a willpower of 6 and a threat of 8 (below), so the game takes several rounds and can be won or lost.
export type EilphDecks = "strong";

// A free ally of the stand-in decks: Neekerbreekers (08105:A:1) deal 2 damage to an ally the engaged player controls, and Nalir (3 hit points) is the only one a deck of free events holds, so the players hold a spare ally to take it.
export const SPARE_ALLY = "spare-ally";
export const eilphLoadout = (seatCount: 1 | 2): LoadoutSeat[] =>
  fillerLoadout(seatCount).map((seat) => ({ ...seat, deck: seat.deck.map((code, index) => (index % 3 === 0 ? SPARE_ALLY : code)) }));

// The goldens' world and the start of a game: the seeded game's parts every scenario shares (test/harness/game-kit.ts).
export const eilphWorld = async (decks: EilphDecks = "strong") => {
  const world = await game.world(decks);
  world.cards.set(SPARE_ALLY, definePrinted({ code: SPARE_ALLY, name: "Spare Ally", type: "ally", sphere: "neutral", cost: 0, willpower: 1, attack: 1, defense: 1, health: 4 }));
  return world;
};
export const eilphStart = (seatCount: 1 | 2, seed: number, difficulty: Difficulty) => game.start(seatCount, seed, difficulty);

export type EilphPolicy = {
  // The option a Choose window with these answers takes: the first or the last.
  choose: "first" | "last";
};
export const DEFAULT_POLICY: EilphPolicy = { choose: "first" };

// The policy (test/harness/policy-kit.ts): a list of rules tried in order, then the auto-player's answer with EILPH_POLICY. A rule answers its own window and returns null for any other. The kit's rules:
//   chooseOption(wanted, otherwise)  a Choose window takes the option `wanted` names for the options offered, else the first or last
//   commitAllBut(reserve, keepHome)  the quest commit: every character but the last `reserve` heroes (and those `keepHome` names)
//   travelFewestQuestPoints(allow)  a travel window: the location with the fewest quest points (one `allow` permits), else decline
//   declineTravel()  a travel window: decline
//   defendFirst(perRound)  a defense window: the first character who may defends (the first `perRound` attacks of a seat's round), else the first hero is undefended
//   undefendedLeastDamaged(except)  a defense window: nobody defends, the least damaged hero takes the attack (the others stay ready to attack)
//   archeryLeastDamaged(skip)  an archery window: all the damage to the least damaged character
//   attackAllTogether(rank, may)  the player attack window: every ready character attacks the enemy of the lowest `rank` (else the first) together
//   attackEach(options)  the player attack window: the first ready character attacks alone, so each takes a different enemy when `once`
//   declineAttack()  the player attack window: decline to attack
//   engageUpTo(most, options)  the optional engagement step: engage the enemy of the lowest `rank` (`allow` permits) while engaged with fewer than `most`
//   triggerActions(effectIds, oncePerRound)  an Action or Response of the records named, each time (or once a round) the engine offers it and the seat can pay
//   passCommitWhile(when)  the quest commit: pass without committing while `when` holds
// Stage 4B (08101) ends the game when Ancient Marsh-dweller is defeated. One defeated earlier lies in the victory display and comes back to the staging area when a stage 3 or the stage 4 is revealed (08098:A:1 to 08101:A:1), so the players attack it whenever it is engaged; they choose to engage it on stage 4 only (its engagement cost is 45).
const STAGE_4 = "08101";
const onStage4 = (state: ScenarioState) => state.cards[state.questStage ?? ""]?.code === STAGE_4;
const rules = (policy: EilphPolicy): Policy => [chooseOption((state, options) => options.find((id) => state.cards[id]?.code !== NALIR), policy.choose), commitAllBut(2, (state, id) => state.cards[id]?.code === NALIR), undefendedLeastDamaged(), engageUpTo(undefined, { allow: (state, id) => state.cards[id]?.code === MARSH_DWELLER && onStage4(state) }), attackAllTogether((state, id) => (state.cards[id]?.code === MARSH_DWELLER ? 0 : 1)), declineAttack()];

// Every intent is one the reducer listed.
export function eilphIntent(state: ScenarioState, ctx: ReduceContext, memory: Set<string>, policy: EilphPolicy = DEFAULT_POLICY): PlayerIntent {
  return policyIntent(rules(policy), EILPH_POLICY, state, ctx, memory);
}

export type EilphGame = PlayedGame;

// The goldens (src/campaign/scenarios/the-nin-in-eilph/golden.test.ts). A standalone game has no earlier parts, Upgraded sides or Mode card.
export type EilphGolden = { name: string; seatCount: 1 | 2; seed: number; difficulty: Difficulty; decks: EilphDecks; outcome: "won" | "lost"; policy?: Partial<EilphPolicy>; lossReason?: string };

// The games to pin (.claude/rules/code-standards.md, Test cost): a standalone scenario has no Resolution, so Easy mode adds no game, and it has no Nightmare deck. Wins true solo and two-handed (both pass through a replaced stage 2 or 3 when its Time runs out),
// each ending when Ancient Marsh-dweller is defeated on stage 4. The ways to lose are a threat at the elimination level (50) and Nalir leaving play (two-handed).
export const EILPH_GOLDENS: readonly EilphGolden[] = [
  { name: "solo win", seatCount: 1, seed: 30, difficulty: "Normal", decks: "strong", outcome: "won" },
  { name: "two-handed win", seatCount: 2, seed: 18, difficulty: "Normal", decks: "strong", outcome: "won" },
  { name: "solo loss: threat at the elimination level", seatCount: 1, seed: 2, difficulty: "Normal", decks: "strong", outcome: "lost", lossReason: "No seats remain" },
  { name: "two-handed loss: Nalir leaves play", seatCount: 2, seed: 29, difficulty: "Normal", decks: "strong", outcome: "lost", lossReason: "Nalir left play" },
];

const game = standaloneGame<EilphDecks, EilphPolicy>({
  campaign: cycle,
  scenario: eilph,
  stats: { strong: { ...HERO_STATS.steady, threat: 8 } },
  loadout: eilphLoadout,
  codes: [...eilph.cards.map((card) => card.code)],
  intent: eilphIntent,
  policy: DEFAULT_POLICY,
  limit: 6000,
});

export const playGolden = (golden: EilphGolden, ctx: ReduceContext): EilphGame => game.playGolden(golden, ctx);
