// Rules: emce.dragon-signs, rr.guarded, rr.engaged (data/rules/entries.json); ledger lines 19012:A:1 to 19012:A:3, 19023:B:2, 19023:B:3, 19025:B:1, 19024:A:1, 19024:B:2. What the table says of The Withered Heath's pieces: a Dragon Sign and its guard, Cold-Drake
// engaged with each player and its damage caps, and the damage it keeps while set aside. The engine decided each; nothing here changes one.
import { beforeAll, describe, expect, it } from "vitest";

import { updateCard } from "../../rules/core/state.ts";
import { guardWith } from "../../rules/families/objectives/guard.ts";
import { syncConstants } from "../../rules/interpret/constants.ts";
import { CODES, heathTable, idOf, loadHeathWorld, type HeathWorld } from "../../../test/scenarios/the-withered-heath/scene.ts";

import { dungeonDetail } from "../cards/dungeon-preview.ts";

let world: HeathWorld;
beforeAll(async () => {
  world = await loadHeathWorld();
}, 120_000);

const nameOf = (table: ReturnType<typeof heathTable>) => (id: string) => table.ctx.cards.get(table.state.cards[id]?.code ?? id)?.name ?? id;
const detail = (t: ReturnType<typeof heathTable>, code: string) => dungeonDetail(t.state, t.ctx, idOf(t.state, code), nameOf(t));

describe("a Dragon Sign (19012:A:1 to 19012:A:3)", () => {
  it("names its guard, and says it goes to the victory display once nothing guards it", () => {
    const t = heathTable(world, { staging: [CODES.dragonSign, CODES.snowTroll] });
    const sign = idOf(t.state, CODES.dragonSign);
    const guarded = syncConstants(guardWith(t.state, idOf(t.state, CODES.snowTroll), sign), t.ctx);
    expect(dungeonDetail(guarded, t.ctx, sign, nameOf(t))).toBe("Guarded by Snow-troll, which is immune to player card effects. When nothing guards it, it goes to the victory display.");
    // A guard that is a location (Creature Den, 19018:A:1) is named the same way.
    const den = heathTable(world, { staging: [CODES.dragonSign, CODES.creatureDen] });
    const denSign = idOf(den.state, CODES.dragonSign);
    expect(dungeonDetail(syncConstants(guardWith(den.state, idOf(den.state, CODES.creatureDen), denSign), den.ctx), den.ctx, denSign, nameOf(den))).toContain("Guarded by Creature Den, which is immune");
  });

  it("with no guard it is free of encounters", () => {
    const t = heathTable(world, { staging: [CODES.dragonSign] });
    expect(detail(t, CODES.dragonSign)).toBe("Free of encounters: it goes to the victory display");
  });

  it("says nothing once it lies in the victory display", () => {
    const t = heathTable(world, { victory: [CODES.dragonSign] });
    expect(detail(t, CODES.dragonSign)).toBeNull();
  });
});

describe("Cold-Drake at stage 2 (19023:B:2, 19023:B:3)", () => {
  it("is engaged with each player from the staging area, takes at most 6 damage a round and never has more than 18", () => {
    const t = heathTable(world, { stage: "19023", staging: [CODES.coldDrake] });
    expect(detail(t, CODES.coldDrake)).toBe("Engaged with each player from the staging area: it attacks every player in the combat phase, any player's characters can attack it, and it adds no Threat. Takes at most 6 damage each round (6 more this round). Never has more than 18 damage, and stays in play even then.");
  });

  it("counts the damage it has taken this round", () => {
    const t = heathTable(world, { stage: "19023", staging: [CODES.coldDrake] });
    const drake = idOf(t.state, CODES.coldDrake);
    const hurt = { ...t.state, roundDamage: { [drake]: 4 } };
    expect(dungeonDetail(hurt, t.ctx, drake, nameOf(t))).toContain("Takes at most 6 damage each round (2 more this round).");
  });

  it("says nothing of the stage while it is not in play", () => {
    const t = heathTable(world, { stage: "19022", staging: [CODES.coldDrake] });
    expect(detail(t, CODES.coldDrake)).toBeNull();
  });
});

describe("Cold-Drake at stage 4 (19025:B:1)", () => {
  it("takes at most as much damage a round as there are Dragon Signs in the victory display, and is no longer engaged with each player", () => {
    const t = heathTable(world, { stage: "19025", staging: [CODES.coldDrake], victory: [CODES.dragonSign, CODES.dragonSign, CODES.dragonSign] });
    expect(detail(t, CODES.coldDrake)).toBe("Takes at most 3 damage each round (3 more this round).");
  });
});

describe("Cold-Drake set aside by Hunting the Beast (19024:A:1, 19024:B:2)", () => {
  it("keeps its damage, and 3 damage come off it at the end of each round", () => {
    const t = heathTable(world, { stage: "19024", setAside: [CODES.coldDrake] });
    const drake = idOf(t.state, CODES.coldDrake);
    const kept = updateCard(t.state, drake, { damage: 15, keepsDamage: true });
    expect(dungeonDetail(kept, t.ctx, drake, nameOf(t))).toBe("Set aside with 15 damage, which it keeps when it returns. 3 damage come off it at the end of each round.");
    // A card set aside by any other means says nothing.
    expect(dungeonDetail(updateCard(t.state, drake, { damage: 5 }), t.ctx, drake, nameOf(t))).toBeNull();
  });
});
