// Rules: ats.cair-andros-location-damage, ats.cair-andros-remove-stage, ats.cair-andros-defense-carry-over, hon.battle, hon.siege, rr.removed-from-game, rr.cannot (data/rules/entries.json); ledger lines 05033:A:1, 05034:A:1, 05035:A:1, 05033:A:2, 05072:B:2, 05073:B:1, 05075:B:2, 05076:B:3, 05058:A:1.
// The words of The Siege of Cair Andros' table pieces: the damage on each Battleground location against the number that removes it from the game, the stage lines (where undefended damage goes, the extra Threat and reveal, the victory points toward Battle), the stages removed from the
// quest deck and a hero whose resources cannot be spent. Damage is never worded as progress (ats.cair-andros-location-damage). Pure.

/** What a Battleground location's preview says: its damage against the limit, and what reaching it does (the card prints the rest). */
export const battlegroundWords = (damage: number, limit: number): string => `${damage} of ${limit} damage. At ${limit} it is removed: no Response, no victory points.`;

/** What a Battleground location's top-bar dial says it counts toward. */
export const battlegroundDialWords = (name: string, limit: number): string => `${name} is removed from the game at ${limit} damage: it is not explored and its victory points are not collected`;

/** The warning one damage short of the limit. */
export const battlegroundNearWords = (name: string, damage: number, limit: number): string => `${name} holds ${damage} of ${limit} damage: ${limit} removes it from the game, with no victory points`;

/** Stage 1B in its preview: where the damage of an undefended attack goes, by name when a Battleground location is in play. */
export const undefendedWords = (names: readonly string[]): string =>
  names.length === 0
    ? "No Battleground location is in play: the quest advances to the next stage at once"
    : `Undefended damage goes to ${names.length === 1 ? names[0] : `one of ${names.join(" and ")}`} now.`;

/** The attack sheet's 6.E guide while stage 1B is current. */
export const UNDEFENDED_GUIDE = "Each enemy attacks: declare one defender, or leave it undefended: a Battleground location takes it.";

/** The readout line of an undefended attack that alone reaches the limit of the location it lands on. */
export const removesWords = (): string => "; it is removed from the game";

/** The choice sheet of an attack while stage 1B sends the damage to a location: the location, the damage it holds and whether this attack removes it. */
export const undefendedSheetWords = (name: string, damage: number, limit: number, attack: number): string =>
  `Undefended: ${name} takes all of it, and no hero does. It holds ${damage} of ${limit} damage${damage + attack >= limit ? `: this attack removes it from the game` : ""}.`;

/** Stage 4B: the 5 Threat it adds to the staging area while it is the current stage. */
export const stagingThreatWords = (amount: number): string => `Adds ${amount} Threat to the staging area while it is the current stage`;

/** Stage 2B: the extra card each staging step reveals while it is the current stage. */
export const extraRevealWords = (amount: number): string => `Reveals ${amount} more encounter ${amount === 1 ? "card" : "cards"} in each staging step while it is the current stage`;

/** Stage 5B: the victory points toward the 4 that make it a Battle stage, and the stat it counts now. */
export const battleTurnWords = (points: number, needed: number): string =>
  points >= needed ? `${points} of ${needed} victory points in the victory display: it has Battle and not Siege, so characters quest with Attack` : `${points} of ${needed} victory points in the victory display. At ${needed} it has Battle and not Siege`;

/** The stages the Responses took out of the quest deck, by number. */
export const removedStagesWords = (numbers: readonly number[]): string => (numbers.length === 1 ? `Stage ${numbers[0]} was removed from the quest deck` : `Stages ${numbers.slice(0, -1).join(", ")} and ${numbers.at(-1)} were removed from the quest deck`);

/** A hero's preview while a card stops its pool paying. */
export const lockedResourcesWords = (source: string): string => `Its resources cannot be spent while ${source} is in the staging area. It can still gain and hold them`;

/** Orc Arbalesters' preview: what Archery X counts, and its value now. */
export const arbalestersWords = (x: number): string => `Archery X: X is the number of different resource icons (Leadership, Tactics, Spirit, Lore) on the heroes in play. It is ${x} now`;
