// DEV ONLY. Delete in phase 11, when the real table and resolution screen exist.
//
// While the table is absent, the dev control plays a scenario with the auto-player and submits the resolution through the
// reducer. The shipped starter decks do not win against the naive auto-player, so the dev context gives the dealt heroes
// other than the Ring-bearer big numbers (the device the whole-game test uses). The codes are the player's: the
// log records the real heroes. This changes nothing in the engine or in a card record; it is a different context handed to
// the same reducer.
import { definePrinted } from "../rules/printed.ts";
import type { ReduceContext } from "../rules/reduce.ts";

import type { World } from "./world.ts";

export function boostedContext(world: World, heroes: readonly string[]): ReduceContext {
  const cards = new Map(world.cards);
  for (const code of heroes) {
    const card = cards.get(code);
    if (!card || card.type !== "hero" || card.traits.includes("Ring-bearer")) continue;
    cards.set(code, definePrinted({ ...card, willpower: 12, defense: 2, health: 100 }));
  }
  return { effects: world.effects, cards };
}
