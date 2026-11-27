// Rules: ats.captain-enemies, ats.setup-the-morgul-vale, ats.setup-the-morgul-vale-to-the-tower, rr.cannot, rr.destroy, rr.damage, rr.reveal, rr.in-play-and-out-of-play (data/rules/entries.json); ledger lines 06144:A:1, 06144:B:1, 06145:B:1, 06146:B:2, 06146:B:3, 06147:A:1, 06147:A:2, 06147:A:3, 06148:A:1, 06148:A:2, 06151:A:1, 06152:A:1, 06152:A:2, 06153:A:1, 06153:A:2, 06156:A:1.
// The words of The Morgul Vale's table pieces: the To the Tower dial and its warnings, the lines of the three stages and their Captains, the Morgul Bodyguard and what it takes, the Nazgûl's cuts, Lord Alcaron's and Murzag's attacks, The White Bridge's X, the refusals and the words of the new verbs.
// A line the shared join(". ") joins carries no final period; the last line of a preview does. Pure.
import type { Instruction } from "../../../../catalog/boundary.ts";

import { plural } from "../../list.ts";

/** The progress tokens on To the Tower that lose the game (06147:A:3). */
export const TOWER_LIMIT = 10;
/** The tokens at which the dial warms, and at which it is critical. */
export const TOWER_NEAR = 7;
export const TOWER_CRITICAL = 9;

const SOLO = 1;
const seatWord = (seatCount: number, seat: number): string => (seatCount > SOLO ? `Player ${seat + 1}` : "you");
const tokens = (count: number): string => plural(count, "progress token");

/** The dial's name for a screen reader. */
export const towerDialName = (count: number): string => `Progress tokens on To the Tower: ${count} of ${TOWER_LIMIT}. At ${TOWER_LIMIT} the players lose the game:`;

/** What the dial's limit means. */
export const towerLimitWords = `${TOWER_LIMIT} progress tokens on To the Tower lose the game`;

/** The dial's note: the count, the loss, and what places and removes tokens. */
export const towerNote = (count: number): string =>
  `To the Tower holds ${count} of the ${TOWER_LIMIT} progress tokens that lose the game for all players. Morgul Tracker, Lord Alcaron's attacks, Morgul Sorcerer, Morgul Vale and several encounter cards place tokens. Morgul Road removes 1.`;

/** The dial's warning: how many more tokens lose the game. */
export const towerWarn = (count: number): string => (count >= TOWER_LIMIT - 1 ? "One more progress token on To the Tower loses the game." : `${TOWER_LIMIT - count} more progress tokens on To the Tower lose the game.`);

/** The stage's win line, in place of the quest points it does not print: the Captain whose destruction ends it. */
export const stageWinWords = (captain: string, last: boolean): string => (last ? `To win: destroy ${captain}` : `To advance: destroy ${captain}`);

/** Where a Captain stands now, for a stage's preview. `at`: null when he is not in play. */
export function captainWhere(name: string, at: { zone: "staging" | "engaged"; seat?: number } | null, seatCount: number): string {
  if (!at) return `${name} is not in play`;
  if (at.zone === "staging") return `${name} is in the staging area`;
  return `${name} is engaged with ${seatWord(seatCount, at.seat ?? 0)}`;
}

/** The stage's lines after its win line (no quest points, the Captain's place and that he stays, the Bodyguards, the loss). The last line ends with a period. */
export function stageLines(parts: { where: string; last: boolean; bodyguards: number; count: number; faramir: number }): string[] {
  const lines = [`${parts.where}, and cannot leave play unless destroyed`, "Progress on this stage never advances it"];
  if (parts.faramir > 0) lines.push(`Faramir is removed from the game: no version of him can be used`);
  if (parts.bodyguards > 0) lines.push(`${plural(parts.bodyguards, "Morgul Bodyguard")} in play take${parts.bodyguards === 1 ? "s" : ""} the damage meant for a Captain`);
  lines.push(`The players lose when To the Tower holds ${TOWER_LIMIT} progress tokens: it holds ${parts.count} now.`);
  return lines;
}

