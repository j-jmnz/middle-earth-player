// Rules: mec108.day-and-night, mec108.campaign-log, mec108.side-quests-in-play (data/rules/entries.json); ledger lines 10011:A:1, 10012:A:1, 10015:B:1, 10015:B:3, 100158:A:2, 10173:A:2.
//
// The pieces The Wastes of Eriador's cards hold on the table: the Day and Night dial (which side of the Time objective is up, what it does and that it flips at the end of the round), Pack Leader's gate (the progress on stage 3B against the 5 that let him take damage, a goal dial:
// it is the players' way out), the damage still on Arnor Ravaged, and the seat mark of Fend Off Despair's lowered starting threat. The engine decided every number (`timeObjective`, `stageOf`, `startingThreat`); nothing here changes one. Empty in any other scenario. Pure, so a test reads it.
import { livingSeats } from "../../rules/core/state.ts";
import type { ScenarioState } from "../../rules/engine/reduce.ts";
import { DAYBREAK, timeObjective } from "../../rules/families/angmar/day-night.ts";
import { stageOf } from "../../rules/families/breaking/areas.ts";

import { TIME_NAME, gateLimitWords, gateWords, ravagedWords, startMarkLabel, startMarkWords, timeWord, timeWords } from "../words/scenarios/wastes-table.ts";
import { cardsOf, type TableDial } from "./dials.ts";
import type { HandMark } from "./isengard.ts";

export const PACK_LEADER = "10017";
export const PACK_LEADER_STAGE = "10015";
export const ARNOR_RAVAGED = "100158";
export const FEND_OFF_DESPAIR = "10173";
/** The progress on stage 3B that lets Pack Leader take damage (10015:B:1). */
export const GATE = 5;

/** Pack Leader's gate: the current stage's code and progress while stage 3B is current and Pack Leader is in play, else null (10015:B:1). The one test the dial and the previews share. */
export function packLeaderGate(game: ScenarioState): { code: string; progress: number } | null {
  const stageId = stageOf(game, 0);
  const stage = stageId ? game.cards[stageId] : undefined;
  return stage?.code === PACK_LEADER_STAGE && cardsOf(game, PACK_LEADER).length > 0 ? { code: stage.code, progress: stage.progress } : null;
}

export function wastesDials(game: ScenarioState, nameOf: (code: string) => string): readonly TableDial[] {
  const dials: TableDial[] = [];
  // Day and Night: the Time objective's faceup side, drawn as the word in the disc (no number).
  const time = timeObjective(game);
  if (time) {
    const day = time.code === DAYBREAK;
    dials.push({ id: "daynight", testID: "angmar-daynight", label: "Time", name: TIME_NAME, value: day ? 1 : 0, word: timeWord(day), note: timeWords(day) });
  }
  // Pack Leader's gate: while stage 3B is current and he is in play, the progress on it against the 5 that let him take damage. A goal dial: it fills in the accent and never warms.
  const gate = packLeaderGate(game);
  if (gate) {
    dials.push({
      id: "gate",
      testID: "angmar-gate",
      label: "Gate",
      name: `Progress on ${nameOf(gate.code)}:`,
      value: gate.progress,
      limit: GATE,
      goal: true,
      limitWords: gateLimitWords(GATE),
      note: gateWords(gate.progress, GATE),
    });
  }
  // Arnor Ravaged: the damage still on it. It prints no limit, so the dial has no ring to fill and never warms.
  for (const card of cardsOf(game, ARNOR_RAVAGED)) {
    if (card.zone !== "staging") continue;
    dials.push({ id: "ravaged", testID: "angmar-ravaged", label: "Ravaged", name: `Damage on ${nameOf(card.code)}:`, value: card.damage, note: ravagedWords(card.damage) });
  }
  return dials;
}

/** Each living seat's mark once Fend Off Despair has been defeated in this game: the starting threat the Campaign Log will lower if the scenario is won. Empty before, and in any other scenario. */
export function wastesHands(game: ScenarioState): readonly HandMark[] {
  const amount = -(game.resolutionLog.startingThreat ?? 0);
  if (amount <= 0) return [];
  return livingSeats(game).map((seat) => ({ seat, label: startMarkLabel(game.seatCount > 1 ? seat : null, amount), note: startMarkWords(amount) }));
}
