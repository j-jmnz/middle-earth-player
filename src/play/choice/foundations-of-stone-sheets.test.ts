// Rules: ltp.commit-characters, rr.the-word-choose (data/rules/entries.json); ledger lines 04118:B:2.
// The sheets of Foundations of Stone's moments. Out of the Depths (04118:B:2) lets a player commit no more allies than heroes: the commit window offers only sets the reducer accepts.
import { describe, expect, it } from "vitest";

import { legalIntents } from "../../rules/engine/legal.ts";
import { reduce } from "../../rules/engine/reduce.ts";
import { syncConstants } from "../../rules/interpret/constants.ts";
import { tableFromLayout, type Layout } from "../../../test/harness/scene-kit.ts";
import { windowSheet } from "./bar-sheets.ts";
import { tap, type Choice, type TapContext } from "./table-choice.ts";

const table = (layout: Layout) => tableFromLayout("foundations-of-stone", layout);

describe("Out of the Depths' commit window (04118:B:2)", () => {
  const made = table({ stage: "04118", play: ["ally", "ally", "ally"], phase: "Quest" });
  const state = syncConstants({ ...made.state }, made.ctx);
  const legal = legalIntents(state, made.ctx);
  const names = { card: (id: string) => id, line: () => null };
  const sheet = windowSheet(state, made.ctx, legal, names);
  const table4: TapContext = { game: state, ctx: made.ctx, legal, names };
  const [hero1, hero2] = state.seats[0].heroes;
  const [ally1, ally2, ally3] = state.seats[0].play;
  const tapped = (held: Choice, id: string): Choice => {
    const result = tap(sheet, held, id, table4);
    return result.kind === "choice" ? result.choice : held;
  };
  const key = { key: sheet.key, ids: [] as readonly string[], shares: [] };

  it("04118:B:2 a tap on an ally with no hero picked does nothing, and the set picked is always one the reducer accepts", () => {
    expect(tapped(key, ally1 ?? "").ids).toEqual([]);
    let choice: Choice = key;
    for (const id of [hero1, ally1, ally2, ally3, hero2, ally2].map((item) => item ?? "")) {
      choice = tapped(choice, id);
      if (choice.ids.length > 0) expect(reduce(state, { type: "Commit", cardIds: [...choice.ids] }, made.ctx).ok, `${choice.ids}`).toBe(true);
    }
  });

  it("04118:B:2 one hero allows one ally: the second ally is not picked until a second hero is", () => {
    let choice = tapped(key, hero1 ?? "");
    choice = tapped(choice, ally1 ?? "");
    choice = tapped(choice, ally2 ?? "");
    expect(choice.ids).toEqual([hero1, ally1]);
    choice = tapped(choice, hero2 ?? "");
    choice = tapped(choice, ally2 ?? "");
    expect(choice.ids).toEqual([hero1, ally1, hero2, ally2]);
  });

  it("04118:B:2 unpicking a hero drops the allies it leaves over", () => {
    let choice: Choice = { key: sheet.key, ids: [hero1 ?? "", ally1 ?? "", hero2 ?? "", ally2 ?? ""], shares: [] };
    choice = tapped(choice, hero1 ?? "");
    expect(choice.ids).toEqual([ally1, hero2]);
    expect(reduce(state, { type: "Commit", cardIds: [...choice.ids] }, made.ctx).ok).toBe(true);
  });
});
