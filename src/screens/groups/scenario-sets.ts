// The set a briefing's Encounter sets row opens: a set name can sit in several packs (a reprint, a Nightmare deck's set named like the scenario's), so the
// row picks the set node whose cards the scenario itself deals, not the first name match. Pure; the briefing hands in the scenario's card codes.
import type { ScenarioTree } from "./scenario-tree";

/** The key (`<pack>~<set>`, the card-group route's id) of the set called `name` that holds most of `codes`; null for a name no pack lists. The first listed wins a tie. */
export function setKeyFor(tree: ScenarioTree, name: string, codes: ReadonlySet<string>): string | null {
  let best: string | null = null;
  let bestHeld = -1;
  for (const [key, found] of tree.byKey) {
    if (found.set.name !== name) continue;
    let held = 0;
    for (const group of found.set.groups) for (const card of group.cards) if (codes.has(card.code)) held += 1;
    if (held > bestHeld) {
      best = key;
      bestHeld = held;
    }
  }
  return best;
}

/** Every card code a scenario deals or its Nightmare deck adds: what picks a set among those of one name. */
export function dealtCodes(scenario: { cards: readonly { code: string }[]; stages: readonly string[]; nightmare?: { cards: readonly { code: string }[]; questCards?: readonly string[] } | undefined }): Set<string> {
  const codes = new Set<string>(scenario.stages);
  for (const card of scenario.cards) codes.add(card.code);
  for (const card of scenario.nightmare?.cards ?? []) codes.add(card.code);
  for (const code of scenario.nightmare?.questCards ?? []) codes.add(code);
  return codes;
}
