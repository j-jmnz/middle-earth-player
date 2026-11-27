import type { Difficulty } from "../../../src/catalog/scenario-data.ts";
import type { LoadoutSeat } from "../../../src/campaign/loadout.ts";
import { legalIntents, legalTargets, type PlayerIntent, type ReduceContext, type ScenarioState } from "../../../src/rules/engine/reduce.ts";

import { loadAnyScenario, loadCampaign } from "../../../scripts/data/load-scenarios.ts";
import type { PolicyOptions } from "../../harness/auto-player.ts";
import { fillerLoadout, HERO_STATS, standaloneGame, type PlayedGame } from "../../harness/game-kit.ts";
import { archeryLeastDamaged, attackAllTogether, chooseFirstOrLast, commitAllBut, engageUpTo, policyIntent, travelFewestQuestPoints, undefendedLeastDamaged, type Policy } from "../../harness/policy-kit.ts";

const cycle = loadCampaign("haradrim");
const gurat = loadAnyScenario("the-dungeons-of-cirith-gurat");

// Test helper. A whole standalone game of The Dungeons of Cirith Gurat played by the auto-player, true solo or two-handed. The heroes are big numbers (or too brittle to survive an attack) and the decks free
// events, so the outcome depends on the engine, the seed and the encounter deck, not on player card play. There is no campaign: no checklist, no log, no earlier part, no Resolution. Every player quests with all but the last hero, who stays home and attacks the guards that hold a captive before any other enemy; they travel to the location with the fewest quest points, engage every enemy they may, nobody defends (the least damaged hero takes each undefended attack) and every other choice takes its first option. With `abaanDefends` Abaan, once free, defends every attack.
export const GURAT_POLICY: PolicyOptions = { scout: "", prefer: "", protect: "", play: false, act: false };
// "strong": big-number heroes that win; "brittle": strong questers that die to an attack.
export type GuratDecks = "strong" | "brittle";

// The stand-in heroes and a deck of free events with two Guards of the Citadel (01013, a plain ally): the Setup discards from the top of each deck until an ally is discarded and a Cirith Gurat guard holds it.
export const GUARD = "01013";
export const guratLoadout = (seatCount: 1 | 2): LoadoutSeat[] => fillerLoadout(seatCount).map((seat) => ({ ...seat, deck: [GUARD, GUARD, ...seat.deck.slice(2)] }));

// The goldens' world and the start of a game: the seeded game's parts every scenario shares (test/harness/game-kit.ts).
export const guratWorld = (decks: GuratDecks = "strong") => game.world(decks);
export const guratStart = (seatCount: 1 | 2, seed: number, difficulty: Difficulty) => game.start(seatCount, seed, difficulty);

export type GuratPolicy = {
  // Abaan, once free, defends every attack he may: with 3 hit points he dies and the players lose.
  abaanDefends: boolean;
  // The option a Choose window with these answers takes: the first or the last.
  choose: "first" | "last";
};
export const DEFAULT_POLICY: GuratPolicy = { choose: "first", abaanDefends: false };

// The policy (test/harness/policy-kit.ts): a list of rules tried in order, then the auto-player's answer with GURAT_POLICY. A rule answers its own window and returns null for any other. The kit's rules:
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
// The last hero a player controls stays home to attack, the guards of the captives first, so each rescue comes as early as the attacks allow (the others quest).
const stayHome = (state: ScenarioState, id: string): boolean => {
  const seat = state.seats[state.activeSeat];
  const mine = (seat?.heroes ?? []).filter((hero) => state.cards[hero]?.controller === state.activeSeat);
  return mine.length > 1 && mine[mine.length - 1] === id;
};
const guardsFirst = (state: ScenarioState, enemyId: string): number => (Object.values(state.cards).some((card) => card.captive && card.host === enemyId) ? 0 : 1);

const abaanDefends: Policy[number] = (state, ctx) => {
  if (state.window?.kind !== "defense" || !legalIntents(state, ctx).some((intent) => intent.type === "DeclareDefender")) return null;
  const abaan = legalTargets(state, { type: "DeclareDefender" }, ctx).find((id) => state.cards[id]?.code === "17120");
  return abaan ? { type: "DeclareDefender", defenderId: abaan } : null;
};

const rules = (policy: GuratPolicy): Policy => [chooseFirstOrLast(policy.choose), ...(policy.abaanDefends ? [abaanDefends] : []), commitAllBut(0, stayHome), travelFewestQuestPoints(), archeryLeastDamaged(), undefendedLeastDamaged(), engageUpTo(), attackAllTogether(guardsFirst)];

// Every intent is one the reducer listed.
export function guratIntent(state: ScenarioState, ctx: ReduceContext, memory: Set<string>, policy: GuratPolicy = DEFAULT_POLICY): PlayerIntent {
  return policyIntent(rules(policy), GURAT_POLICY, state, ctx, memory);
}

export type GuratGame = PlayedGame;

// The goldens (src/campaign/scenarios/the-dungeons-of-cirith-gurat/golden.test.ts). A standalone game has no earlier parts, Upgraded sides or Mode card.
export type GuratGolden = { name: string; seatCount: 1 | 2; seed: number; difficulty: Difficulty; decks: GuratDecks; outcome: "won" | "lost"; policy?: Partial<GuratPolicy>; lossReason?: string };

// The games to pin (.claude/rules/code-standards.md, Test cost): wins true solo and two-handed (a hero stays home to attack the guards and free the captives; the rest quest; the scenario has no Nightmare deck and Easy only deals a smaller encounter deck, so
// neither has a golden of its own) and each way to lose: Abaan leaves play (he defends and dies), a player's threat at 50 (the heroes too brittle for the attacks die but the one an enemy holds, so the seat stays in the game until its threat is 50) and every hero destroyed (the same heroes, an ally still held).
// A two-handed loss reaches no path a solo loss cannot, so there is none.
export const GURAT_GOLDENS: readonly GuratGolden[] = [
  { name: "true solo, won, Normal", seatCount: 1, seed: 1, difficulty: "Normal", decks: "strong", outcome: "won" },
  { name: "two-handed, won, Normal", seatCount: 2, seed: 4, difficulty: "Normal", decks: "strong", outcome: "won" },
  { name: "true solo, lost, Abaan leaves play", seatCount: 1, seed: 2, difficulty: "Normal", decks: "strong", outcome: "lost", policy: { abaanDefends: true }, lossReason: "Abaan left play" },
  { name: "true solo, lost, threat reaches 50 while the only hero left is held", seatCount: 1, seed: 14, difficulty: "Normal", decks: "brittle", outcome: "lost", lossReason: "No seats remain" },
  { name: "true solo, lost, every hero destroyed while an enemy holds the ally", seatCount: 1, seed: 21, difficulty: "Normal", decks: "brittle", outcome: "lost", lossReason: "No seats remain" },
];
const game = standaloneGame<GuratDecks, GuratPolicy>({
  campaign: cycle,
  scenario: gurat,
  stats: HERO_STATS,
  codes: [...gurat.cards.map((card) => card.code), GUARD],
  loadout: guratLoadout,
  intent: guratIntent,
  policy: DEFAULT_POLICY,
  limit: 3000,
});

// The play keeps its trail: the golden's checks read the states between intents from it.
export const playGolden = (golden: GuratGolden, ctx: ReduceContext): GuratGame => game.playGolden(golden, ctx, { trail: true });
