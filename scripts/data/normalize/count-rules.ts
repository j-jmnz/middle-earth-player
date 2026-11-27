import type { Pile, Placement } from "../../../src/catalog/scenario-data.ts";

// The fields of an `overrides.scenarioCounts` rule this reads (scripts/data/normalize/overrides.ts).
type CountRule = { code: string; pile?: Pile | undefined; normal?: number | undefined; easy?: number | undefined; add?: boolean | undefined; reason: string };

// A printed count the sources disagree on, settled by an override: it sets the copies of a card the load list places, or with `add` places a card the load
// list has no line for. A card the load list already places makes an `add` rule stale, and a placement needs a `normal`; both are reported in `errors`.
export function applyCountRule(placed: Placement[], rule: CountRule, scenario: string, nameOf: (code: string) => string, errors: string[]): void {
  const pile: Pile = rule.pile ?? "encounter";
  let item = placed.find((candidate) => candidate.code === rule.code && candidate.pile === pile);
  if (rule.add === true) {
    if (item) errors.push(`${scenario}: scenarioCounts adds ${nameOf(rule.code)}, which the load list already places in the ${pile} pile (stale rule: ${rule.reason})`);
    else if (rule.normal == null) errors.push(`${scenario}: scenarioCounts adds ${nameOf(rule.code)} with no \`normal\` count (${rule.reason})`);
    else {
      item = { code: rule.code, pile, normal: rule.normal, easy: rule.easy ?? rule.normal };
      placed.push(item);
    }
  }
  if (!item) {
    errors.push(`${scenario}: scenarioCounts names ${nameOf(rule.code)}, which the ${pile} pile does not hold`);
    return;
  }
  if (rule.normal != null) item.normal = rule.normal;
  if (rule.easy != null) item.easy = rule.easy;
  item.easy = Math.min(item.easy, item.normal);
  if (item.normal === 0) placed.splice(placed.indexOf(item), 1);
}
