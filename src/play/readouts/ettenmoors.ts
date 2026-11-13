// Rules: mec108.safe, mec108.objective-locations, mec108.campaign-setup-across-the-ettenmoors (data/rules/entries.json); ledger lines 10068:A:1, 10069:A:1, 10070:A:1, 10071:A:1, 10080:A:1, 10182:A:2, 10182:A:3.
//
// The pieces Across the Ettenmoors' cards hold on the table: the Losing Time clock on the campaign card (its resources against the 3 that reveal a copy, and how many copies are still set aside) as a top-bar dial, the safe location that is the active location, and the guard of a guarded safe
// location. The engine decided every number (`resources` on the campaign card, the cards set aside); nothing here changes one. Empty in any other scenario. Pure, so a test reads it.
import { flagged, type CardInstance, type ScenarioState } from "../../rules/core/state.ts";
import type { ReduceContext } from "../../rules/engine/reduce.ts";
import { isSafeLocation } from "../../rules/families/angmar/safe.ts";
import { printedOf } from "../../rules/core/printed.ts";

import { ignoredRevealWords, LOSING_TIME_AT, losingTimeNearWords, losingTimeWords } from "../words/scenarios/ettenmoors-table.ts";
import type { TableDial } from "./dials.ts";

export const ETTENMOORS_CAMPAIGN = "10182";
export const LOSING_TIME = "10183";
export const NO_REST = "10080";

/** The campaign card, when it is in the game (a campaign game: a standalone game deals none, so it has no clock). */
export const ettenmoorsCampaignCard = (game: ScenarioState): CardInstance | undefined => Object.values(game.cards).find((card) => card.code === ETTENMOORS_CAMPAIGN && card.zone === "campaign");

/** The copies of Losing Time the campaign card still holds out of play. */
export const losingTimeSetAside = (game: ScenarioState): number => game.setAside.filter((id) => game.cards[id]?.code === LOSING_TIME).length;

/** The Losing Time dial: the campaign card's resources against 3. It warms at 2 resources while a copy is set aside, since the next quest phase then reveals one; with none set aside it never warns and its words say nothing more is revealed. Empty with no campaign card. */
export function ettenmoorsDials(game: ScenarioState, nameOf: (code: string) => string): readonly TableDial[] {
  const card = ettenmoorsCampaignCard(game);
  if (!card) return [];
  const setAside = losingTimeSetAside(game);
  return [{
    id: "losing",
    testID: "angmar-losing",
    label: "Losing Time",
    name: `Resources on ${nameOf(card.code)}, a Losing Time is revealed at ${LOSING_TIME_AT}:`,
    value: card.resources,
    limit: LOSING_TIME_AT,
    warms: true,
    ...(setAside > 0 && card.resources >= LOSING_TIME_AT - 1 ? { warn: { level: "near" as const, words: losingTimeNearWords(setAside) } } : {}),
    limitWords: setAside > 0 ? `${LOSING_TIME_AT} reveals one` : "no copy is set aside",
    note: losingTimeWords(card.resources, setAside),
  }];
}

/** The safe location that is the active location now, or undefined. */
export function activeSafeLocation(game: ScenarioState, ctx: ReduceContext): CardInstance | undefined {
  const id = game.activeLocation;
  return id != null && isSafeLocation(game, id, ctx) ? game.cards[id] : undefined;
}

/** The encounter card guarding an objective-location, or undefined: a card attached to it with the guard mark. */
export function guardOf(game: ScenarioState, cardId: string): CardInstance | undefined {
  const attachments = game.cards[cardId]?.attachments ?? [];
  const id = attachments.find((attached) => game.cards[attached]?.guard === true);
  return id ? game.cards[id] : undefined;
}

/** The objective a card guards, or undefined. */
export function guardedBy(game: ScenarioState, cardId: string): CardInstance | undefined {
  const card = game.cards[cardId];
  const host = card?.guard === true && card.host != null ? game.cards[card.host] : undefined;
  return host;
}

/** Whether the card is an encounter side quest. */
export const isEncounterSideQuest = (game: ScenarioState, ctx: ReduceContext, cardId: string): boolean => {
  const code = game.cards[cardId]?.code;
  return code != null && printedOf(ctx.cards, code).type === "encounter-side-quest";
};

/** The banner line of a treachery revealed while a safe location is the active location (its When Revealed effects are ignored), or null. `after` is the game after the reveal: a treachery lies in the encounter discard pile then. */
export function ignoredRevealNote(after: ScenarioState, cardId: string, name: (id: string) => string): string | null {
  if (after.activeLocation == null || after.cards[cardId]?.zone !== "encounterDiscard" || !flagged(after, "table", "treacheryRevealIgnored")) return null;
  return ignoredRevealWords(name(cardId), name(after.activeLocation));
}
