// Hall of Beorn lists the campaign edition of a box scenario as "The Oath (Campaign)"; the player reads the printed title.
export function printedScenarioName(name: string): string {
  return name.replace(/ \(Campaign\)$/, "");
}
