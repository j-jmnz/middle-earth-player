import { describe, expect, it } from "vitest";

import { loadScenario } from "../../scripts/data/load-scenarios.ts";
import { printedScenarioName, printedSetName } from "./printed-name.ts";

describe("printedScenarioName", () => {
  it("drops Hall of Beorn's \" (Campaign)\" suffix and leaves a printed title alone", () => {
    expect(printedScenarioName("The Oath (Campaign)")).toBe("The Oath");
    expect(printedScenarioName("The Caves of Nibin-Dûm (Campaign)")).toBe("The Caves of Nibin-Dûm");
    expect(printedScenarioName("A Shadow of the Past")).toBe("A Shadow of the Past");
  });

  it("is what a player reads for every scenario file", () => {
    for (const id of ["the-oath", "the-caves-of-nibin-dum", "escape-from-dol-guldur", "a-shadow-of-the-past"]) expect(printedScenarioName(loadScenario(id).name)).not.toContain("(Campaign)");
  });
});

describe("printedSetName", () => {
  const listed = new Set(["The Woodland Realm", "The Woodland Realm 3", "Escape from Khazad-dûm 15"]);

  it("folds a numbered packet into the listed set it belongs to", () => {
    expect(printedSetName("The Woodland Realm 3", listed)).toBe("The Woodland Realm");
    expect(printedSetName("The Woodland Realm", listed)).toBe("The Woodland Realm");
  });

  it("leaves a name alone when no listed set is its name without the number", () => {
    expect(printedSetName("Escape from Khazad-dûm 15", listed)).toBe("Escape from Khazad-dûm 15");
    expect(printedSetName("Journey Down the Anduin", listed)).toBe("Journey Down the Anduin");
  });
});
