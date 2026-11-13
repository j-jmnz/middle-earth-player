// Rules: mec108.time-x, mec108.side-quests, mec108.side-quests-in-play, mec108.indestructible, rr.player-elimination (data/rules/entries.json); ledger lines 09023:A:1, 10023:A:1, 09024:A:1, 09024:A:3, 09036:A:2, 09073:B:3, 09074:B:2, 10158:A:3.
//
// The dials Intruders in Chetwood's pieces hold now, in the order the top bar draws them: Protect the Innocent's damage against the number that loses the game (it warms toward it), the time counters taken off Rescue Iârion
// (it warms toward the last, which discards Iârion and loses the game) and, while Orc Rearguard (or Eriador Wastes) is in the staging area, the progress placed on the current quest this round against its cap (3, or 5 for Eriador Wastes). The engine decided every number
// (`heldAmount`, `timeOf`, `questCapTally`); nothing here changes one. Empty in any other scenario. Pure, so a test reads it.
import { HUNT_FLIP_TOKENS } from "../../effects/authored/angmar-awakened/the-weather-hills.ts";
import { flagged, heldAmount, inPlay, livingSeats, type CardInstance } from "../../rules/core/state.ts";
import { frameScope, resolveAmount } from "../../rules/interpret/amounts.ts";
import type { ReduceContext, ScenarioState } from "../../rules/engine/reduce.ts";
import { questCapTally } from "../../rules/families/caves/progress.ts";
import { hitPointsOf } from "../../rules/families/angmar/quest.ts";
import { timeOf } from "../../rules/families/angmar/time.ts";
import { stageOf } from "../../rules/families/breaking/areas.ts";
import { questPointsOf } from "../../rules/quest/quest.ts";
import { cardsUnder } from "../../rules/core/zones.ts";
import { captiveUnder } from "../../rules/families/south/captive.ts";

import { battlementsTimeNearWords, battlementsTimeWords, deckLabel, deckNearWords, deckWords, thaurdirLimitWords, thaurdirWords, handUnderLabel, handUnderWords, huntWords, iarionLabel, iarionWords, protectNearWords, protectWords, savageNearWords, savageWords, rearguardLimitWords, rearguardWords, shelterTimeNearWords, shelterTimeWords, timeNearWords, timeWords } from "../words/scenarios/angmar/angmar-table.ts";
import { executionersNearWords, executionersTimeWords } from "../words/scenarios/angmar/gram-table.ts";
import { cardsOf, type TableDial } from "./dials.ts";
import { EXECUTIONERS, executionersRaises } from "./gram.ts";
import type { HandMark } from "./isengard.ts";

const REARGUARD = "09023";
const ERIADOR_WASTES = "10023";
// The encounter cards that cap the progress placed on the current quest each round while they are in the staging area.
const CAPPERS = [REARGUARD, ERIADOR_WASTES];
const HUNTING_THE_ORCS = "09071";
const SAVAGE_COUNTER_ATTACK = "09072";
const FIND_SHELTER = "09032";
const BROKEN_BATTLEMENTS = "09036";
const THAURDIR = "09033";
const THAURDIR_STAGE = "09074";
const DEADMENS_DIKE_STAGE_1 = "09073";
/** The number of resource tokens at which Hunting the Orcs flips: 3 more than the players (09071:A:1), read as the record reads it. */
export const huntLimit = (game: ScenarioState, ctx: ReduceContext, sourceId: string): number => resolveAmount(game, HUNT_FLIP_TOKENS, frameScope(game, 0, sourceId), ctx);

// The quest points of the current stage 2B of Deadmen's Dike, the progress it needs besides Thaurdir's damage; null when another stage is current.
export function thaurdirStagePoints(game: ScenarioState, ctx: ReduceContext): number | null {
  const id = stageOf(game, 0);
  const stage = id ? game.cards[id] : undefined;
  return stage?.code === THAURDIR_STAGE ? questPointsOf(game, stage, ctx.cards) : null;
}

// Where a copy of a card with several lies: the active location or the staging area, numbered when more than one copy shares the place.
function placeOf(card: CardInstance, copies: readonly CardInstance[]): string {
  const place = card.zone === "activeLocation" ? "active" : "staging";
  const same = copies.filter((other) => other.zone === card.zone).sort((left, right) => left.id.localeCompare(right.id));
  return same.length > 1 ? `${place} ${same.indexOf(card) + 1}` : place;
}

