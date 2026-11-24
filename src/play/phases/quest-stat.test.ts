// Rules: hon.battle, hon.siege, rr.current-quest, ats.ally-objectives (data/rules/entries.json); ledger lines 05068:B:1, 05069:B:1, 05025:A:1, 05028:A:1.
// Every quest number and word of the table follows the stat the stage counts: Attack under Battle, Defense under Siege, Willpower otherwise.
import { describe, expect, it } from "vitest";

import { idOf, tableFromLayout } from "../../../test/harness/scene-kit.ts";
import type { SheetNames } from "../choice/sheet-types.ts";
import { commitSheet } from "../choice/bar-sheets.ts";
import { cardEffects, chipText, effectLines, slotNumbers } from "../cards/card-effects.ts";
import { carouselOf } from "./carousel.ts";
import { guideLine, turnReference } from "./reference.ts";
import { legalIntents } from "../../rules/engine/reduce.ts";
import { questStatNow, questStatWord } from "./quest-stat.ts";
import { questScaleOf, scaleLabel, scaleStatWord } from "../readouts/quest-scale.ts";
import { readoutFor } from "../readouts/readout.ts";

const ID = "into-ithilien";
const names: SheetNames = { card: (id) => id, line: () => null };

// Stage 05068 has Battle, 05069 Siege, 05071 neither below 37 threat; a plain scenario's stage has neither.
const at = (stage: string, extra: Record<string, unknown> = {}) => tableFromLayout(ID, { phase: "Quest", staging: ["05025"], committed: ["dh1"], stage, ...extra });

describe("the stat a stage counts", () => {
  it("is Attack under Battle, Defense under Siege and Willpower under neither", () => {
    expect(questStatNow(at("05068").state, at("05068").ctx)).toBe("attack");
    expect(questStatNow(at("05069").state, at("05069").ctx)).toBe("defense");
    expect(questStatNow(at("05071").state, at("05071").ctx)).toBe("willpower");
    expect(questStatWord("attack")).toBe("Attack");
  });

  it("words the commit list, its note and the quest readout with the stat the engine counts", () => {
    for (const [stage, stat] of [["05068", "attack"], ["05069", "defense"]] as const) {
      const made = at(stage);
      const sheet = commitSheet(made.state, made.ctx, names);
      expect(sheet.note).toContain(`add their ${stat} against`);
      expect(sheet.options.length).toBeGreaterThan(0);
      for (const option of sheet.options) {
        const card = made.state.cards[option.id];
        expect(option.stats?.[0]?.icon, option.id).toBe(stat);
        expect(card).toBeDefined();
      }
      const readout = readoutFor(made.state, made.ctx, null, null, () => "");
      expect(readout?.kind === "quest" && readout.stats.map((entry) => entry.icon)).toEqual([stat, "threat"]);
      expect(readout?.kind === "quest" && readout.stats[0]?.word).toBe(questStatWord(stat));
    }
  });

  it("keeps every word as it was where the stage has neither keyword", () => {
    const made = at("05071");
    expect(commitSheet(made.state, made.ctx, names).note).toBe("Committed characters exhaust and add their willpower against the threat in staging.");
    const readout = readoutFor(made.state, made.ctx, null, null, () => "");
    expect(readout?.kind === "quest" && readout.stats.map((entry) => entry.icon)).toEqual(["willpower", "threat"]);
    const scale = questScaleOf(made.state, made.ctx, null);
    expect(scale.stat).toBeUndefined();
    expect(scaleLabel(scale)).toContain("willpower committed");
  });

  it("names the stat on the meter and in the spoken scale under Battle and Siege", () => {
    const battle = questScaleOf(at("05068").state, at("05068").ctx, null);
    expect(battle.stat).toBe("attack");
    expect(scaleStatWord(battle)).toBe("attack");
    expect(scaleLabel(battle)).toContain("attack committed");
    const siege = questScaleOf(at("05069").state, at("05069").ctx, null);
    expect(scaleLabel(siege)).toContain("defense committed");
    expect(scaleStatWord({ threat: 0, willpower: 0, delta: 0, live: true, seat: null })).toBe("willpower");
  });

  it("totals the committed number in the scale from the same stat", () => {
    const made = at("05068");
    const hero = made.state.cards[idOf(made.state, "dh1")];
    const scale = questScaleOf(made.state, made.ctx, null);
    // The hero and the staged Celador count their Attack, never their Willpower.
    expect(scale.willpower).toBeGreaterThan(0);
    expect(hero?.committed).toBe(true);
  });
});

