import { describe, expect, it } from "vitest";

import type { Effect } from "../../../../src/catalog/boundary.ts";
import { checkLines, lineChecks } from "./checks.ts";

// The checks `pnpm effects render --checks` prints under a printed line: a tag for each fault kind its words or its record call for, and none for a plain line.
const record = (timing: string, instructions: unknown[], extra: Record<string, unknown> = {}): Effect => ({ id: "00000:x:1", cardCode: "00000", lines: ["00000:A:1"], timing, instructions, ...extra }) as unknown as Effect;
const tags = (text: string, owners: Effect[] = []): string[] => lineChecks(text, owners).map((check) => check.tag);

describe("render checks", () => {
  it("tags a line by its words", () => {
    expect(tags("Deal 1 damage to a hero, then draw a card.")).toEqual(["then"]);
    expect(tags("Each enemy in play gets +1 Attack until the end of the round.")).toEqual(["in-play", "limit"]);
    expect(tags("Limit 1 per round.")).toEqual(["limit"]);
    expect(tags("Attach to another character you control. Its printed Willpower is 0.")).toEqual(["you-control", "another", "printed"]);
    expect(tags("When Revealed effects cannot be canceled.")).toEqual(["uncancelable"]);
    expect(tags("After a When Revealed effect is canceled, draw a card.")).toEqual(["canceled"]);
    expect(tags("Encounter card effects cannot be canceled.")).toEqual(["uncancelable"]);
    expect(tags("Any player may exhaust a Lore hero.")).toEqual(["any-player", "sphere"]);
  });

  it("names the doc entry each check stands for", () => {
    const [check] = lineChecks("Deal 1 damage, then draw a card.", []);
    expect(check).toMatchObject({ tag: "then", entry: "Then" });
    expect(checkLines("Deal 1 damage, then draw a card.", [])[0]).toMatch(/\[entry: Then\]$/);
  });

  it("tags a sphere by a sphere word or icon, not by every non-", () => {
    expect(tags("Choose a non-Fellowship hero.")).toEqual(["sphere"]);
    expect(tags("Each hero with a printed resource icon of that sphere gets +1 Willpower.")).toContain("sphere");
    expect(tags("Attach to a non-unique enemy.")).toEqual([]);
    expect(tags("Choose a non-Ship objective.")).toEqual([]);
    expect(tags("Discard the top card of the encounter deck. If it is a non-unique location, add it to the staging area.")).toEqual([]);
  });

  it("tags an enemy filter with no zone from the record, not from the word enemy", () => {
    const loose = record("action", [{ verb: "Pick", pick: { type: "enemy", control: "you" } }]);
    const zoned = record("action", [{ verb: "Pick", pick: { type: "enemy", staging: true } }]);
    expect(tags("Choose an enemy.", [loose])).toContain("enemy-zone");
    expect(tags("Choose an enemy.", [zoned])).not.toContain("enemy-zone");
    // Lines that name enemies and pick none.
    expect(tags("Pillage. (After this enemy attacks, discard 1 card from your hand.)")).toEqual([]);
    expect(tags("Set aside all 7 unique enemies from the encounter deck.")).toEqual([]);
    expect(tags("Each enemy gets +1 Attack.")).toEqual([]);
  });

  it("tags an Action or a Response whose first step is a Pick, from the record", () => {
    const pick = record("action", [{ verb: "Pick", pick: { type: "hero", control: "you" } }, { verb: "Heal" }]);
    expect(tags("Action: Heal a hero.", [pick])).toEqual(["pick-first"]);
    expect(tags("Action: Heal a hero.", [record("action", [{ verb: "Heal" }])])).toEqual([]);
    expect(tags("Forced: Heal a hero.", [record("forced", [{ verb: "Pick", pick: { type: "hero", control: "you" } }])])).toEqual([]);
  });

  it("tags a Shadow record with a record-level condition and a Travel line", () => {
    expect(tags("Shadow: +1 Attack.", [record("shadow", [], { condition: { kind: "always" } })])).toEqual(["shadow-condition"]);
    expect(tags("Travel: Exhaust a hero to travel here.")).toEqual(["travel-cost"]);
  });

  it("prints each check as an indented CHECK row, and nothing for a plain line", () => {
    expect(checkLines("Draw a card.", [])).toEqual([]);
    const rows = checkLines("Then draw a card.", []);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatch(/^ {2}CHECK then: /);
  });
});
