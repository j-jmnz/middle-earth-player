import { describe, expect, it } from "vitest";

import { verbsWithRole } from "./setup-verbs.ts";

// The verbs the start deals, and those it resolves after the quest card's Setup, as src/campaign/start.ts listed them by name before each schema entry carried its role.
describe("setup roles", () => {
  it("mark exactly the verbs the start has always dealt", () => {
    expect([...verbsWithRole("dealt")].sort()).toEqual(["AddToStaging", "AttachToRingBearer", "PutObjectiveAllyIntoPlay", "SetAside", "SetAsideEachPlayer"]);
  });

  it("mark exactly the verbs the start has always resolved after the quest card's Setup", () => {
    expect([...verbsWithRole("afterSetup")].sort()).toEqual(["AttachSetAsideTo", "FitShips", "FlipSetAside", "FlipStormcaller", "PlaceSecrets", "PutSetAsideInPlay", "RaiseThreatToAttach", "TradeDamageForThreat", "TradeShipDamage"]);
  });
});
