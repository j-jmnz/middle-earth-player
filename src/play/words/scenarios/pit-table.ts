// Rules: dwd.cave-torch-the-long-dark, rr.forced, rr.removed-from-game (data/rules/entries.json); ledger line 901001:A:2.
// What the table says of Into the Pit's Nightmare setup card (src/play/readouts/pit.ts): the damage its Forced effect puts on it each time the Cave Torch exhausts, against the 5 that remove the Torch from the game. The engine decided every number; these only say it.
// Each sentence stays at about 25 words (docs/design-system-table.md, Choice tray, Plain words). Pure.

import { plural } from "../list.ts";

/** The dial's accessible name: the damage on the setup card and what its limit does. */
export const torchDialName = (limit: number, gone: boolean): string => (gone ? "Damage on the Nightmare setup card, the Cave Torch is out of the game:" : `Damage on the Nightmare setup card, the Cave Torch is removed from the game at ${limit}:`);

/** The words on the limit: what 5 damage does. */
export const torchLimitWords = (limit: number): string => `${limit} removes the Cave Torch`;

/** The dial's note: the damage so far and what each exhaust and the limit do; said true once the Torch is gone. */
export const torchDialWords = (damage: number, limit: number, gone: boolean): string =>
  gone
    ? `${plural(damage, "damage", "damage")} on the setup card. The Cave Torch is removed from the game, so its exhausts add no more.`
    : `${damage} of ${limit} damage on the setup card. Each exhaust of the Cave Torch adds 1. At ${limit}, the Cave Torch is removed from the game.`;

/** The warning one exhaust from the limit. */
export const torchNearWords = (): string => "The next exhaust removes the Cave Torch from the game. Burning Low then cannot be canceled and Lightless Passage cannot be traveled to.";
