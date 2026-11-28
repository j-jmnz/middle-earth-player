import type { Difficulty } from "../../../src/catalog/scenario-data.ts";
import type { PlayerIntent, ReduceContext, ScenarioState } from "../../../src/rules/engine/reduce.ts";

import { loadAnyScenario, loadCampaign } from "../../../scripts/data/load-scenarios.ts";
import type { PolicyOptions } from "../../harness/auto-player.ts";
import { definePrinted } from "../../../src/rules/core/printed.ts";
import { FILLER, fillerLoadout, HERO_STATS, standaloneGame, type PlayedGame } from "../../harness/game-kit.ts";
import { archeryLeastDamaged, attackAllTogether, chooseFirstOrLast, chooseOption, commitAllBut, engageUpTo, policyIntent, undefendedLeastDamaged, type Policy } from "../../harness/policy-kit.ts";

const cycle = loadCampaign("vengeance-of-mordor");
const templedoom = loadAnyScenario("the-temple-of-doom");

// Test helper. A whole standalone game of The Temple of Doom played by the auto-player, true solo or two-handed. The heroes are big numbers (or too small to quest, or too brittle to survive an attack) and the decks free
// events, so the outcome depends on the engine, the seed and the encounter deck, not on player card play. There is no campaign: no checklist, no log, no earlier part, no Resolution. The players quest with all but one character, engage the enemies of the staging area (Thane Ulchor first) and the hero kept home attacks, Ulchor first. The first player's choice of the current quest takes Tribute to Mordor when it is offered, unless the policy says `tribute: false` (then the game runs on until the Power of Mordor deck is empty); every other Choose window takes the first option.
export const TEMPLEDOOM_POLICY: PolicyOptions = { scout: "", prefer: "", protect: "", play: false, act: false };
// "strong": big-number heroes that win; "weak": heroes too small to quest, so the players lose on threat; "brittle": strong questers that die to an attack.
export type TempledoomDecks = "strong" | "weak" | "brittle";

export const templedoomLoadout = fillerLoadout;

// The goldens' world and the start of a game: the seeded game's parts every scenario shares (test/harness/game-kit.ts).
// The filler event costs 2 here: stage 2B The Lord of Middle-earth caps its progress at the total printed cost of the cards the players discard (21085:B:2), and a free card would hold that stage shut for good.
export const templedoomWorld = async (decks: TempledoomDecks = "strong") => {
  const world = await game.world(decks);
  world.cards.set(FILLER, definePrinted({ code: FILLER, name: FILLER, type: "event", sphere: "neutral", cost: 2 }));
  return world;
};
export const templedoomStart = (seatCount: 1 | 2, seed: number, difficulty: Difficulty) => game.start(seatCount, seed, difficulty);

export type TempledoomPolicy = {
  // The option a Choose window with these answers takes: the first or the last.
  choose: "first" | "last";
  // Whether the current-quest choice takes Tribute to Mordor when offered (default). False: every Choose takes `choose`.
  tribute?: boolean;
};
export const DEFAULT_POLICY: TempledoomPolicy = { choose: "first" };

// The policy (test/harness/policy-kit.ts): a list of rules tried in order, then the auto-player's answer with TEMPLEDOOM_POLICY. A rule answers its own window and returns null for any other. The kit's rules:
//   chooseFirstOrLast(which)  a Choose window takes the first or the last option
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
// TODO: the scenario's own answers (where the players travel, who defends, which locations they explore) go in the list, before the auto-player's.
const TRIBUTE = "21053";
const ULCHOR = "21054";
// Thane Ulchor first: he is engageable only on the last stage, and his damage opens Tribute to Mordor.
const ulchorFirst = (state: ScenarioState, id: string) => (state.cards[id]?.code === ULCHOR ? 0 : 1);
// The first player's choice of the current quest takes Tribute to Mordor when it is offered (once Ulchor has taken his hit points in damage); every other Choose window takes the policy's option.
const takeTribute = chooseOption((state, options) => options.find((id) => state.cards[id]?.code === TRIBUTE), "first");
const rules = (policy: TempledoomPolicy): Policy => [policy.tribute === false ? chooseFirstOrLast(policy.choose) : takeTribute, commitAllBut(1), archeryLeastDamaged(), undefendedLeastDamaged(), engageUpTo(undefined, { rank: ulchorFirst }), attackAllTogether(ulchorFirst)];

// Every intent is one the reducer listed.
export function templedoomIntent(state: ScenarioState, ctx: ReduceContext, memory: Set<string>, policy: TempledoomPolicy = DEFAULT_POLICY): PlayerIntent {
  return policyIntent(rules(policy), TEMPLEDOOM_POLICY, state, ctx, memory);
}

export type TempledoomGame = PlayedGame;

// The goldens (src/campaign/scenarios/the-temple-of-doom/golden.test.ts). A standalone game has no earlier parts, Upgraded sides or Mode card.
export type TempledoomGolden = { name: string; seatCount: 1 | 2; seed: number; difficulty: Difficulty; decks: TempledoomDecks; outcome: "won" | "lost"; policy?: Partial<TempledoomPolicy>; lossReason?: string };

// TODO: the games to pin (at most 3000 intents in all, .claude/rules/code-standards.md, Test cost), a few wins (true solo and two-handed, Normal and Nightmare) and a few losses (each way the scenario can be lost), each on a fixed seed.
export const TEMPLEDOOM_GOLDENS: readonly TempledoomGolden[] = [
  { name: "true solo, won, Normal", seatCount: 1, seed: 1, difficulty: "Normal", decks: "strong", outcome: "won" },
  { name: "two-handed, won, Normal", seatCount: 2, seed: 5, difficulty: "Normal", decks: "strong", outcome: "won" },
  { name: "two-handed, won, Easy", seatCount: 2, seed: 1, difficulty: "Easy", decks: "strong", outcome: "won" },
  { name: "true solo, lost, threat reaches 50", seatCount: 1, seed: 4, difficulty: "Normal", decks: "weak", outcome: "lost", lossReason: "No seats remain" },
  { name: "true solo, lost, every hero destroyed", seatCount: 1, seed: 2, difficulty: "Normal", decks: "brittle", outcome: "lost", lossReason: "No seats remain" },
  { name: "true solo, lost, the Power of Mordor deck is empty", seatCount: 1, seed: 3, difficulty: "Normal", decks: "strong", outcome: "lost", policy: { tribute: false }, lossReason: "No card is left in the Power of Mordor deck to reveal" },
];

const game = standaloneGame<TempledoomDecks, TempledoomPolicy>({
  campaign: cycle,
  scenario: templedoom,
  stats: HERO_STATS,
  // TODO: the cards a game loads besides the scenario's piles and its Nightmare deck.
  codes: [...templedoom.cards.map((card) => card.code)],
  intent: templedoomIntent,
  policy: DEFAULT_POLICY,
  limit: 6000,
});

export const playGolden = (golden: TempledoomGolden, ctx: ReduceContext): TempledoomGame => game.playGolden(golden, ctx);
