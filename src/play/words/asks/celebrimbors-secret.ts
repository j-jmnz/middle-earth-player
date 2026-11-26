import type { Ask } from "../asks.ts";

// The choice words of Celebrimbor's Secret (the-ring-maker part 8), one entry for each Pick and Choose of its records: `<record id> @<instruction path> <verb | option id>` (src/play/words/asks.ts; docs/design-system-table.md, Choice tray).
// `pnpm test scenario celebrimbors-secret --words` fails on a Pick or Choose with neither an entry nor words of its own, and `WORDS_DUMP=celebrimbors-secret` prints each sentence.
// The Scour order picks (`TriggerScour` over the cards in play, asked of the first player when two or more cards are left) are asked by the engine, not by a record's Pick; the words test counts them as asking, and their entries are keyed on the record that triggers them.
const SCOUR_ORDER: Ask = {
  owned: true,
  // The clause about Ancient Foundation is said only while one is in play: it is the card that counts locations.
  note: [
    { when: { kind: "canPick", pick: { type: "location", control: "any", staging: true, names: ["Ancient Foundation"] } }, text: "Choose which Scour effect resolves next. Each one finishes before the next starts, so damage from one can bury a location before Ancient Foundation counts locations." },
    { text: "Choose which Scour effect resolves next. Each one finishes before the next starts." },
  ],
  verb: "Resolve",
};

export const ASKS: Readonly<Record<string, Ask>> = {
  // 08122:A:1 (The Ruins of Ost-in-Edhil): each player in turn searches for an Ost-in-Edhil location with a different title.
  "08122:setup:1 @1.0 SearchMove": { owned: true, note: "The Ruins of Ost-in-Edhil: choose an Ost-in-Edhil location with a different title from the others found, from the encounter deck or discard pile. It is added to the staging area.", verb: "Add" },

  // 08122:B:2 and 08123:B:2 (the last time counter is removed): each Scour effect in play is triggered, the first player ordering them.
  "08122:forced:1 @0 TriggerScour": SCOUR_ORDER,
  "08123:forced:1 @0 TriggerScour": SCOUR_ORDER,

  // 08123:A:1 (The Enemy's Servant): each Scour effect, then Bellach attacks the player who controls Celebrimbor's Mould, then the Mould is attached to Bellach.
  "08123:whenRevealed:1 @0 TriggerScour": SCOUR_ORDER,
  "08123:whenRevealed:1 @1 Pick": { owned: true, note: "The Enemy's Servant: Bellach attacks the player who controls Celebrimbor's Mould. Then the Mould is attached to Bellach.", verb: "Attack" },

  // 08124:A:1 (Bellach): Scour, each player searches the encounter deck and discard pile for an Orc enemy and adds it to the staging area.
  "08124:triggered:1 @0.0 SearchMove": { owned: true, note: "Bellach's Scour: choose an Orc enemy from the encounter deck or discard pile. It is added to the staging area.", verb: "Add" },

  // 08128:A:1 (Bellach's Scout): place 3 damage on the active location, or reveal an additional encounter card.
  "08128:whenRevealed:1 @0 damage": { label: "Place 3 damage on the active location" },
  "08128:whenRevealed:1 @0 reveal": { label: "Reveal an additional encounter card" },

  // 08129:A:1 (Prowling Orc): Scour, it engages the player with the highest threat and attacks at once.
  "08129:triggered:1 @0 Pick": { owned: true, note: "Prowling Orc's Scour: choose among the players tied for the highest threat. Prowling Orc engages that player and attacks at once.", verb: "Engage" },

  // 08130:A:2 (Ruined Plaza): shadow, the defender assigns X damage among his characters, X the cards underneath The Orcs' Search.
  "08130:shadow:1 @0 AssignDamage": { owned: true, note: "Ruined Plaza's shadow: assign {left} damage among characters you control, one for each card underneath The Orcs' Search.", title: "{card}: assign {left}", verb: "Assign" },

  // 08132:A:1 (Ancient Foundation): Scour, the first player assigns X damage among locations in play.
  "08132:triggered:1 @0 AssignDamage": {
    owned: true,
    note: [
      { when: { kind: "canPick", pick: { type: "location", control: "any", staging: true, names: ["The Secret Chamber"] } }, text: "Ancient Foundation's Scour: assign {left} damage among locations in play, one for each location. A location at its quest points goes underneath The Orcs' Search. If The Secret Chamber goes there, the players lose the game." },
      { text: "Ancient Foundation's Scour: assign {left} damage among locations in play, one for each location. A location at its quest points goes underneath The Orcs' Search." },
    ],
    title: "{card}: assign {left}",
    verb: "Assign",
  },

  // 08134:A:1 (Discovered!): trigger each Scour effect, or each player puts a random hand card underneath The Orcs' Search.
  "08134:whenRevealed:1 @0.scour.0 TriggerScour": SCOUR_ORDER,
  "08134:whenRevealed:1 @0 scour": { label: "Trigger each Scour effect in play" },
  "08134:whenRevealed:1 @0 hand": { label: "Each player puts a random card from hand facedown underneath The Orcs' Search" },

  // 08136:A:2 (shadow): the defender discards a non-objective attachment he controls.
  "08136:shadow:1 @0 Pick": { owned: true, note: "Choose a non-objective attachment you control to discard.", verb: "Discard" },
};
