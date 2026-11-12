// Rules: mec108.time-x, mec108.side-quests, mec108.side-quests-in-play, mec108.indestructible, rr.player-elimination (data/rules/entries.json); ledger lines 09023:A:1, 09024:A:1, 09024:A:3, 09036:A:2, 09073:B:3, 09074:B:2, 10158:A:3.
//
// The dials Intruders in Chetwood's pieces hold now, in the order the top bar draws them: Protect the Innocent's damage against the number that loses the game (it warms toward it), the time counters taken off Rescue Iârion
// (it warms toward the last, which discards Iârion and loses the game) and, while Orc Rearguard is in the staging area, the progress placed on the current quest this round against its cap of 3. The engine decided every number
// (`heldAmount`, `timeOf`, `questCapTally`); nothing here changes one. Empty in any other scenario. Pure, so a test reads it.
import { HUNT_FLIP_TOKENS } from "../../effects/authored/angmar-awakened/the-weather-hills.ts";
import { printedOf } from "../../rules/core/printed.ts";
import { flagged, heldAmount, inPlay, livingSeats } from "../../rules/core/state.ts";
import { frameScope, resolveAmount } from "../../rules/interpret/amounts.ts";
import type { ReduceContext, ScenarioState } from "../../rules/engine/reduce.ts";
import { questCapTally } from "../../rules/families/caves/progress.ts";
import { timeOf } from "../../rules/families/angmar/time.ts";
import { cardsUnder } from "../../rules/core/zones.ts";
import { captiveUnder } from "../../rules/families/south/captive.ts";

import { battlementsTimeNearWords, battlementsTimeWords, deckLabel, deckNearWords, deckWords, thaurdirWords, handUnderLabel, handUnderWords, huntWords, iarionLabel, iarionWords, protectNearWords, protectWords, savageNearWords, savageWords, rearguardLimitWords, rearguardWords, shelterTimeNearWords, shelterTimeWords, timeNearWords, timeWords } from "../words/scenarios/angmar-table.ts";
import { cardsOf, type TableDial } from "./dials.ts";
import type { HandMark } from "./isengard.ts";

const REARGUARD = "09023";
const HUNTING_THE_ORCS = "09071";
const SAVAGE_COUNTER_ATTACK = "09072";
const FIND_SHELTER = "09032";
const BROKEN_BATTLEMENTS = "09036";
const THAURDIR = "09033";
/** The number of resource tokens at which Hunting the Orcs flips: 3 more than the players (09071:A:1), read as the record reads it. */
export const huntLimit = (game: ScenarioState, ctx: ReduceContext, sourceId: string): number => resolveAmount(game, HUNT_FLIP_TOKENS, frameScope(game, 0, sourceId), ctx);

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
  // Thaurdir (stage 2B of Deadmen's Dike): the damage on him against his hit points, the players' way out (the stage cannot be defeated while he has any left, 09074:B:2), so a goal dial that fills in the accent and never warms. He cannot be destroyed, so it can pass its limit.
  for (const card of cardsOf(game, THAURDIR)) {
    const limit = printedOf(ctx.cards, card.code).health ?? 0;
    if (limit <= 0) continue;
    dials.push({
      id: "thaurdir",
      testID: "angmar-thaurdir",
      label: "Thaurdir",
      name: `Damage on ${nameOf(card.code)}, stage 2 can be won at ${limit}:`,
      value: card.damage,
      limit,
      goal: true,
      limitWords: `${limit} opens the stage`,
      note: thaurdirWords(card.damage, limit),
    });
  }
  // Hunting the Orcs: its tokens against the number at which it flips (09071:A:1), the players' way out of stage 1, so a goal dial that fills and never warms. Savage Counter-attack: its tokens, a countdown to the loss at 0 (09072:A:3), warming as it falls to 2 and critical at 1.
  for (const card of cardsOf(game, HUNTING_THE_ORCS)) {
    const limit = huntLimit(game, ctx, card.id);
    dials.push({
      id: "hunt",
      testID: "angmar-hunt",
      label: "Hunted",
      name: `Resource tokens on ${nameOf(card.code)}, it flips at ${limit}:`,
      value: card.resources,
      limit,
      goal: true,
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
  // Rescue Iârion: the time counters left, a countdown as Mount Doom's Doom is (no ring to fill): it warns at 2 left and is critical at 1, the last discards what it holds (09024:A:3). Find Shelter's is the same dial worded for its own last counter, never critical.
  for (const card of Object.values(game.cards)) {
    const total = inPlay(card.zone) ? timeOf(ctx, card.code) : null;
    if (total == null) continue;
    const held = captiveUnder(game, card.id);
    const heldName = held ? nameOf(game.cards[held]?.code ?? "") : null;
    // Find Shelter's last counter costs damage and returns 4 counters (09032:A:2), not the game: its dial warns near and never critical.
    const shelter = card.code === FIND_SHELTER;
    // Broken Battlements' last counter makes each player discard 5 cards and place 1 counter (09036:A:2): not a loss either.
    const battlements = card.code === BROKEN_BATTLEMENTS;
    const costly = shelter || battlements;
    dials.push({
      id: "time",
      testID: "angmar-time",
      label: "Time",
      name: `Time counters left on ${nameOf(card.code)}:`,
      value: card.resources,
      ...(card.resources <= 2 ? { warn: { level: card.resources <= 1 && !costly ? ("critical" as const) : ("near" as const), words: shelter ? shelterTimeNearWords(card.resources) : battlements ? battlementsTimeNearWords(card.resources) : timeNearWords(card.resources) } } : {}),
      note: shelter ? shelterTimeWords(card.resources) : battlements ? battlementsTimeWords(card.resources) : timeWords(card.resources, heldName),
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
 * The marks of the seats that hold something of the Angmar scenarios': each seat with cards of its hand under Lost in the Wilderness ("hand under"), the seat that controls Iârion while he is in play and controlled (the first player) and, while a stage eliminates a player with no cards in his deck (Deadmen's Dike), each seat's deck count. Empty in any other game and when
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
  // A stage that eliminates a player with no cards in his deck (09073:B:3, 09074:B:2): each living seat's deck count, warming near empty.
  if (flagged(game, "table", "eliminatedAtEmptyDeck")) {
    for (const seat of livingSeats(game)) {
      const cards = game.seats[seat]?.deck.length ?? 0;
      marks.push({ seat, label: deckLabel(game.seatCount > 1 ? seat : null, cards), note: deckWords(cards), ...(cards <= 5 ? { warn: { level: cards <= 2 ? ("critical" as const) : ("near" as const), words: deckNearWords(cards) } } : {}) });
    }
  }
  for (const [seat, count] of [...under].sort((left, right) => left[0] - right[0])) marks.push({ seat, label: handUnderLabel(game.seatCount > 1 ? seat : null), note: handUnderWords(count) });
  for (const card of cardsOf(game, IARION)) if (card.zone === "play" && card.controller != null) marks.push({ seat: card.controller, label: iarionLabel(game.seatCount > 1 ? card.controller : null), note: iarionWords });
  return marks;
}
