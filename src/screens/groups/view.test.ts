import { describe, expect, it } from "vitest";

import type { Sections } from "../kit/fold-state";
import { CARDS_VIEWS, viewOf as read, withView } from "./view";

const viewOf = (sections: Sections, offered?: Parameters<typeof read>[1]) => read((id) => sections[id] ?? false, offered);

describe("the Cards tab's view", () => {
  it("opens on Player and keeps the view picked in the fold map", () => {
    expect(viewOf({})).toBe("Player");
    expect(viewOf(withView({}, "Scenario"))).toBe("Scenario");
    expect(withView(withView({}, "Scenario"), "Player")).toEqual({});
    expect(withView({ "box-core": true }, "Scenario")).toEqual({ "box-core": true, "cards-view-scenario": true });
  });

  it("keeps Campaign, and falls back to Player for a view the switch does not offer", () => {
    expect(CARDS_VIEWS).toEqual(["Player", "Scenario", "Campaign"]);
    expect(viewOf(withView({}, "Campaign"))).toBe("Campaign");
    expect(withView(withView({}, "Campaign"), "Scenario")).toEqual({ "cards-view-scenario": true });
    expect(viewOf(withView({}, "Campaign"), ["Player", "Scenario"])).toBe("Player");
  });
});
