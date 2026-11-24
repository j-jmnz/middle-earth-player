// Rules: ats.controlling-locations, ats.losing-control-of-locations, ats.setup-assault-on-osgiliath, rr.winning-the-game, rr.in-play-and-out-of-play (data/rules/entries.json); ledger lines 06091:B:1, 06091:B:2, 06091:B:3, 06096:A:2, 06103:A:1, 06103:A:2, 06104:A:1, 06095:A:1.
// The words of Assault on Osgiliath's table pieces: who controls a location and what control gives, the win line of the stage, the bar on progress in the staging area, the locations an undefended attack returns, and the verbs of the control records in a sentence. Pure.
import type { Instruction } from "../../../../catalog/boundary.ts";

import { plural } from "../../list.ts";
import { ownerWords } from "../../owner.ts";

const SOLO = 1;

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
    : `If ${controllerWords(seatCount, seat).toLowerCase()} leave${seatCount > SOLO ? "s" : ""} an attack undefended, it returns to the staging area with its progress removed.`;

/** The names of the Osgiliath locations that stop the win, as a list: "West Gate, The Old Bridge". */
const listOf = (names: readonly string[]): string => (names.length <= 2 ? names.join(" and ") : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`);

/** Stage 1B's win line with the table as it stands: what blocks the win, or that the end of the round wins. */
export function winWords(left: readonly string[], controlled: number): string {
  if (left.length === 0) {
    return controlled === 0 ? "To win: at the end of the round, no Osgiliath location is in the staging area or active. None is in play, so the players win at the end of this round" : `To win: at the end of the round, no Osgiliath location is in the staging area or active. ${plural(controlled, "location")} controlled, none is left, so the players win at the end of this round`;
  }
  return `To win: at the end of the round, no Osgiliath location is in the staging area or active. ${left.length} left: ${listOf(left)}. ${plural(controlled, "location")} controlled`;
}

/** The bar on progress from player cards (06091:B:1). */
export const PROGRESS_BAR_WORDS = "No player card effect can place progress on a location in the staging area. The active location, a controlled location and any card effect of the encounter deck are not barred";

/** The first player takes control of an explored Osgiliath location (06091:B:2). */
export const TAKE_CONTROL_WORDS = "An Osgiliath location that leaves play explored goes to the first player's play area, ready and with no progress. The first player controls it";

/** The dial's name for a screen reader. */
export const dialName = (controlled: number, left: number): string => `Osgiliath locations: ${controlled} controlled, ${left} still in the staging area or active. The players win at the end of the round when none is left`;

/** The log and the banner when a player takes control. */
export const tookWords = (name: string, seatCount: number, seat: number): string => `${name}: ${controllerWords(seatCount, seat)} ${seatCount > SOLO ? "takes" : "take"} control`;

/** The log and the banner when control is lost: where the location went and the progress removed. */
export const lostWords = (name: string, seatCount: number, seat: number, progress: number, toStaging: boolean): string =>
  `${name}: ${controllerWords(seatCount, seat)} ${seatCount > SOLO ? "loses" : "lose"} control${toStaging ? ", back in the staging area" : ""}${progress > 0 ? `, ${plural(progress, "progress token")} removed` : ""}`;

/** The attack sheet's line when leaving an attack undefended returns controlled locations: the hero still takes the damage (the sheet's own default line is replaced, so this one says it). */
export function undefendedLocationsWords(names: readonly string[], seatCount: number, seat: number): string {
  const plural_ = names.length > 1;
  return `Undefended: a hero takes all of it. ${listOf(names)}, which ${seatCount > SOLO ? `Player ${seat + 1} controls` : "you control"}, ${plural_ ? "return" : "returns"} to the staging area afterwards with ${plural_ ? "their" : "its"} progress removed.`;
}

/** The turn reference's 6.E step in this scenario. */
export const UNDEFENDED_GUIDE = "Each enemy attacks: declare one defender, or leave it undefended on a hero: West Gate, The King's Library, Ancient Harbor and The Old Bridge return to the staging area if you control them.";

/** Pinned Down: X is the locations the players control, and the surge. */
export const pinnedWords = (controlled: number): string => `X is the number of locations the players control: ${controlled} now. It adds X to this round's archery total${controlled < 4 ? ", and surge brings another card while fewer than 4 are controlled" : ""}.`;

/** Southron Commander: who it attacks when revealed. */
export const commanderWords = (targets: readonly string[]): string =>
  targets.length === 0 ? "When revealed it attacks each player who controls a location, first player first. No player controls one now, so it attacks no one." : `When revealed it attacks each player who controls a location, first player first. Now it attacks ${listOf(targets)}.`;

/** Ruined Tower: the second active location. */
export const towerWords = (active: number): string =>
  active === 1 ? "Travel here by exhausting a character: it becomes a second active location, and the first player divides progress between the two. 1 location is active now." : `Travel here needs exactly 1 active location. ${plural(active, "location")} ${active === 1 ? "is" : "are"} active now.`;

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
