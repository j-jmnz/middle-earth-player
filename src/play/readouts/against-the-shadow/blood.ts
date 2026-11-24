// Rules: ats.hidden-cards, ats.hidden-cards-turn-faceup, ats.ally-objectives, rr.travel, rr.lasting-effects, hon.siege (data/rules/entries.json); ledger lines 06117:B:1, 06117:B:2, 06118:A:1, 06118:B:3, 06119:A:1, 06119:A:2, 06121:A:1, 06123:A:1, 06123:A:3, 06125:A:1, 06128:A:3, 06131:A:1, 06132:A:2, 06133:A:2.
//
// The pieces The Blood of Gondor's cards hold on the table: how many hidden cards each player holds (a mark on each seat's threat dial and one total dial, never a card), the lines of the two stages, the objective allies (whose they are, who may use the Action, held under Captured!),
// the Travel cost lines of the locations, The Cross-roads, Black Númenorean, Conflict at the Crossroads' lasting Threat in the quest readout and Brutal Uruk's line on the attack sheet. A hidden card is never named, typed or pictured here: only the count of each seat. Every hook
// keys on this scenario's id and is empty in another. The engine decided every number; nothing here changes one. Pure, so a test reads it.
import type { Effect } from "../../../catalog/boundary.ts";
import { flagged, heldAmount, livingSeats, type ScenarioState } from "../../../rules/core/state.ts";
import type { ReduceContext } from "../../../rules/engine/reduce.ts";
import { engagedOrcRaise } from "../../../rules/families/pelargir/engaged-threat.ts";
import { hiddenIds, hiddenSupply } from "../../../rules/families/pelargir/hidden.ts";
import { effectsOf } from "../../../rules/windows/listen.ts";

import { ALCARON_ACTION, BEFORE_COMBAT_NOTE, COMBAT_START_DECISION, allyWords, bonusWords, capturedWords, crossroadsWords, exploredWords, FARAMIR_ACTION, hiddenLabel, hiddenNote, hiddenWarn, numenoreanWords, orcThreatWords, totalName, totalNote, totalWarn, travelWords, urukAttackWords, ambushWords } from "../../words/scenarios/against-the-shadow/blood.ts";
import type { TableDial } from "../dials.ts";
import type { HandMark } from "../isengard.ts";

const SCENARIO = "the-blood-of-gondor";
const STAGE_ONE = "06117";
const STAGE_TWO = "06118";
const NUMENOREAN = "06119";
const URUK = "06121";
const CROSSROADS = "06123";
const WESTERN = "06125";
const EASTERN = "06127";
const DARK_WOODS = "06128";
const FARAMIR = "06132";
const ALCARON = "06133";
const FIVE_LIMIT = 4;
// The locations that print a Travel cost of hidden cards.
const TRAVEL_COSTS: ReadonlySet<string> = new Set([CROSSROADS, "06124", WESTERN, "06126", EASTERN]);

/** Whether the game is The Blood of Gondor: every hook below keys on it. */
export const live = (game: ScenarioState): boolean => game.scenarioId === SCENARIO;

/** The hidden cards each seat holds, in seat order: a count and nothing of the cards. Empty in any other scenario. */
export const holdings = (game: ScenarioState): number[] => (live(game) ? Array.from({ length: game.seatCount }, (_, seat) => hiddenIds(game, seat).length) : []);

// Whether the current stage turns a player's hidden cards at 5 (the flag Captured! holds).
const limited = (game: ScenarioState): boolean => live(game) && game.questStage != null && game.modifiers.length > 0 && flagged(game, game.questStage, "turnsAtFiveHidden");

// The seats a fifth card would turn: living seats at 4 while the limit holds.
const atFour = (game: ScenarioState): number[] => (limited(game) ? livingSeats(game).filter((seat) => hiddenIds(game, seat).length === FIVE_LIMIT) : []);

const inPlayCode = (game: ScenarioState, code: string): boolean => Object.values(game.cards).some((card) => card.code === code && (card.zone === "staging" || card.zone === "activeLocation" || card.zone === "secondActiveLocation"));

/** Each living seat's mark on its threat dial: its count, who it belongs to, and on stage 2 the warning at 4. Empty in any other scenario and before a card is dealt. */
export function bloodHands(game: ScenarioState): readonly HandMark[] {
  if (!live(game) || game.questStage == null) return [];
  const limit = limited(game);
  return livingSeats(game).map((seat) => {
    const count = hiddenIds(game, seat).length;
    const warn = limit && count === FIVE_LIMIT ? { level: "near" as const, words: hiddenWarn(game.seatCount, seat) } : undefined;
    return { seat, label: hiddenLabel(game.seatCount > 1 ? seat : null, count), note: hiddenNote(game.seatCount, seat, count, limit), ...(warn ? { warn } : {}) };
  });
}

/** The total dial: every hidden card in the game, with each seat's count in its note. A tap shows the current stage. */
export function bloodDials(game: ScenarioState): readonly TableDial[] {
  if (!live(game) || game.questStage == null) return [];
  const counts = holdings(game);
  const total = counts.reduce((sum, count) => sum + count, 0);
  const four = atFour(game);
  return [{ id: "hidden", testID: "hidden-total", label: "Hidden", name: totalName(total), value: total, note: totalNote(counts, inPlayCode(game, NUMENOREAN)), ...(four.length > 0 ? { warn: { level: "near" as const, words: totalWarn(four, game.seatCount) } } : {}), cardId: game.questStage }];
}

