// Rules: ats.hidden-cards, ats.hidden-cards-turn-faceup, ats.ally-objectives, rr.travel, hon.siege, hon.battle (data/rules/entries.json); ledger lines 06117:B:1, 06117:B:2, 06118:A:1, 06118:B:3, 06119:A:1, 06119:A:2, 06121:A:1, 06123:A:1, 06123:A:3, 06124:A:1, 06125:A:2, 06126:A:1, 06127:A:2, 06128:A:3, 06131:A:1, 06132:A:2, 06133:A:2.
// The words of The Blood of Gondor's table pieces. A hidden card lies facedown in a player's play area: the table says how many each player holds and never what a card is, nor its type, until it is turned faceup. Pure.
import type { Instruction } from "../../../../catalog/boundary.ts";

import { capital, plural } from "../../list.ts";
import { ownerWords } from "../../owner.ts";

const HIDDEN = "hidden card";
const FIVE = 5;

/** "1 hidden card", "3 hidden cards". */
export const hiddenCards = (count: number): string => plural(count, HIDDEN);

/** The label a seat's threat dial wears: "P1 · Hidden 3", with no seat prefix solo. */
export const hiddenLabel = (seat: number | null, count: number): string => `${seat == null ? "" : `P${seat + 1} · `}Hidden ${count}`;

/** The note spoken after a seat's dial: whose cards they are, that nobody sees them, and what turns them. */
export const hiddenNote = (seatCount: number, seat: number, count: number, limit: boolean): string =>
  `${capital(ownerWords(seatCount, seat))} play area holds ${hiddenCards(count)}, facedown. Nobody sees which they are.${limit ? ` At ${FIVE} the player turns them all faceup.` : ""}`;

// What the turn at 5 waits for: the effect or the attack that gave the fifth card is finished first, and every window but an action window is passed.
const WAITS = "they turn faceup when the effect or attack in progress is done";

/** The warning when a player sits at 4 on stage 2 (one more card turns them all faceup), or at 5 or more (the turn is waiting): near. */
export const hiddenWarn = (seatCount: number, seat: number, count = 4): string => {
  const who = seatCount > 1 ? `Player ${seat + 1} holds` : "You hold";
  return count >= FIVE ? `${who} ${hiddenCards(count)}: ${WAITS}` : `${who} 4 hidden cards: one more turns them all faceup`;
};

/** Who holds how many, as a sentence part: "You hold 2 hidden cards", "Hidden cards: Player 1 holds 2, Player 2 holds 0". */
export function holdingWords(counts: readonly number[]): string {
  if (counts.length === 1) return `You hold ${hiddenCards(counts[0] ?? 0)}`;
  return `Hidden cards: ${counts.map((count, seat) => `Player ${seat + 1} holds ${count}`).join(", ")}`;
}

/** The top-bar total dial's name and note. */
export const totalName = (total: number): string => `Hidden cards in all play areas: ${total}. Each seat's own count is on its threat dial`;
export const totalNote = (counts: readonly number[], numenorean: boolean): string =>
  `${holdingWords(counts)}. ${numenorean ? "Black Númenorean counts every hidden card for its Threat. " : ""}Nobody sees the cards, only how many each player holds.`;

/** The dial's warning while a seat sits at 4 (or holds 5 or more) under Captured!. */
export const totalWarn = (seats: readonly { seat: number; count: number }[], seatCount: number): string => seats.map((entry) => hiddenWarn(seatCount, entry.seat, entry.count)).join("; ");

const turnRule = (self: boolean): string => `an enemy engages ${self ? "you" : "that player"}, any other card is discarded`;

/** Stage 1's line: the counts, what starts each phase and the loss. Last in the stage's preview, so it ends with its period. */
export const ambushWords = (counts: readonly number[]): string =>
  `${holdingWords(counts)}. Each quest phase starts with 1 hidden card for each player; each combat phase starts with the choice: turn them faceup or take 1 more. The players lose if Faramir or Lord Alcaron leaves play.`;

/** Stage 2's line. `crossroads`: The Cross-roads is in play, so the stage has Siege and no Battle. `four`: the seats at 4 or more, each with its count. */
export function capturedWords(counts: readonly number[], crossroads: boolean, four: readonly { seat: number; count: number }[]): string {
  const near = four.length > 0 ? ` ${totalWarn(four, counts.length)}.` : "";
  const stat = crossroads ? " The Cross-roads gives this stage Siege and no Battle." : "";
  return `${holdingWords(counts)}. Each quest phase starts with 1 hidden card for each player; a player at ${FIVE} turns them all faceup.${near}${stat} The players lose if Faramir or Lord Alcaron, held under this stage and controlled by nobody, leaves play.`;
}

