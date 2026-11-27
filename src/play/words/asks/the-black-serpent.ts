import type { Ask } from "../asks.ts";
import type { Condition } from "../../../catalog/boundary.ts";
import { ELIMINATION_LEVEL } from "../../../rules/core/eliminate.ts";

// The choice words of The Black Serpent (haradrim part 7), one entry for each Pick and Choose of its records: `<record id> @<instruction path> <verb | option id>` (src/play/words/asks.ts; docs/design-system-table.md, Choice tray).
// `pnpm test scenario the-black-serpent --words` fails on a Pick or Choose with neither an entry nor words of its own, and `WORDS_DUMP=the-black-serpent` prints each sentence.
// A choice of the defending player or of the player who plays the card (the Redoubt, the Tower, the Serpent Guard's shadow, Bold and Grim, No Quarter's shadow) is owned. The first player answers for the group at No Quarter's reveal, Chaos in the Night's
// threat or progress choice and the Redoubt's travel, so those sentences are not owned. Removing progress is a cost with no loss, so it has no caution; a threat raise that reaches the elimination level warns.
// Chaos in the Night raises every player's threat, so the warning reads each seat's threat (the condition seatThreat) and names the players it eliminates; a solo game says "your".
const REACHES = (seat: number): Condition => ({ kind: "seatThreat", seat, min: ELIMINATION_LEVEL - 3 });
const ELIMINATED_BY_THREAT = {
  when: { kind: "any", conditions: [REACHES(0), REACHES(1)] } as Condition,
  text: [
    { when: { kind: "all", conditions: [{ kind: "not", condition: { kind: "otherPlayer" } }, REACHES(0)] } as Condition, text: "Tap again: this takes your threat to 50 and eliminates you. If you are the last player, the game is lost" },
    { when: { kind: "all", conditions: [REACHES(0), REACHES(1)] } as Condition, text: "Tap again: this takes Player 1's and Player 2's threat to 50 and eliminates both. The game is lost" },
    { when: REACHES(0), text: "Tap again: this takes Player 1's threat to 50 and eliminates Player 1. The game is lost when no other player is left" },
    { text: "Tap again: this takes Player 2's threat to 50 and eliminates Player 2. The game is lost when no other player is left" },
  ],
} as const;

