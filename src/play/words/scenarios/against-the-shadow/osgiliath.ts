// Rules: ats.controlling-locations, ats.losing-control-of-locations, ats.setup-assault-on-osgiliath, rr.winning-the-game, rr.in-play-and-out-of-play (data/rules/entries.json); ledger lines 06091:B:1, 06091:B:2, 06091:B:3, 06096:A:2, 06103:A:1, 06103:A:2, 06104:A:1, 06095:A:1.
// The words of Assault on Osgiliath's table pieces: who controls a location and what control gives, the win line of the stage, the bar on progress in the staging area, the locations an undefended attack returns, and the verbs of the control records in a sentence. Pure.
import type { Instruction } from "../../../../catalog/boundary.ts";

import { listAnd, plural } from "../../list.ts";
import { ownerWords } from "../../owner.ts";

const SOLO = 1;

/** "you" or "Player 2" inside a sentence. */
const whoInside = (seatCount: number, seat: number): string => (seatCount > SOLO ? `Player ${seat + 1}` : "you");

/** "You" or "Player 2" for the seat that controls a location. */
export const controllerWords = (seatCount: number, seat: number): string => (seatCount > SOLO ? `Player ${seat + 1}` : "You");

/** A controlled location's preview: whose it is, where it lies and what control gives. Losing control returns it with no progress. */
export const controlledWords = (seatCount: number, seat: number): string => {
  const who = controllerWords(seatCount, seat);
  return `${who} ${seatCount > SOLO ? "controls" : "control"} it: it lies in ${ownerWords(seatCount, seat)} play area, ready, with its text working. Losing control puts it in the staging area with its progress removed.`;
};

/** The Forced line of the four unique locations, worded as what happens to the player who controls one. */
export const undefendedReturnWords = (seatCount: number, seat: number | null): string =>
  seat == null
    ? "Once a player controls it: if that player leaves an attack undefended, it returns to the staging area with its progress removed."
    : `If ${whoInside(seatCount, seat)} leave${seatCount > SOLO ? "s" : ""} an attack undefended, it returns to the staging area with its progress removed.`;

/** The names of the Osgiliath locations that stop the win, as a list: "West Gate, The Old Bridge". */

/** A location a player controls, by name and seat. */
export type HeldLocation = { name: string; seat: number };

/** The controlled locations as the dial counts them: "West Gate and Ruined Tower (Player 1)", alone solo ("West Gate and Ruined Tower"), one group a seat. */
const heldList = (held: readonly HeldLocation[], seatCount: number): string => {
  const seats = [...new Set(held.map((entry) => entry.seat))].sort((one, other) => one - other);
  return seats.map((seat) => `${listAnd(held.filter((entry) => entry.seat === seat).map((entry) => entry.name))}${seatCount > SOLO ? ` (Player ${seat + 1})` : ""}`).join("; ");
};

/** Stage 1B's win line with the table as it stands: what blocks the win and what the players control, or that the end of the round wins. During Setup nothing is in play yet, so no win is announced. No final period: the preview's join ends the line. */
export function winWords(left: readonly string[], held: readonly HeldLocation[], seatCount: number, setup: boolean): string {
  const head = "To win: at the end of the round, no Osgiliath location is in the staging area or active";
  const controlled = held.length === 0 ? "Controlled: none" : `Controlled: ${heldList(held, seatCount)}`;
  if (left.length > 0) return `${head}. Left: ${listAnd(left)}. ${controlled}`;
  if (setup) return `${head}. ${controlled}`;
  return held.length === 0 ? `${head}. None is in play, so the players win at the end of this round` : `${head}. None is left, so the players win at the end of this round. ${controlled}`;
}

/** The bar on progress from player cards (06091:B:1). */
export const PROGRESS_BAR_WORDS = "Player card effects cannot place progress on a location in the staging area; an active or controlled location is not barred";

/** The log line of progress the bar kept: a progress step of 0 (06091:B:1; no other effect places 0). */
export const barredWords = (name: string): string => `No progress on ${name}: Retake the City bars player card effects from placing progress on a location in the staging area`;

/** The first player takes control of an explored Osgiliath location (06091:B:2). */
export const TAKE_CONTROL_WORDS = "An explored Osgiliath location goes to the first player, ready, with no progress";

/** The dial's name for a screen reader. */
export const dialName = (controlled: number, left: number): string => `Osgiliath locations: ${controlled} controlled, ${left} still in the staging area or active. The players win at the end of the round when none is left`;

