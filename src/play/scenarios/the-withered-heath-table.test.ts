// Rules: emce.dragon-signs, rr.guarded, rr.engaged (data/rules/entries.json); ledger lines 19012:A:1 to 19012:A:3, 19023:B:2, 19023:B:3, 19025:B:1, 19024:A:1, 19024:B:2. What the table says of The Withered Heath's pieces: a Dragon Sign and its guard, Cold-Drake
// engaged with each player and its damage caps, and the damage it keeps while set aside. The engine decided each; nothing here changes one.
import { beforeAll, describe, expect, it } from "vitest";

import { updateCard } from "../../rules/core/state.ts";
import { guardWith } from "../../rules/families/objectives/guard.ts";
import { syncConstants } from "../../rules/interpret/constants.ts";
import { CODES, heathTable, idOf, loadHeathWorld, type HeathWorld } from "../../../test/scenarios/the-withered-heath/scene.ts";

import { dungeonDetail } from "../cards/dungeon-preview.ts";
import { ledgerLine } from "../cards/ledger.ts";
import { questTitle } from "../cards/table-preview.ts";

let world: HeathWorld;
beforeAll(async () => {
  world = await loadHeathWorld();
}, 120_000);

const nameOf = (table: ReturnType<typeof heathTable>) => (id: string) => table.ctx.cards.get(table.state.cards[id]?.code ?? id)?.name ?? id;
const detail = (t: ReturnType<typeof heathTable>, code: string) => dungeonDetail(t.state, t.ctx, idOf(t.state, code), nameOf(t));

describe("a Dragon Sign (19012:A:1 to 19012:A:3)", () => {
  it("names its guard, and says it goes to the victory display once nothing guards it", () => {
    const t = heathTable(world, { staging: [CODES.dragonSign, CODES.snowTroll], setAside: Array.from({ length: 3 }, () => CODES.dragonSign) });
    const sign = idOf(t.state, CODES.dragonSign);
    const guarded = syncConstants(guardWith(t.state, idOf(t.state, CODES.snowTroll), sign), t.ctx);
    expect(dungeonDetail(guarded, t.ctx, sign, nameOf(t))).toBe("Guarded by Snow-troll, which is immune to player card effects. When nothing guards it, it goes to the victory display. 0 of 4 Dragon Signs in the victory display; 4 discover a treasure.");
    // A guard that is a location (Creature Den, 19018:A:1) is named the same way.
    const den = heathTable(world, { staging: [CODES.dragonSign, CODES.creatureDen] });
    const denSign = idOf(den.state, CODES.dragonSign);
    expect(dungeonDetail(syncConstants(guardWith(den.state, idOf(den.state, CODES.creatureDen), denSign), den.ctx), den.ctx, denSign, nameOf(den))).toContain("Guarded by Creature Den, which is immune");
  });

  it("with no guard it is free of encounters", () => {
    const t = heathTable(world, { staging: [CODES.dragonSign], setAside: Array.from({ length: 3 }, () => CODES.dragonSign) });
    expect(detail(t, CODES.dragonSign)).toBe("Free of encounters: it goes to the victory display. 0 of 4 Dragon Signs in the victory display; 4 discover a treasure.");
  });

  it("says nothing once it lies in the victory display", () => {
    const t = heathTable(world, { victory: [CODES.dragonSign] });
    expect(detail(t, CODES.dragonSign)).toBeNull();
  });
});

describe("Cold-Drake at stage 2 (19023:B:2, 19023:B:3)", () => {
  it("is engaged with each player from the staging area, takes at most 6 damage a round and never has more than 18", () => {
    const t = heathTable(world, { stage: "19023", staging: [CODES.coldDrake] });
    expect(detail(t, CODES.coldDrake)).toBe("Engaged with each player from the staging area. It attacks every player in the combat phase, any player's characters can attack it, and it adds no Threat. Takes at most 6 damage each round (6 more this round). Never has more than 18 damage, and stays in play even then.");
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
    expect(detail(t, CODES.coldDrake)).toBe("Takes at most 3 damage each round (1 for each Dragon Sign in the victory display; 3 more this round).");
  });
});

describe("the stages that read the Dragon Signs (19022:B:2, 19024:B:3, 19025:B:1)", () => {
  const signs = (n: number) => Array.from({ length: n }, () => CODES.dragonSign);

  it("count the Dragon Signs in the victory display out of the four of the game, and say how many the treasure takes", () => {
    const t = heathTable(world, { stage: "19022", staging: [CODES.dragonSign], setAside: signs(3), victory: signs(0) });
    const four = heathTable(world, { stage: "19022", staging: [CODES.dragonSign], setAside: signs(1), victory: signs(2) });
    expect(detail(t, CODES.stage1)).toBe("0 of 4 Dragon Signs in the victory display; 4 discover a treasure.");
    expect(detail(four, CODES.stage1)).toBe("2 of 4 Dragon Signs in the victory display; 4 discover a treasure.");
  });

  it("stage 3 says Cold-Drake is set aside with its damage and how much comes off each round (the set-aside card itself is never drawn)", () => {
    const t = heathTable(world, { stage: "19024", setAside: [CODES.coldDrake], victory: signs(2) });
    const drake = idOf(t.state, CODES.coldDrake);
    const kept = updateCard(t.state, drake, { damage: 15, keepsDamage: true });
    expect(dungeonDetail(kept, t.ctx, idOf(kept, CODES.stage3), nameOf(t))).toBe("2 of 2 Dragon Signs in the victory display; 4 discover a treasure. Cold-Drake is set aside with 15 damage; 3 come off each round.");
  });

  it("stage 2 has nothing of the signs to say", () => {
    const t = heathTable(world, { stage: "19023", staging: [CODES.coldDrake] });
    expect(detail(t, CODES.stage2)).toBeNull();
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

describe("A Cornered Dragon (19025:B:3)", () => {
  it("has no quest points, and its preview says how it is won: the printed line, whose win is inside a Delay", () => {
    const t = heathTable(world, { stage: "19025", staging: [CODES.coldDrake] });
    const stage = idOf(t.state, CODES.stage4);
    const preview = questTitle(t.state, t.ctx, stage, "A Cornered Dragon", ledgerLine);
    expect(preview?.detail).toMatch(/^To win: .*When Cold-Drake is defeated, the players win the game\.$/);
    expect(preview?.detail).not.toBe("No quest points");
  });

  it("the other stages keep their quest points", () => {
    for (const stage of ["19022", "19023", "19024"] as const) {
      const t = heathTable(world, { stage });
      const preview = questTitle(t.state, t.ctx, idOf(t.state, stage), "Stage", ledgerLine);
      expect(preview?.title, stage).toMatch(/ · \d+ \/ \d+$/);
    }
  });
});