/** An objective ally's preview: whose it is, who may use its Action, the loss. `action`: what its Action does. Held under Captured! it is told by the stage (capturedWords). */
export function allyWords(seatCount: number, seat: number, action: string): string {
  const who = seatCount > 1 ? `Player ${seat + 1} controls it` : "You control it";
  const only = seatCount > 1 ? `only Player ${seat + 1} may use its Action` : "only you may use its Action";
  return `Objective ally. ${who}: ${only}, though it is an objective. Control passes with the first player token. The players lose if it leaves play. Action: ${action}.`;
}
export const FARAMIR_ACTION = "exhaust it to choose a player who holds a hidden card; 1 of that player's hidden cards, picked at random, is turned faceup (an enemy takes 3 damage first, and one it destroys never engages; any other card is discarded)";
export const ALCARON_ACTION = "exhaust it to return an enemy engaged with the player who controls it to the staging area";

/** A location's Travel cost line, said as its consequence: who takes how many cards, how many they hold, whether the players can pay, and the turn at 5. */
export function travelWords(amount: number, seatCount: number, seat: number, held: number, supply: number, limit: boolean): string {
  const who = seatCount > 1 ? `Player ${seat + 1}` : "you";
  const first = seatCount > 1 ? `the first player (${who})` : "you";
  const cost = `To travel here ${first} ${seatCount > 1 ? "takes" : "take"} ${hiddenCards(amount)}: the top of the encounter deck, facedown, not revealed (${who} ${seatCount > 1 ? "holds" : "hold"} ${held} now, ${held + amount} after).`;
  const cannot = supply < amount ? ` The players cannot travel here now: the encounter deck and its discard pile hold ${supply === 0 ? "no card" : plural(supply, "card")}.` : "";
  const turn = limit && held + amount >= FIVE ? ` That brings ${who} to ${FIVE} or more: all turn faceup at once.` : "";
  return `${cost}${cannot}${turn}`;
}

/** The travel readout's cost clause: who takes how many hidden cards and what they hold before and after. */
export function travelCostWords(amount: number, seatCount: number, seat: number, held: number): string {
  const who = seatCount > 1 ? `Player ${seat + 1} takes` : "You take";
  return `${who} ${hiddenCards(amount)} (${seatCount > 1 ? "holds" : "hold"} ${held}, then ${held + amount})`;
}

/** The reason the engine's refusal gets when the Travel cost is a hidden card with nothing left to take. */
export const noHiddenSupply = (amount: number): string => `The players cannot travel here: the encounter deck and its discard pile hold ${amount === 1 ? "no card" : `fewer than ${hiddenCards(amount)}`} to take`;

/** The Cross-roads' preview: what it gives the current stage, and its Threat. */
export const crossroadsWords = (players: number): string => `While it is in play, in the staging area or active, the current quest stage has Siege and no Battle: characters count Defense when questing. Its Threat is ${players}, the number of players.`;

/** The +5 quest points of Western Road and Eastern Road. */
export const bonusWords = (inStaging: boolean): string => (inStaging ? "It has +5 quest points while it is in the staging area, and loses them once it is the active location." : "It is the active location, so its +5 quest points are gone.");

/** The Dark Woods' Forced line: who discards what once it is explored. */
export const exploredWords = (seatCount: number, seat: number, held: number): string =>
  `When it leaves play explored, ${seatCount > 1 ? `the first player (Player ${seat + 1})` : "you"} discard${seatCount > 1 ? "s" : ""} 1 hidden card at random, unseen: it is not turned faceup, so nothing engages and no When Revealed resolves (${seatCount > 1 ? `Player ${seat + 1} holds` : "you hold"} ${held} now${held > 0 ? `, ${held - 1} after` : ""}).`;

/** Black Númenorean's preview: X now, and what the end of the round raises for each seat. */
export function numenoreanWords(total: number, counts: readonly number[]): string {
  const raises = counts.map((count, seat) => `${counts.length > 1 ? `Player ${seat + 1}` : "you"} ${count > 0 ? `+${count}` : "+0"}`).join(", ");
  return `X is ${total}, every hidden card in the game. At the end of the round each player raises his threat by his own hidden cards: ${raises}.`;
}