// The living seats whose deck the last time counter's discard empties: Broken Battlements makes each player discard 5, and stage 1B discards 1 more at the end of the same refresh phase (09036:A:2, 09073:B:2).
function battlementsDoomed(game: ScenarioState): { seat: number; cards: number }[] {
  const stage = stageOf(game, 0);
  const discard = 5 + (stage && game.cards[stage]?.code === DEADMENS_DIKE_STAGE_1 ? 1 : 0);
  return livingSeats(game).flatMap((seat) => {
    const cards = game.seats[seat]?.deck.length ?? 0;
    return cards <= discard ? [{ seat, cards }] : [];
  });
}

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
  // Thaurdir (stage 2B of Deadmen's Dike): the damage on him against his hit points, one of the two things that win stage 2 (the stage cannot be defeated while he has any left, 09074:B:2, and it needs its own quest points in progress), so a goal dial that fills in the accent and never warms. He cannot be
  // destroyed, so it can pass its limit.
  for (const card of cardsOf(game, THAURDIR)) {
    const limit = hitPointsOf(game, card, ctx);
    if (limit <= 0) continue;
    const points = thaurdirStagePoints(game, ctx);
    dials.push({
      id: "thaurdir",
      testID: "angmar-thaurdir",
      label: "Thaurdir",
      name: `Damage on ${nameOf(card.code)}, stage 2 needs ${points == null ? "" : `its ${points} progress and `}${limit} damage on him:`,
      value: card.damage,
      limit,
      goal: true,
      limitWords: thaurdirLimitWords(limit, points),
      note: thaurdirWords(card.damage, limit, points),
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
  // Rescue Iârion: the time counters left, a countdown as Mount Doom's Doom is (no ring to fill): it warns at 2 left and is critical at 1, the last discards what it holds (09024:A:3). Find Shelter's is the same dial worded for its own last counter, never critical. Broken Battlements has three copies, so
  // each dial is its card's (id and test id) and says where its copy lies.
  for (const card of Object.values(game.cards)) {
    const total = inPlay(card.zone) ? timeOf(ctx, card.code) : null;
    if (total == null) continue;
    const held = captiveUnder(game, card.id);
    const heldName = held ? nameOf(game.cards[held]?.code ?? "") : null;
    // Find Shelter's last counter costs damage and returns 4 counters (09032:A:2), not the game: its dial warns near and never critical.
    const shelter = card.code === FIND_SHELTER;
    // Broken Battlements' last counter makes each player discard 5 cards and place 1 counter (09036:A:2): a loss only for a seat whose deck it empties.
    const battlements = card.code === BROKEN_BATTLEMENTS;
    const doomed = battlements && card.resources <= 1 ? battlementsDoomed(game) : [];
    // Stop the Executioners' last counter discards the cards captured under it and raises threat (10053:A:3): it loses the game only when the raise eliminates the last player, so its dial warns near and is critical only then.
    const executioners = card.code === EXECUTIONERS;
    const executed = executioners ? executionersRaises(game, card.id, ctx) : { under: 0, raises: [] };
    const level = card.resources <= 1 && (!(shelter || battlements || executioners) || doomed.length > 0 || executed.raises.some((raise) => raise.out)) ? ("critical" as const) : ("near" as const);
    const copies = Object.values(game.cards).filter((other) => other.code === card.code && inPlay(other.zone));
    const where = copies.length > 1 ? placeOf(card, copies) : null;
    dials.push({
      id: `time:${card.id}`,
      testID: `angmar-time:${card.id}`,
      label: where ? `Time · ${where}` : "Time",
      name: `Time counters left on ${nameOf(card.code)}${where ? ` (${where})` : ""}:`,
      value: card.resources,
      ...(card.resources <= 2 ? { warn: { level, words: executioners ? executionersNearWords(card.resources, executed.under, executed.raises, game.seatCount <= 1) : shelter ? shelterTimeNearWords(card.resources) : battlements ? battlementsTimeNearWords(card.resources, doomed.map((seat) => ({ owner: game.seatCount > 1 ? `Player ${seat.seat + 1}` : null, cards: seat.cards }))) : timeNearWords(card.resources) } } : {}),
      note: executioners ? executionersTimeWords(card.resources, executed.under, executed.raises) : shelter ? shelterTimeWords(card.resources) : battlements ? battlementsTimeWords(card.resources) : timeWords(card.resources, heldName),
    });
  }
  // Orc Rearguard: no more than 3 progress on the current quest each round (09023:A:1), Eriador Wastes: no more than 5 (10023:A:1); the tally of the round. The cap is the table's, so two copies are one dial, named for the first.
  const capper = CAPPERS.flatMap((code) => cardsOf(game, code).filter((card) => card.zone === "staging"))[0];
  const cap = capper ? questCapTally(game) : null;
  if (capper && cap) {
    dials.push({
      id: "cap",
      testID: "angmar-cap",
      label: "This round",
      name: "Progress placed on the current quest this round:",
      value: cap.placed,
      limit: cap.limit,
      ...(cap.placed >= cap.limit ? { warn: { level: "near" as const, words: rearguardWords(cap.placed, cap.limit) } } : {}),
      limitWords: rearguardLimitWords(cap.limit, nameOf(capper.code)),
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
