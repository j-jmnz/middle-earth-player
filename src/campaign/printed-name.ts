// Hall of Beorn lists the campaign edition of a box scenario as "The Oath (Campaign)"; the player reads the printed title.
export function printedScenarioName(name: string): string {
  return name.replace(/ \(Campaign\)$/, "");
}

// The Fellowship event kits (The Wizard's Quest, The Woodland Realm, The Mines of Moria, Escape from Khazad-dûm) print their encounter cards in
// numbered packets of five, which DragnCards names "The Woodland Realm 3". The player reads one set: a name that is another listed set's name and
// a number folds into that set. `sets` are the names listed beside it.
export function printedSetName(name: string, sets: ReadonlySet<string>): string {
  const base = / \d+$/.test(name) ? name.replace(/ \d+$/, "") : null;
  return base != null && sets.has(base) ? base : name;
}
