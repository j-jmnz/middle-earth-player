import type { ScreenMoment } from "../../harness/screens.ts";

import { MUMAK, captures } from "./kit.ts";

// The table moments the screen review shoots (`pnpm browser shot --moment the-mumakil --landscape`; test/harness/screens.ts): one for each new piece of The Mûmakil's table (docs/scenarios/haradrim/the-mumakil.md, Table), a layout (the same JSON `pnpm game scene` takes) and a note that says
// which printed line or widget it shows. A state only a played game reaches is not here: it is shot from the fixture or opened as text from the golden `the-mumakil/2` (two-handed, won; `pnpm game show the-mumakil/2 --at <n> --legal`; `pnpm browser shot --fixture` takes only a fixture, so the review reads these as text):
//   --at 146  the stage 2A attach choice (17027:A:1): the second player picks the Wild Mûmak (#i106 engaged with him, or #i108 in the staging area) that carries the next random Capture; the first player's pick follows at 147.
//   --at 69   the Wild Mûmak's end-of-round Choose (17015:A:3): the engaged player returns it to the staging area or lets it attack (`staging`, `attack`).
//   Biting Insects (17024:A:1) is no golden's: no game reveals it with a card in hand. A scene that reveals it (a hand with one card of cost 2, `revealFromTop`) opens the Assign window with {left} = 2, the card's printed cost, and the sheet says "Biting Insects: assign 2 damage, the cost of the card you discarded, among characters you control." (a cost 3 card says 3, a cost 0 card opens no window).
const STAGE = { stage: "17027", side: "B" as const, phase: "Quest" as const };

export const screens: ScreenMoment[] = [
  {
    name: "capture-on-staged-mumak",
    note: "17027:A:1: two Capture objectives (Horse-hair Lasso 17011, Poisoned Spear 17012) lie faceup on a Wild Mûmak in the staging area, controlled by nobody; a tap on a Capture opens its Response and says it is not offered while the Mûmak is in the staging area (17011:A:1).",
    layout: { ...STAGE, seats: 2, staging: [MUMAK], attached: captures("17011", "17012") },
  },
  {
    name: "capture-on-engaged-mumak",
    note: "17027:A:1, 17014:A:1: a Noose of Vines lies faceup on a Wild Mûmak engaged with the first player; its Response is offered to him, after a character defends the Mûmak's attack and has more remaining hit points than it.",
    layout: { ...STAGE, seats: 2, engaged: [{ code: MUMAK, seat: 0 }], attached: captures("17014") },
  },
];
