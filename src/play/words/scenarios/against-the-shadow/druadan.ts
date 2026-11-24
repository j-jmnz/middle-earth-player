// Rules: ats.prowl, ats.prowl-example, hon.siege, hon.archery, faq.victory-display, rr.cost, rr.travel (data/rules/entries.json); ledger lines 06043:B:1, 06044:B:2, 06044:B:3, 06045:A:2, 06045:A:3, 06047:A:1, 06048:A:1, 06049:A:1, 06050:A:1, 06051:A:1, 06051:A:2, 06052:A:1, 06054:A:1.
// The words of The Drúadan Forest's table pieces: the Prowl and Archery X lines of an enemy's preview, the archery a Glade gives a Wose, the progress on Drû-buri-Drû against his hit points, the attack readout of stage 3 (Willpower in place of Attack, progress in place of damage), the
// win bar of stage 3, the cost Ancestral Clearing adds, and Garden of Poisons' two lines. Progress is never worded as damage here (06044:B:2). Pure.
import { plural } from "../../list.ts";

/** An enemy's preview: what its Prowl X does when it is revealed. A discard, not a spend. */
export const prowlWords = (x: number): string => `Prowl ${x}: when it is revealed, the players as a group discard ${plural(x, "resource")} from their heroes' pools, as many as they can. It is a discard, not a spend.`;

/** The Hunter's preview: what its Archery X counts and its value now. */
export const archeryXWords = (x: number): string => `Archery X: X is the number of heroes in play with no resources in their pool. It is ${x} now.`;

/** A Wose's preview: its archery total, and each card that gives it archery beyond its print. */
export const woseArcheryWords = (total: number, gains: readonly { name: string; amount: number }[]): string =>
  `Archery ${total}: ${gains.map((gain) => `${gain.amount >= 0 ? "+" : ""}${gain.amount} from ${gain.name}`).join(", ")}.`;

/** The preview of an enemy that holds progress while stage 3 turns its attack damage into progress: the tokens against its hit points, and what the full number does. */
export const enemyProgressWords = (progress: number, hits: number): string => `${progress} of ${hits} progress. At ${hits} it goes to the victory display and its progress goes to the quest.`;

/** The attack sheet's first sentence while characters attack with Willpower and the damage is progress: short, so the sheet does not cut it off. */
export const willpowerAttackWords = (defense: number): string => `Willpower against Defense ${defense}. Each point over is 1 progress, not damage.`;

/** The dock readout's line for an attack that places progress: how much, the progress it will hold against the hit points, and whether that fills it. */
export function progressResultWords(amount: number, name: string, held: number, hits: number): string {
  if (amount <= 0) return "No progress";
  const total = held + amount;
  const text = `${amount} progress on ${name}, ${Math.min(total, hits)} of ${hits} progress`;
  return total >= hits ? `${text}; it goes to the victory display and all ${total} progress to the quest` : text;
}

/** The dock readout's line once the attack has struck: the progress the enemy holds now. */
export const progressHeldWords = (held: number, hits: number, name: string): string => `${held} of ${hits} progress on ${name}`;

/** The dock readout's line once the strike filled the enemy: it is in the victory display and its progress is on the quest. */
export const progressFilledWords = (name: string): string => `${name} is in the victory display; its progress is on the quest`;

/** The stage 3 line: what wins the game, where each half stands, and that progress waits on the stage until both halves are true (06044:B:3, 06045:A:3). `where`: Drû-buri-Drû's place now. It ends with a period: it is the last line of the stage's text. */
export function winBarWords(progress: number, points: number, where: "victory" | "play" | "gone", name: string): string {
  if (where === "gone") return `${name} is out of play, so the players cannot win.`;
  const need = `The players win with ${points} progress on this stage and ${name} in the victory display`;
  const standing = where === "victory" ? `${progress} of ${points} progress, and he is there` : `${progress} of ${points} progress, and he is not there yet`;
  return `${need}. ${standing}. Progress stays on the stage until both are true: ${points} of ${points} without him, nothing happens.`;
}

/** The dial of Drû-buri-Drû. */
export const druDialName = (name: string): string => `Progress on ${name}, toward his hit points:`;
export const druDialLimit = (name: string, hits: number): string => `${name} goes to the victory display at ${hits} progress, and all his progress goes to the quest`;
export const druDialNote = (name: string, progress: number, hits: number, points: number): string =>
  `${name} holds ${progress} of ${hits} progress. At ${hits} he goes to the victory display and his progress goes to the quest. The players win with ${points} progress on the stage and ${name} in the victory display.`;
export const druDialDoneNote = (name: string, progress: number, points: number): string => `${name} is in the victory display. The players win when the stage holds ${points} progress: it holds ${progress}.`;

/** A player card in hand or in a play area under Ancestral Clearing: what it costs now and why. */
export const clearingCostWords = (cost: number, more: number, source: string): string => `Costs ${cost} to play: ${more} more from ${source}.`;

/** Ancestral Clearing's preview. */
export const clearingWords = (more: number): string => `While it is in play, each player card costs ${more} more to play. To travel here, exhaust 1 ready hero of any player; the first player chooses.`;

/** Garden of Poisons' preview: what its printed lines leave unsaid (the resource phase still gives resources, and when the players cannot travel here). */
export const GARDEN_WORDS = "Heroes still gain 1 resource in the resource phase. The players cannot travel here while a player cannot pay 1 resource from their heroes' pools.";

/** A hero's preview while Garden of Poisons is in play. */
export const gardenHeroWords = (source: string): string => `${source} stops card effects from giving it resources. The resource phase still gives it 1.`;

/** The Archery sheet's note while An Untimely End sends archery damage to allies. */
export const ALLIES_ARCHERY_WORDS = "Archery damage must go to allies while any ally is in play: only allies are listed.";
