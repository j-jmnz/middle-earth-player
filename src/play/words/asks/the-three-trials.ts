import type { Ask } from "../asks.ts";

// The choice words of The Three Trials (the-ring-maker part 5), one entry for each Pick and Choose of its records: `<record id> @<instruction path> <verb | option id>` (src/play/words/asks.ts; docs/design-system-table.md, Choice tray).
// `pnpm test scenario the-three-trials --words` fails on a Pick or Choose with neither an entry nor words of its own, and `WORDS_DUMP=the-three-trials` prints each sentence.
// The stage choice of 08035:B:1 and the three 2B lines is the engine's (AdvanceToChosenStage), so no record holds it: its sentence and its three rows are `trialsChoice` (words/scenarios/ring-maker/trials-table.ts). The first player answers for the group there and at Hallowed Circle's travel cost.
// No choice here loses the game by itself, so no row carries a caution: a Guardian's last counter costs the engaged player an ally, an attack or damage, and the sentences say so.
export const ASKS: Readonly<Record<string, Ask>> = {
  // 08040:A:2 (Forced): after the last time counter leaves Boar's Guardian, the engaged player discards an ally he controls. None: nothing happens.
  "08040:forced:1 @0.0 Pick": { owned: true, why: "its last time counter came off.", note: "Choose an ally you control to discard.", verb: "Discard" },

  // 08049:A:2 (Travel cost): the players exhaust 3 Key objectives, the Keys and not the heroes they lie on. One Pick for each Key; the engine refuses the travel without 3 ready ones.
  "08049:travel:1 @0 Pick": { note: "Hallowed Circle travel cost, Key 1 of 3: choose a ready Key objective the players control to exhaust. Its hero stays ready.", verb: "Exhaust" },
  "08049:travel:1 @2 Pick": { note: "Hallowed Circle travel cost, Key 2 of 3: choose another ready Key objective the players control to exhaust. Its hero stays ready.", verb: "Exhaust" },
  "08049:travel:1 @4 Pick": { note: "Hallowed Circle travel cost, Key 3 of 3: choose a third ready Key objective the players control to exhaust. Its hero stays ready.", verb: "Exhaust" },

  // 08051:A:1 (Travel): search the encounter deck and discard pile for a Spirit enemy and add it to the staging area. It is not revealed, so no Time and no When Revealed.
  "08051:travel:1 @0 SearchMove": { note: "Cursed Forest travel: search the encounter deck and discard pile for a Spirit enemy. Add it to the staging area; it is not revealed.", verb: "Add" },

  // 08051:A:2 (Shadow): if the attack destroys a character, the defending player removes 1 time counter from an enemy, if able. Only an enemy that holds a counter is offered.
  "08051:shadow:1 @0.0 Pick": { owned: true, why: "its attack destroyed a character.", note: "Choose an enemy that holds a time counter. It loses 1 time counter.", verb: "Remove" },
};