/** Brutal Uruk's line on the attack sheet: what its attack does to the player if it destroys a character. `held`: the hidden cards of the defending player. */
export const urukAttackWords = (seatCount: number, seat: number, held: number): string => {
  const who = seatCount > 1 ? `Player ${seat + 1}` : "You";
  const holds = held === 0 ? `${who} ${seatCount > 1 ? "holds" : "hold"} no hidden card, so nothing is turned` : `${who} ${seatCount > 1 ? "holds" : "hold"} ${hiddenCards(held)}: all are turned faceup, one at a time`;
  return `If this attack destroys a character, its controller turns all his hidden cards faceup. Each enemy turned is dealt a shadow card and attacks as normal. ${holds}.`;
};

/** The short clause of the dock readout: a character destroyed turns its controller's hidden cards. Empty with none. */
export const dockWords = (seatCount: number, seat: number, held: number): string => (held === 0 ? "" : `; a hero destroyed turns ${seatCount > 1 ? `Player ${seat + 1}'s` : "your"} ${hiddenCards(held)}`);

const SOURCE = (count: number | undefined): string => (count === 1 || count == null ? "1 hidden card" : `${count} hidden cards`);
const WHO: Readonly<Record<string, string>> = { actor: "the acting player", firstPlayer: "the first player", eachPlayer: "each player, the first player first," };

/** The six hidden verbs in a sentence of a choice or a response. Null for any other verb. */
export function hiddenWords(instruction: Instruction): string | null {
  switch (instruction.verb) {
    case "TakeHiddenCard":
      return `${instruction.who === "firstPlayer" ? "the first player" : "you"} take${instruction.who === "firstPlayer" ? "s" : ""} ${SOURCE(instruction.amount)}: the top of the encounter deck, facedown`;
    case "TurnHiddenCards":
      return `${instruction.who === "eachPlayer" ? WHO.eachPlayer : instruction.who === "firstPlayer" ? "the first player" : "you"} turn${instruction.who === "actor" ? "" : "s"} each hidden card faceup, one at a time (${turnRule(instruction.who === "actor")})`;
    case "TurnHiddenCard":
      return `turn 1 hidden card of the player chosen faceup${instruction.damageEnemy != null ? ` (an enemy takes ${instruction.damageEnemy} damage first)` : ""}`;
    case "DiscardHiddenCard":
      return `${instruction.who === "firstPlayer" ? "the first player" : "you"} discard${instruction.who === "firstPlayer" ? "s" : ""} 1 hidden card at random, unseen`;
    case "HoldUnderStage":
      return "place Faramir and Lord Alcaron under this stage, controlled by nobody";
    case "GainControlOfSelf":
      return "the first player gains control of this card";
    default:
      return null;
  }
}

/** The log and banner lines of the hidden cards. `who` is "You" solo or "Player 2": the verb agrees with it. */
const verb = (who: string, base: string): string => (who === "You" ? base : `${base}s`);
export const takenWords = (who: string, amount: number, now: number, why: string | null): string => `${who} ${verb(who, "take")} ${hiddenCards(amount)}${why ? ` (${why})` : ""}, ${verb(who, "hold")} ${now} now`;
export const turnedWords = (who: string, count: number, why: string | null): string => `${who} ${verb(who, "turn")} ${hiddenCards(count)} faceup${why ? ` (${why})` : ""}`;
export const fiveWords = (who: string): string => `${who} ${verb(who, "hold")} 5 hidden cards: Captured! turns them all faceup at once`;
export const discardedWords = (who: string, why: string | null): string => `${who} ${verb(who, "discard")} 1 hidden card at random, unseen${why ? ` (${why})` : ""}`;
export const heldUnderWords = (names: readonly string[]): string => `${names.join(" and ")} ${names.length > 1 ? "are" : "is"} under Captured!: in play, controlled by nobody`;
export const controlWords = (name: string, seatCount: number, seat: number): string => `${name}: ${seatCount > 1 ? `Player ${seat + 1} gains` : "You gain"} control, the first player token passed`;
export const HIDDEN_TITLE = "Hidden cards";

/** The guide and the window note of the combat start on stage 1: the choice comes before the shadow cards (06117:B:2). */
export const COMBAT_START_DECISION = "At the beginning of combat each player, the first player first, turns his hidden cards faceup or takes 1 hidden card. Then each engaged enemy is dealt a face-down shadow card.";
export const BEFORE_COMBAT_NOTE = "Engagement is done. Each player chooses next: turn hidden cards faceup, or take 1 hidden card. Shadow cards are dealt after that, to the enemies turned too.";
