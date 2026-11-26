import type { Amount } from "../../../catalog/boundary.ts";
import type { Ask } from "../asks.ts";

// The choice words of The Long Arm of Mordor (haradrim part 3), one entry for each Pick and Choose of its records: `<record id> @<instruction path> <verb | option id>` (src/play/words/asks.ts; docs/design-system-table.md, Choice tray).
// `pnpm test scenario the-long-arm-of-mordor --words` fails on a Pick or Choose with neither an entry nor words of its own, and `WORDS_DUMP=the-long-arm-of-mordor` prints each sentence.
// X is the stage number of the main quest wherever a card says it (16035, 16039): the bind reads it from the quest card on the table.
const STAGE: Amount = { stage: true };
const X = { x: STAGE } as const;

export const ASKS: Readonly<Record<string, Ask>> = {
  // 16071:A:1 (Surprise Attack, Setup): each player in turn takes one of the set-aside objective-heroes, with 2 resources on it.
  "16071:setup:1 @1.0 TakeObjectiveHero": { owned: true, note: "Surprise Attack: take an objective-hero. It joins your heroes with 2 resources, and you are eliminated if it leaves play.", verb: "Take" },

  // 16071:B:3 (Surprise Attack, stage 1B) and 16072:B:3 (Find the Others, stage 2B): each player takes control of a hero they own in the staging area, exhausted.
  "16071:forced:1 @0.0 ReleaseStagedHero": { owned: true, note: "Surprise Attack: take back a hero you own from the staging area. It returns to your heroes, exhausted.", verb: "Take back" },
  "16072:forced:1 @0.0 ReleaseStagedHero": { owned: true, note: "Find the Others: take back one more hero you own from the staging area. It returns to your heroes, exhausted.", verb: "Take back" },

  // 16073:A:1 (Free the Captives): each player adds an Orc enemy from the encounter deck or discard pile to the staging area, then the first player pairs each hero in the staging area with an Orc there.
  "16073:whenRevealed:1 @0.0 SearchMove": { owned: true, note: "Free the Captives: choose an Orc enemy in the encounter deck or discard pile to add to the staging area.", verb: "Add" },
  "16073:whenRevealed:1 @2 GuardStagedHeroes": { owned: true, note: "Free the Captives: choose the Orc enemy in the staging area that will guard {hero}. The hero goes under it.", verb: "Guard" },

  // 16061:A:3 (Uruk Chieftain): at the end of the encounter phase it engages the player engaged with the most non-unique Orc enemies; the first player picks among tied players.
  "16061:forced:1 @0 EngageSeatWithMost": {
    owned: true,
    note: "Uruk Chieftain: choose which tied player it engages, the one engaged with the most non-unique Orc enemies. It attacks that player at once.",
    verb: "Engage",
    labels: { "seat:0": "Player 1", "seat:1": "Player 2", "seat:2": "Player 3", "seat:3": "Player 4" },
  },

  // 16031:A:1 (Kahliel): at the beginning of the planning phase he may add 1 resource to a hero in play (any player's; a hero in the staging area is immune).
  "16031:response:1 @0 Pick": { owned: true, note: "Kahliel: choose a hero in play to add 1 resource to.", verb: "Add" },

  // 16032:A:1 (Firyal): she looks at the top card of the encounter deck, then may discard it.
  "16032:response:1 @1 discard": { label: "Discard the top card of the encounter deck" },
  "16032:response:1 @1 keep": { label: "Leave it on top of the encounter deck" },

  // 16033:A:2 (Yazan) and 16034:A:2 (Jubayr): once each phase, a non-unique enemy takes 1 damage, or loses a facedown shadow card.
  "16033:response:1 @0 Pick": { owned: true, note: "Yazan: choose a non-unique enemy in play to take 1 damage.", verb: "Damage" },
  "16034:response:1 @0 Pick": { owned: true, note: "Jubayr: choose a non-unique enemy to discard 1 facedown shadow card from.", verb: "Discard" },

  // 16035:A:2 (Sauron's Enforcers): at the end of the round the first player assigns X damage among all characters in play, X the stage number.
  "16035:forced:1 @0 AssignDamage": { owned: true, note: "Sauron's Enforcers: assign {x} damage, the stage number, among the characters in play, heroes in the staging area too ({left} left).", bind: X, verb: "Assign", title: "Assign {left}: {card}" },

  // 16036:A:2 (Southron Boma, Travel): each player spends 1 resource from a hero they control, an objective-hero included.
  "16036:travel:1 @0.0 SpendResources": { owned: true, note: "Southron Boma: choose a hero you control to spend 1 resource from, to travel here.", verb: "Pay" },

  // 16037:A:1 (Village Hut): after the players travel here the first player discards the top card of their deck; an ally enters play under their control, exhausted.
  "16037:response:1 @2 Pick": { owned: true, note: "Village Hut: put the ally you discarded into play under your control, exhausted.", verb: "Enter play" },

  // 16038:A:1 (Savage Attack): each player in turn discards their highest cost ally, or reveals the top encounter card.
  "16038:whenRevealed:1 @0.0 ally": { label: "Discard your highest cost ally" },
  "16038:whenRevealed:1 @0.0 reveal": { label: "Reveal the top card of the encounter deck" },
  "16038:whenRevealed:1 @0.0.ally.0 Pick": { owned: true, note: "Savage Attack: choose one of your highest cost allies to discard.", verb: "Discard" },

  // 16039:A:2 (Overrun by Orcs) Shadow: the defending player assigns X damage among the characters they control, X the stage number.
  "16039:shadow:1 @0 AssignDamage": { owned: true, note: "Overrun by Orcs, Shadow: assign {x} damage, the stage number, among the characters you control ({left} left).", bind: X, verb: "Assign", title: "Assign {left}: {card}" },

  // 16057:A:2 (Forest Clearing) Shadow: the defending player discards an attachment they control.
  "16057:shadow:1 @0 Pick": { owned: true, note: "Forest Clearing, Shadow: choose an attachment you control to discard.", verb: "Discard" },

  // 16059:A:2 (Overgrown): it attaches to the highest Threat location in the staging area with no Overgrown; the first player picks among a tie.
  "16059:whenRevealed:1 @0 Pick": { owned: true, note: "Overgrown: choose which tied location in the staging area it attaches to. It gives that location +1 Threat.", verb: "Attach" },

  // 16064:A:1 (Mordor Warg): it attaches to an Orc enemy in play and that enemy returns to the staging area; the first player chooses.
  "16064:whenRevealed:1 @0 Pick": { owned: true, note: "Mordor Warg: choose an Orc enemy in play to attach to. It returns to the staging area.", verb: "Attach" },
};
