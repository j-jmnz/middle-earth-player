import { describe, expect, it } from "vitest";

import { loadScenario } from "../../scripts/data/load-scenarios.ts";
import { printedScenarioName } from "./printed-name.ts";

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