/** The objective allies lying under Captured!: in play, controlled by nobody. Empty for any other card and scenario. */
export const alliesUnder = (game: ScenarioState, cardId: string): string[] => (live(game) && game.cards[cardId]?.code === STAGE_TWO ? Object.values(game.cards).filter((card) => card.zone === "captive" && card.host === cardId).map((card) => card.id) : []);

/** The line a stage adds to its preview: the counts and what the stage does with the hidden cards. Empty for any other stage and scenario. */
export function bloodStageLines(game: ScenarioState, stageCode: string): string[] {
  if (!live(game)) return [];
  const counts = holdings(game);
  if (stageCode === STAGE_ONE) return [ambushWords(counts)];
  if (stageCode === STAGE_TWO) return [capturedWords(counts, inPlayCode(game, CROSSROADS), atFour(game))];
  return [];
}

// The amount of hidden cards a card's Travel record takes.
function travelAmount(ctx: ReduceContext, code: string): number | null {
  const record = (effectsOf(ctx, code) as readonly Effect[]).find((effect) => effect.timing === "travel");
  const take = record?.instructions.find((instruction) => instruction.verb === "TakeHiddenCard");
  return take?.verb === "TakeHiddenCard" ? (take.amount ?? 1) : null;
}

/** The reason the engine's refusal of a Travel gets when its cost is a hidden card and the deck and the discard pile are too short: null otherwise. */
export function travelShort(game: ScenarioState, ctx: ReduceContext, locationId: string): number | null {
  const code = game.cards[locationId]?.code;
  const amount = live(game) && code ? travelAmount(ctx, code) : null;
  return amount != null && hiddenSupply(game) < amount ? amount : null;
}

/** The card preview's line for a card of this scenario: a Travel cost as its consequence, The Cross-roads, the +5 quest points, the Dark Woods' Forced line, Black Númenorean and the two allies. Null for any other card. */
export function bloodDetail(game: ScenarioState, ctx: ReduceContext, cardId: string): string | null {
  const card = game.cards[cardId];
  if (!live(game) || !card) return null;
  const staged = card.zone === "staging" || card.zone === "activeLocation" || card.zone === "secondActiveLocation";
  const first = game.firstPlayer;
  const held = hiddenIds(game, first).length;
  const parts: string[] = [];
  if (staged && TRAVEL_COSTS.has(card.code) && card.zone === "staging") {
    const amount = travelAmount(ctx, card.code) ?? 1;
    parts.push(travelWords(amount, game.seatCount, first, held, hiddenSupply(game), limited(game)));
  }
  if (card.code === CROSSROADS && staged) parts.push(crossroadsWords(game.seatCount));
  if ((card.code === WESTERN || card.code === EASTERN) && staged) parts.push(bonusWords(card.zone === "staging"));
  if (card.code === DARK_WOODS && staged) parts.push(exploredWords(game.seatCount, first, held));
  if (card.code === NUMENOREAN && staged) parts.push(numenoreanWords(holdings(game).reduce((sum, count) => sum + count, 0), holdings(game)));
  if ((card.code === FARAMIR || card.code === ALCARON) && card.zone === "play") parts.push(allyWords(game.seatCount, card.controller ?? first, card.code === FARAMIR ? FARAMIR_ACTION : ALCARON_ACTION));
  return parts.length > 0 ? parts.join(" ") : null;
}

/** The quest readout's addition while Conflict at the Crossroads' lasting effect holds: the Threat the engaged Orcs add now. Empty otherwise. */
export function bloodQuestNote(game: ScenarioState, ctx: ReduceContext): string {
  if (!live(game) || game.modifiers.length === 0 || heldAmount(game, "table", "engagedOrcThreat") <= 0) return "";
  return `; ${orcThreatWords(engagedOrcRaise(game, ctx.cards))}`;
}

/** Brutal Uruk's line on the attack sheet, or null for any other attacker. */
export function bloodAttackLine(game: ScenarioState): string | null {
  const attack = game.pendingAttack;
  if (!live(game) || !attack || game.cards[attack.enemyId]?.code !== URUK) return null;
  return urukAttackWords(game.seatCount, attack.seat, hiddenIds(game, attack.seat).length);
}

// Stage 1 holds the choice at the beginning of the combat phase.
const choosing = (game: ScenarioState): boolean => live(game) && game.questStage != null && game.cards[game.questStage]?.code === STAGE_ONE;

/** The step note of the combat start while stage 1 holds the choice, or null: the guide's 6.2 line. */
export const combatStartDecision = (game: ScenarioState, step: string): string | null => (step === "6.2" && choosing(game) ? COMBAT_START_DECISION : null);

/** The note of the window before combat while stage 1 holds the choice, or null. */
export const beforeCombatNote = (game: ScenarioState, point: string): string | null => (point === "5.3" && choosing(game) ? BEFORE_COMBAT_NOTE : null);
