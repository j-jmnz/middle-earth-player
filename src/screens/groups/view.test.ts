import { describe, expect, it } from "vitest";

import type { Sections } from "../kit/fold-state";
import { CARDS_VIEWS, viewOf as read, withView } from "./view";

const viewOf = (sections: Sections) => read((id) => sections[id] ?? false);

describe("the Cards tab's view", () => {
  it("opens on Player cards and keeps the view picked in the fold map", () => {
    expect(CARDS_VIEWS).toEqual(["Player cards", "Encounter cards"]);
    expect(viewOf({})).toBe("Player cards");
    expect(viewOf(withView({}, "Encounter cards"))).toBe("Encounter cards");
    expect(withView(withView({}, "Encounter cards"), "Player cards")).toEqual({});
    expect(withView({ "box-core": true }, "Encounter cards")).toEqual({ "box-core": true, "cards-view-encounter": true });
  });

  it("reads the earlier Scenario and Campaign views as Encounter cards, and a pick clears them", () => {
    expect(viewOf({ "cards-view-scenario": true })).toBe("Encounter cards");
    expect(viewOf({ "cards-view-campaign": true })).toBe("Encounter cards");
    expect(withView({ "cards-view-campaign": true }, "Player cards")).toEqual({});
    expect(withView({ "cards-view-scenario": true }, "Encounter cards")).toEqual({ "cards-view-encounter": true });
  });
});