export const ASKS: Readonly<Record<string, Ask>> = {
  // 16042:A:2 (Southron Soldier, shadow): engage a non-unique enemy in the staging area and deal it a shadow card.
  "16042:shadow:1 @0 Pick": { note: "Southron Soldier: choose a non-unique enemy in the staging area. It engages the first player, then is dealt a shadow card.", verb: "Engage" },

  // 17092:A:3 (The Serpent's Garb, action): a Harad enemy in the staging area gets -2 Threat until the end of the phase.
  "17092:action:1 @0 Pick": { owned: true, note: "The Serpent's Garb: choose a Harad enemy in the staging area. It gets -2 Threat until the end of the phase.", verb: "Weaken" },

  // 17094:A:3 (The Black Serpent, forced): the first player chooses between X progress off the main quest and the Serpent's attack.
  "17094:forced:1 @0 Choose": { note: "The Black Serpent: remove progress equal to the stage number of the main quest, or it attacks you." },
  "17094:forced:1 @0 progress": { label: "Remove {x} progress from the main quest", bind: { x: { stage: true } } },
  "17094:forced:1 @0 attack": { label: "The Black Serpent attacks you (Attack {x})", bind: { x: { stat: "attack", of: "self" } } },

  // 17095:A:1 (Serpent Guard, forced) and A:2 (shadow): 2 progress off the main quest, or no damage to enemies.
  "17095:forced:1 @0 Choose": { owned: true, note: "Serpent Guard engaged you: remove 2 progress from the main quest, or enemies engaged with you cannot take damage this round." },
  "17095:forced:1 @0 progress": { label: "Remove 2 progress from the main quest" },
  "17095:forced:1 @0 noDamage": { label: "Enemies engaged with you cannot take damage this round" },
  "17095:shadow:1 @0 Choose": { owned: true, note: "Serpent Guard's shadow: remove 2 progress from the main quest, or the attacking enemy cannot take damage this round." },
  "17095:shadow:1 @0 progress": { label: "Remove 2 progress from the main quest" },
  "17095:shadow:1 @0 noDamage": { label: "The attacking enemy cannot take damage this round" },

  // 17096:A:1 (The Serpent's Redoubt, forced): after a player plays an ally, 1 progress off the main quest or the ally exhausts. A:2: the first player searches for an enemy.
  "17096:forced:1 @0 Choose": { owned: true, note: "The Serpent's Redoubt: remove 1 progress from the main quest, or exhaust the ally you played." },
  "17096:forced:1 @0 progress": { label: "Remove 1 progress from the main quest" },
  "17096:forced:1 @0 exhaust": { label: "Exhaust {subject}" },
  "17096:travel:1 @1 SearchMove": { note: "The Serpent's Redoubt: choose an enemy from the encounter deck or discard pile. It enters play engaged with the first player.", verb: "Add" },

  // 17097:A:1 (Roofless Tower, forced): when a player plays an event, 1 progress off the main quest or the event's effects are canceled.
  "17097:forced:1 @0 Choose": { owned: true, note: "Roofless Tower: remove 1 progress from the main quest, or cancel the effects of the event you played." },
  "17097:forced:1 @0 progress": { label: "Remove 1 progress from the main quest" },
  "17097:forced:1 @0 cancel": { label: "Cancel the effects of {subject}" },

  // 17097:A:2 (Roofless Tower, travel): exhaust a hero to travel here.
  "17097:travel:1 @0 Pick": { owned: true, note: "Roofless Tower: choose a hero you control to exhaust. This is the cost to travel here.", verb: "Exhaust" },

  // 17100:A:3 (Broken Courtyard, shadow): 2 progress off the main quest, or the attacker returns to the staging area after the attack.
  "17100:shadow:1 @0 Choose": { owned: true, note: "Broken Courtyard: remove 2 progress from the main quest, or return the attacking enemy to the staging area after this attack." },
  "17100:shadow:1 @0 progress": { label: "Remove 2 progress from the main quest" },
  "17100:shadow:1 @0 staging": { label: "Return the attacking enemy to the staging area after this attack" },

  // 17101:A:3 (Bold and Grim, shadow): a non-unique attacker either guards a Harad objective you control, or attacks again.
  "17101:shadow:1 @0 Choose": { owned: true, note: "Bold and Grim: attach a Harad objective you control to the attacker, or it attacks you again after this attack." },
  "17101:shadow:1 @0 attach": { label: "Attach a Harad objective you control to the attacking enemy" },
  "17101:shadow:1 @0 attack": { label: "The attacking enemy makes an additional attack against you" },
  "17101:shadow:1 @0.attach.0 Pick": { owned: true, note: "Bold and Grim: choose a Harad objective you control. The attacking enemy becomes its guard.", verb: "Guard" },

  // 17102:A:1 (No Quarter, when revealed): the first player reveals 2 encounter cards, or detaches a Harad objective from a hero and reveals it. A:2: shadow.
  "17102:whenRevealed:1 @0 Choose": { note: "No Quarter: reveal 2 encounter cards, or detach a Harad objective from a hero, reveal it and add it to the staging area." },
  "17102:whenRevealed:1 @0 reveal": { label: "Reveal 2 encounter cards" },
  "17102:whenRevealed:1 @0 detach": { label: "Detach a Harad objective from a hero and reveal it" },
  "17102:whenRevealed:1 @0.detach.0 Pick": { note: "No Quarter: choose a Harad objective held by a hero. It is detached, revealed and added to the staging area.", verb: "Detach" },
  "17102:shadow:1 @0.0 Pick": { owned: true, note: "No Quarter's shadow: choose a Harad objective you control to attach to a non-unique encounter card in the staging area.", verb: "Attach" },
  "17102:shadow:1 @0.1 Pick": { owned: true, note: "No Quarter's shadow: choose a non-unique encounter card in the staging area. It becomes the objective's guard.", verb: "Guard" },

  // 17103:A:1 (Chaos in the Night, when revealed): the first player raises each player's threat by 3, or stops progress on quest cards until the end of the round.
  "17103:whenRevealed:1 @0 Choose": { note: "Chaos in the Night: each player raises their threat by 3, or no progress can be placed on quest cards this round." },
  "17103:whenRevealed:1 @0 threat": { label: "Each player raises their threat by 3", caution: ELIMINATED_BY_THREAT },
  "17103:whenRevealed:1 @0 noProgress": { label: "No progress can be placed on quest cards until the end of the round" },

  // 17108:A:1 (Defeat the Serpent, when revealed): a random set-aside Harad objective is attached to The Black Serpent.
  "17108:whenRevealed:1 @0 Pick": { note: "Defeat the Serpent: The Black Serpent receives a random set-aside Harad objective.", verb: "Attach" },
};
