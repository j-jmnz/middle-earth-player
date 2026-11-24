import type { Ask } from "../asks.ts";

// The choice words of Assault on Osgiliath (against-the-shadow part 7), one entry for each Pick and Choose of its records: `<record id> @<instruction path> <verb | option id>` (src/play/words/asks.ts; docs/design-system-table.md, Choice tray).
// `pnpm test scenario assault-on-osgiliath --words` fails on a Pick or Choose with neither an entry nor words of its own, and `WORDS_DUMP=assault-on-osgiliath` prints each sentence.
// Control (ats.controlling-locations, ats.losing-control-of-locations): "return" is always to the staging area, with the progress removed; only the first player takes control. The Pick of a shadow card or a Forced effect belongs to the player who controls the destroyed character, so it is owned.
const RETURN = "choose a location you control to return to the staging area. Its progress is removed.";
export const ASKS: Readonly<Record<string, Ask>> = {
  // 06091:A:1 (Retake the City, Setup): each player in turn, the first player first, adds 1 enemy and then 1 unique location from the encounter deck to the staging area; the deck is shuffled after.
  "06091:setup:1 @0.0 SearchMove": { owned: true, note: "Setup: choose an enemy from the encounter deck to add to the staging area. It is not revealed. Next you choose a unique location.", verb: "Add" },
  "06091:setup:1 @0.2 Choose": { owned: true, note: "Setup: choose a unique location from the encounter deck to add to the staging area. It is not revealed. A location another player took is not offered." },
  "06091:setup:1 @0.2 06096": { label: "West Gate: add it to the staging area" },
  "06091:setup:1 @0.2 06097": { label: "The King's Library: add it to the staging area" },
  "06091:setup:1 @0.2 06098": { label: "Ancient Harbor: add it to the staging area" },
  "06091:setup:1 @0.2 06099": { label: "The Old Bridge: add it to the staging area" },
  "06091:setup:1 @0.2.06096.0 SearchMove": { owned: true, note: "Setup: West Gate is added to the staging area, not revealed.", verb: "Add" },
  "06091:setup:1 @0.2.06097.0 SearchMove": { owned: true, note: "Setup: The King's Library is added to the staging area, not revealed.", verb: "Add" },
  "06091:setup:1 @0.2.06098.0 SearchMove": { owned: true, note: "Setup: Ancient Harbor is added to the staging area, not revealed.", verb: "Add" },
  "06091:setup:1 @0.2.06099.0 SearchMove": { owned: true, note: "Setup: The Old Bridge is added to the staging area, not revealed.", verb: "Add" },
  // 06092:A:2 (Uruk Lieutenant, Shadow): the defending player discards an attachment he controls, all of them when the attack is undefended.
  "06092:shadow:1 @0 Pick": { owned: true, note: "Uruk Lieutenant (shadow): choose an attachment you control to discard.", verb: "Discard" },
  // 06093:A:1 (Uruk Soldier): after it destroys a character, that character's controller returns a location he controls to the staging area.
  "06093:forced:1 @0 Pick": { owned: true, note: `Uruk Soldier destroyed a character: ${RETURN}`, verb: "Return" },
  // 06096:A:1 (West Gate, Action): search for an Osgiliath location to reveal and add; West Gate then becomes the active location. With nothing to find it does not.
  "06096:action:1 @0 Choose": { owned: true, note: "West Gate: search the encounter deck and discard pile for an Osgiliath location. It is revealed and added to the staging area, then West Gate becomes the active location and the deck is shuffled. A controlled West Gate is no longer controlled." },
  "06096:action:1 @0 found": { label: "Search, reveal the location found and make West Gate the active location" },
  "06096:action:1 @0 none": { label: "No Osgiliath location can be found: West Gate stays where it is" },
  // 06098:A:2 (Ancient Harbor, combat Action): exhaust a hero to place 1 progress on it, wherever it is.
  "06098:action:1 @0 Pick": { owned: true, note: "Ancient Harbor: choose a hero you control to exhaust. Then place 1 progress on Ancient Harbor, wherever it is.", verb: "Exhaust" },
  // 06100:A:2, 06101:A:2, 06104:A:2 (West Quarter, East Quarter, Pinned Down, Shadow): if the attack destroys a character, its controller returns the location he controls with the highest Threat.
  "06100:shadow:1 @0.1 Pick": { owned: true, note: "West Quarter destroyed a character: choose, among the locations you control with the highest Threat, the one to return to the staging area. Its progress is removed.", verb: "Return" },
  "06101:shadow:1 @0.1 Pick": { owned: true, note: "East Quarter destroyed a character: choose, among the locations you control with the highest Threat, the one to return to the staging area. Its progress is removed.", verb: "Return" },
  "06104:shadow:1 @0.1 Pick": { owned: true, note: "Pinned Down destroyed a character: choose, among the locations you control with the highest Threat, the one to return to the staging area. Its progress is removed.", verb: "Return" },
  // 06103:A:1 (Ruined Tower, Travel): with 1 active location, exhaust a character to travel here as a second active location.
  "06103:travel:1 @0 Pick": { owned: true, note: "Ruined Tower: choose a character you control to exhaust. Ruined Tower becomes a second active location.", verb: "Exhaust" },
  // 06105:A:1 (Street Fighting): the first player may exhaust a hero to take control of the Osgiliath location the discard stopped at; otherwise it is added to the staging area.
  "06105:whenRevealed:1 @1 Choose": { owned: true, note: "Street Fighting: the discarded Osgiliath location is the last card discarded. Exhaust a hero to take control of it, or add it to the staging area." },
  "06105:whenRevealed:1 @1 take": { label: "Exhaust a hero: you control the discarded location, with no progress" },
  "06105:whenRevealed:1 @1 stage": { label: "Do not exhaust: add the discarded location to the staging area" },
  "06105:whenRevealed:1 @1.take.0 Pick": { owned: true, note: "Street Fighting: choose a hero you control to exhaust. You take control of the discarded location.", verb: "Exhaust" },
  // 06106:A:2 (Counter-attack): each player, the first player first, returns the controlled location with the highest Threat or raises his threat by the total Threat of the locations he controls.
  "06106:whenRevealed:1 @0.0 Choose": { owned: true, note: "Counter-attack: return the location you control with the highest Threat to the staging area, or raise your threat by the total Threat of the locations you control." },
  "06106:whenRevealed:1 @0.0 return": { label: "Return your highest-Threat location to the staging area" },
  "06106:whenRevealed:1 @0.0 raise": { label: "Raise your threat by the total Threat of your locations" },
  "06106:whenRevealed:1 @0.0.return.0 Pick": { owned: true, note: "Counter-attack: choose, among the locations you control with the highest Threat, the one to return to the staging area. Its progress is removed.", verb: "Return" },
};
