// Rules: mec108.time-x, mec108.side-quests, mec108.side-quests-in-play (data/rules/entries.json); ledger lines 09023:A:1, 09024:A:1, 09024:A:3, 10158:A:3.
//
// The dials Intruders in Chetwood's pieces hold now, in the order the top bar draws them: Protect the Innocent's damage against the number that loses the game (it warms toward it), the time counters taken off Rescue Iârion
// (it warms toward the last, which discards Iârion and loses the game) and, while Orc Rearguard is in the staging area, the progress placed on the current quest this round against its cap of 3. The engine decided every number
// (`heldAmount`, `timeOf`, `questCapTally`); nothing here changes one. Empty in any other scenario. Pure, so a test reads it.
import { heldAmount, inPlay } from "../../rules/core/state.ts";
import type { ReduceContext, ScenarioState } from "../../rules/engine/reduce.ts";
import { questCapTally } from "../../rules/families/caves/progress.ts";
import { timeOf } from "../../rules/families/angmar/time.ts";
import { captiveUnder } from "../../rules/families/south/captive.ts";

import { protectNearWords, protectWords, rearguardWords, timeNearWords, timeWords } from "../words/scenarios/angmar-table.ts";
import { cardsOf, type TableDial } from "./dials.ts";

const REARGUARD = "09023";

export function angmarDials(game: ScenarioState, ctx: ReduceContext, nameOf: (code: string) => string): readonly TableDial[] {
  if (game.sideQuests !== true) return [];
  const dials: TableDial[] = [];
  // Protect the Innocent: a side quest that holds `loseAtDamage` damage tokens loses the game (10158:A:3), 10 with one or two players.
  for (const card of Object.values(game.cards)) {
    const limit = card.zone === "staging" ? heldAmount(game, card.id, "loseAtDamage") : 0;
    if (limit <= 0) continue;
    dials.push({
      id: "protect",
      testID: "angmar-protect",
      label: "Innocent",
      name: `Damage on ${nameOf(card.code)}, ${limit} loses the game:`,
      value: card.damage,
      limit,
      warms: true,
      ...(card.damage + 2 >= limit ? { warn: { level: card.damage + 1 >= limit ? ("critical" as const) : ("near" as const), words: protectNearWords(card.damage, limit) } } : {}),
      limitWords: `${limit} loses`,
      note: protectWords(card.damage, limit),
    });
  }
  // Rescue Iârion: the time counters taken off, against the X the card prints; the last discards what it holds (09024:A:3).
  for (const card of Object.values(game.cards)) {
    const total = inPlay(card.zone) ? timeOf(ctx, card.code) : null;
    if (total == null) continue;
    const held = captiveUnder(game, card.id);
    const removed = Math.max(0, total - card.resources);
    dials.push({
      id: "time",
      testID: "angmar-time",
      label: "Time",
      name: `Time counters taken off ${nameOf(card.code)}, ${total} in all:`,
      value: removed,
      limit: total,
      warms: true,
      ...(card.resources <= 2 ? { warn: { level: card.resources <= 1 ? ("critical" as const) : ("near" as const), words: timeNearWords(card.resources) } } : {}),
      limitWords: `${total} discards ${held ? nameOf(game.cards[held]?.code ?? "") : "the card under it"}`,
      note: timeWords(removed, total, held ? nameOf(game.cards[held]?.code ?? "") : null),
    });
  }
  // Orc Rearguard: no more than 3 progress on the current quest each round (09023:A:1), the tally of the round.
  const cap = cardsOf(game, REARGUARD).some((card) => card.zone === "staging") ? questCapTally(game) : null;
  if (cap) {
    dials.push({
      id: "cap",
      testID: "angmar-cap",
      label: "This round",
      name: `Progress placed on the current quest this round, ${cap.limit} allowed by ${nameOf(REARGUARD)}:`,
      value: cap.placed,
      limit: cap.limit,
      ...(cap.placed >= cap.limit ? { warn: { level: "near" as const, words: rearguardWords(cap.placed, cap.limit) } } : {}),
      limitWords: rearguardWords(cap.placed, cap.limit),
    });
  }
  return dials;
}
