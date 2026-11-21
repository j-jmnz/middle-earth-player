import type { Ask } from "../asks.ts";

// The choice words of Flight from Moria (dwarrowdelf part 3), one entry for each Pick and Choose of its records: `<record id> @<instruction path> <verb | option id>` (src/play/words/asks.ts; docs/design-system-table.md, Choice tray).
// `pnpm test scenario flight-from-moria --words` fails on a Pick or Choose with neither an entry nor words of its own, and `WORDS_DUMP=flight-from-moria` prints each sentence.
// The first player answers for the group at Blocked by Shadow's choice, Dismay and Fear's removals and Hasty Council, so those sentences are not owned (the sheet adds who chooses); the last player's hero, the player who claims the Tools, the defending player's resources and each player's
// Narrow Paths character are owned. The Nameless Fear's X is its Attack or Threat now, read with the engine's reader. The bypass choice of every stage 2 (words/scenarios/gundabad.ts) says the shuffle of the Nightmare setup card and the threat of Shadowed Corridor.
const NAMELESS = "The Nameless Fear";
const FEAR_ATTACK = { stat: "attack", ofNamed: NAMELESS } as const;
const FEAR_THREAT = { stat: "threat", ofNamed: NAMELESS } as const;

export const ASKS: Readonly<Record<string, Ask>> = {
  // 03027:A:1 (When Revealed): the first player attaches Shadow of Fear to one of his heroes that carries no copy of it.
  "03027:whenRevealed:1 @0 AttachSelf": { note: "{card}: choose 1 of your heroes to carry it. That hero cannot exhaust or ready, and its text box is blank. A hero with a Shadow of Fear already is not offered.", verb: "Attach" },

  // 03028:A:1 (When Revealed): the last player's hero takes damage equal to The Nameless Fear's Attack, which nothing cancels.
  "03028:whenRevealed:1 @0.0 Pick": { owned: true, bind: { x: FEAR_ATTACK }, note: "{card}: as the last player, choose 1 hero you control to take {x} damage, The Nameless Fear's Attack now. Nothing cancels it.", verb: "Assign" },

  // 03029:A:2 (Action): any player exhausts a ready hero that can exhaust to claim Abandoned Tools from the staging area.
  "03029:action:1 @0 Pick": { owned: true, note: "{card}: choose 1 ready hero you control to exhaust. That hero claims it and carries it. A hero that cannot exhaust is not offered.", verb: "Exhaust" },

  // 03073:B:1 (When Revealed): each player chooses 1 questing character he controls; the others do not count their Willpower until the end of the round.
  "03073:whenRevealed:1 @1.0 Pick": { owned: true, note: "Narrow Paths: choose 1 questing character you control. Your other questing characters do not count their Willpower until the end of the round.", verb: "Choose" },

  // 03073:B:2 (Forced after the 1st progress token): the encounter deck and discard pile are searched for Abandoned Tools, which joins the staging area unguarded.
  "03073:forced:2 @0 SearchMove": { note: "Narrow Paths: search the encounter deck and discard pile for Abandoned Tools. It joins the staging area, not guarded, and the deck is shuffled.", verb: "Add" },

  // 03075:B:1 to B:3 (When Revealed): the first player chooses 1 of two options.
  "03075:whenRevealed:1 @0 Choose": { note: "Blocked by Shadow: choose 1. Every player discards the top card of the encounter deck, and a treachery eliminates its player. Or this stage goes to the bottom of the quest deck and the next stage is revealed." },
  "03075:whenRevealed:1 @0 discard": { label: "Each player discards the top card of the encounter deck: a treachery eliminates the player who discarded it" },
  "03075:whenRevealed:1 @0 next": { label: "Reveal the next quest card: this stage goes to the bottom of the quest deck with no progress" },

  // 03076:B:1 (Refresh Action): the hero carrying Abandoned Tools exhausts to put 1 progress token on Escape from Darkness. The pick spans seats, so each row names its owner.
  "03076:action:1 @0 Pick": { note: "Escape from Darkness: choose the ready hero that carries Abandoned Tools to exhaust. It puts 1 progress token on this stage. A hero that cannot exhaust is not offered.", verb: "Exhaust" },
  "03076:action:2 @0 Pick": { note: "Escape from Darkness: choose the ready hero that carries Abandoned Tools to exhaust. It puts 1 progress token on this stage. It can be used once a round.", verb: "Exhaust" },

  // 901203:B:1 (Forced at the start of the combat phase): The Nameless Fear attacks each player in turn order from the staging area, each attack dealt its own shadow card.
  "901203:forced:2 @0 Pick": { note: "Blocked by Flame: The Nameless Fear attacks each player in turn order from the staging area. Each attack is dealt a new shadow card, and every character may attack it.", verb: "Attack" },

  // 901205:A:2 (Forced when a stage is bypassed, while engaged with a player): the engaged copy puts a Goblin Spearman from the encounter discard pile into play engaged with its player.
  "901205:forced:1 @0 SearchMove": { note: "{card}: a stage was bypassed. Search the encounter discard pile for a Goblin Spearman and put it into play engaged with you. The deck is not shuffled.", verb: "Engage" },

  // 901207:A:2 (Shadow): the defending hero's resources are all discarded and the attacker is dealt another shadow card for each.
  "901207:shadow:1 @0 Pick": { owned: true, note: "{card}: discard every resource in your defending hero's pool. The attacking enemy is dealt 1 more shadow card for each.", verb: "Discard" },

  // 901208:A:1 (When Revealed): the first player removes questing characters from the quest one at a time until the Willpower removed reaches The Nameless Fear's Threat. The pick spans seats, so each row names its owner.
  "901208:whenRevealed:1 @0.0 Pick": { bind: { threat: FEAR_THREAT }, note: "{card}: choose 1 questing character, any player's, to remove from the quest. Go on until the Willpower removed is {threat}, The Nameless Fear's Threat now, or no questing character is left.", verb: "Remove" },
};
