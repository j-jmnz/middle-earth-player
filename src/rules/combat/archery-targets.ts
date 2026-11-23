// Rules: mec109.archery, rr.cannot, hob.riddle-area (data/rules/entries.json). The characters that may be assigned archery damage: archeryRecipients less those that cannot take it.
import type { PrintedCard } from "../core/printed.ts";
import type { ScenarioState } from "../core/state.ts";
import { damageBarred } from "../families/defense/damage.ts";
import { archeryRecipients } from "./combat.ts";

/** Who may be assigned archery damage. A character that takes no damage from this source (Bilbo Baggins in the riddle area, which takes it only from Gollum) is not offered: its share would vanish. Every other table gets archeryRecipients as it is. */
export function archeryTargets(state: ScenarioState, cards: ReadonlyMap<string, PrintedCard>, seat?: number): string[] {
  return archeryRecipients(state, cards, seat).filter((id) => !damageBarred(state, id, "framework", null));
}
