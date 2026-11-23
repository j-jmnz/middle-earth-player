// Rules: hob.sack-x, hob.sack-x-example (data/rules/entries.json); ledger lines 131044:A:1 to 131050:A:1. A row of a Sack card's tie shows the number the characters tie on.
import { expect, it } from "vitest";

import { updateCard } from "../../rules/core/state.ts";
import { idOf, tableFromLayout } from "../../../test/harness/scene-kit.ts";
import { EFFECTS } from "../../effects/index.ts";

import { sackStat } from "./sack-rows.ts";

const ID = "we-must-away-ere-break-of-day";

it("a row shows the stat the Sack card compares: a printed value, the attachments or the resources", () => {
  const made = tableFromLayout(ID, { heroResources: 3 }, { effects: EFFECTS });
  const hero = idOf(made.state, "dh1");
  const withResources = updateCard(made.state, hero, { resources: 3 });
  expect(sackStat({ verb: "AttachSacked", to: "hero", by: "resources" }, hero, withResources, made.ctx)).toEqual([{ icon: "resource", value: 3, word: "Resources" }]);
  expect(sackStat({ verb: "AttachSacked", to: "hero", by: "attachments" }, hero, withResources, made.ctx)).toEqual([{ icon: "attachment", value: 0, word: "Attachments" }]);
  const attack = sackStat({ verb: "AttachSacked", to: "character", by: "attack" }, hero, withResources, made.ctx);
  expect(attack).toHaveLength(1);
  expect(attack[0]).toMatchObject({ icon: "attack", word: "Printed Attack" });
});

it("no stat for another instruction", () => {
  const made = tableFromLayout(ID, {}, { effects: EFFECTS });
  expect(sackStat({ verb: "DrawCards" } as never, idOf(made.state, "dh1"), made.state, made.ctx)).toEqual([]);
});
