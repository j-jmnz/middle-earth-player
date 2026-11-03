import { describe, expect, it } from "vitest";

import type { Effect } from "../catalog/boundary.ts";
import { pushCardEffects } from "../rules/interpret/effect-frames.ts";
import { cardMap, expectOk, hero, idleScenario } from "../rules/core/test-fixture.ts";
import { settle } from "../rules/engine/machine.ts";
import { definePrinted } from "../rules/core/printed.ts";
import { legalIntents, reduce } from "../rules/engine/reduce.ts";
import { updateCard, type ScenarioState } from "../rules/core/state.ts";
import { spawn } from "../rules/core/zones.ts";

import type { SheetNames } from "./sheet-types.ts";
import { sheetFor } from "./sheets.ts";

// Rules: rr.in-play-and-out-of-play, rr.first-player (data/rules/entries.json). "Shuffle 1 out of play Ringwraith into the
// encounter deck" (141026:B:2): with copies out of play in different zones, the first player picks one, and the sheet tells
// the copies apart by where each is and says what the choice is for.
const wraith = definePrinted({ code: "wraith", name: "Ringwraith", type: "enemy", traits: ["Nazgûl"], engagementCost: 35, threat: 3, attack: 5, defense: 4, health: 5 });
const hills = definePrinted({ code: "hills", name: "Weather Hills", type: "location", threat: 3, questPoints: 2 });
const stage = definePrinted({ code: "stage", name: "Into the Wild", type: "quest", questPoints: 6 });
const cards = cardMap([wraith, hills, stage, hero("aragorn", "leadership"), hero("sam", "lore")]);
const shuffle: Effect = { id: "stage:forced:1", cardCode: "stage", lines: ["141026:B:2"], timing: "forced", instructions: [{ verb: "ShuffleOutOfPlayIntoEncounterDeck", code: "wraith" }] };
const ctx = { effects: [shuffle], cards };

function table(): { state: ScenarioState; stageId: string; ids: Record<string, string> } {
  let state: ScenarioState = idleScenario(2);
  const placed = spawn(state, "stage", { zone: "questStage" });
  state = updateCard(placed.state, placed.id, { face: "B" });
  for (const seat of [0, 1]) state = spawn(state, "aragorn", { zone: "heroes", seat }).state;
  const aside = spawn(state, "wraith", { zone: "setAside" }, "down");
  const discarded = spawn(aside.state, "wraith", { zone: "encounterDiscard" });
  const location = spawn(discarded.state, "hills", { zone: "staging" });
  const under = spawn(location.state, "wraith", { zone: "under", locationId: location.id }, "down");
  return { state: { ...under.state, firstPlayer: 1 }, stageId: placed.id, ids: { aside: aside.id, discarded: discarded.id, under: under.id } };
}

describe("which out-of-play Ringwraith", () => {
  it("labels each copy with its zone, names the purpose, and each option is accepted", () => {
    const { state: base, stageId, ids } = table();
    const asked = { ...settle(pushCardEffects(base, "forced", stageId, 0, false, [shuffle], ctx, []), ctx, []), activeSeat: 1 };
    expect(asked.window?.kind).toBe("choose");
    const names: SheetNames = { card: (id) => cards.get(asked.cards[id]?.code ?? "")?.name ?? id, line: () => null };
    const sheet = sheetFor(asked, ctx, legalIntents(asked, ctx), names);
    expect(sheet?.kind).toBe("pick");
    if (sheet?.kind !== "pick") return;
    expect(sheet.options.map((option) => [option.id, option.label])).toEqual([
      [ids.aside, "Ringwraith set aside"],
      [ids.discarded, "Ringwraith from the encounter discard pile"],
      [ids.under, "Ringwraith under Weather Hills"],
    ]);
    expect(sheet.verb).toBe("Shuffle in");
    // The primary is the action alone, so a long zone name does not wrap the pill.
    expect(sheet.confirm).toBe("Shuffle in");
    expect(sheet.note).toBe("Choose which out-of-play Ringwraith is shuffled into the encounter deck. Any other copy stays where it is. Player 2 chooses.");
    for (const option of sheet.options) {
      if (!("intent" in option)) throw new Error("an option opens another sheet");
      const done = expectOk(reduce(asked, option.intent, ctx)).state;
      expect(done.cards[option.id]?.zone).toBe("encounterDeck");
    }
  });
});
