// Rules: rr.damage, rr.destroy, rr.player-elimination, hrd.objective-heroes, hrd.objective-hero-elimination (data/rules/entries.json); ledger lines 16035:A:2, 16039:A:2, 16031:A:2.
// The damage trays of The Long Arm of Mordor: an objective-hero's row says what it is and the damage it stands at, the point that destroys a character says so and arms the confirm with the player it eliminates or the game it loses.
import { describe, expect, it } from "vitest";

import type { Instruction } from "../../catalog/boundary.ts";
import { settle } from "../../rules/engine/machine.ts";
import { idOf, tableFromLayout, type Layout } from "../../../test/harness/scene-kit.ts";

import { captiveLabel } from "./sheet-parts.ts";
import { mordorRow } from "./mordor-sheets.ts";

const ASSIGN: Instruction = { verb: "AssignDamage", amount: { stage: true }, pick: { type: "character", control: "you" }, single: true, left: 1 };
const MARKS = (code: string) => ({ code, from: code, stats: [["blankText", 1], ["immuneToPlayerCards", 1]] as const });
const OBJECTIVE = (code: string) => ({ code, from: code, stats: [["heroType", 1]] as const });

function at(layout: Layout) {
  const made = tableFromLayout("the-long-arm-of-mordor", { phase: "Quest", stage: "16073", side: "A", ...layout });
  const state = settle(made.state, made.ctx, []);
  const name = (id: string) => made.ctx.cards.get(state.cards[id]?.code ?? "")?.name ?? id;
  return { made, state, name };
}

describe("16035:A:2 the damage tray rows", () => {
  it("an objective-hero is told as one, with the damage it stands at, and the point that destroys it arms the confirm with the player eliminated", () => {
    const { made, state, name } = at({ seats: 2, heroes: [{ code: "16032", seat: 1, damage: 2 }, { code: "16031", seat: 0, damage: 0 }], modified: [OBJECTIVE("16032"), OBJECTIVE("16031")] });
    const firyal = idOf(state, "16032");
    const kahliel = idOf(state, "16031");
    const options = [firyal, kahliel];
    const destroying = mordorRow(ASSIGN, firyal, options, state, made.ctx, name);
    expect(destroying?.label).toBe("Firyal · objective-hero · 3 of 3 damage · destroyed · Player 2");
    expect(destroying?.caution).toBe("Tap again: Firyal falls and Player 2 is eliminated");
    const plain = mordorRow(ASSIGN, kahliel, options, state, made.ctx, name);
    expect(plain?.label).toBe("Kahliel · objective-hero · 1 of 3 damage · Player 1");
    expect(plain?.caution).toBeUndefined();
  });

  it("in true solo the point that destroys the objective-hero loses the game", () => {
    const { made, state, name } = at({ seats: 1, heroes: [{ code: "16032", seat: 0, damage: 2 }], modified: [OBJECTIVE("16032")] });
    const firyal = idOf(state, "16032");
    const row = mordorRow(ASSIGN, firyal, [firyal], state, made.ctx, name);
    expect(row?.caution).toBe("Tap again: Firyal falls and the game is lost");
  });

  it("is no row of another scenario's AssignDamage", () => {
    const made = tableFromLayout("escape-from-umbar", { seats: 1 });
    expect(mordorRow(ASSIGN, made.hero, [made.hero], made.state, made.ctx, () => "x")).toBeNull();
  });
});

describe("heroes the staging area holds, in a pick's rows", () => {
  it("a hero no card holds is in the staging area, a guarded hero is guarded by its Orc, and a Captive of another scenario stays a Captive", () => {
    const { made, state, name } = at({ seats: 2, staging: ["16062"], staged: [{ hero: "dh1" }, { hero: "dh2", under: "16062" }], modified: [MARKS("dh1"), MARKS("dh2")] });
    const names = { card: name } as Parameters<typeof captiveLabel>[2];
    const free = idOf(state, "dh1");
    const guarded = idOf(state, "dh2");
    expect(captiveLabel(state, made.ctx, names, free, [free, guarded])).toContain(" · staging area · ");
    expect(captiveLabel(state, made.ctx, names, guarded, [free, guarded])).toContain(" · guarded by Uruk of Mordor · ");
  });
});
