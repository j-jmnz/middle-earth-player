// Rules: mec113.setup-the-tower-of-cirith-ungol, mec113.the-one-ring, mec113.multiplayer-the-one-ring, rr.travel, rr.quest-advancement (data/rules/entries.json); ledger lines 146014:A:1, 146015:A:2, 146068:B:1, 146070:A:2
//
// The pieces of The Tower of Cirith Ungol's table (docs/design-system-table.md, Cards, The Tower of Cirith Ungol): the progress on stage 2B against the 18 that lets the players travel to Topmost Chamber and on stage 3B against the 12 that lets them travel to
// The Two Watchers, the Watchers' X on its location side, and the seat whose hero carries Last of the Company. The engine decided every number (`stageProgress`, the Threat modifier, the card's host); nothing here changes one. Pure, so a test reads it.
import { modifiedStat } from "../../rules/core/keywords.ts";
import type { ReduceContext, ScenarioState } from "../../rules/engine/reduce.ts";
import { stageNumber } from "../../rules/families/caves/progress.ts";

import { chamberWords, companyLabel, companyWords, watchersEnemyWords, watchersTravelWords, watchersXWords, type GuardedBoon } from "../words/scenarios/ungol.ts";
import { ownerWords } from "../words/owner.ts";
import { cardsOf, type TableDial } from "./dials.ts";
import type { HandMark } from "./isengard.ts";

const SCENARIO = "the-tower-of-cirith-ungol";
const CHAMBER = "146015";
const LAST_OF_THE_COMPANY = "146014";
const WATCHERS_LOCATION = "146070";
const WATCHERS_ENEMY = "146071";
const SHAGRAT = "146020";
const STAGE_ONE = "146066";
const STAGE_TWO = "146067";
const STAGE_THREE = "146068";
// The progress each stage needs before the players may travel (146015:A:2, 146068:B:1).
export const CHAMBER_PROGRESS = 18;
export const WATCHERS_PROGRESS = 12;

/**
 * The dials The Tower of Cirith Ungol's pieces hold now, in the order the top bar draws them. None warms toward a loss, so the one that is the players' way forward comes first: the progress on stage 2B toward 18 while Topmost Chamber is still to be
 * explored (not once it is the active location: exploring it, not progress on the stage, is what remains), or on stage 3B toward 12 while The Two Watchers' location is in the staging area (goal dials: the ring fills in the accent), then X, the Watchers' Threat, while its location
 * side is in play, or the hit points left of The Two Watchers' enemy side while it is in play on stage 1B or 3B (defeating it is the way forward; its ring fills with its damage and is never full). Empty in any other scenario.
 */
export function ungolDials(game: ScenarioState, ctx: ReduceContext, nameOf: (code: string) => string): readonly TableDial[] {
  if (game.scenarioId !== SCENARIO) return [];
  const dials: TableDial[] = [];
  const stage = game.questStage ? game.cards[game.questStage] : undefined;
  if (stage?.code === STAGE_TWO && cardsOf(game, CHAMBER).some((card) => card.id !== game.activeLocation)) {
    dials.push({ id: "chamber", testID: "ungol-chamber", label: "Chamber", name: `Progress on ${nameOf(STAGE_TWO)}, ${CHAMBER_PROGRESS} lets the players travel to ${nameOf(CHAMBER)}:`, value: stage.progress, limit: CHAMBER_PROGRESS, goal: true, limitWords: chamberWords(stage.progress, CHAMBER_PROGRESS, nameOf(STAGE_TWO)) });
  }
  const watchers = cardsOf(game, WATCHERS_LOCATION)[0];
  if (stage?.code === STAGE_THREE && watchers) {
    dials.push({ id: "watchers", testID: "ungol-watchers", label: "Gate", name: `Progress on ${nameOf(STAGE_THREE)}, ${WATCHERS_PROGRESS} lets the players travel to ${nameOf(WATCHERS_LOCATION)}:`, value: stage.progress, limit: WATCHERS_PROGRESS, goal: true, limitWords: watchersTravelWords(stage.progress, WATCHERS_PROGRESS, nameOf(STAGE_THREE), guardedBoons(game, (card) => nameOf(card.code))) });
  }
  if (watchers) {
    const x = modifiedStat(game, watchers, "threat", ctx.cards);
    dials.push({ id: "x", testID: "ungol-x", label: "X", name: `${nameOf(WATCHERS_LOCATION)}, X, its Threat:`, value: x, note: watchersXWords(x, stageNumber(game)) });
  }
  const enemy = cardsOf(game, WATCHERS_ENEMY)[0];
  if (enemy && stage && (stage.code === STAGE_ONE || stage.code === STAGE_THREE)) {
    const hitPoints = modifiedStat(game, enemy, "hitPoints", ctx.cards);
    dials.push({ id: "watchers-enemy", testID: "ungol-watchers-enemy", label: "Watchers \u00b7 HP", name: `${nameOf(WATCHERS_ENEMY)}'s hit points left`, value: Math.max(0, hitPoints - enemy.damage), limit: hitPoints, filled: Math.min(hitPoints, enemy.damage), goal: true, limitWords: watchersEnemyWords(nameOf(stage.code), stage.code === STAGE_THREE) });
  }
  return dials;
}

/** The boons Shagrat guards, each with its name and its owner's words in a list ("yours", "Player 2's"): the Gate's travel words and Shagrat's preview say them. Empty while he guards none or is not in the game. */
export function guardedBoons(game: ScenarioState, nameOf: (card: ScenarioState["cards"][string]) => string): readonly GuardedBoon[] {
  const shagrat = cardsOf(game, SHAGRAT)[0];
  if (!shagrat) return [];
  return Object.values(game.cards).filter((card) => card.held === true && card.host === shagrat.id).map((card) => ({ name: nameOf(card), owner: ownerWords(game.seatCount, card.owner, true) }));
}

/** The mark of the seat whose hero carries Last of the Company ("Company", "P2 · Company" two-handed). Empty once Last of the Company has left its hero and in any other scenario. */
export function ungolHands(game: ScenarioState, ctx: ReduceContext): readonly HandMark[] {
  if (game.scenarioId !== SCENARIO) return [];
  return cardsOf(game, LAST_OF_THE_COMPANY).flatMap((card) => {
    const hero = card.host ? game.cards[card.host] : undefined;
    return hero?.controller == null ? [] : [{ seat: hero.controller, label: companyLabel(game.seatCount > 1 ? hero.controller : null), note: companyWords(ctx.cards.get(hero.code)?.name ?? hero.code) }];
  });
}
