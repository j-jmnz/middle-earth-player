import { describe, expect, it } from "vitest";

import { tableTokens } from "../play/tokens.ts";
import { palette } from "./palette.js";

// docs/design-system.md: the canvas copies felt, feltLight and the marks it draws from the palette. They must not drift.
describe("table tokens", () => {
  it("match the Night palette", () => {
    for (const [name, value] of Object.entries(tableTokens)) {
      expect(palette[name as keyof typeof palette], name).toBe(value);
    }
  });
});