/** The log and the banner when a player takes control. */
export const tookWords = (name: string, seatCount: number, seat: number): string => `${name}: ${controllerWords(seatCount, seat)} ${seatCount > SOLO ? "takes" : "take"} control`;

/** The log and the banner when control is lost: where the location went and the progress removed. */
export const lostWords = (name: string, seatCount: number, seat: number, progress: number, toStaging: boolean): string =>
  `${name}: ${controllerWords(seatCount, seat)} ${seatCount > SOLO ? "loses" : "lose"} control${toStaging ? ", back in the staging area" : ""}${progress > 0 ? `, ${plural(progress, "progress token")} removed` : ""}`;

/** The attack sheet's line when leaving an attack undefended returns controlled locations: the hero still takes the damage (the sheet's own default line is replaced, so this one says it). `towers`: Ruined Tower, which the defending player controls, returns too when it hears the loss of another location (06103:A:2). */
export function undefendedLocationsWords(names: readonly string[], seatCount: number, seat: number, towers = 0): string {
  const plural_ = names.length > 1;
  const first = `Undefended: a hero takes all of it. ${listAnd(names)}, which ${seatCount > SOLO ? `Player ${seat + 1} controls` : "you control"}, ${plural_ ? "return" : "returns"} to the staging area afterwards with ${plural_ ? "their" : "its"} progress removed.`;
  return towers > 0 ? `${first} ${towers > 1 ? "Each Ruined Tower" : "Ruined Tower"} returns as well, as control of another location is lost.` : first;
}

/** The turn reference's 6.E step in this scenario. */
export const UNDEFENDED_GUIDE = "Each enemy attacks: declare one defender, or leave it undefended on a hero: West Gate, The King's Library, Ancient Harbor and The Old Bridge return to the staging area when the player who controls them leaves the attack undefended.";

/** Pinned Down: X is the locations the players control, and the surge. */
export const pinnedWords = (controlled: number): string => `X is the number of locations the players control: ${controlled} now. It adds X to this round's archery total${controlled < 4 ? ", and surge brings another card while fewer than 4 are controlled" : ""}.`;

/** Southron Commander: who it attacks when revealed. */
export const commanderWords = (targets: readonly string[]): string =>
  targets.length === 0 ? "When revealed it attacks each player who controls a location, first player first. No player controls one now, so it attacks no one." : `When revealed it attacks each player who controls a location, first player first. Now it attacks ${listAnd(targets)}.`;

/** Ruined Tower in the staging area: how many locations are active decides how it is traveled to (06103:A:1). */
export const towerStagedWords = (active: number): string =>
  active === 0
    ? "Travel here as to any location. With 1 active location, exhaust a character to travel here as a second active location instead; the first player then divides progress between the two. No location is active now."
    : active === 1
      ? "Travel here by exhausting a character: it becomes a second active location, and the first player divides progress between the two. 1 location is active now."
      : "2 locations are active now, so the players cannot travel here until only 1 is.";

/** Ruined Tower as an active location, in either slot: with a second one active, the first player divides the quest's progress between them. */
export const towerActiveWords = (active: number): string =>
  active >= 2 ? "Active, one of 2 active locations: the first player divides the quest's progress between them." : "Active. If a second location becomes active, the first player divides the quest's progress between them.";

/** A controlled Ruined Tower (06103:A:2): it returns when its controller loses control of another location. */
export const towerHeldWords = (seatCount: number, seat: number): string =>
  `If ${whoInside(seatCount, seat)} lose${seatCount > SOLO ? "s" : ""} control of another location, it returns to the staging area with its progress removed.`;

/** West Gate under control (06096:A:1): its Action takes it out of the play area. */
export const gateHeldWords = (): string => "Its Action, with no active location, makes it the active location: control is lost and its progress is removed.";

const subjectOf = (ref: string | undefined): string => (ref === "self" ? "this card" : ref === "picked" ? "the location you chose" : ref === "previous" ? "the discarded location" : "the explored location");

/** The verbs of the control records in a sentence of a choice or a response. Null for any other verb. */
export function osgiliathWords(instruction: Instruction): string | null {
  switch (instruction.verb) {
    case "TakeControlOfLocation":
      return `the first player takes control of ${subjectOf(instruction.card)}: it lies in that player's play area with no progress`;
    case "LoseControlOfLocation":
      return `return ${subjectOf(instruction.card ?? "picked")} to the staging area, with its progress removed`;
    case "AnnounceAddedToStaging":
      return "the enemy just added to the staging area makes the attacks it has when it enters play";
    case "ActForDestroyedController":
      return "the controller of the destroyed character decides the rest";
    default:
      return null;
  }
}
