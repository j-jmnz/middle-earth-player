// Rules: rr.the-word-choose, rr.first-player, mec112.setup-the-uruk-hai, rr.player-elimination (data/rules/entries.json). The words of the choices of The Uruk-hai's own cards (ledger lines 143069:A:1, 143024:A:1, 143024:A:2, 143016:A:3), as data beside
// the records (src/play/words/asks.ts, docs/design-system-table.md, Choice tray): each sentence names its number, its side (the Captives are under To Isengard! or on Grishnákh) and whose choice it is. The other picks of the scenario read as the families word them.
import type { Ask } from "../asks.ts";

export const ASKS: Readonly<Record<string, Ask>> = {
  // Setup, a campaign game: the Campaign Log names the seat's Captive (user ruling R1, 2026-11-08). Each player answers for themself, first player first.
  "143069:setup:1 @0.0 Pick": {
    why: "the Campaign Log names a Captive of yours.",
    note: "Choose that hero to be your Captive. It goes faceup under To Isengard! and keeps its tokens and attachments.",
    owned: true,
    verb: "Capture",
  },
  // Setup with no hero of the seat on the log (standalone, a fresh log): any non-Fellowship hero the player controls.
  "143069:setup:1 @0.1 Pick": {
    why: "you choose your Captive.",
    note: "Choose 1 non-Fellowship hero you control to be your Captive. It goes faceup under To Isengard! and keeps its tokens and attachments.",
    owned: true,
    verb: "Capture",
  },
  // Grishnákh enters play: the first player picks 1 of the Captives under To Isengard! for him to hold (143024:A:1).
  "143024:forced:1 @0 Pick": {
    why: "it entered play.",
    note: "Choose 1 Captive to attach to {card}. The Captive takes 1 damage at the end of each quest phase.",
    verb: "Attach",
  },
  // End of the quest phase: the Captive he holds takes the damage (143024:A:2); the pick has one row.
  "143024:forced:3 @0 Pick": {
    why: "the quest phase ended.",
    note: "Choose the Captive {card} holds to take 1 damage.",
    verb: "Damage",
  },
  // Hands of a Healer (143016:A:3): any hero in play, a Captive included (user ruling R3, 2026-11-08).
  "143016:action:1 @0 Pick": {
    note: "choose a hero in play to heal up to 3 damage, a Captive included.",
    owned: true,
    verb: "Heal",
  },
};
