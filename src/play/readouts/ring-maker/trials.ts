// Rules: rm.current-trial, rm.time-x, rr.objective-cards, rr.attachment-cards, rr.engaged (data/rules/entries.json); ledger lines 08036:B:2, 08037:B:2, 08038:B:2, 08039:A:1, 08040:A:2, 08041:A:2, 08042:A:2, 08043:A:1.
// What the table reads of The Three Trials: the current trial's Key as a top-bar dial (who controls it, or where it lies), each Guardian's time counters against its Time X (warming at the last counter), the Guardians in the victory display that stage 3A reveals again, and the Keys lying on a card. The engine decided every fact (`trialKeyControlled`, the counters on the card, the zones); nothing here changes one. Empty in any other scenario. Pure, so a test reads it.
import type { CardInstance, ScenarioState } from "../../../rules/core/state.ts";
import { refreshTakes, timeLimit } from "../../../rules/families/angmar/time.ts";
import { trialKeyControlled } from "../../../rules/families/ring-maker/trial-sweeps.ts";
import type { ReduceContext } from "../../../rules/engine/reduce.ts";

import { guardianLimitWords, guardianTimeWords, keyWords, trialKeyName, TRIAL_KEY_LABEL, victoryGuardianWords, type KeyPlace } from "../../words/scenarios/ring-maker/trials-table.ts";
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
  if (game.scenarioId !== SCENARIO || game.questStage == null) return null;
  const mark = game.modifiers.find((modifier) => modifier.stat === "trialKey" && modifier.sourceId === game.questStage);
  return mark ? (game.cards[mark.instanceId] ?? null) : null;
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
  for (const code of GUARDIANS) {
    const limit = timeLimit(game, ctx, code);
    if (limit == null) continue;
    for (const card of cardsOf(game, code)) {
      const words = guardianTimeWords(code, card.resources, limit, takes, card.zone === "engaged" ? seatWords(game, card.controller) : null);
      dials.push({
        id: `trial-time:${card.id}`,
        testID: `ring-maker-trial-time:${card.id}`,
        label: "Time",
        name: `Time counters left on ${nameOf(card.code)}:`,
        value: card.resources,
        cardId: card.id,
        limit: Math.max(limit, card.resources),
        limitWords: guardianLimitWords(limit),
        // The last counter hits the engaged player (08040:A:2 to 08042:A:2), so the dial warms when the next refresh phase takes it.
        ...(card.resources <= Math.max(takes, 1) ? { warn: { level: "near" as const, words } } : {}),
        note: words,
      });
    }
  }
  const away = guardiansInVictory(game);
  if (away.length > 0) dials.push({ id: "trial-victory", testID: "ring-maker-trial-victory", label: "Victory", name: "Guardians in the victory display", value: away.length, pile: "victory", note: victoryGuardianWords(away.map(nameId)) });
  return dials;
}