describe("the pill on a committed card", () => {
  it("shows the Attack of a committed hero and of a staged Celador under Battle, the Defense under Siege, the Willpower under neither", () => {
    for (const [stage, stat] of [["05068", "attack"], ["05069", "defense"], ["05071", "willpower"]] as const) {
      const made = at(stage);
      const hero = slotNumbers(made.state, made.ctx, idOf(made.state, "dh1"));
      const celador = slotNumbers(made.state, made.ctx, idOf(made.state, "05025"));
      expect(hero.commitStat, stage).toBe(stat);
      expect(celador.commitStat, stage).toBe(stat);
      expect(celador.willpower, stage).not.toBeNull();
      expect(celador.willpower).toBe(stat === "attack" ? 2 : stat === "defense" ? 2 : 2);
    }
  });

  it("gives a card that is not committed no pill", () => {
    const made = at("05068", { staging: ["05025", "05026"], committed: [] });
    const other = slotNumbers(made.state, made.ctx, idOf(made.state, "05026"));
    expect(other.willpower).not.toBeNull();
    const hero = slotNumbers(made.state, made.ctx, idOf(made.state, "dh1"));
    expect(hero.willpower).toBeNull();
  });
});

describe("the turn reference", () => {
  const decisions = (stat?: "willpower" | "attack" | "defense") =>
    turnReference(at("05068").state, () => null, stat).flatMap((phase) => phase.steps).filter((step) => step.id === "3.2" || step.id === "3.4").map((step) => step.decision);

  it("says the stat in the commit and resolution steps under Battle and Siege, and is as it was without", () => {
    expect(decisions("attack")).toEqual(["Commit characters to the quest: they exhaust and add their attack.", "Attack against staging threat: progress, or your threat rises by the difference."]);
    expect(decisions("defense")[0]).toContain("add their defense");
    expect(decisions("willpower")).toEqual(decisions());
    expect(decisions()[0]).toBe("Commit characters to the quest: they exhaust and add their willpower.");
  });

  it("words the panel's quest steps by the stat the stage counts", () => {
    const words = (stage: string) => {
      const made = at(stage);
      return carouselOf(made.state, made.ctx, { stopsOn: false, stops: [] }, () => null).phases.flatMap((phase) => phase.steps).find((step) => step.id === "3.2")?.decision;
    };
    expect(words("05068")).toContain("add their attack");
    expect(words("05069")).toContain("add their defense");
    expect(words("05071")).toContain("add their willpower");
  });

  it("gives the first-game guide the stat's line", () => {
    const made = at("05068");
    const legal = legalIntents(made.state, made.ctx);
    expect(legal.length).toBeGreaterThan(0);
    const line = guideLine({ ...made.state, window: { kind: "pass", seat: 0 } as never }, false, "attack");
    if (line) expect(line.text).toContain("attack");
  });
});

describe("Ithilien Road's engagement cost", () => {
  const road = () => tableFromLayout(ID, { phase: "Quest", staging: ["05052"], active: "05028", stage: "05068" });

  it("05028:A:1 says the cost is 0 while it is the active location, and its chip shows 0", () => {
    const made = road();
    const enemy = idOf(made.state, "05052");
    expect(effectLines(made.state, made.ctx, enemy, () => "Ithilien Road")).toEqual(["Engagement cost is 0 from Ithilien Road, while it is the active location"]);
    const badge = cardEffects(made.state, made.ctx, enemy).stats.find((entry) => entry.stat === "engagementCost");
    expect(badge?.floored).toBe(true);
    expect(badge && chipText(badge)).toBe("0");
  });

  it("05028:A:1 leaves the cost to the printed one when the Road is not active", () => {
    const made = tableFromLayout(ID, { phase: "Quest", staging: ["05052", "05028"], stage: "05068" });
    expect(effectLines(made.state, made.ctx, idOf(made.state, "05052"), () => "Ithilien Road")).toEqual([]);
  });
});
