// Rules: emce.guarded-x, emce.caves-deck, rr.guarded (data/rules/entries.json); ledger lines 18050:A:2, 18043:A:3, 18059:A:2, 12172:A:2. What the table says of The King's Quest's pieces: the card Hobgoblin holds, an Artifact guarded in the
// staging area, the shield Dragon Scales gives its enemy and the resources of The Threat to Wilderland. The engine decided each; nothing here changes one.
import { beforeAll, describe, expect, it } from "vitest";

import { attachTo, cardsUnder } from "../../rules/core/zones.ts";
import { guardPickedAttachment, guardWithDeckTop } from "../../rules/families/wilderland/kings.ts";
import { pushEffectFrame } from "../../rules/interpret/effect-frames.ts";
import { syncConstants } from "../../rules/interpret/constants.ts";
import { CODES, idOf, kingsquestTable, loadKingsquestWorld, type KingsquestWorld } from "../../../test/scenarios/the-kings-quest/scene.ts";

import { cardEffects } from "../cards/card-effects.ts";
import { dungeonDetail } from "../cards/dungeon-preview.ts";
import { tokenLines } from "../cards/table-preview.ts";

let world: KingsquestWorld;
beforeAll(async () => {
  world = await loadKingsquestWorld();
}, 120_000);

const nameOf = (table: ReturnType<typeof kingsquestTable>) => (id: string) => table.ctx.cards.get(table.state.cards[id]?.code ?? id)?.name ?? id;

describe("the card Hobgoblin holds (18050:A:2)", () => {
  it("names the card, its owner and when it returns, two-handed and solo", () => {
    for (const [seats, owner] of [[2, "Player 1's"], [1, "your"]] as const) {
      const t = kingsquestTable(world, { seats, staging: [CODES.hobgoblin], deckOf: [CODES.guardOfTheCitadel, "f0"] });
      const hob = idOf(t.state, CODES.hobgoblin);
      const held = guardWithDeckTop(t.state, { seat: 0, sourceId: hob });
      expect(cardsUnder(held, hob)).toHaveLength(1);
      expect(dungeonDetail(held, t.ctx, hob, nameOf(t))).toBe(`Holds Guard of the Citadel, ${owner} card, faceup. It returns to its owner's hand when Hobgoblin leaves play.`);
    }
    const bare = kingsquestTable(world, { staging: [CODES.hobgoblin] });
    expect(dungeonDetail(bare.state, bare.ctx, idOf(bare.state, CODES.hobgoblin), nameOf(bare))).toBeNull();
  });
});

describe("an Artifact guarded in the staging area (18043:A:3)", () => {
  it("names the guard and who claims it", () => {
    const t = kingsquestTable(world, { deck: [CODES.contestedDepths, "f0"], hand: [CODES.hornOfGondor] });
    const horn = idOf(t.state, CODES.hornOfGondor);
    const framed = pushEffectFrame(t.state, { frame: "ResolveEffect", sourceId: null, actor: 0, peril: false, effectId: "x", instructions: [], picked: [horn], cancel: null, blockCancel: null }, []);
    const guarded = syncConstants(guardPickedAttachment(framed, { verb: "GuardPickedAttachment", types: ["location"] }, { seat: 0, sourceId: null }, t.ctx, []), t.ctx);
    expect(guarded.cards[horn]?.zone).toBe("staging");
    expect(dungeonDetail(guarded, t.ctx, horn, nameOf(t))).toBe("Guarded by Contested Depths. Once nothing guards it, the first player claims it for a character.");
  });
});

describe("Dragon Scales on Fire-drake (18059:A:2)", () => {
  it("shows the shield on the enemy that carries it", () => {
    const t = kingsquestTable(world, { engaged: [CODES.fireDrake] });
    const drake = idOf(t.state, CODES.fireDrake);
    expect(cardEffects(t.state, t.ctx, drake).flags.map((flag) => flag.flag)).not.toContain("cancelsDamage");
    const scales = kingsquestTable(world, { engaged: [CODES.fireDrake], staging: [CODES.dragonScales] });
    const host = idOf(scales.state, CODES.fireDrake);
    const worn = syncConstants(attachTo(scales.state, idOf(scales.state, CODES.dragonScales), host), scales.ctx);
    expect(cardEffects(worn, scales.ctx, host).flags).toEqual(expect.arrayContaining([expect.objectContaining({ flag: "cancelsDamage", word: "Cancels all the damage it would take, once" })]));
  });
});

describe("The Threat to Wilderland (12172:A:2)", () => {
  it("shows its resources as tokens and says what each quest phase does with them", () => {
    const t = kingsquestTable(world, { staging: [{ code: CODES.theThreatToWilderland, resources: 3 }] });
    const threat = idOf(t.state, CODES.theThreatToWilderland);
    expect(tokenLines(t.state.cards[threat]!)).toContain("3 resources");
    expect(dungeonDetail(t.state, t.ctx, threat, nameOf(t))).toBe("3 resources: one is removed at the beginning of each quest phase, then the first player chooses between 2 threat for each player and all encounter cards immune to player card effects for the phase");
    const spent = kingsquestTable(world, { staging: [{ code: CODES.theThreatToWilderland, resources: 0 }] });
    expect(dungeonDetail(spent.state, spent.ctx, idOf(spent.state, CODES.theThreatToWilderland), nameOf(spent))).toBe("No resources left: it does nothing");
  });
});
