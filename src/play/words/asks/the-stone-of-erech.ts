import type { Ask } from "../asks.ts";
import type { PickSpec } from "../../../catalog/boundary.ts";

const STAGED_ENEMIES: PickSpec = { type: "enemy", control: "any", stagingOnly: true };

// The choice words of The Stone of Erech (standalone-scenarios part 3), one entry for each Pick and Choose of its records: `<record id> @<instruction path> <verb | option id>` (src/play/words/asks.ts; docs/design-system-table.md, Choice tray).
// `pnpm test scenario the-stone-of-erech --words` fails on a Pick or Choose with neither an entry nor words of its own, and `WORDS_DUMP=the-stone-of-erech` prints each sentence.
// The first player answers for the group at the three Choose (the stage 2B round choice, Tarlang's Neck, Groping Horror), so those sentences are not owned (the sheet adds who chooses). The player who uses the Relic or the Haunted Valley action answers for his own hero.
export const ASKS: Readonly<Record<string, Ask>> = {
  // 50302:B:1 (Terror of the Dead, stage 2B Forced at the beginning of each round): the players choose for this round, the first player deciding.
  "50302:forced:1 @0 Choose": { note: "Terror of the Dead: at the beginning of the round the players must choose. Every player skips the next planning phase, or no hero collects resources in this round's resource phase." },
  "50302:forced:1 @0 skipPlanning": { label: "Every player skips the next planning phase" },
  "50302:forced:1 @0 noCollect": { label: "Heroes do not collect resources this round" },

  // 50307:A:1 (Tarlang's Neck, active, gains a Forced effect at the beginning of the encounter phase): end the phase at once, or the first player engages every enemy in the staging area.
  "50307:forced:1 @0 Choose": { note: "Tarlang's Neck: the players must either end the encounter phase at once, or the first player engages every enemy in the staging area." },
  "50307:forced:1 @0 endPhase": { label: "End the encounter phase now" },
  "50307:forced:1 @0 engageAll": {
    label: [
      { when: { kind: "count", pick: STAGED_ENEMIES, max: 0 }, text: "The first player engages every enemy in the staging area (none now)" },
      { text: "The first player engages every enemy in the staging area" },
    ],
  },

  // 50311:A:1 (Relic from the Dark Years, Midnight Action): the player who uses it claims it and attaches it to a hero he controls.
  "50311:action:1 @0 Pick": { owned: true, note: "Relic from the Dark Years: choose a hero you control to carry it.", verb: "Claim" },

  // 50321:A:2 (Haunted Valley, Planning Action): the player who uses it exhausts a hero he controls.
  "50321:action:1 @0 Pick": { owned: true, note: "Haunted Valley: choose a ready hero you control to exhaust, so that it keeps its icons.", verb: "Exhaust" },

  // 50324:A:1 (Groping Horror, When Revealed): the first player chooses for the players: skip the next travel phase, or every player passes his hand to the player on his left (the only player discards his hand).
  "50324:whenRevealed:1 @0 Choose": { note: "Groping Horror: the players must choose. Skip the next travel phase, or each player passes his hand to the player on his left (alone, you discard your hand instead)." },
  "50324:whenRevealed:1 @0 skipTravel": { label: "Skip the next travel phase" },
  "50324:whenRevealed:1 @0 passHands": {
    label: [
      { when: { kind: "otherPlayer" }, text: "Each player passes his hand to the player on his left" },
      { text: "Discard your hand" },
    ],
  },
};
