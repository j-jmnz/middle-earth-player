// Rules: mec108.capture-x, rr.in-play-and-out-of-play (data/rules/entries.json); ledger lines 10039:A:1, 10043:A:1, 10044:A:1, 10045:A:1, 10046:A:1, 10047:A:1, 10048:A:1, 10053:A:1, 10175:A:1.
//
// Capture X is a constant marker (`Capture`, like `Time`): when a card with it enters play, before its When Revealed resolves, each player sharing its staging area (the engaged player for an enemy put into play engaged) takes the top X cards of
// their captured deck and puts them facedown underneath it; a shorter deck gives what is left. "Enters play" is a move from out of play to a play area, so a card revealed, added to the staging area unrevealed, put into play engaged, or a
// quest card that becomes a seat's stage all capture. The table's `capture` field holds the numbers by code (`markCapture`); a game whose records name no Capture has none and never gets here.
import type { Destination } from "../../core/zones.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import type { ScenarioState } from "../../core/state.ts";
import { livingSeats } from "../../core/state.ts";
import { sharing } from "../breaking/areas.ts";
import { captureFromDeck } from "./pile.ts";

// Reads the Capture X of every card the game deals from the effect records, and the cards that are in every area (`InEveryArea`). Absent when the game has neither (every other scenario).
export function markCapture(state: ScenarioState, ctx: ReduceContext): ScenarioState {
  const x: Record<string, number> = {};
  const everyArea: string[] = [];
  const instead: string[] = [];
  let refresh = false;
  // The cards dealt, and the cards the Setup names to put into play (the campaign card's Loot the Dungeons).
  const codes = new Set([...Object.values(state.cards).map((card) => card.code), ...state.setup.flatMap((instruction) => ("code" in instruction && typeof instruction.code === "string" ? [instruction.code] : []))]);
  for (const effect of ctx.effects) {
    if (!codes.has(effect.cardCode)) continue;
    for (const instruction of effect.instructions) {
      if (instruction.verb === "Capture") x[effect.cardCode] = instruction.amount;
      if (instruction.verb === "InEveryArea") everyArea.push(effect.cardCode);
      // An enemy whose own record captures the allies its attacks would damage (Cruel Torturer; play.ts captureInstead).
      if (instruction.verb === "CaptureInsteadOfDamage" && effect.timing === "forced") instead.push(effect.cardCode);
      // The campaign card raises each player's threat at the end of the refresh phase by its own count instead of 1 (10174:B:1; engine/refresh.ts).
      if (instruction.verb === "RaiseThreat" && effect.trigger === "endOfPhase" && typeof instruction.amount === "object" && instruction.amount.captured === "questsAndSides") refresh = true;
    }
  }
  return Object.keys(x).length === 0 && everyArea.length === 0 && instead.length === 0 && !refresh ? state : { ...state, capture: { x, everyArea, here: [], instead, ...(refresh ? { refresh: true as const } : {}) } };
}

// The seats that capture for a card entering at `dest`: the seat an enemy is engaged with, the players sharing the staging area it goes to, the seat whose stage it becomes; every living player for the shared staging area.
function capturers(state: ScenarioState, dest: Destination): number[] {
  if (dest.zone === "engaged") return state.seats[dest.seat] && !state.seats[dest.seat]?.eliminated ? [dest.seat] : [];
  if (!state.separate) return livingSeats(state);
  const seat = dest.zone === "staging" ? (dest.area ?? state.viewSeat) : dest.zone === "questStage" ? (dest.seat ?? state.viewSeat) : state.viewSeat;
  return seat == null ? livingSeats(state) : sharing(state, seat);
}

// A card that has entered play (zones.ts moveCard): it joins the cards in every area when it is one, and captures when it has Capture X.
export function captureOnEntry(state: ScenarioState, id: string, dest: Destination): ScenarioState {
  const card = state.cards[id];
  const marks = state.capture;
  if (!card || !marks) return state;
  let next = state;
  if (dest.zone === "staging" && marks.everyArea.includes(card.code) && !marks.here.includes(id)) next = { ...next, capture: { ...marks, here: [...marks.here, id] } };
  const amount = marks.x[card.code];
  if (amount == null) return next;
  for (const seat of capturers(next, dest)) next = captureFromDeck(next, seat, id, amount, "top");
  return next;
}
