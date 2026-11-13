// Rules: mec108.reanimated-dead, mec108.indestructible, rr.winning-the-game (data/rules/entries.json); ledger lines 10152:B:3, 10153:A:2, 10153:A:3, 101161:A:1.
//
// The pieces The Dread Realm's cards hold on the table: on stage 2B the Sorcery cards in play against Daechanar's guard (a count: each one cancels the damage dealt to him once), on stage 3 the locations in play against the 0 at which the players win at the end of the quest phase, and a seat's Reanimated Dead.
// The engine decided every number (`countMatching`, `modifiedStat`); nothing here changes one. Empty in any other scenario. Pure, so a test reads it.
import { A_FELL_DREAD, DAECHANAR, ESCAPE_FROM_CARN_DUM, LOCATIONS_IN_PLAY, SORCERY_IN_PLAY } from "../../effects/authored/angmar-awakened/the-dread-realm.ts";
import { modifiedStat } from "../../rules/core/keywords.ts";
import { isReanimatedCode, printedOf, type PrintedCard } from "../../rules/core/printed.ts";
import { inPlay, livingSeats, type ScenarioState } from "../../rules/core/state.ts";
import type { ReduceContext } from "../../rules/engine/reduce.ts";
import { countMatching } from "../../rules/interpret/pick.ts";
import { stageOf } from "../../rules/families/breaking/areas.ts";

import { deadLabel, deadSeatWords, escapeNear, escapeNote, ESCAPE_DIAL_NAME, SORCERY_DIAL_NAME, sorceryNote, type DeadStats } from "../words/scenarios/angmar/dread-realm-table.ts";
import type { TableDial } from "./dials.ts";
import type { HandMark } from "./isengard.ts";

export const DAECHANAR_CODE = DAECHANAR;
export const FELL_DREAD = A_FELL_DREAD;
const UNHOLY_CRYPT = "101161";

/** The Sorcery cards in play now, as the records count them (faceup cards with the trait, attachments included; a facedown shadow card is not in play). */
export const sorceryInPlay = (game: ScenarioState, ctx: ReduceContext, sourceId: string | null = null): number => countMatching(game, SORCERY_IN_PLAY, 0, sourceId, ctx);

/** The locations in play: the staging area and the active location (a location is no player's, so the count is of every card with the type). */
export const locationsInPlay = (game: ScenarioState, ctx: ReduceContext): number => countMatching(game, LOCATIONS_IN_PLAY, 0, null, ctx);

/** Daechanar in play (staging or engaged), or undefined. */
export const daechanarNow = (game: ScenarioState) => Object.values(game.cards).find((card) => card.code === DAECHANAR && inPlay(card.zone));

/** What the engine reads for a Reanimated Dead now: the derived printed numbers with every modifier (a Dark Halls in the staging area, a Possession's host). */
export function deadStats(game: ScenarioState, cards: ReadonlyMap<string, PrintedCard>, cardId: string): DeadStats | null {
  const card = game.cards[cardId];
  if (!card || !isReanimatedCode(card.code)) return null;
  return {
    engagementCost: modifiedStat(game, card, "engagementCost", cards),
    threat: modifiedStat(game, card, "threat", cards),
    attack: modifiedStat(game, card, "attack", cards),
    defense: modifiedStat(game, card, "defense", cards),
    hitPoints: modifiedStat(game, card, "hitPoints", cards),
    damage: card.damage,
  };
}

/** The characters (heroes and allies in play) that 1 more damage destroys: stage 3's damage at the end of the quest phase is dealt to each of them. */
function nearDestroyed(game: ScenarioState, ctx: ReduceContext, nameOf: (code: string) => string): string[] {
  return Object.values(game.cards)
    .filter((card) => (card.zone === "heroes" || card.zone === "play") && ["hero", "ally"].includes(printedOf(ctx.cards, card.code).type) && modifiedStat(game, card, "hitPoints", ctx.cards) - card.damage <= 1)
    .map((card) => nameOf(card.code));
}

export function realmDials(game: ScenarioState, ctx: ReduceContext, nameOf: (code: string) => string): readonly TableDial[] {
  const stageId = stageOf(game, 0);
  const stage = stageId ? game.cards[stageId] : undefined;
  const dials: TableDial[] = [];
  // Stage 2B: the Sorcery cards in play, while Daechanar is. His record cancels the damage dealt to him while one is in play and removes one each time, so the count is how many hits are wasted (the players' way on is to run them down).
  if (daechanarNow(game)) {
    const sorcery = sorceryInPlay(game, ctx);
    dials.push({ id: "sorcery", testID: "angmar-sorcery", label: "Sorcery", name: SORCERY_DIAL_NAME, value: sorcery, note: sorceryNote(sorcery) });
  }
  // Stage 3: the locations in play against 0, the players' way out. While any is in play every character takes 1 damage at the end of the quest phase, so the dial warns when that damage would destroy someone.
  if (stage?.code === ESCAPE_FROM_CARN_DUM) {
    const locations = locationsInPlay(game, ctx);
    const doomed = locations > 0 ? nearDestroyed(game, ctx, nameOf) : [];
    dials.push({ id: "escape", testID: "angmar-escape", label: "Locations", name: ESCAPE_DIAL_NAME, value: locations, note: escapeNote(locations), ...(doomed.length > 0 ? { warn: { level: "near" as const, words: escapeNear(doomed) } } : {}) });
  }
  return dials;
}

/** Each seat's Reanimated Dead, engaged with it; the dead in the staging area are no seat's to hold and are counted by their previews. */
export function realmHands(game: ScenarioState): readonly HandMark[] {
  const marks: HandMark[] = [];
  const crypts = Object.values(game.cards).filter((card) => card.code === UNHOLY_CRYPT && card.zone === "staging").length;
  for (const seat of livingSeats(game)) {
    const count = (game.seats[seat]?.engaged ?? []).filter((id) => game.cards[id] != null && isReanimatedCode(game.cards[id].code)).length;
    if (count > 0) marks.push({ seat, label: deadLabel(game.seatCount > 1 ? seat : null), note: deadSeatWords(count, true, crypts) });
  }
  return marks;
}
