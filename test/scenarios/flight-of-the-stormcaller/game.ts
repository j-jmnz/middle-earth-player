import { emptyLog, type CampaignLog } from "../../../src/campaign/log.ts";
import type { Difficulty } from "../../../src/catalog/scenario-data.ts";
import type { CampaignFacts, ModeCard } from "../../../src/rules/core/campaign-state.ts";
import { askingToCommit } from "../../../src/rules/families/sea/sailing-legal.ts";
import { legalIntents, legalTargets, type PlayerIntent, type ReduceContext, type ScenarioState } from "../../../src/rules/engine/reduce.ts";

import { campaign, CODES, flight, MODIFICATIONS, ORIGINAL_SHIPS, SHIP_CODES } from "./scene.ts";
import { nextIntent, type PolicyOptions } from "../../harness/auto-player.ts";
import { attackTogether, campaignGame, engageOneEach, fillerLoadout, HERO_STATS, STRONG_HEROES as HEROES, type PlayedGame } from "../../harness/game-kit.ts";

// Test helper. A whole game of Flight of the Stormcaller in Campaign Mode played by the auto-player, true solo or two-handed. The heroes are big numbers (or too small
// to quest, or too brittle to survive an attack) and the decks free events, so the outcome depends on the engine, the seed and the encounter deck, not on player card play.
// Each player takes a ship (the first option each choice offers), fits the Modification boon the choice offers first, and keeps or trades the damage on it as the policy
// says; the Sailing test commits no one or the Dream-chaser, as the policy says. Ships defend, the heroes attack the Ship enemies.
export const FLIGHT_POLICY: PolicyOptions = { scout: "", prefer: "", protect: "", play: false, act: false };
// "strong": big-number heroes that win; "weak": heroes too small to quest, so the players lose on threat; "brittle": strong questers that die to an attack.
export type FlightDecks = "strong" | "weak" | "brittle" | "tense";

export const flightLoadout = fillerLoadout;

// The Galdor's Counsel the earlier parts leave in the pool.
const COUNSEL = "11184";

// The goldens' world, the plan and start of a game, and the log of a campaign whose first three parts were won (Ominous Fate and a Galdor's Counsel in the pool, the XP they gained,
// and marks on the ships, a Modification boon and the Counsel): the seeded game's parts every scenario shares (test/harness/game-kit.ts).
export const flightWorld = (decks: FlightDecks = "strong") => game.world(decks);
export const afterRaid = (seatCount: 1 | 2) => game.after(seatCount);
export const flightPlan = (seatCount: 1 | 2, log: CampaignLog = emptyLog(seatCount)) => game.plan(seatCount, log);
export const flightStart = (seatCount: 1 | 2, seed: number, difficulty: Difficulty, facts?: Omit<CampaignFacts, "modeCard">, log: CampaignLog = emptyLog(seatCount), modeCard?: ModeCard) => game.start(seatCount, seed, difficulty, { facts, log, modeCard });

export type FlightPolicy = {
  // "keep" or "trade": unused (the campaign card offers no trade of damage), kept so a golden names one policy shape with Voyage's.
  // "pass" or "ships" at the Sailing test (commit no one, or the ships that can sail).
  sail: "pass" | "ships";
  // Engage the Ship enemies in the optional engagement step ("ships"), or leave them in the staging area ("none").
  engage: "ships" | "none";
};
export const DEFAULT_POLICY: FlightPolicy = { sail: "pass", engage: "ships" };