/** A Captain's preview line while his stage holds him: what he cannot do, what his destruction does, and who takes his damage. */
export function captainWords(stage: number, current: boolean, destroyWins: boolean, bodyguards: number): string {
  const then = destroyWins ? "wins the game" : "advances the quest";
  const shield = bodyguards > 0 ? ` ${plural(bodyguards, "Morgul Bodyguard")} in play take${bodyguards === 1 ? "s" : ""} the damage meant for him.` : "";
  if (!current) return `Captain of stage ${stage}. Once that stage is current he cannot leave play unless destroyed.`;
  return `Captain. He cannot leave play unless destroyed. Destroying him ${then}.${shield}`;
}

/** Murzag's line: what his Forced effect reveals and for whom. */
export const murzagWords = (seatCount: number, seat: number | null): string =>
  `After he attacks, reveal the top encounter card for the player he attacked${seat != null && seatCount > SOLO ? ` (Player ${seat + 1} now)` : ""}. An enemy engages that player and attacks this phase. A location goes to the staging area. A treachery resolves and is discarded.`;

/** Lord Alcaron's line: his tokens and his additional attacks. */
export const alcaronWords = (count: number): string =>
  `Each attack he begins places 1 progress token on To the Tower (${count} of ${TOWER_LIMIT} now). Each shadow card dealt to him with no shadow effect gives him one more attack after this one.`;

/** The Nazgûl's line: the cut on each damage, the Bodyguard exception and the attachments. */
export const nazgulWords = (bodyguards: number): string =>
  `Each damage he takes is cut to 1, with no limit for the round. No attachment can be attached to him.${bodyguards > 0 ? " Damage a Morgul Bodyguard takes for him is not cut." : ""}`;

/** A Morgul Bodyguard's line: whose damage it takes, and the count. */
export const bodyguardWords = (bodyguards: number, damage: number, hits: number): string =>
  `While it is in play, damage meant for a Captain goes whole to the Morgul Bodyguard with the most damage. The Bodyguard's own Defense does not reduce it. ${plural(bodyguards, "Morgul Bodyguard")} in play. This one has ${damage} of ${hits} damage.`;

/** The pill on the Morgul Bodyguard that takes the damage meant for a Captain, and what a screen reader hears of it. */
export const SHIELD_WORD = "Shield";
export const shieldMarkWords = "It takes the damage meant for a Captain: it holds the most damage of the Morgul Bodyguards in play.";

/** The line a shielding Bodyguard's preview adds: it is the one that takes a Captain's damage now. */
export const shieldNowWords = "This one takes the damage meant for a Captain now.";

/** To the Tower's preview line. */
export const towerWords = (count: number): string =>
  `Objective. It stays in the staging area all game: no card or effect can shuffle, discard or take it, and it is never engaged. The Power of Mordor counts it. It holds ${count} of the ${TOWER_LIMIT} progress tokens that lose the game. Card effects place progress tokens on it; questing never does.`;

/** The White Bridge's preview line: X, its Threat and quest points now, and what none does. `active`: it is the active location. */
export function bridgeWords(count: number, active: boolean): string {
  const now = `Threat X and quest points X: X is the progress tokens on To the Tower, ${count} now. Its Threat is ${count} and its quest points are ${count}.`;
  if (count > 0) return now;
  return `${now} ${active ? "It takes no progress, and stays the active location until a token is placed on To the Tower." : "As the active location it would take no progress."}`;
}

/** The travel readout's line for The White Bridge: what it has once active. */
export const bridgeTravelWords = (count: number): string =>
  count > 0 ? `It takes the next ${count} progress before the quest (X = ${count} tokens on To the Tower)` : "It has 0 quest points (X = 0 on To the Tower): it takes no progress and stays active until a token is placed";

/** The attack sheet's line for a player's attack on a Captain that a Bodyguard shields: where the damage goes. */
export const shieldWords = (captain: string, bodyguard: string, damage: number, hits: number): string => `Damage to ${captain} goes to ${bodyguard}, which holds ${damage} of ${hits} damage.`;

/** The dock readout for a player's attack on a shielded Captain. `amount`: the damage; `left`: what the Bodyguard has left before it is destroyed. */
export const shieldReadout = (amount: number, bodyguard: string, captain: string, left: number): string =>
  amount <= 0 ? `No damage; it would go to ${bodyguard}` : `${amount} damage on ${bodyguard}, not ${captain}${amount >= left ? "; it is destroyed" : `; ${left - amount} more destroys it`}`;

