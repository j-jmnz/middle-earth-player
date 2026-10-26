import { describe, expect, it } from "vitest";

import { modifierStatSchema, triggerSchema } from "../effect-schema.ts";

// Each mechanic family adds triggers and flags to shared enums (src/catalog/families/index.ts). A name two families both add
// would be one word with two meanings; verbs and condition kinds already fail to load when duplicated.
describe("mechanic family vocabulary", () => {
  const twice = (names: readonly string[]) => names.filter((name, at) => names.indexOf(name) !== at);

  it("adds no trigger or stat flag twice", () => {
    expect(twice(triggerSchema.options)).toEqual([]);
    expect(twice(modifierStatSchema.options)).toEqual([]);
  });
});