// The auto-player's answer (test/harness/auto-player.ts), except: the Sailing test commits no one or the ships; a trade of damage for a resource is answered as the policy says; in
// a player attack window every ready character that can attack the target attacks together (the Ship enemy with the least hit points left, else the first enemy it can reach);
// in the optional engagement step the seat engages one Ship enemy at a time; defense falls to the ships. Every intent is one the reducer listed.
export function flightIntent(state: ScenarioState, ctx: ReduceContext, memory: Set<string>, policy: FlightPolicy = DEFAULT_POLICY): PlayerIntent {
  if (askingToCommit(state)) {
    if (policy.sail === "ships") {
      const ships = legalTargets(state, { type: "Commit" }, ctx).filter((id) => SHIP_CODES.includes(state.cards[id]?.code ?? ""));
      if (ships.length > 0) return { type: "Commit", cardIds: ships };
    }
    return { type: "Pass" };
  }
  if (state.mode === "questCommit" && state.window?.kind === "pass" && !Object.values(state.cards).some((card) => card.committed && card.controller === state.activeSeat)) {
    const ids = legalTargets(state, { type: "Commit" }, ctx);
    // With the strong loadout the last hero of each seat stays out of the quest, so it is ready to attack.
    const heroes = ids.filter((id) => HEROES.includes(state.cards[id]?.code ?? ""));
    if (heroes.length > 0) {
      const home = heroes.length >= 3 ? heroes.slice(-1) : [];
      const questers = ids.filter((id) => !home.includes(id) && !SHIP_CODES.includes(state.cards[id]?.code ?? ""));
      if (questers.length > 0) return { type: "Commit", cardIds: questers };
    }
  }
  const together = attackTogether(state, ctx);
  if (together) return together;
  // Damage the players assign among their characters falls on the least wounded hero (the heroes are big numbers), never on a ship.
  if (state.window?.kind === "choose") {
    const heroes = state.window.options.filter((option) => HEROES.includes(state.cards[option]?.code ?? ""));
    const least = [...heroes].sort((left, right) => (state.cards[left]?.damage ?? 0) - (state.cards[right]?.damage ?? 0))[0];
    if (least && heroes.length < state.window.options.length) return { type: "Choose", optionId: least };
  }
  // The ships defend; a seat without one falls to its least wounded hero.
  if (state.window?.kind === "defense") {
    const defenders = legalIntents(state, ctx).some((intent) => intent.type === "DeclareDefender") ? legalTargets(state, { type: "DeclareDefender" }, ctx) : [];
    if (defenders[0]) return { type: "DeclareDefender", defenderId: defenders[0] };
    const targets = legalTargets(state, { type: "Undefended" }, ctx);
    const least = [...targets].sort((left, right) => (state.cards[left]?.damage ?? 0) - (state.cards[right]?.damage ?? 0))[0];
    if (least) return { type: "Undefended", heroId: least };
  }
  if (state.window?.kind === "optionalEngage" && policy.engage === "none") return { type: "DeclineEngage" };
  const engaging = engageOneEach(state, ctx, 2);
  if (engaging) return engaging;
  return nextIntent(state, ctx, FLIGHT_POLICY, memory, legalIntents(state, ctx));
}

export type FlightGame = PlayedGame;

// The goldens (src/campaign/scenarios/flight-of-the-stormcaller/golden.test.ts), also played by the causes and replay tests. A win runs the campaign card's Resolution and awards its XP; a loss writes nothing.
// `upgraded`: the cards the log marks as upgraded (the ships, the Modification boons, Black Key and Calaerion), dealt on their Upgraded side. `mode`: the Hard or Expert Mode card.
export type FlightGolden = { name: string; seatCount: 1 | 2; seed: number; difficulty: Difficulty; decks: FlightDecks; outcome: "won" | "lost"; policy?: Partial<FlightPolicy>; upgraded?: boolean; mode?: ModeCard; after?: boolean; lossReason?: string };

export const UPGRADED_CODES = [...SHIP_CODES, ...MODIFICATIONS, CODES.blackKey, CODES.calaerion];
const THREAT_LOST = "No seats remain";

// A win needs the players to catch up to the Stormcaller: the ships sail every round to bring the heading back on-course, and the Ship enemies stay in the staging area.
const SAIL: Partial<FlightPolicy> = { sail: "ships", engage: "none" };
const STORMCALLER_LOST = "The Stormcaller has defeated stage 4";
const SHIP_LOST = "Dream-chaser left play";

