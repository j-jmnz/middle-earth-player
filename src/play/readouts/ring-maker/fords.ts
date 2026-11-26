// Rules: rm.time-x, rm.grima-objective-ally (data/rules/entries.json); ledger lines 08011:B:2, 08013:B:1, 08013:B:3, 08014:A:3, 08016:A:1, 07063:B:1, 07063:B:2, 07064:B:1, 07064:B:2, 07059:B:1, 07059:B:2, 07060:B:2, 07060:B:3, 07061:B:1, 07061:B:2, 07065:B:1, 07065:B:2, 07066:B:1, 07066:B:2, 07067:B:1, 07067:B:2, 08066:B:1, 08066:B:2, 08067:B:1, 08067:B:2, 08095:B:1, 08095:B:2, 08096:B:1, 08096:B:2, 08097:B:1, 08097:B:2, 08098:B:1, 08098:B:2, 08099:B:1, 08099:B:2, 08100:B:1, 08100:B:2, 08101:B:1, 08101:B:2.
// The time dial of the quest stages of The Fords of Isen, To Catch an Orc, Into Fangorn, The Dunland Trap and Trouble in Tharbad: the counters left against the Time X the stage was given (the printed X, times the players it counted when its record says `perPlayer`, read from the flag `timePlayers`), warming as the counters the next refresh phase takes reach the counters left. The engine decided every number (`timeInstruction`, `timePlayersOf`, the counters on the card); nothing here changes one. Empty in any other scenario. Pure, so a test reads it.
import { inPlay, livingSeats } from "../../../rules/core/state.ts";
import { refreshTakes, timeInstruction, timeLimit, timePlayersOf } from "../../../rules/families/angmar/time.ts";
import type { ReduceContext, ScenarioState } from "../../../rules/engine/reduce.ts";

import { CROWN_STAGE_LABEL } from "../../words/scenarios/ring-maker/crown-table.ts";
import { ELIMINATION_DROP, LEVEL_STAGE, stageTimeLimitWords, stageTimeNearWords, stageTimeWords, timeDialWarms, type NewLevels, type TimeTakes } from "../../words/scenarios/ring-maker/fords-table.ts";
import { cardsOf, type TableDial } from "../dials.ts";
import { mouldGateWords } from "../../words/scenarios/ring-maker/celebrimbor-table.ts";
import { mouldState, STAGE_1, STAGE_2 } from "./celebrimbor.ts";
import { seatLevel } from "../threat-level.ts";

/** The quest stages of The Fords of Isen, of To Catch an Orc (stages 2B and 3B), of Into Fangorn (stages 1B, 2B and 3B) and of The Dunland Trap (stages 1B and 3B; 2B prints none) of Trouble in Tharbad (stages 1B and 2B) and of Celebrimbor's Secret (stages 1B and 2B) and of The Antlered Crown (stages 1B, 2B and 3B) and of The Nîn-in-Eilph (the three stages 2B, the three stages 3B and stage 4B) that print Time X. */
export const FORDS_STAGES: readonly string[] = ["07059", "07060", "07061", "07063", "07064", "07065", "07066", "07067", "08011", "08013", "08066", "08067", "08095", "08096", "08097", "08098", "08099", "08100", "08101", "08122", "08123", "08147", "08148", "08149"];

/** The three stages of The Antlered Crown: its dial says "Stage", as the location dials say their own names. */
const CROWN_STAGES: readonly string[] = ["08147", "08148", "08149"];

const TURCH = "08014";
const NO_WAY_OUT = "08013";

/** The threat elimination level of each living seat once a stage that lowers it by 10 (08066:B:2) has done so, as the engine reads each seat's level now. */
export const newLevels = (game: ScenarioState): NewLevels => livingSeats(game).map((seat) => ({ seat, level: seatLevel(game, seat) - ELIMINATION_DROP }));

/** What the next refresh phase takes from this time stage, and whether Chief Turch makes an engagement take one more (stage 3B of The Dunland Trap). */
export function timeTakes(game: ScenarioState, ctx: ReduceContext, code: string): TimeTakes {
  // The count comes from the records in play (refreshTakes: Old South Road 08016, Off Track 07057), not from card codes.
  return { takes: refreshTakes(game, ctx), engages: code === NO_WAY_OUT && Object.values(game.cards).some((card) => inPlay(card.zone) && card.code === TURCH), ...(code === LEVEL_STAGE ? { levels: newLevels(game) } : {}) };
}

/** The stage gate of Celebrimbor's Secret (08122:B:4, 08123:B:4) as a sentence for the stage's dial: progress is held until a hero holds the Mould. Empty on any other stage. */
const mouldGate = (game: ScenarioState, ctx: ReduceContext, code: string): string[] => (code === STAGE_1 || code === STAGE_2 ? [mouldGateWords(code === STAGE_1 ? 1 : 2, mouldState(game, ctx)?.where === "hero")] : []);

export function ringMakerDials(game: ScenarioState, ctx: ReduceContext, nameOf: (code: string) => string): readonly TableDial[] {
  const dials: TableDial[] = [];
  for (const code of FORDS_STAGES) {
    const time = timeInstruction(ctx, code);
    const printed = timeLimit(game, ctx, code);
    if (time == null || printed == null) continue;
    const facts = timeTakes(game, ctx, code);
    for (const card of cardsOf(game, code)) {
      // A stage that counted the players when it turned keeps that count if a player leaves later (the flag timePlayers).
      const counted = time.perPlayer === true ? (timePlayersOf(game, card.id) ?? livingSeats(game).length) : null;
      const limit = Math.max(counted != null ? time.amount * counted : printed, card.resources);
      // Only stage 1B's last counter is a loss; the other two return counters, so their dials warm near and are never critical.
      const level = card.resources <= 1 && code === "07059" ? ("critical" as const) : ("near" as const);
      const warms = timeDialWarms(code, card.resources, facts.takes);
      dials.push({
        id: `time:${card.id}`,
        testID: `ring-maker-time:${card.id}`,
        label: CROWN_STAGES.includes(code) ? CROWN_STAGE_LABEL : "Time",
        name: `Time counters left on ${nameOf(card.code)}:`,
        value: card.resources,
        cardId: card.id,
        limit,
        limitWords: stageTimeLimitWords(limit, counted != null ? { amount: time.amount, players: counted } : undefined),
        ...(warms ? { warn: { level, words: stageTimeNearWords(code, card.resources, facts) } } : {}),
        note: [stageTimeWords(code, card.resources, facts), ...mouldGate(game, ctx, code)].join(" "),
      });
    }
  }
  return dials;
}

/** Gríma's code. */
export const GRIMA = "07016";

/** The ids of Gríma lying on this card (The Islet, 07059:A:1): attached to it and controlled by no player. The card's pill says "1 held". Empty for any other card and in every other game. */
export function grimaLyingOn(game: ScenarioState, hostId: string): readonly string[] {
  const host = game.cards[hostId];
  return host == null || host.attachments.length === 0 ? [] : host.attachments.filter((id) => game.cards[id]?.code === GRIMA && game.cards[id]?.controller == null);
}
