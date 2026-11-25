import type { ScreenMoment } from "../../harness/screens.ts";

// The table moments the screen review shoots (`pnpm browser shot --moment to-catch-an-orc --landscape`; test/harness/screens.ts): one for each new widget of To Catch an Orc's table, a layout (the same JSON `pnpm game scene` takes) and a note that says
// which printed line or widget it shows. `scripts/browser/scene.test.ts` builds each one in Node and fails when a layout no longer builds.
const MUGASH = "07024";
const GUARD = "07025";
const deck = (cards: number, ...extra: string[]) => [...Array.from({ length: cards }, () => "filler"), ...extra];
const HELD = { attached: [{ code: MUGASH, to: "dh1", encounter: true as const }] };

export const screens: ScreenMoment[] = [
  { name: "out-of-play-deck", layout: { stage: "07062", piles: { outOfPlay0: deck(17, MUGASH) } }, note: "Stage 1B (07062:A:1): the out-of-play deck dial in the top bar, 18 cards, a count only (never which cards); it has not warmed." },
  { name: "out-of-play-low", layout: { stage: "07062", piles: { outOfPlay0: deck(3, MUGASH) } }, note: "07062:A:1: 4 cards left and Mugash still hidden in the deck, so the dial warms (near)." },
  { name: "out-of-play-two", layout: { seats: 2, stage: "07062", piles: { outOfPlay0: deck(14, MUGASH), outOfPlay1: deck(3, GUARD) } }, note: "07062:A:1 two-handed: one dial for both decks, 19 cards in all; the second seat's deck is low, so it warms and the tap panel names each player's deck." },
  { name: "mugash-held", layout: { stage: "07064", timeCounters: 3, ...HELD, piles: { outOfPlay0: deck(9) } }, note: "07024:A:2: Mugash held under the hero he is attached to, with the held pill; a tap on the hero opens the line that says it cannot ready and that the players lose if it leaves play. Stage 3B's Time dial at 3." },
  { name: "mugash-guard", layout: { stage: "07064", timeCounters: 2, ...HELD, engaged: [GUARD], piles: { outOfPlay0: deck(9) } }, note: "07025:A:1: Mugash's Guard engaged with the player whose hero holds Mugash; a tap on it opens the line that names why. Stage 3B's Time dial at 2 warms." },
  { name: "mugash-guard-staging", layout: { stage: "07064", timeCounters: 3, staging: [GUARD], ...HELD }, note: "07025:A:1: the Guard in the staging area while Mugash is attached (the sweep engages it at the next settle); its preview says whom it engages." },
  { name: "time-dial-2b", layout: { stage: "07063", timeCounters: 2, staging: ["07038"], piles: { outOfPlay0: deck(11, MUGASH) } }, note: "Stage 2B (07063:B:1): the Time dial in the top bar, 2 counters against Time 2, warming near." },
  { name: "time-dial-2b-1", layout: { stage: "07063", timeCounters: 1, piles: { outOfPlay0: deck(11, MUGASH) } }, note: "Stage 2B with 1 counter left: the dial warms and says the refresh phase takes the last one, then the discard pile joins the deck (07063:B:2)." },
];
