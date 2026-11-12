// Rules: mec108.time-x, mec108.side-quests, mec108.side-quests-in-play (data/rules/entries.json); ledger lines 09023:A:1, 09024:A:1, 09024:A:3, 10158:A:3.
//
// The dials Intruders in Chetwood's pieces hold now, in the order the top bar draws them: Protect the Innocent's damage against the number that loses the game (it warms toward it), the time counters taken off Rescue Iârion
// (it warms toward the last, which discards Iârion and loses the game) and, while Orc Rearguard is in the staging area, the progress placed on the current quest this round against its cap of 3. The engine decided every number
// (`heldAmount`, `timeOf`, `questCapTally`); nothing here changes one. Empty in any other scenario. Pure, so a test reads it.
import { heldAmount, inPlay } from "../../rules/core/state.ts";
import { frameScope, resolveAmount } from "../../rules/interpret/amounts.ts";
import type { ReduceContext, ScenarioState } from "../../rules/engine/reduce.ts";
import { questCapTally } from "../../rules/families/caves/progress.ts";
import { timeOf } from "../../rules/families/angmar/time.ts";
import { cardsUnder } from "../../rules/core/zones.ts";
import { captiveUnder } from "../../rules/families/south/captive.ts";

import { handUnderLabel, handUnderWords, huntNearWords, huntWords, iarionLabel, iarionWords, protectNearWords, protectWords, savageNearWords, savageWords, rearguardLimitWords, rearguardWords, timeNearWords, timeWords } from "../words/scenarios/angmar-table.ts";
import { cardsOf, type TableDial } from "./dials.ts";
import type { HandMark } from "./isengard.ts";

const REARGUARD = "09023";
const HUNTING_THE_ORCS = "09071";
const SAVAGE_COUNTER_ATTACK = "09072";
/** The number of resource tokens at which Hunting the Orcs flips: 3 more than the players (09071:A:1), read as the record reads it. */
export const huntLimit = (game: ScenarioState, ctx: ReduceContext, sourceId: string): number => resolveAmount(game, { players: true, plus: 3 }, frameScope(game, 0, sourceId), ctx);

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
      name: `Damage on ${nameOf(card.code)}:`,
      value: card.damage,
      limit,
      warms: true,
      ...(card.damage + 2 >= limit ? { warn: { level: card.damage + 1 >= limit ? ("critical" as const) : ("near" as const), words: protectNearWords(card.damage, limit) } } : {}),
      limitWords: `${limit} loses the game`,
      note: protectWords(card.damage, limit),
    });
  }
  // Hunting the Orcs: its tokens against the number at which it flips (09071:A:1), warming toward it. Savage Counter-attack: its tokens, a countdown to the loss at 0 (09072:A:3), warming as it falls to 2 and critical at 1.
  for (const card of cardsOf(game, HUNTING_THE_ORCS)) {
    const limit = huntLimit(game, ctx, card.id);
    dials.push({
      id: "hunt",
      testID: "angmar-hunt",
      label: "Hunted",
      name: `Resource tokens on ${nameOf(card.code)}, it flips at ${limit}:`,
      value: card.resources,
      limit,
      warms: true,
      ...(card.resources + 2 >= limit ? { warn: { level: card.resources + 1 >= limit ? ("critical" as const) : ("near" as const), words: huntNearWords(card.resources, limit) } } : {}),
      limitWords: `${limit} flips it`,
      note: huntWords(card.resources, limit),
    });
  }
  for (const card of cardsOf(game, SAVAGE_COUNTER_ATTACK)) {
    dials.push({
      id: "savage",
      testID: "angmar-savage",
      label: "Counter",
      name: `Resource tokens on ${nameOf(card.code)}, the players lose at 0:`,
      value: card.resources,
      ...(card.resources <= 2 ? { warn: { level: card.resources <= 1 ? ("critical" as const) : ("near" as const), words: savageNearWords(card.resources) } } : {}),
      note: savageWords(card.resources),
    });
  }
  // Rescue Iârion: the time counters left, a countdown as Mount Doom's Doom is (no ring to fill): it warns at 2 left and is critical at 1, the last discards what it holds (09024:A:3).
  for (const card of Object.values(game.cards)) {
    const total = inPlay(card.zone) ? timeOf(ctx, card.code) : null;
    if (total == null) continue;
    const held = captiveUnder(game, card.id);
    const heldName = held ? nameOf(game.cards[held]?.code ?? "") : null;
    dials.push({
      id: "time",
      testID: "angmar-time",
      label: "Time",
      name: `Time counters left on ${nameOf(card.code)}:`,
      value: card.resources,
      ...(card.resources <= 2 ? { warn: { level: card.resources <= 1 ? ("critical" as const) : ("near" as const), words: timeNearWords(card.resources) } } : {}),
      note: timeWords(card.resources, heldName),
    });
  }
  // Orc Rearguard: no more than 3 progress on the current quest each round (09023:A:1), the tally of the round.
  const cap = cardsOf(game, REARGUARD).some((card) => card.zone === "staging") ? questCapTally(game) : null;
  if (cap) {
    dials.push({
      id: "cap",
      testID: "angmar-cap",
      label: "This round",
      name: "Progress placed on the current quest this round:",
      value: cap.placed,
      limit: cap.limit,
      ...(cap.placed >= cap.limit ? { warn: { level: "near" as const, words: rearguardWords(cap.placed, cap.limit) } } : {}),
      limitWords: rearguardLimitWords(cap.limit, nameOf(REARGUARD)),
    });
  }
  return dials;
}

const WILDERNESS = "09051";
const IARION = "09016";

/**
 * The marks of the seats that hold something of Intruders in Chetwood's: each seat with cards of its hand under Lost in the Wilderness ("hand under"), and the seat that controls Iârion while he is in play and controlled (the first player). Empty in any other game and when
 * neither is true.
 */
export function angmarHands(game: ScenarioState): readonly HandMark[] {
  if (game.sideQuests !== true) return [];
  const marks: HandMark[] = [];
  const under = new Map<number, number>();
  for (const wilds of cardsOf(game, WILDERNESS)) for (const id of cardsUnder(game, wilds.id)) {
    const owner = game.cards[id]?.owner;
    if (owner != null) under.set(owner, (under.get(owner) ?? 0) + 1);
  }
  for (const [seat, count] of [...under].sort((left, right) => left[0] - right[0])) marks.push({ seat, label: handUnderLabel(game.seatCount > 1 ? seat : null), note: handUnderWords(count) });
  for (const card of cardsOf(game, IARION)) if (card.zone === "play" && card.controller != null) marks.push({ seat: card.controller, label: iarionLabel(game.seatCount > 1 ? card.controller : null), note: iarionWords });
  return marks;
}
