// Rules: rr.step-3-4, rr.step-6-4-3, rr.damage, rr.engaged (data/rules/entries.json). The lean telling of an intent (docs/design-system-table.md, Last move): the
// last move's line leaves out each fact the table shows once the intent is resolved (a card in its row, tokens, a threat dial, an attack the spotlight
// played) and keeps what it does not (a result's two numbers, a card that left the table, why an attack was undefended). The full telling keeps every line.
import { describe, expect, it } from "vitest";

import type { EngineStep } from "../../rules/core/intents.ts";
import type { ScenarioState } from "../../rules/engine/reduce.ts";
import { buildTable, idsOf, SAM, sceneCards } from "../../../test/harness/scene.ts";

import { momentsOf } from "./outcome.ts";

const rule = (id: string) => ({ rule: id });
const names = { card: (id: string) => id };
const texts = (moment: { lines: readonly { text: string }[] } | null) => moment?.lines.map((line) => line.text);

describe("the lean telling", () => {
  it("keeps a quest's two numbers and leaves the threat raise to the dials", async () => {
    const table = buildTable(await sceneCards(), {});
    const steps: EngineStep[] = [
      { kind: "quest", willpower: 0, threat: 8, cause: rule("rr.step-3-4") } as EngineStep,
      { kind: "threat", seat: 0, amount: 8, cause: rule("rr.step-3-4") } as EngineStep,
    ];
    const { full, lean } = momentsOf(table.state, table.state, steps, names);
    expect(texts(full)).toEqual(["Willpower 0 against threat 8", "Threat +8"]);
    expect(lean?.title).toBe("Quest failed");
    expect(lean?.tone).toBe("bad");
    expect(texts(lean)).toEqual(["Willpower 0 against threat 8"]);
  });

  it("says nothing of a card that stands in its row, and names one that left the table", async () => {
    const table = buildTable(await sceneCards(), { engaged: [{ code: "f3", seat: 0 }] });
    const enemy = idsOf(table, "f3");
    // The enemy is in a row of the table after the intent: its reveal and its engagement are on the table.
    const shown: EngineStep[] = [{ kind: "reveal", cardId: enemy } as EngineStep, { kind: "engage", enemyId: enemy, seat: 0 }];
    expect(momentsOf(table.state, table.state, shown, names).full?.lines.length).toBeGreaterThan(0);
    expect(momentsOf(table.state, table.state, shown, names).lean).toBeNull();
    // A treachery is resolved and discarded: no row holds it, so its name is told.
    const gone: EngineStep[] = [{ kind: "reveal", cardId: "treachery" } as EngineStep];
    const { lean } = momentsOf(table.state, table.state, gone, names);
    expect(lean?.title).toBe("Staging");
    expect(texts(lean)).toEqual(["Revealed treachery"]);
  });

  it("keeps a fact about the seat the table does not draw", async () => {
    const table = buildTable(await sceneCards(), { seats: 2, engaged: [{ code: "f3", seat: 1 }] });
    const enemy = idsOf(table, "f3");
    const steps: EngineStep[] = [{ kind: "engage", enemyId: enemy, seat: 1 }];
    // The table draws Player 1: the enemy in Player 2's engagement area is not on screen.
    expect(texts(momentsOf(table.state, table.state, steps, { ...names, seat: 0 }).lean)).toEqual(["Engaged with Player 2"]);
    // Drawn for Player 2, it is.
    expect(momentsOf(table.state, table.state, steps, { ...names, seat: 1 }).lean).toBeNull();
  });

  it("leaves damage and healing to the tokens, and an attack to the spotlight only when it played", async () => {
    const table = buildTable(await sceneCards(), { engaged: [{ code: "f3", seat: 0 }] });
    const sam = idsOf(table, SAM);
    const enemy = idsOf(table, "f3");
    const before: ScenarioState = { ...table.state, pendingAttack: { enemyId: enemy, seat: 0, defenderId: sam, undefended: false, shadowResolved: false } as never };
    const steps: EngineStep[] = [
      { kind: "destroy", targetId: sam },
      { kind: "strike", side: "enemy", enemyId: enemy, targetId: "hero", attack: 3, defense: 0, undefended: true, cause: rule("rr.step-6-4-3") },
      { kind: "damage", targetId: "hero", amount: 3, cause: rule("rr.step-6-4-3") },
      { kind: "damage", targetId: sam, amount: -2, cause: rule("rr.damage") },
    ];
    // No spotlight (the setting off, reduced motion, a reader): the attack's numbers stay, the tokens' do not.
    const plain = momentsOf(before, table.state, steps, names).lean;
    expect(plain?.title).toBe(`${enemy} attacks`);
    expect(texts(plain)).toEqual([`With ${sam} gone, the attack is undefended`, "Attack 3 on hero, undefended", `${sam} is destroyed`]);
    // The spotlight played the attack on that target: only what it did not show is left.
    const spotlit = momentsOf(before, table.state, steps, { ...names, spotlit: (targetId) => targetId === "hero" }).lean;
    expect(texts(spotlit)).toEqual([`With ${sam} gone, the attack is undefended`, `${sam} is destroyed`]);
    // The full telling is the same either way.
    expect(momentsOf(before, table.state, steps, names).full?.lines).toHaveLength(5);
  });
});
