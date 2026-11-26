// Rules: rm.current-trial, rm.time-x, rr.objective-cards, rr.attachment-cards, rr.engaged (data/rules/entries.json); ledger lines 08036:B:2, 08037:B:2, 08038:B:2, 08039:A:1, 08040:A:2, 08041:A:2, 08042:A:2, 08043:A:1.
// What the table reads of The Three Trials: the current trial's Key as a top-bar dial (who controls it, or where it lies), each Guardian's time counters against its Time X (warming at the last counter), the Guardians in the victory display that stage 3A reveals again, and the Keys lying on a card. The engine decided every fact (`trialKeyControlled`, the counters on the card, the zones); nothing here changes one. Empty in any other scenario. Pure, so a test reads it.
import type { CardInstance, ScenarioState } from "../../../rules/core/state.ts";
import { refreshTakes, timeLimit } from "../../../rules/families/angmar/time.ts";
import { currentTrialKey, trialKeyControlled } from "../../../rules/families/ring-maker/trial-sweeps.ts";
import type { ReduceContext } from "../../../rules/engine/reduce.ts";

import { guardianLimitWords, guardianTimeLead, guardianTimeRest, guardianTimeWords, keyWords, trialAnimal, trialKeyName, TRIAL_KEY_LABEL, victoryGuardianWords, type KeyPlace } from "../../words/scenarios/ring-maker/trials-table.ts";
import { cardsOf, type TableDial } from "../dials.ts";

const SCENARIO = "the-three-trials";
/** Boar's, Wolf's and Raven's Guardian. */
export const GUARDIANS: readonly string[] = ["08040", "08041", "08042"];
/** Key of the Boar, the Wolf and the Raven. */
export const KEYS: readonly string[] = ["08043", "08044", "08045"];
/** Hallowed Circle. */
export const HALLOWED_CIRCLE = "08049";

/** A seat as words: "Player 2" with several players, "you" alone, null for none. */
export const seatWords = (game: ScenarioState, seat: number | null | undefined): string | null => (seat == null ? null : game.seatCount > 1 ? `Player ${seat + 1}` : "you");

/** The Key the stage in play marked as the current trial's (`trialKey`, set by the stage's 2A), or null: before a trial, at stage 3 and in any other scenario. */
export function currentKey(game: ScenarioState): CardInstance | null {
  return game.scenarioId === SCENARIO ? currentTrialKey(game) : null;
}

/** Where a Key lies: attached to a hero (a player controls it), attached to another card, or in a pile. */
export function keyPlace(game: ScenarioState, key: CardInstance, nameOf: (id: string) => string): KeyPlace {
  const host = key.zone === "attached" && key.host != null ? game.cards[key.host] : undefined;
  if (host) return host.zone === "heroes" ? { zone: "attached", host: nameOf(host.id), holder: seatWords(game, host.controller) } : { zone: "attached", host: nameOf(host.id) };
  return { zone: key.zone === "staging" || key.zone === "encounterDeck" || key.zone === "encounterDiscard" ? key.zone : "other" };
}

/** The ids of the Keys lying on this card: a Guardian or Barrow the stage attached one to, or a hero that claimed one. Empty for any other card and in every other game. The card's pill names them. */
export function keysLyingOn(game: ScenarioState, hostId: string): readonly string[] {
  const host = game.cards[hostId];
  return host == null || host.attachments.length === 0 ? [] : host.attachments.filter((id) => KEYS.includes(game.cards[id]?.code ?? ""));
}

/** The Guardians in the victory display, by id: stage 3A reveals each again (08039:A:1). */
export const guardiansInVictory = (game: ScenarioState): readonly string[] => Object.values(game.cards).filter((card) => card.zone === "victory" && GUARDIANS.includes(card.code)).map((card) => card.id);

/** The engaged player of a Guardian as words ("Player 2", "you"), or null while it lies in the staging area. */
const guardianEngagedWords = (game: ScenarioState, card: CardInstance): string | null => (card.zone === "engaged" ? seatWords(game, card.controller) : null);

/** The sentence a Guardian's card preview says of its time counters (the dial's note): its counters, what the refresh phase takes and what the last does. Null for a card that is not a Guardian with Time X. */
export function guardianWords(game: ScenarioState, ctx: ReduceContext, card: CardInstance): string | null {
  const limit = GUARDIANS.includes(card.code) ? timeLimit(game, ctx, card.code) : null;
  return limit == null ? null : guardianTimeWords(card.code, card.resources, limit, refreshTakes(game, ctx), guardianEngagedWords(game, card));
}

export function trialDials(game: ScenarioState, ctx: ReduceContext, nameOf: (code: string) => string): readonly TableDial[] {
  if (game.scenarioId !== SCENARIO) return [];
  const dials: TableDial[] = [];
  const key = currentKey(game);
  const stage = game.questStage ? game.cards[game.questStage] : undefined;
  const nameId = (id: string) => nameOf(game.cards[id]?.code ?? id);
  if (key && stage) {
    dials.push({
      id: "trial-key",
      testID: "ring-maker-trial-key",
      label: TRIAL_KEY_LABEL,
      name: trialKeyName(nameOf(stage.code)),
      value: trialKeyControlled(game, ctx) ? 1 : 0,
      limit: 1,
      goal: true,
      cardId: key.id,
      note: keyWords(nameOf(key.code), keyPlace(game, key, nameId)),
    });
  }
  const takes = refreshTakes(game, ctx);
  // The dials of the Guardians, the fewest counters first: the one nearest its last counter stands first in the row, where a row that scrolls shows it.
  const guardians = GUARDIANS.flatMap((code) => cardsOf(game, code).map((card) => ({ code, card, limit: timeLimit(game, ctx, code) }))).sort((a, b) => a.card.resources - b.card.resources);
  for (const { code, card, limit } of guardians) {
    if (limit == null) continue;
    const engaged = guardianEngagedWords(game, card);
    // The dial warms only while a player is engaged: the last counter then hits him; in the staging area it does nothing (08040:A:2 to 08042:A:2).
    const warm = engaged != null && card.resources <= Math.max(takes, 1);
    dials.push({
      id: `trial-time:${card.id}`,
      testID: `ring-maker-trial-time:${card.id}`,
      label: trialAnimal(code) ?? "Time",
      name: `Time counters left on ${nameOf(card.code)}:`,
      value: card.resources,
      cardId: card.id,
      limit: Math.max(limit, card.resources),
      limitWords: guardianLimitWords(limit),
      // The warning says the lead sentence, the note the rest: a screen reader hears each once.
      ...(warm ? { warn: { level: "near" as const, words: guardianTimeLead(card.resources, takes) } } : {}),
      note: warm ? guardianTimeRest(code, limit, engaged) : guardianTimeWords(code, card.resources, limit, takes, engaged),
    });
  }
  const away = guardiansInVictory(game);
  if (away.length > 0) dials.push({ id: "trial-victory", testID: "ring-maker-trial-victory", label: "Victory", name: "Guardians in the victory display", value: away.length, pile: "victory", note: victoryGuardianWords(away.map(nameId)) });
  return dials;
}
