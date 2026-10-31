// Rules: dcce.stormcallers-area-stages, dcce.sailing-tests, rr.travel, rr.cancel (data/rules/entries.json); ledger lines 12026:A:1, 12022:A:3, 12028:A:1. What the sheets say of the Stormcaller's cards: Hidden Cove's
// travel row (the numbers it leaves on the Stormcaller's stage, and the caution that arms the confirm), the Corsair Skiff's two branches and Man Overboard!'s note.
import { beforeAll, describe, expect, it } from "vitest";

import { AUTHORED_EFFECTS } from "../effects/authored/flight-of-the-stormcaller.ts";
import { legalIntents } from "../rules/legal.ts";
import { updateCard } from "../rules/state.ts";
import { CODES, flightTable, idOf, loadFlightWorld, type FlightLayout, type FlightWorld } from "../../scripts/stormcaller-scene.ts";

import { branchWords } from "./choice-words.ts";
import type { PickSheet, SheetNames } from "./sheet-types.ts";
import { sheetFor } from "./sheets.ts";
import { committedNote, stormcallerTravel } from "./stormcaller-sheets.ts";

let world: FlightWorld;

beforeAll(async () => {
  world = await loadFlightWorld();
});

const travelSheet = (layout: FlightLayout): { sheet: PickSheet; made: ReturnType<typeof flightTable> } => {
  const made = flightTable(world, { staging: [CODES.cove], phase: "Travel", ...layout });
  const names: SheetNames = { card: (id) => world.cards.get(made.state.cards[id]?.code ?? "")?.name ?? id, line: (id) => (id === "12026:A:1" ? "Travel: move 2 progress" : null) };
  const sheet = sheetFor(made.state, made.ctx, legalIntents(made.state, made.ctx), names);
  if (sheet?.kind !== "pick") throw new Error("no travel sheet");
  return { sheet, made };
};

describe("Hidden Cove's travel row (12026:A:1)", () => {
  it("states what the move leaves on the Stormcaller's stage", () => {
    const { sheet } = travelSheet({ stage: "12013", progress: 2, callerProgress: 4 });
    expect(sheet.options[0]?.label).toContain("Stormcaller 4 → 6 of 12");
    expect(sheet.options[0] && "caution" in sheet.options[0] ? sheet.options[0].caution : undefined).toBeUndefined();
  });

  it("says it advances the Stormcaller and arms the confirm", () => {
    const { sheet } = travelSheet({ stage: "12013", progress: 2, callerProgress: 10 });
    expect(sheet.options[0]?.label).toContain("Stormcaller 10 → 12 of 12: it advances");
    expect(sheet.options[0] && "caution" in sheet.options[0] ? sheet.options[0].caution : undefined).toBe("Tap again: the Stormcaller advances to stage 3 of 4");
  });

  it("says the players lose when it fills the last stage, and arms the confirm", () => {
    const { made } = travelSheet({ stage: "12014", progress: 2, caller: 4, callerProgress: 22 });
    const row = stormcallerTravel(made.state, made.ctx, idOf(made.state, CODES.cove));
    expect(row).toEqual({ words: "Stormcaller 22 → 24 of 24: the players lose", caution: "Tap again: the Stormcaller fills its last stage and the game is lost" });
  });

  it("is none for a location whose Travel moves no progress", () => {
    const made = flightTable(world, { staging: [CODES.coastland], phase: "Travel" });
    expect(stormcallerTravel(made.state, made.ctx, idOf(made.state, CODES.coastland))).toBeNull();
  });
});

describe("Corsair Skiff's branches (12022:A:3)", () => {
  it("say where the threat goes and what Boarding reveals", () => {
    const made = flightTable(world, { threat: [28, 28] });
    const choose = AUTHORED_EFFECTS.find((effect) => effect.id === "12022:forced:1")?.instructions.find((instruction) => instruction.verb === "Choose");
    if (choose?.verb !== "Choose") throw new Error("no Choose");
    const names = { card: () => "Corsair Skiff", code: (code: string) => code };
    expect(branchWords(choose, "threat", made.state, names, "x")).toBe("Raise your threat by 3 (to 31)");
    expect(branchWords(choose, "boarding", made.state, names, "x")).toBe("Corsair Skiff gains Boarding 1: reveal 1 Corsair card now");
  });
});

describe("Man Overboard!'s note (12028:A:1)", () => {
  const effect = AUTHORED_EFFECTS.find((item) => item.id === "12028:whenRevealed:1");

  it("shows the Willpower committed against the 8 it asks, and that Storm cannot cancel it", () => {
    const made = flightTable(world, { heading: "Storm" });
    const committed = [made.hero, made.hero2].reduce((state, id) => updateCard(state, id, { committed: true }), made.state);
    expect(committedNote(committed, made.ctx, effect, 0)).toBe("You commit 4 Willpower (8 or more discards a questing character). It cannot be canceled at Storm: the heading is at Storm.");
  });

  it("says the heading is not at Storm when it is not, and is none for any other effect", () => {
    const made = flightTable(world, { heading: "Sun" });
    expect(committedNote(made.state, made.ctx, effect, 0)).toBe("You commit 0 Willpower (8 or more discards a questing character). It cannot be canceled at Storm, and the heading is not.");
    expect(committedNote(made.state, made.ctx, AUTHORED_EFFECTS.find((item) => item.id === "12022:forced:1"), 0)).toBeNull();
  });
});
