// Rules: rr.step-3-3, rr.shadow-effects, rr.attachment-cards, rr.guarded, rr.discard-pile-and-victory-display (data/rules/entries.json). The Escape from
// Dol Guldur encounter cards: each line of the ledger (data/printed/mirkwood-paths.json) has a record, and these tests run them on a table of
// plain-number heroes (test/scenarios/escape-from-dol-guldur/scene.ts).
import { beforeAll, describe, expect, it } from "vitest";

import { syncConstants } from "../../../rules/interpret/constants.ts";
import { attachBlocked } from "../../../rules/interpret/restrictions.ts";
import { flagged } from "../../../rules/core/state.ts";
import { causeProblems } from "../../../../test/harness/cause-check.ts";
import { dolGuldurTable, fight, loadDolGuldurWorld, type DolGuldurLayout, type DolGuldurWorld } from "../../../../test/scenarios/escape-from-dol-guldur/scene.ts";
import { first } from "../../../../test/scenarios/a-shadow-of-the-past/scene.ts";

let world: DolGuldurWorld;

beforeAll(async () => {
  world = await loadDolGuldurWorld();
});

function make(layout: DolGuldurLayout = {}) {
  const made = dolGuldurTable(world, layout);
  return { ...made, state: syncConstants(made.state, made.ctx) };
}

describe("Nazgûl of Dol Guldur (01102:A:1)", () => {
  it("has no attachment played on it, and other enemies do", () => {
    const { state, ctx } = make({ engaged: [{ code: "01102", seat: 0 }, { code: "grunt", seat: 0 }] });
    const nazgul = first(state, "01102");
    expect(flagged(state, nazgul, "cannotHaveAttachments")).toBe(true);
    expect(attachBlocked(state, ctx, nazgul, "blade")).toBe(true);
    expect(attachBlocked(state, ctx, first(state, "grunt"), "blade")).toBe(false);
  });
});

describe("Cavern Guardian's shadow effect (01103:A:2)", () => {
  const codes = (state: ReturnType<typeof fight>["run"]["state"], zone: string) => Object.values(state.cards).filter((card) => card.zone === zone).map((card) => card.code).sort();

  it("has the defending player choose and discard 1 attachment he controls; a discarded objective returns to the staging area", () => {
    // The first option the shadow effect offers is the first attachment of the hero: the claimed Shadow Key (a Restricted objective).
    const pickKey = fight(world, "01103", "grunt", { claimed: ["01110"], attachments: ["blade"] }, { answer: (state) => ({ type: "Choose", optionId: state.window?.kind === "choose" ? (state.window.options.find((id) => state.cards[id]?.code === "01110") ?? "") : "" }) });
    expect(codes(pickKey.run.state, "staging")).toContain("01110");
    expect(pickKey.run.state.cards[first(pickKey.run.state, "01110")]?.controller).toBeNull();
    expect(pickKey.run.state.cards[first(pickKey.run.state, "01110")]?.host).toBeNull();
    // The other attachment stays.
    expect(pickKey.run.state.cards[first(pickKey.run.state, "blade")]?.zone).toBe("play");
    // Choosing the other card discards that one to its owner's discard pile, and the objective stays on its hero.
    const pickBlade = fight(world, "01103", "grunt", { claimed: ["01110"], attachments: ["blade"] }, { answer: (state) => ({ type: "Choose", optionId: state.window?.kind === "choose" ? (state.window.options.find((id) => state.cards[id]?.code === "blade") ?? "") : "" }) });
    expect(pickBlade.run.state.cards[first(pickBlade.run.state, "blade")]?.zone).toBe("discard");
    expect(pickBlade.run.state.cards[first(pickBlade.run.state, "01110")]?.zone).toBe("attached");
    expect(causeProblems(pickKey.run.steps)).toEqual([]);
  });

  it("discards every attachment he controls when the attack is undefended, the objective back to the staging area", () => {
    const hit = fight(world, "01103", "grunt", { claimed: ["01109", "01110"], attachments: ["blade"] }, { undefended: true });
    expect(codes(hit.run.state, "staging")).toEqual(expect.arrayContaining(["01109", "01110"]));
    expect(hit.run.state.cards[first(hit.run.state, "blade")]?.zone).toBe("discard");
    expect(hit.run.state.cards[hit.hero]?.attachments).toEqual([]);
    for (const code of ["01109", "01110"]) expect(hit.run.state.cards[first(hit.run.state, code)]?.controller).toBeNull();
  });
});

describe("Under the Shadow's shadow effect (01104:A:2)", () => {
  it("has the defending player raise his threat by the number of enemies engaged with him, defended or not", () => {
    const engaged = [{ code: "grunt", seat: 0 }, { code: "f0", seat: 0 }, { code: "f0", seat: 0 }];
    expect(fight(world, "01104", "grunt", { engaged }).run.state.seats[0].threat).toBe(31);
    expect(fight(world, "01104", "grunt", { engaged }, { undefended: true }).run.state.seats[0].threat).toBe(31);
    const alone = fight(world, "01104", "grunt", {}, { undefended: true });
    expect(alone.run.state.seats[0].threat).toBe(29);
    expect(causeProblems(alone.run.steps)).toEqual([]);
  });
});
