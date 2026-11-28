import type { Amount, PickSpec } from "../../../catalog/boundary.ts";
import type { Ask } from "../asks.ts";

// The choice words of Wrath and Ruin (vengeance-of-mordor part 4), one entry for each Pick and Choose of its records: `<record id> @<instruction path> <verb | option id>` (src/play/words/asks.ts; docs/design-system-table.md, Choice tray).
// `pnpm test scenario wrath-and-ruin --words` fails on a Pick or Choose with neither an entry nor words of its own, and `WORDS_DUMP=wrath-and-ruin` prints each sentence.
// Control (vom.controlling-locations, vom.losing-control-of-a-location): "return" is always to the staging area, with the progress removed. A Pick that belongs to the player whose character was destroyed, or to each player in turn, is owned. No row raises a player's threat, so no row arms a caution: an attack row names the attacker and its Attack.
const RETURN = "choose a location you control to return to the staging area. Its progress is removed.";
const MINE_HIGHEST: PickSpec = { type: "location", control: "you", controlled: true, highestThreat: true };
const TIED = { tied: { count: MINE_HIGHEST } };
const ULCHOR: PickSpec = { type: "enemy", control: "any", names: ["Thane Ulchor"], staging: true };
const CHAMPION: PickSpec = { type: "enemy", control: "any", names: ["Champion of Rhûn"] };
// The locations a player controls: X is 1 more than their number.
const X_MINE: Amount = { count: { type: "location", control: "you", controlled: true }, plus: 1 };
// The Easterling enemies without Fury that tie for the lowest engagement cost, the cards the first player chooses among.
const FURY_CANDIDATE: PickSpec = { type: "enemy", control: "any", staging: true, trait: "Easterling", hasAttachment: { names: ["Fury"], none: true }, lowestEngagementCost: true };
const EASTERLING = { type: "enemy", control: "any", staging: true, trait: "Easterling" } as const;
const LOWEST_ATTACK = (title: string): PickSpec => ({ ...EASTERLING, hasAttachment: { names: [title], none: true }, lowestAttack: true });
const HIGHEST_COST = (title: string): PickSpec => ({ ...EASTERLING, hasAttachment: { names: [title], none: true }, highestEngagementCost: true });

