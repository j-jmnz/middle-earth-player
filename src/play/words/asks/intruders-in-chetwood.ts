import type { Ask } from "../asks.ts";

// The choice words of Intruders in Chetwood (angmar-awakened part 1), one entry for each Pick and Choose of its records: `<record id> @<instruction path> <verb | option id>` (src/play/words/asks.ts; docs/design-system-table.md, Choice tray).
// `pnpm test scenario intruders-in-chetwood --words` fails on a Pick or Choose with neither an entry nor words of its own, and `WORDS_DUMP=intruders-in-chetwood` prints each sentence.
// The first player answers for the group (the player who engages at Chetwood Forest, the enemy Borders of Bree-land returns, Angmar Orc's and Pressing Needs' options), so those sentences are not owned and the sheet adds who chooses; the rest are one player's own choice.
// Iârion is an ally for Angmar Orc's discard, and discarding him loses the game (09016:A:4): his row says so.
const IARION_LOST: NonNullable<Ask["caution"]> = { when: { kind: "matches", card: "picked", pick: { type: "ally", control: "any", names: ["Iârion"] } }, text: "Tap again: discarding Iârion loses the game" };

export const ASKS: Readonly<Record<string, Ask>> = {
  // 09018:A:1 (Travel): the first player decides which player engages, and that player chooses the enemy.
  "09018:travel:1 @0 Pick": { note: "Chetwood Forest: choose the player who chooses an enemy in the staging area and engages it.", verb: "Choose" },
  "09018:travel:1 @2 Pick": { owned: true, note: "Chetwood Forest: choose an enemy in the staging area to engage.", verb: "Engage" },

  // 09018:A:2 (Shadow): the defending player chooses.
  "09018:shadow:1 @0 Choose": { owned: true, note: "Chetwood Forest shadow: you either exhaust a hero you control, or the attacking enemy returns to the staging area after this attack." },
  "09018:shadow:1 @0 exhaust": { label: "Exhaust a hero you control" },
  "09018:shadow:1 @0 staging": { label: "{host} returns to the staging area after the attack" },
  "09018:shadow:1 @0.exhaust.0 Pick": { owned: true, note: "Chetwood Forest shadow: choose a ready hero you control to exhaust.", verb: "Exhaust" },

  // 09019:A:1 (Forced, beginning of the quest phase): the first player chooses the one enemy for the group.
  "09019:forced:1 @0 Pick": { note: "Borders of Bree-land: choose an enemy engaged with a player to return to the staging area.", verb: "Return" },

  // 09021:A:1 (When Revealed): no attack was made, so the first player's search finds the Orc War Party.
  "09021:whenRevealed:1 @1 SearchMove": { owned: true, note: "Sudden Assault: no enemy attacked. Search the encounter deck and discard pile for an Orc War Party and add it to the staging area.", verb: "Add" },

  // 09022:A:1 (When Revealed, a copy of 41017:A:1): each player returns an enemy engaged with them.
  "09022:whenRevealed:1 @0.0 ReturnToStaging": { owned: true, note: "Surprising Speed: choose an enemy engaged with you to return to the staging area.", verb: "Return" },

  // 09043:A:1 (When Revealed): the first player chooses for the group, Iârion being an ally.
  "09043:whenRevealed:1 @0 Choose": { note: "Angmar Orc: the first player either discards an ally from play, or reveals an additional encounter card." },
  "09043:whenRevealed:1 @0 ally": { label: "Discard an ally from play" },
  "09043:whenRevealed:1 @0 reveal": { label: "Reveal an additional encounter card" },
  "09043:whenRevealed:1 @0.ally.0 Pick": { note: "Angmar Orc: choose an ally in play to discard.", verb: "Discard", caution: IARION_LOST },

  // 09046:A:2 (When Revealed): each player in turn searches for an Orc enemy.
  "09046:whenRevealed:1 @0.0 SearchMove": { owned: true, note: "Orc Ambush: search the encounter deck and discard pile for an Orc enemy. Put it into play engaged with you.", verb: "Engage" },

  // 09049:A:2 (When Revealed): the first player chooses for the group.
  "09049:whenRevealed:1 @0 Choose": { note: "Pressing Needs: the first player either searches for an encounter side quest and reveals it, or makes another quest card the current quest this phase." },
  "09049:whenRevealed:1 @0 search": { label: "Search the encounter deck and discard pile for an encounter side quest and reveal it" },
  "09049:whenRevealed:1 @0 current": { label: "Make a different quest card in play the current quest until the end of the phase" },
  "09049:whenRevealed:1 @0.search.0 SearchReveal": { note: "Pressing Needs: search the encounter deck and discard pile for an encounter side quest. Reveal it.", verb: "Reveal" },
  "09049:whenRevealed:1 @0.current.0 ChooseCurrentQuest": { note: "Pressing Needs: choose the main quest card or a side quest in the staging area to be the current quest this phase.", verb: "Choose" },

  // 09050:A:2 (Shadow): the defending player discards.
  "09050:shadow:1 @0.0 Pick": { owned: true, note: "Weight of Responsibility shadow: choose an attachment you control to discard.", verb: "Discard" },

  // 09068:A:1 (Setup): each player in turn, the first player first, adds a location with a different title.
  "09068:setup:1 @1.0 SearchMove": { owned: true, note: "Stop the War Party: search the encounter deck for a location with a different title from those added. Add it to the staging area.", verb: "Add" },

  // 10156:A:2 (campaign Setup): each player in turn may trade damage on Protect the Innocent for resources.
  "10156:campaignSetup:1 @2 TradeDamageForResources": { owned: true, note: "Protect the Innocent holds {held} of 10 damage; placing 4 makes {made}. You may place 4 damage on it to add 1 resource to each hero you control. The players lose at 10.", bind: { held: { stat: "damage", ofNamed: "Protect the Innocent" }, made: { stat: "damage", ofNamed: "Protect the Innocent", plus: 4 } }, labels: { trade: "Place 4 damage on Protect the Innocent, add 1 resource to each of your heroes", keep: "Place no damage" } },
};