export const FLIGHT_GOLDENS: readonly FlightGolden[] = [
  { name: "true solo, won on stage 2B, on-course", seatCount: 1, seed: 1, difficulty: "Normal", decks: "strong", outcome: "won", policy: SAIL },
  { name: "true solo, Easy, won on stage 2B", seatCount: 1, seed: 3, difficulty: "Easy", decks: "strong", outcome: "won", policy: SAIL },
  { name: "true solo, won on stage 3B", seatCount: 1, seed: 7, difficulty: "Normal", decks: "strong", outcome: "won", policy: SAIL },
  { name: "true solo, won on stage 4B", seatCount: 1, seed: 2, difficulty: "Normal", decks: "strong", outcome: "won", policy: SAIL },
  { name: "true solo, after Raid on the Grey Havens, won", seatCount: 1, seed: 2, difficulty: "Normal", decks: "strong", outcome: "won", policy: SAIL, after: true },
  { name: "true solo, Hard Mode card, won", seatCount: 1, seed: 8, difficulty: "Normal", decks: "strong", outcome: "won", policy: SAIL, mode: "hard" },
  { name: "true solo, Upgraded ships, Modification boons, Black Key and Calaerion, won", seatCount: 1, seed: 6, difficulty: "Normal", decks: "strong", outcome: "won", policy: SAIL, upgraded: true },
  { name: "two-handed, won", seatCount: 2, seed: 6, difficulty: "Normal", decks: "strong", outcome: "won", policy: SAIL },
  { name: "two-handed, Easy, won", seatCount: 2, seed: 1, difficulty: "Easy", decks: "strong", outcome: "won", policy: SAIL },
  { name: "two-handed, Expert Mode card, Upgraded cards, won on stage 3B", seatCount: 2, seed: 18, difficulty: "Normal", decks: "strong", outcome: "won", policy: SAIL, mode: "expert", upgraded: true },
  { name: "true solo, weak, lost on threat", seatCount: 1, seed: 2, difficulty: "Normal", decks: "weak", outcome: "lost", lossReason: THREAT_LOST },
  { name: "true solo, weak, the Stormcaller defeats stage 4, lost", seatCount: 1, seed: 1, difficulty: "Normal", decks: "weak", outcome: "lost", lossReason: STORMCALLER_LOST },
  { name: "two-handed, weak, lost on threat", seatCount: 2, seed: 1, difficulty: "Normal", decks: "weak", outcome: "lost", lossReason: THREAT_LOST },
  { name: "true solo, brittle heroes, lost", seatCount: 1, seed: 1, difficulty: "Normal", decks: "brittle", outcome: "lost", lossReason: THREAT_LOST },
  { name: "two-handed, the Dream-chaser destroyed, lost", seatCount: 2, seed: 1, difficulty: "Normal", decks: "strong", outcome: "lost", policy: SAIL, lossReason: SHIP_LOST },
  { name: "two-handed, the Stormcaller defeats stage 4, lost", seatCount: 2, seed: 7, difficulty: "Normal", decks: "strong", outcome: "lost", policy: SAIL, lossReason: STORMCALLER_LOST },
  { name: "true solo, the Stormcaller defeats stage 4, lost", seatCount: 1, seed: 3, difficulty: "Normal", decks: "strong", outcome: "lost", lossReason: STORMCALLER_LOST },
];

const game = campaignGame<FlightDecks, FlightPolicy>({
  campaign,
  scenario: flight,
  stats: HERO_STATS,
  codes: [...SHIP_CODES, ...ORIGINAL_SHIPS, ...flight.cards.map((card) => card.code), CODES.ominousFate, COUNSEL],
  intent: flightIntent,
  policy: DEFAULT_POLICY,
  limit: 8000,
  upgraded: UPGRADED_CODES,
  levels: { [COUNSEL]: 3 },
  earlier: { xp: [4, 3, 5], pool: [{ code: CODES.ominousFate }, { code: COUNSEL, seat: 0 }], marks: { "11080": 1, "11172": 2, [COUNSEL]: 3 } },
});

export const playGolden = (golden: FlightGolden, ctx: ReduceContext): FlightGame => game.playGolden(golden, ctx);
export { SHIP_LOST, STORMCALLER_LOST, THREAT_LOST };
