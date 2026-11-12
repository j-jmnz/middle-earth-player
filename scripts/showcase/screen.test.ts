import { describe, expect, it } from "vitest";

import { screenWords } from "./screen.ts";

describe("the capture's screen summary", () => {
  it("lists the ids and words of a Maestro hierarchy in screen order, each once", () => {
    const tree = {
      attributes: {},
      children: [
        { attributes: { "resource-id": "campaign-list", text: "" }, children: [{ attributes: { accessibilityText: "Campaigns" } }, { attributes: { text: "Campaigns" } }] },
        { attributes: { "resource-id": "settings-open", accessibilityText: "Settings" } },
        { attributes: { "resource-id": "sheet-option-i35", bounds: "[10,20][110,60]" } },
      ],
    };
    expect(screenWords(tree)).toEqual(["#campaign-list", '"Campaigns"', "#settings-open", '"Settings"', "#sheet-option-i35[10,20][110,60]"]);
  });
});
