// Rules: rr.the-word-choose, rr.first-player, rr.neutral-cards (data/rules/entries.json); ledger line 132037:A:1. The choice words of the Wilderland set (the cards of the Wilderland encounter deck, 132035-132038) that more than one scenario deals.
// A game reads only its own scenario's asks file, so each scenario that deals the set (The Lonely Mountain, The Battle of Five Armies, and the third Hobbit scenario that deals it) spreads this table into its own (`...WILDERLAND_ASKS`), as the Goblins set's is (src/play/words/misty-mountain-goblins-asks.ts); an entry keys a record of a card the set holds.
import type { PickSpec } from "../../catalog/boundary.ts";

import type { Ask } from "./asks.ts";

const SPHERES = ["leadership", "lore", "spirit", "tactics"] as const;
const NAMES: Readonly<Record<(typeof SPHERES)[number], string>> = { leadership: "Leadership", lore: "Lore", spirit: "Spirit", tactics: "Tactics" };

// The committed characters a sphere removes: those outside it, a Baggins one excepted (a neutral character belongs to none of the four, so it leaves too).
const LEAVING = (sphere: (typeof SPHERES)[number]): PickSpec => ({ type: "character", control: "any", committed: true, atStage: true, exceptSphere: [sphere, "baggins"] });

const rows = Object.fromEntries(
  SPHERES.map((sphere) => [
    `132037:whenRevealed:1 @0 ${sphere}`,
    {
      bind: { n: { count: LEAVING(sphere) } },
      label: [
        { when: { kind: "less", left: { count: LEAVING(sphere) }, right: 1 }, text: `Name ${NAMES[sphere]}: no character leaves the quest` },
        { when: { kind: "less", left: { count: LEAVING(sphere) }, right: 2 }, text: `Name ${NAMES[sphere]}: 1 character leaves the quest` },
        { text: `Name ${NAMES[sphere]}: {n} characters leave the quest` },
      ],
    } satisfies Ask,
  ]),
);

export const WILDERLAND_ASKS: Readonly<Record<string, Ask>> = {
  // 132037 Fighting Among Friends. When Revealed: the first player names a sphere; each committed character outside it, a Baggins one excepted, is removed from the quest.
  "132037:whenRevealed:1 @0 Choose": { owned: true, note: "{card}: name a sphere. Each committed non-Baggins character outside it is removed from the quest." },
  ...rows,
};
