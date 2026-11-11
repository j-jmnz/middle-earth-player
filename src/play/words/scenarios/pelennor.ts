// Rules: mec113.minas-tirith, mec113.assault, mec113.multiplayer-aragorn, mec113.saga-staging-rules, rr.active-location, rr.quest-advancement, rr.damage (data/rules/entries.json); ledger lines 145043:A:1, 145043:A:2, 145044:A:2, 145044:A:3, 145046:A:1, 145046:A:2, 145072:A:1, 145074:B:1, 145075:B:1, 145076:B:1.
// The words of The Battle of the Pelennor Fields' table pieces: Minas Tirith's damage against its hit points, City Wall's damage against its quest points, The Corsair Fleet's resources (Aragorn's return), Grond's resources, the allies in the staging area, and the
// quest result on stages 3B (Assault) and 4B (progress becomes damage). Pure.

/** What the City's dial counts toward: the damage on Minas Tirith against its hit points, and what loses the game (145043:A:1, 145043:A:2). */
export const cityWords = (hitPoints: number): string => `Minas Tirith has ${hitPoints} hit points. At the end of the round it takes 1 damage for each enemy in the staging area, and when none remain the players lose the game`;

/** The warning near the limit: the damage it holds, and what the end of the round deals (the enemies in the staging area, less what City Wall takes first). */
export const cityNearWords = (damage: number, hitPoints: number, incoming: number): string =>
  incoming > 0
    ? `Minas Tirith holds ${damage} of ${hitPoints} damage: at the end of the round it takes ${incoming} more from the enemies in the staging area`
    : `Minas Tirith holds ${damage} of ${hitPoints} damage: ${hitPoints - damage} more destroys it and the players lose the game`;

/** The last warning: the damage the end of the round deals reaches the hit points left. */
export const cityDestroyedWords = (damage: number, hitPoints: number, incoming: number): string =>
  `Minas Tirith holds ${damage} of ${hitPoints} damage: the ${incoming} damage at the end of the round destroys it and the players lose the game`;

/** What City Wall's dial counts toward: its damage against its quest points, taken before Minas Tirith while it is the active location (145046:A:1, 145046:A:2). */
export const wallWords = (questPoints: number): string => `While City Wall is the active location it takes the damage meant for Minas Tirith first, up to ${questPoints}. At ${questPoints} it is discarded and each player raises their threat by 3`;

/** The warning one point short of the limit. */
export const wallNearWords = (damage: number, questPoints: number): string => `City Wall holds ${damage} of ${questPoints} damage: at ${questPoints} it is discarded and each player raises their threat by 3`;

/** What the Fleet's dial says: its resources, the one removed each quest phase and what happens at 0 (145072:A:1, 145078:A:1). */
export const fleetWords = (resources: number): string =>
  `${resources} resources on The Corsair Fleet. At the beginning of each quest phase it loses 1. At none the first player takes control of Aragorn with Andúril and the Banner of Elendil, and it goes to the victory display. Stage 5B cannot be defeated without Aragorn`;

/** What Grond's dial says: X is its resources, the Threat it adds and the damage it deals to Minas Tirith at the beginning of each quest phase, after it gains 1 (145044:A:2, 145044:A:3). */
export const grondWords = (resources: number): string => `X is ${resources}: the resources on Grond, and its Threat. At the beginning of each quest phase it gets 1 resource, then deals X damage to Minas Tirith`;

/** What the allies dial says: the total printed cost of the allies in the staging area is the quest points of stage 2B (145074:B:1, 145074:B:2, 145074:B:3). */
export const alliesWords = (cost: number): string =>
  `X is ${cost}: the total cost of the allies in the staging area, the quest points of Retreat from Osgiliath. They are blank, immune to player card effects and controlled by no player, and take the damage at the end of the round`;

/** The quest result on stage 3B: Assault places no progress on the stage from questing and turns a failed quest into damage to Minas Tirith, no threat raised (145075:B:1). */
export function assaultQuestWords(margin: number, onLocation: boolean, cityDamage: number | null, cityLeft: number | null): string {
  if (margin > 0) return onLocation ? `${margin} progress on the active location, none on the stage, if nothing changes: Assault` : "No progress on the stage if nothing changes: Assault places none from questing";
  if (margin === 0) return "No progress and no threat if nothing changes";
  if (cityDamage == null) return "No threat raised and no damage dealt if nothing changes: Minas Tirith is not in play";
  const lost = cityLeft != null && -margin >= cityLeft ? `; Minas Tirith is destroyed and the players lose the game` : "";
  return `${-margin} damage to Minas Tirith, no threat raised, if nothing changes${lost}`;
}

/** The quest result on stage 4B: the progress questing would place is dealt as damage among the enemies in play, none on the stage (145076:B:1). */
export const rohanQuestWords = (margin: number): string => `${margin} damage among the enemies in play if nothing changes: Rohan has Come! places none on the stage`;
