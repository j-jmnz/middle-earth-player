import { describe, expect, it } from "vitest";

import { legalIntents, reduce, type PlayerIntent } from "../../../src/rules/engine/reduce.ts";
import { send, start, tableFromLayout, type Layout } from "../../../test/harness/scene-kit.ts";

import { foesToCome, movesOf, STYLES, type Style } from "./moves.ts";

const ID = "the-uruk-hai";
const built = (layout: Layout) => tableFromLayout(ID, layout);
const careful: Style = STYLES[0] as Style;
const bold: Style = { quest: "all", engage: "all", attack: "always", travel: "easiest" };

// Every option of every window is an intent the reducer accepts, and the list has no twin.
const accepted = (table: ReturnType<typeof built>, options: readonly PlayerIntent[]) => options.map((intent) => reduce(table.state, intent, table.ctx).ok);
const distinct = (options: readonly PlayerIntent[]) => new Set(options.map((intent) => JSON.stringify(intent))).size === options.length;

describe("the search's move generator", () => {
  it("lists the quest commitments the style puts first: everyone, or all but the best defender", () => {
    const table = built({ phase: "Quest", play: [{ code: "ally", seat: 0 }, { code: "ally", seat: 0 }] });
    const all = movesOf(table.state, table.ctx, new Set(), bold);
    const kept = movesOf(table.state, table.ctx, new Set(), careful);
    const ids = (options: readonly PlayerIntent[]) => (options[0]?.type === "Commit" ? options[0].cardIds.length : -1);
    expect(ids(all)).toBe(4);
    expect(ids(kept)).toBe(3);
    expect(distinct(all)).toBe(true);
    expect(accepted(table, all).every(Boolean)).toBe(true);
    expect(all.length).toBeGreaterThan(2);
  });

  it("keeps back as many defenders as enemies will attack", () => {
    const table = built({ phase: "Quest", engaged: [{ code: "f0", seat: 0 }, { code: "f3", seat: 0 }], play: [{ code: "ally", seat: 0 }, { code: "ally", seat: 0 }] });
    expect(foesToCome(table.state, table.ctx)).toBe(2);
    const first = movesOf(table.state, table.ctx, new Set(), STYLES[0] as Style)[0];
    expect(first?.type === "Commit" ? first.cardIds.length : -1).toBe(2);
  });

  it("offers engaging the enemies first to a bold style and declining first to a careful one", () => {
    const table = built({ phase: "Encounter", staging: ["f0", "f3"] });
    const engaged = movesOf(table.state, table.ctx, new Set(), bold);
    const declined = movesOf(table.state, table.ctx, new Set(), careful);
    expect(engaged[0]?.type).toBe("Engage");
    expect(declined[0]?.type).toBe("DeclineEngage");
    expect(engaged.filter((intent) => intent.type === "Engage")).toHaveLength(2);
    expect(accepted(table, engaged).every(Boolean)).toBe(true);
  });

  it("answers an attack with the defender who takes the least, and keeps the undefended hero as the last resort", () => {
    // An enemy engaged with the seat attacks in the combat phase: the table is played on, passing, to its defense window.
    const opened = built({ phase: "Encounter", engaged: [{ code: "f3", seat: 0 }], deck: ["f0", "f0", "f0"], play: [{ code: "ally", seat: 0 }] });
    let run = send(start(opened.state), { type: "DeclineEngage" }, opened.ctx);
    for (let guard = 0; guard < 40 && run.state.window?.kind !== "defense"; guard += 1) run = send(run, { type: "Pass" }, opened.ctx);
    expect(run.state.window?.kind).toBe("defense");
    const table = { state: run.state, ctx: opened.ctx };
    const options = movesOf(table.state, table.ctx, new Set(), careful);
    expect(options.length).toBeGreaterThan(1);
    expect(options[0]?.type).toBe("DeclareDefender");
    expect(options.every((intent) => reduce(table.state, intent, table.ctx).ok)).toBe(true);
    expect(distinct(options)).toBe(true);
  });

  it("lists the fewest attackers that kill an enemy, then all of them, and declines last", () => {
    const table = built({ phase: "PlayerAttacks", engaged: [{ code: "f0", seat: 0 }], play: [{ code: "ally", seat: 0 }] });
    const options = movesOf(table.state, table.ctx, new Set(), bold);
    expect(options.at(-1)?.type).toBe("DeclineAttack");
    const attacks = options.flatMap((intent) => (intent.type === "DeclareAttackers" ? [intent.attackerIds.length] : []));
    expect(attacks.length).toBeGreaterThan(0);
    expect(Math.max(...attacks)).toBe(3);
    expect(movesOf(table.state, table.ctx, new Set(), { ...bold, attack: "never" })[0]?.type).toBe("DeclineAttack");
    expect(options.every((intent) => reduce(table.state, intent, table.ctx).ok)).toBe(true);
  });

  it("plays a card in the planning window, then passes", () => {
    const table = built({ phase: "Planning", hand: ["ally"], heroResources: 3 });
    const options = movesOf(table.state, table.ctx, new Set(), careful);
    expect(options[0]?.type).toBe("PlayCard");
    expect(options.at(-1)).toEqual({ type: "Pass" });
    expect(legalIntents(table.state, table.ctx).some((intent) => intent.type === "PlayCard")).toBe(true);
    expect(options.every((intent) => reduce(table.state, intent, table.ctx).ok)).toBe(true);
  });

  it("gives the same list for the same table and style", () => {
    const table = built({ phase: "Quest", play: [{ code: "ally", seat: 0 }] });
    expect(movesOf(table.state, table.ctx, new Set(), careful)).toEqual(movesOf(table.state, table.ctx, new Set(), careful));
  });
});
