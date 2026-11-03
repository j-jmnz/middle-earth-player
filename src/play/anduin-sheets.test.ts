import { beforeAll, describe, expect, it } from "vitest";

import { legalIntents } from "../rules/engine/legal.ts";
import { fight, loadAnduinWorld, type AnduinWorld } from "../../test/scenarios/journey-along-the-anduin/scene.ts";

import type { SheetNames } from "./sheet-types.ts";
import { sheetFor } from "./sheets.ts";

// Rules: rr.shadow-effects, rr.attacks-outside-the-combat-phase (data/rules/entries.json); ledger line 01081:A:2.
// The defense sheet of the attack Wolf Rider makes as a shadow card says where the attack comes from.
let world: AnduinWorld;

beforeAll(async () => {
  world = await loadAnduinWorld();
});

describe("the defense sheet of Wolf Rider's shadow attack", () => {
  it("names the shadow effect that started the attack, and says when Wolf Rider goes back (01081:A:2)", () => {
    const { run, ctx } = fight(world, "01081", "grunt", { deck: ["01081", "f0", "f0", "f0", "f0"] }, { undefended: true });
    const names: SheetNames = { card: (id) => ctx.cards.get(run.state.cards[id]?.code ?? "")?.name ?? id, line: () => null };
    const sheet = sheetFor(run.state, ctx, legalIntents(run.state, ctx), names);
    expect(sheet?.kind).toBe("pick");
    if (sheet?.kind !== "pick") return;
    expect(sheet.title).toBe("Wolf Rider attacks");
    expect(sheet.note).toContain("Wolf Rider's shadow effect: it attacks you now, and goes back to the top of the encounter deck after combat.");
  });
});
