// Rules: rr.guarded, rr.explored, rr.victory, rr.player-elimination (data/rules/entries.json); ledger lines 18074:B:2, 18075:B:2, 18075:B:3, 18076:B:1 to 18076:B:3, 18029:A:2. What the table says of Lost in Mirkwood's pieces: an enemy that holds a hero, a location with a hand under it, the nemesis, and an
// Objective-Location, which shows a location's numbers and travels like one. The engine decided each; nothing here changes one.
import { beforeAll, describe, expect, it } from "vitest";

import { updateCard } from "../../rules/core/state.ts";
import { carryAwayHero } from "../../rules/families/wilderland/carried.ts";
import { placeHandUnderLocation } from "../../rules/families/wilderland/lost.ts";
import { syncConstants } from "../../rules/interpret/constants.ts";
import { pushEffectFrame } from "../../rules/interpret/effect-frames.ts";
import { CODES, idOf, legalIntents, loadLostmirkWorld, lostmirkTable, type LostmirkWorld } from "../../../test/scenarios/lost-in-mirkwood/scene.ts";

import { cardEffects } from "../cards/card-effects.ts";
import { dungeonDetail } from "../cards/dungeon-preview.ts";
import { sheetFor } from "../choice/sheets.ts";
import { heldDial, heldDials } from "../readouts/widgets.ts";

let world: LostmirkWorld;
beforeAll(async () => {
  world = await loadLostmirkWorld();
}, 120_000);

const nameOf = (table: ReturnType<typeof lostmirkTable>) => (id: string) => table.ctx.cards.get(table.state.cards[id]?.code ?? id)?.name ?? id;

// The hero picked, then the enemy that came: the effect has run CarryAwayHero.
function carried(seats: 1 | 2) {
  const t = lostmirkTable(world, { seats, stage: "18074", staging: [CODES.ravenousSpider] });
  const enemy = idOf(t.state, CODES.ravenousSpider);
  const framed = pushEffectFrame(t.state, { frame: "ResolveEffect", sourceId: null, actor: 0, peril: false, effectId: "x", instructions: [], picked: [seats === 2 ? (t.seat1Hero ?? t.hero) : t.hero, enemy], cancel: null, blockCancel: null }, []);
  return { t, enemy, state: carryAwayHero(framed, t.ctx, []), hero: seats === 2 ? (t.seat1Hero ?? t.hero) : t.hero };
}

describe("an enemy that holds a hero (18074:B:2)", () => {
  it("names the hero, its owner and what frees it, and the owner's dial says it is held", () => {
    const two = carried(2);
    expect(dungeonDetail(two.state, two.t.ctx, two.enemy, nameOf(two.t))).toBe(`Holds ${nameOf(two.t)(two.hero)}, Player 2's hero, facedown. Defeat or discard it to free the hero, exhausted.`);
    expect(heldDial(two.state, (code) => two.t.ctx.cards.get(code)?.name ?? code)).toMatchObject({ seat: 1, mark: "hero" });
    const solo = carried(1);
    expect(dungeonDetail(solo.state, solo.t.ctx, solo.enemy, nameOf(solo.t))).toContain(", your hero, facedown.");
  });
});

describe("two heroes held at once (18074:A:1)", () => {
  it("gives each owner's dial its own mark", () => {
    const two = carried(2);
    const other = two.t.hero;
    const second = two.state.cards[other];
    expect(second).toBeDefined();
    if (!second) return;
    const both = { ...two.state, cards: { ...two.state.cards, [other]: { ...second, zone: "captive" as const, guardedHero: true as const, host: two.enemy, owner: 0 } } };
    const marks = heldDials(both, (code) => two.t.ctx.cards.get(code)?.name ?? code, () => true);
    expect(marks.map((mark) => mark.seat).sort()).toEqual([0, 1]);
  });
});

describe("a location with a hand under it (18075:B:2, 18075:B:3)", () => {
  it("names the owner and the cards, and what happens to them", () => {
    const t = lostmirkTable(world, { seats: 2, stage: "18075", hand: [CODES.melanwar, CODES.melanwar, CODES.melanwar], staging: [CODES.forestClearing, CODES.bareHilltop] });
    const place = idOf(t.state, CODES.forestClearing);
    const framed = pushEffectFrame(t.state, { frame: "ResolveEffect", sourceId: null, actor: 1, peril: false, effectId: "x", instructions: [], picked: [], cancel: null, blockCancel: null }, []);
    const down = placeHandUnderLocation(framed, { seat: 1, sourceId: null, chosen: place }, t.ctx, []);
    expect(dungeonDetail(down, t.ctx, place, nameOf(t))).toBe("Player 2's hand, 3 cards, facedown under it: back to hand when explored, discarded if the players advance");
    expect(dungeonDetail(down, t.ctx, idOf(down, CODES.bareHilltop), nameOf(t))).toBeNull();
  });
});

describe("the nemesis (18076:B:1 to 18076:B:3)", () => {
  it("states its rules on the stage's quest points", () => {
    const t = lostmirkTable(world, { stage: "18076", staging: [CODES.ravenousSpider] });
    const spider = idOf(t.state, CODES.ravenousSpider);
    const marked = updateCard(t.state, spider, { nemesis: true });
    const line = dungeonDetail(marked, t.ctx, spider, nameOf(t));
    expect(line).toContain("immune to player card effects");
    expect(line).toContain("It takes no damage while the stage has fewer than 8 progress");
    expect(line).toContain("blocks the stage");
    expect(line).toContain("it returns to the staging area and attacks the first player");
    expect(line).toContain("Defeating it wins the game");
    expect(dungeonDetail(t.state, t.ctx, spider, nameOf(t))).toBeNull();
  });
});

describe("an Objective-Location (18029:A:2)", () => {
  it("shows its threat and quest points like a location, and the travel sheet counts it among the locations that wait", () => {
    // Truly Lost: +1 quest point for each facedown player card under it, shown on the card as it is for a location.
    const t = lostmirkTable(world, { stage: "18075", hand: [CODES.melanwar, CODES.melanwar], staging: [CODES.overgrownPath, CODES.forestClearing] });
    const path = idOf(t.state, CODES.overgrownPath);
    const framed = pushEffectFrame(t.state, { frame: "ResolveEffect", sourceId: null, actor: 0, peril: false, effectId: "x", instructions: [], picked: [], cancel: null, blockCancel: null }, []);
    const down = syncConstants(placeHandUnderLocation(framed, { seat: 0, sourceId: null, chosen: path }, t.ctx, []), t.ctx);
    expect(cardEffects(down, t.ctx, path).stats).toEqual([expect.objectContaining({ stat: "questPoints", delta: 2 })]);
    expect(cardEffects(down, t.ctx, idOf(down, CODES.forestClearing)).stats).toEqual([]);
    // Only an Objective-Location waits in the staging area while a location is active: the sheet says to explore the active one first, as it does for a location.
    const active = lostmirkTable(world, { stage: "18071", phase: "Travel", active: CODES.forestClearing, staging: [CODES.overgrownPath] });
    const sheet = sheetFor(active.state, active.ctx, legalIntents(active.state, active.ctx), { card: nameOf(active), line: () => null });
    if (sheet?.kind !== "pick") throw new Error("expected a pick sheet");
    expect(sheet.title).toBe("Explore Forest Clearing first");
  });
});
