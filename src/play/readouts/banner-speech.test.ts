// Rules: rr.step-6-4-3, rr.damage (data/rules/entries.json). What a phone screen reader hears of the banner when the combat spotlight never
// plays: the title, then each line of the attack on its own, in the order the engine resolved them.
import { describe, expect, it } from "vitest";

import type { EngineStep } from "../../rules/core/intents.ts";
import type { ScenarioState } from "../../rules/engine/reduce.ts";
import { buildTable, idsOf, SAM, sceneCards } from "../../../test/harness/scene.ts";

import { momentOf, type Moment } from "../store/outcome.ts";
import { bannerLabel, bannerSpeech } from "./banner-speech.ts";

const rule = (id: string) => ({ rule: id });

describe("the banner for a screen reader", () => {
  it("says the title, then the attack, its damage and a destroyed card, one announcement each, in the engine's order", async () => {
    const base = await sceneCards();
    const table = buildTable(base, { engaged: [{ code: "f3", seat: 0 }] });
    const sam = idsOf(table, SAM);
    const enemy = idsOf(table, "f3");
    const before: ScenarioState = { ...table.state, pendingAttack: { enemyId: enemy, seat: 0, defenderId: sam, undefended: false, shadowResolved: false } as never };
    const steps: EngineStep[] = [
      { kind: "destroy", targetId: sam },
      { kind: "strike", side: "enemy", enemyId: enemy, targetId: "hero", attack: 3, defense: 0, undefended: true, cause: rule("rr.step-6-4-3") },
      { kind: "damage", targetId: "hero", amount: 3, cause: rule("rr.step-6-4-3") },
    ];
    const moment = momentOf(before, table.state, steps, { card: (id) => id });
    if (!moment) throw new Error("a moment");
    const said = bannerSpeech(moment);
    expect(said[0]).toBe(moment.title);
    expect(said.slice(1)).toEqual(moment.lines.map((line) => line.text));
    // The attack is said before its damage, and the destroyed card after both.
    const at = (part: string) => said.findIndex((line) => line.includes(part));
    expect(at("Attack 3 on hero")).toBeGreaterThan(0);
    expect(at("3 damage on hero")).toBeGreaterThan(at("Attack 3 on hero"));
    expect(at("is destroyed")).toBeGreaterThan(at("3 damage on hero"));
  });

  it("says every line once, so the title and lines together are the label", () => {
    const moment: Moment = { title: "Wolf attacks", tone: "bad", lines: [{ text: "Attack 4 on Aragorn", mark: "attack" as never }, { text: "2 damage on Aragorn", mark: "damage" as never }] };
    expect(bannerSpeech(moment)).toEqual(["Wolf attacks", "Attack 4 on Aragorn", "2 damage on Aragorn"]);
    expect(bannerLabel(moment)).toBe(bannerSpeech(moment).join(". "));
  });
});