/** The attack sheet's line for the Nazgûl: each damage is cut to 1. */
export const NAZGUL_SHEET = "He takes 1 damage at most from each attack.";

/** An immediate attack of this scenario: Lord Alcaron's additional attack, or an enemy sent to the next player by a Morgul Bodyguard's shadow effect. */
export const additionalAttackWords = (name: string): string => ` ${name}'s additional attack: his shadow card had no effect. It has a shadow card of its own.`;
export const switchedAttackWords = (name: string): string => ` A Morgul Bodyguard's shadow effect sent ${name} to you: the first attack ended with no damage, and this one has a shadow card of its own.`;

/** The attack sheet's line on Lord Alcaron's attack: the token it placed and the attack a blank shadow card gives. */
export const alcaronAttackWords = (count: number): string => ` He placed 1 progress token on To the Tower (${count} of ${TOWER_LIMIT}). A shadow card with no effect gives him another attack.`;

/** The attack sheet's line on Murzag's attack: what follows it. `seat`: the player attacked. */
export const murzagAttackWords = (seatCount: number, seat: number): string => ` After it, Murzag reveals the top card of the encounter deck for ${seatWord(seatCount, seat)}, the player attacked.`;

/** The refusal added to "no legal target" while a Captain holds a stage: why he is not a target. */
export const CAPTAIN_REFUSAL = " A Captain cannot leave play unless destroyed, so no card can discard, return or remove him.";
export const NAZGUL_REFUSAL = " No attachment can attach to the Nazgûl of Minas Morgul.";

/** The banner's and the log's line for a placement or removal on To the Tower: the amount and the count it reaches. */
export function towerStepWords(amount: number, name: string, now: number, who?: string): string {
  const reaches = now >= TOWER_LIMIT ? `${now} of ${TOWER_LIMIT}: the players lose the game` : `${now} of ${TOWER_LIMIT}`;
  return amount < 0 ? `${-amount} progress removed from ${name}, ${reaches}` : who ? `${who} places ${amount} progress on ${name}, ${reaches}` : `${amount} progress on ${name}, ${reaches}`;
}

/** The banner's line for damage that went to a Morgul Bodyguard in a Captain's place. */
export const bodyguardTookWords = (amount: number, bodyguard: string, captain: string | null): string => `${amount} damage on ${bodyguard}${captain ? `, in ${captain}'s place` : ", in a Captain's place"}`;

/** The banner's lines for Murzag's Forced effect: the card he reveals, and the enemy it engages, which attacks this phase. */
export const murzagRevealsWords = (murzag: string, card: string): string => `${murzag} reveals ${card}`;
export const murzagEngagesWords = (murzag: string, enemy: string, who: string): string => `${murzag} reveals ${enemy}: it engages ${who} and attacks this phase`;

/** The banner's and the log's line for the enemy a Morgul Bodyguard's shadow effect sent to the next player. */
export const switchEngagesWords = (enemy: string, who: string): string => `A Morgul Bodyguard's shadow effect ends the attack with no damage: ${enemy} engages ${who} and attacks ${who} now`;

/** The line for an enemy that went back to the staging area: by a shadow card's effect, or by the Forced effect of Morgul Vale at the end of the round. */
export const returnsWords = (enemy: string, via: string, shadow: boolean): string => `${enemy} returns to the staging area (${via}'s ${shadow ? "shadow effect" : "effect at the end of the round"})`;

/** The banner's line for damage cut to 1 on the Nazgûl. */
export const cutWords = (name: string): string => `1 damage on ${name}, cut to 1`;

/** The words of the verbs this scenario added, in a sentence of a choice or a response. Null for any other verb. */
export function valeWords(instruction: Instruction): string | null {
  switch (instruction.verb) {
    case "PlaceProgressOnNamed":
      return `place ${tokens(typeof instruction.amount === "number" ? instruction.amount : 1)} on ${instruction.name}`;
    case "RemoveAllNamedFromGame":
      return `remove every ${instruction.name} the players own from the game, whether in a deck, a hand, a discard pile or in play`;
    case "RevealTopEngaging":
      return "reveal the top card of the encounter deck in full for the player attacked: an enemy engages that player and attacks this phase";
    case "AttackPerBlankShadow":
      return "make one more attack for each shadow card dealt with no shadow effect";
    default:
      return null;
  }
}
