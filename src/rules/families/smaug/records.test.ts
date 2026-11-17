// Rules: docs/brief.md (The Battle of Lake-town), rr.cancel, rr.damage, faq.additional-attacks, rr.keywords; ledger lines 50209:A:2, 50224:A:3, 50206:A:3, 50216:A:2, 50202:B:2, Burn X.
// What the records of the scenario need from the engine beyond the family's verbs: a Shadow effect that any player cancels by discarding a hero, Esgaroth Wharf's additional attack in Smaug's attack against Lake-town, the card refs `smaug` and `lakeTown`,
// RemoveDamageFrom with an amount that is read, and the Burn keyword.
import { describe, expect, it } from "vitest";

import { AUTHORED_EFFECTS } from "../../../effects/authored/the-battle-of-lake-town.ts";
import { parseKeywordTokens } from "../../../catalog/keyword-line.ts";
import { legalIntents, type PlayerIntent } from "../../engine/reduce.ts";
import { enemy, send, treachery, type Table } from "../defense/table.ts";
import { updateCard, type ScenarioState } from "../../core/state.ts";
import { LAKE, MAGNIFICENT, MIGHTY, damageOn, lakeTable, run } from "./fixture.ts";

const records = (...codes: string[]) => AUTHORED_EFFECTS.filter((effect) => codes.includes(effect.cardCode));

// Plays the combat phase from the optional engagement: a choice takes the option `pick` names, a defense window is answered undefended, every other window passes.
function combat(made: Table, state: ScenarioState, pick: (options: readonly string[]) => string): ScenarioState {
  let current = send(state, { type: "DeclineEngage" }, made.ctx);
  for (let step = 0; step < 60; step += 1) {
    const legal = legalIntents(current, made.ctx);
    if (legal.length === 0 || (current.phase !== "Encounter" && current.phase !== "Combat")) return current;
    if (current.window?.kind === "choose") current = send(current, { type: "Choose", optionId: pick(current.window.options) }, made.ctx);
    else if (legal.some((intent) => intent.type === "Undefended")) current = send(current, { type: "Undefended", heroId: [made.ids.h1, made.ids.h2].find((id) => current.cards[id ?? ""]?.zone === "heroes") ?? "" }, made.ctx);
    else {
      const pass = legal.find((intent) => intent.type === "Pass" || intent.type === "DeclineAttack");
      if (!pass) return current;
      current = send(current, pass as PlayerIntent, made.ctx);
    }
  }
  return current;
}

describe("50209:A:2 Any player may discard a hero to cancel this Shadow effect", () => {
  const fight = (answer: string) => {
    const made = lakeTable({ heroes: [{ code: "h1" }, { code: "h2" }], enemies: [{ code: "foe" }], cards: [enemy("foe", { attack: 1, defense: 1, health: 9 }), treachery("50209")], encounter: ["50209"], effects: records("50209") });
    return { made, state: combat(made, made.state, (options) => (options.includes(answer) ? answer : (options[0] ?? ""))) };
  };

  it("deals 1 damage to each character in play when nobody cancels it", () => {
    const { made, state } = fight("keep");
    // The foe's 1 undefended damage and 1 more on each of the two heroes.
    expect((state.cards[made.ids.h1 ?? ""]?.damage ?? 0) + (state.cards[made.ids.h2 ?? ""]?.damage ?? 0)).toBe(3);
    expect(state.cards[made.ids.h1 ?? ""]?.zone).toBe("heroes");
  });

  it("is canceled when a player discards a hero: the hero is gone and no damage is dealt", () => {
    const { made, state } = fight("discard");
    const gone = [made.ids.h1, made.ids.h2].filter((id) => state.cards[id ?? ""]?.zone === "discard");
    expect(gone).toHaveLength(1);
    const left = [made.ids.h1, made.ids.h2].find((id) => state.cards[id ?? ""]?.zone === "heroes");
    // The foe's 1 attack is undefended, so the hero that remains has taken exactly that and not the shadow's damage as well.
    expect(state.cards[left ?? ""]?.damage).toBeLessThanOrEqual(1);
  });
});

describe("Esgaroth Wharf's additional attack in Smaug's attack against Lake-town (50224:A:3, 50211:A:1)", () => {
  it("is another attack against Lake-town, dealt a shadow card of its own", () => {
    const made = lakeTable({ staging: [{ code: MIGHTY }], encounter: ["50224", "x"], cards: [treachery("50224")], effects: records("50224") });
    const attacked = run(made, made.state, { verb: "AttackLakeTown" });
    const first = send(attacked, { type: "Undefended" }, made.ctx);
    // The first attack had +2 Attack from the shadow card: 7 on Lake-town; the additional attack is made against Lake-town too.
    expect(damageOn(first, LAKE)).toBe(7);
    expect(first.pendingAttack).toMatchObject({ enemyId: made.ids[MIGHTY], toLakeTown: true });
    const second = send(first, { type: "Undefended" }, made.ctx);
    expect(damageOn(second, LAKE)).toBe(12);
    expect(damageOn(second, "h1")).toBe(0);
  });
});

describe("the card refs smaug and lakeTown (50206:A:3, 50216:A:2)", () => {
  it("MoveDamageTo moves up to 3 damage from Smaug the Magnificent to Lake-town", () => {
    const made = lakeTable({ staging: [{ code: MAGNIFICENT }] });
    const hurt = updateCard(made.state, made.ids[MAGNIFICENT] ?? "", { damage: 5 });
    const next = run(made, hurt, { verb: "MoveDamageTo", from: "self", to: "lakeTown", amount: 3 }, made.ids[MAGNIFICENT]);
    expect(damageOn(next, MAGNIFICENT)).toBe(2);
    expect(damageOn(next, LAKE)).toBe(3);
  });

  it("MoveDamageTo moves all the damage from whichever Smaug is in play, and nothing without one", () => {
    const made = lakeTable({ staging: [{ code: MIGHTY }] });
    const hurt = updateCard(made.state, made.ids[MIGHTY] ?? "", { damage: 6 });
    const next = run(made, hurt, { verb: "MoveDamageTo", from: "smaug", to: "lakeTown" });
    expect(damageOn(next, MIGHTY)).toBe(0);
    expect(damageOn(next, LAKE)).toBe(6);
    const none = lakeTable();
    expect(damageOn(run(none, none.state, { verb: "MoveDamageTo", from: "smaug", to: "lakeTown" }), LAKE)).toBe(0);
  });
});

describe("RemoveDamageFrom with a read amount (50202:B:2)", () => {
  it("removes as much as X, no further than 0", () => {
    const made = lakeTable();
    const lake = Object.values(made.state.cards).find((card) => card.code === LAKE)?.id ?? "";
    const hurt = updateCard(made.state, lake, { damage: 2 });
    const next = run(made, hurt, { verb: "RemoveDamageFrom", code: LAKE, amount: { lakeTownDamage: true } });
    expect(damageOn(next, LAKE)).toBe(0);
  });
});

describe("Burn X", () => {
  it("is a numbered keyword", () => {
    expect(parseKeywordTokens(["Burn 3."]).keywords).toEqual({ burn: 3 });
    expect(parseKeywordTokens(["Burn 1."]).unknown).toEqual([]);
  });
});
