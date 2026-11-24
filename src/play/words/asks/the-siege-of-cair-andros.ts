import type { Condition } from "../../../catalog/boundary.ts";
import type { Ask } from "../asks.ts";

// The 2 damage of the shadow reach the limit of the named location (its quest points equal its removal limit): said by the note, read with the engine's reader.
const REMOVES = (name: string): Condition => ({ kind: "less", left: { stat: "questPoints", ofNamed: name }, right: { stat: "damage", ofNamed: name, plus: 3 } });
const SHADOW_NOTE = (card: string, name: string) => [{ when: REMOVES(name), text: `${card}: ${name} takes 2 damage, and the attacker gets no +2 Attack. This removes it from the game.` }, { text: `${card}: ${name} takes 2 damage, and the attacker gets no +2 Attack.` }] as const;

// The choice words of The Siege of Cair Andros (against-the-shadow part 3), one entry for each Pick and Choose of its records: `<record id> @<instruction path> <verb | option id>` (src/play/words/asks.ts; docs/design-system-table.md, Choice tray).
// `pnpm test scenario the-siege-of-cair-andros --words` fails on a Pick or Choose with neither an entry nor words of its own, and `WORDS_DUMP=the-siege-of-cair-andros` prints each sentence.
export const ASKS: Readonly<Record<string, Ask>> = {
  // 05030:A:3, 05031:A:3, 05032:A:2 (Shadow): the named Battleground location is in play, so it takes 2 damage and the attacker gets no +2 Attack. The defending player's own shadow card, so the seat is the defender's.
  "05030:shadow:1 @1 Pick": { owned: true, note: SHADOW_NOTE("Orc Scramblers", "The Citadel"), verb: "Damage" },
  "05031:shadow:1 @1 Pick": { owned: true, note: SHADOW_NOTE("Battering Ram", "The Approach"), verb: "Damage" },
  "05032:shadow:1 @1 Pick": { owned: true, note: SHADOW_NOTE("Siege Raft", "The Banks"), verb: "Damage" },
  // 05032:A:1 (Siege Raft, When Revealed): 2 damage to the lowest Threat Battleground location in play; the Pick opens only when locations tie, and the first player breaks the tie.
  "05032:whenRevealed:1 @0 Pick": { owned: true, note: "Siege Raft: Battleground locations are tied for the lowest Threat. Choose the one that takes 2 damage. The first player chooses.", verb: "Damage" },
  // 05055:A:2 (Southron Support, When Revealed): each player searches the encounter deck and discard pile for 1 Harad enemy and adds it to the staging area, if able.
  "05055:whenRevealed:1 @0.0 SearchMove": { owned: true, note: "Southron Support: choose 1 Harad enemy from the encounter deck or discard pile to add to the staging area. Each player chooses one.", verb: "Add" },
  // 05060:A:1 (The Master's Malice, When Revealed): each player in turn chooses 1 sphere; each character he controls that does not belong to it takes 3 damage (a neutral character takes it; one with several icons is safe if any matches).
  "05060:whenRevealed:1 @0.0 Choose": { owned: true, note: "The Master's Malice: choose 1 sphere. Each character you control that does not belong to it takes 3 damage." },
  "05060:whenRevealed:1 @0.0 leadership": { label: "Leadership: each of your characters without a Leadership icon takes 3 damage" },
  "05060:whenRevealed:1 @0.0 tactics": { label: "Tactics: each of your characters without a Tactics icon takes 3 damage" },
  "05060:whenRevealed:1 @0.0 spirit": { label: "Spirit: each of your characters without a Spirit icon takes 3 damage" },
  "05060:whenRevealed:1 @0.0 lore": { label: "Lore: each of your characters without a Lore icon takes 3 damage" },
  // 05074:B:2 (stage 3B, Forced): after an unsuccessful quest, instead of raising threat, each player chooses and discards 1 character he controls (a hero so discarded is not defeated).
  "05074:forced:1 @1.0 Pick": { owned: true, note: "The quest failed: your threat does not rise. Choose 1 character you control to discard.", verb: "Discard" },
};
