// Rules: rr.defense-strength, rr.defending-player (data/rules/entries.json); ledger line 148010:A:1.
// defenseFromWillpower with a `defendingAgainst` condition (defense family): a character defends against the named enemies with its Willpower and against any other with its Defense. North Downs of Fog on the Barrow-downs.
import { describe, expect, it } from "vitest";

import { modifiedStat } from "../../core/keywords.ts";
import { printedOf } from "../../core/printed.ts";
import type { ScenarioState } from "../../core/state.ts";
import { settle } from "../../engine/machine.ts";
import { idOf } from "../../../../test/harness/scene-kit.ts";
import { fogTable as table } from "../../../../test/scenarios/fog-on-the-barrow-downs/scene.ts";

describe("defenseFromWillpower defendingAgainst (148010:A:1)", () => {
  it("148010:A:1 characters defend against a Wight with their Willpower, and against any other enemy with their Defense", () => {
    const t = table({ seats: 1, staging: ["148010"], engaged: ["148011", "f3"] });
    const settled = settle({ ...t.state, mode: "stopped", window: null }, t.ctx, []);
    const hero = settled.seats[0].heroes[0] ?? "";
    const card = settled.cards[hero]!;
    const printed = printedOf(t.ctx.cards, card.code);
    const against = (enemy: string) => ({ ...settled, pendingAttack: { enemyId: idOf(settled, enemy), seat: 0, defenderId: hero } }) as ScenarioState;
    expect(modifiedStat(against("148011"), card, "defense", t.ctx.cards)).toBe(printed.willpower ?? 0);
    expect(modifiedStat(against("f3"), card, "defense", t.ctx.cards)).toBe(printed.defense ?? 0);
    });
});
