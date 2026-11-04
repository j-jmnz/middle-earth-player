// Rules: rr.card-types, rr.constant-ability (data/rules/entries.json).
// A card that loses the ally card type and gains the hero card type: Prince Imrahil while a hero is in his controller's discard pile
// (145005:A:1). Sword-thain's host works the same way (play/control.test.ts); both are the heroType flag, read as cardTypeOf.
import { describe, expect, it } from "vitest";

import { RECORDS } from "../../../effects/authored/families/play.ts";

import { pickCandidates } from "../../interpret/pick.ts";
import { cardTypeOf, printedOf } from "../../core/printed.ts";
import { destroyCard, eliminateEmpties } from "../../core/keywords.ts";
import { moveCard } from "../../core/zones.ts";
import { playCtx, put, run, seat } from "./fixture.ts";

const ctx = playCtx(RECORDS);

describe("Prince Imrahil is a hero while a hero is in your discard pile (145005:A:1)", () => {
  it("is an ally with no hero in the discard pile", () => {
    const table = seat(1, ["dwarf", "rohan"]);
    const imrahil = put(table.state, "145005", "play");
    const state = run(imrahil.state, ctx);
    expect(state.cards[imrahil.id]?.zone).toBe("play");
    expect(pickCandidates(state, { type: "ally", control: "you" }, 0, [], null, ctx)).toContain(imrahil.id);
    expect(pickCandidates(state, { type: "hero", control: "you" }, 0, [], null, ctx)).not.toContain(imrahil.id);
  });

  it("becomes a hero among your heroes, and not an ally, once a hero is discarded; an ally again when it leaves the discard pile", () => {
    const table = seat(1, ["dwarf", "rohan"]);
    const imrahil = put(table.state, "145005", "play");
    const fallen = run(moveCard(imrahil.state, table.heroes[0] ?? "", { zone: "discard", seat: 0 }), ctx);
    const card = fallen.cards[imrahil.id];
    expect(card?.zone).toBe("heroes");
    expect(fallen.seats[0].heroes).toContain(imrahil.id);
    expect(cardTypeOf(card ?? { zone: "play" }, printedOf(ctx.cards, "145005"))).toBe("hero");
    expect(pickCandidates(fallen, { type: "hero", control: "you" }, 0, [], null, ctx)).toContain(imrahil.id);
    expect(pickCandidates(fallen, { type: "ally", control: "you" }, 0, [], null, ctx)).not.toContain(imrahil.id);
    expect(pickCandidates(fallen, { type: "character", control: "you" }, 0, [], null, ctx)).toContain(imrahil.id);
    const restored = run(moveCard(fallen, table.heroes[0] ?? "", { zone: "removed" }), ctx);
    expect(restored.cards[imrahil.id]?.zone).toBe("play");
    expect(restored.seats[0].heroes).not.toContain(imrahil.id);
  });

  it("only counts a hero in his controller's own discard pile", () => {
    const table = seat(2, ["dwarf"]);
    const imrahil = put(table.state, "145005", "play", 0);
    const other = run(moveCard(imrahil.state, table.heroes[1] ?? "", { zone: "discard", seat: 1 }), ctx);
    expect(other.cards[imrahil.id]?.zone).toBe("play");
  });

  it("does not leave play as an ally when it is destroyed as a hero", () => {
    const table = seat(1, ["dwarf", "rohan"]);
    const imrahil = put(table.state, "145005", "play");
    const fallen = run(moveCard(imrahil.state, table.heroes[0] ?? "", { zone: "discard", seat: 0 }), ctx);
    const destroyed = destroyCard(fallen, imrahil.id, ctx.cards, []);
    expect((destroyed.pendingEvents ?? []).some((event) => event.trigger === "allyLeftPlay")).toBe(false);
    expect(destroyed.cards[imrahil.id]?.zone).toBe("discard");
  });

  it("keeps his player in the game when the last hero falls (his player still has a hero)", () => {
    const table = seat(1, ["dwarf"]);
    const imrahil = put(table.state, "145005", "play");
    const settled = run(imrahil.state, ctx);
    expect(settled.heroSavers).toEqual([0]);
    const fallen = run(destroyCard(settled, table.heroes[0] ?? "", ctx.cards, []), ctx);
    expect(fallen.cards[imrahil.id]?.zone).toBe("heroes");
    expect(fallen.seats[0].eliminated).toBe(false);
  });

  it("eliminates the player after all when no hero reached the discard pile for him to follow", () => {
    const table = seat(1, ["dwarf"]);
    const settled = run(put(table.state, "145005", "play").state, ctx);
    const gone = eliminateEmpties(moveCard(settled, table.heroes[0] ?? "", { zone: "removed" }), []);
    expect(gone.seats[0].eliminated).toBe(false);
    expect(run(gone, ctx).seats[0].eliminated).toBe(true);
  });
});
