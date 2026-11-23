// Rules: rr.the-word-choose, rr.first-player, rr.neutral-cards (data/rules/entries.json); ledger line 132037:A:1. The choice words of the Wilderland set (the cards of the Wilderland encounter deck, 132035-132038) that more than one scenario deals.
// A game reads only its own scenario's asks file, so each scenario that deals the set (Flies and Spiders, The Lonely Mountain, The Battle of Five Armies) spreads this table into its own (`...WILDERLAND_ASKS`), as the Goblins set's is (src/play/words/misty-mountain-goblins-asks.ts); an entry keys a record of a card the set holds.
import type { PickSpec } from "../../catalog/boundary.ts";
import { AUTHORED_EFFECTS } from "../../effects/authored/the-hobbit/set-wilderland.ts";

import type { Ask } from "./asks.ts";

const SPHERES = ["leadership", "lore", "spirit", "tactics"] as const;
const NAMES: Readonly<Record<(typeof SPHERES)[number], string>> = { leadership: "Leadership", lore: "Lore", spirit: "Spirit", tactics: "Tactics" };

const RECORD_ID = "132037:whenRevealed:1";

// The committed characters a sphere removes, read from the record's own Choose option (its Each pick), so a change to the record moves the count.
const LEAVING = (sphere: (typeof SPHERES)[number]): PickSpec => {
  const choose = AUTHORED_EFFECTS.find((effect) => effect.id === RECORD_ID)?.instructions[0];
  const option = choose?.verb === "Choose" ? choose.options.find((o) => o.id === sphere) : undefined;
  const each = option?.instructions[0];
  if (each?.verb !== "Each") throw new Error(`${RECORD_ID}: no Each pick in the ${sphere} option`);
  return each.pick;
};

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