export const ASKS: Readonly<Record<string, Ask>> = {
  // 21022:A:3, 21023:A:3 (Sword of Rhûn, Recurve Bow, When Revealed): attach to the Easterling enemy with the lowest Attack / highest engagement cost that has no copy of it; the first player chooses among those tied.
  "21022:whenRevealed:1 @0 Pick": {
    note: "{card}: {tied} Easterling enemies are tied for the lowest Attack ({lowAttack}) and have no Sword of Rhûn. Choose the one it attaches to.",
    bind: { tied: { count: LOWEST_ATTACK("Sword of Rhûn") } },
    named: { low: { pick: LOWEST_ATTACK("Sword of Rhûn"), otherwise: "the same" } },
    verb: "Attach",
  },
  "21023:whenRevealed:1 @0 Pick": {
    note: "{card}: {tied} Easterling enemies are tied for the highest engagement cost ({highCost}) and have no Recurve Bow. Choose the one it attaches to.",
    bind: { tied: { count: HIGHEST_COST("Recurve Bow") } },
    named: { high: { pick: HIGHEST_COST("Recurve Bow"), otherwise: "the same" } },
    verb: "Attach",
  },
  // 21047:A:3 (Seedy Tavern, Travel): look at the top 5 cards of the encounter deck and put one facedown under it.
  "21047:travel:1 @1 PickEncounter": { note: "Seedy Tavern: to travel here, choose 1 of the top 5 encounter cards to put facedown under it. The other 4 are shuffled back.", verb: "Hide" },

  // 22011:A:2 (Thane Ulchor, Forced after the active location is explored): the first player chooses: discard from the top of the encounter deck until a location is discarded and add it to the staging area, or Ulchor attacks him.
  "22011:forced:1 @0 Choose": { note: "{card}: the active location was explored. {owner} chooses for all the players: reveal a location from the deck, or {card} attacks {owner} from the staging area." },
  "22011:forced:1 @0 location": { label: "Discard from the top of the encounter deck until a location is discarded, and add it to the staging area" },
  "22011:forced:1 @0 attack": { label: "Thane Ulchor attacks {owner} now ({ulchorAttack} Attack)", named: { ulchor: { pick: ULCHOR, otherwise: "Thane Ulchor" } } },

  // 22012:A:1 (Champion of Rhûn, Forced after it engages you): return a location you control to the staging area, or it makes an immediate attack against you.
  "22012:forced:1 @0 Choose": { owned: true, note: "Champion of Rhûn engaged you. Return a location you control to the staging area, or it attacks you now." },
  "22012:forced:1 @0 return": { label: "Return a location you control to the staging area. Its progress is removed" },
  "22012:forced:1 @0 attack": { label: "Champion of Rhûn attacks {owner} now ({champAttack} Attack)", named: { champ: { pick: CHAMPION, otherwise: "Champion of Rhûn" } } },
  "22012:forced:1 @0.return.0 Pick": { owned: true, note: `Champion of Rhûn engaged you: ${RETURN}`, verb: "Return" },

  // 22013:A:2 (Easterling Skirmisher, Forced after it destroys a character): that character's controller returns the location he controls with the highest Threat.
  "22013:forced:1 @0 Pick": { owned: true, note: "Easterling Skirmisher destroyed a character. {tied} of your locations tie for the highest Threat: return one to the staging area. Its progress is removed.", bind: TIED, verb: "Return" },

  // 22014:A:4 (Gate of Dorwinion, Travel): Thane Ulchor attacks each player in turn order.
  "22014:travel:1 @0.0 Pick": { note: "{card}: choose Thane Ulchor. He attacks {owner} now ({ulchorAttack} Attack).", named: { ulchor: { pick: ULCHOR, otherwise: "Thane Ulchor" } }, verb: "Attack" },

  // 22019:A:3 (Fury, When Revealed): attach to the lowest engagement cost Easterling enemy without Fury; the first player chooses among those tied.
  "22019:whenRevealed:1 @0 Pick": {
    note: "{card}: {tied} Easterling enemies are tied for the lowest engagement cost ({lowCost}) and have no Fury. Choose the one it attaches to.",
    bind: { tied: { count: FURY_CANDIDATE } },
    named: { low: { pick: FURY_CANDIDATE, otherwise: "the same" } },
    verb: "Attach",
  },

  // 22020:A:1 (Caught Off Guard, When Revealed): each player, the first player first, returns a location he controls, or discards from the top of the encounter deck until an enemy is discarded and it engages him.
  "22020:whenRevealed:1 @0.0 Choose": { owned: true, why: "it was revealed.", note: "Return a location you control to the staging area, or discard cards from the top of the encounter deck until an enemy is discarded. It engages you." },
  "22020:whenRevealed:1 @0.0 return": { label: "Return a location you control to the staging area. Its progress is removed" },
  "22020:whenRevealed:1 @0.0 enemy": { label: "Discard from the top of the encounter deck until an enemy is discarded, and it engages you" },
  "22020:whenRevealed:1 @0.0.return.0 Pick": { owned: true, note: `Caught Off Guard: ${RETURN}`, verb: "Return" },

  // 22021:A:1, A:2 (Street Fighting): each player assigns X damage among characters he controls, X 1 more than the locations he controls.
  "22021:whenRevealed:1 @0.0 AssignDamage": {
    owned: true,
    why: "it was revealed.",
    title: "{card}: assign {left}",
    note: "Assign {x} damage among characters you control: 1 more than the {locations} locations you control.",
    bind: { x: X_MINE, locations: { count: { type: "location", control: "you", controlled: true } } },
    verb: "Damage",
  },
  "22021:shadow:1 @0 AssignDamage": {
    owned: true,
    why: "it is a shadow card.",
    title: "{card}: assign {left}",
    note: "Assign {x} damage among characters you control: 1 more than the {locations} locations you control.",
    bind: { x: X_MINE, locations: { count: { type: "location", control: "you", controlled: true } } },
    verb: "Damage",
  },

  // 22022:A:2 (Under Siege, Shadow): if the attack destroys a character, its controller returns the highest Threat location he controls.
  "22022:shadow:1 @1.0 Pick": { owned: true, note: "Under Siege: {host} destroyed a character. {tied} of your locations tie for the highest Threat: return one to the staging area. Its progress is removed.", bind: TIED, verb: "Return" },

  // 22023:A:2 (Ulchor's Revenge, When Revealed): Thane Ulchor attacks each player that controls a location, in turn order.
  "22023:whenRevealed:1 @0.0 Pick": { note: "{card}: choose Thane Ulchor. He attacks {owner}, who controls a location ({ulchorAttack} Attack).", named: { ulchor: { pick: ULCHOR, otherwise: "Thane Ulchor" } }, verb: "Attack" },

  // 22025:A:1 (Inside the Walls, Setup): each player adds a different location to the staging area; the encounter deck is shuffled after.
  "22025:setup:1 @0.0 SearchMove": { owned: true, note: "Setup: choose a location from the encounter deck to add to the staging area. It is not revealed. Each player adds a different one.", verb: "Add" },

  // 22026:A:1 (Drive them Out, When Revealed): each player returns the highest Threat location he controls to the staging area.
  "22026:whenRevealed:1 @0.0 Pick": { owned: true, why: "it was revealed.", note: "{tied} of your locations tie for the highest Threat: return one to the staging area. Its progress is removed.", bind: TIED, verb: "Return" },
};
