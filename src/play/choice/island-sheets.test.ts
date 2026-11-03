// Rules: dcce.island-map, dcce.exploration, dcce.uncharted, rr.travel, rr.guarded (data/rules/entries.json). What the table says in Temple of the Deceived beyond the map: the travel rows on the map (how far, what a Temple location
// brings back, who attacks when the players go right), the sentence under the travel choice, the prompts of the choices the scenario opens (the starting location, where progress goes, Spyglass, the Gate Key's look, the
// player a Recurring Nightmare goes to) and that none of them says what lies on a facedown side.
import { beforeAll, describe, expect, it } from "vitest";

import { legalIntents } from "../../rules/engine/legal.ts";
import type { ScenarioState } from "../../rules/core/state.ts";
import { CODES, loadTempleWorld, send, start, templeTable, type TempleLayout, type TempleWorld } from "../../../test/scenarios/temple-of-the-deceived/scene.ts";

import { islandBlocked, islandBlockedTitle, islandOptionLabel, islandPickWords, islandTravelNote, islandTravelRow, islandWords } from "../words/island.ts";
import { sheetFor } from "./sheets.ts";
import type { SheetNames } from "./sheet-types.ts";
import { shownName } from "../cards/shown-name.ts";
import { islandTell } from "../words/uncharted.ts";
import { pictureKey } from "../canvas/picture-key.ts";

let world: TempleWorld;

beforeAll(async () => {
  world = await loadTempleWorld();
});

const MAP = [
  "12072", "12073", "?12074", "?11072", "?12068",
  "?11073", "11074", "?12072", "?12073", "?12069",
  "12074", "?11072", "?11073", "?11074", "?12069",
] as const;
const nameOf = (state: ScenarioState) => (id: string): string => {
  const card = state.cards[id];
  return card ? shownName(pictureKey(card), world.cards.get(card.code)) : id;
};
const names = (state: ScenarioState): SheetNames => ({ card: nameOf(state), line: (id) => id });
const words = (state: ScenarioState) => ({ card: nameOf(state), code: (code: string) => world.cards.get(code)?.name ?? code });
const full = (code: string): number => world.cards.get(code)?.questPoints ?? 0;

function travelSheet(layout: TempleLayout) {
  const made = templeTable(world, { map: MAP, at: 6, phase: "Travel", engaged: [{ code: "mild", seat: 0 }], ...layout });
  const sheet = sheetFor(made.state, made.ctx, legalIntents(made.state, made.ctx), names(made.state));
  return { made, sheet: sheet?.kind === "pick" ? sheet : null };
}

describe("the travel choice on the map", () => {
  it("says the marker moves, the location left stays and loses its progress, and never names a covered location's real side", () => {
    const { made, sheet } = travelSheet({ cellProgress: [[6, full("11074")]] });
    expect(sheet?.title).toBe("Travel to a location");
    expect(sheet?.note).toContain("The marker moves to the location, which stays where it lies. Cursed Temple is explored and its");
    expect(sheet?.note).toContain("progress is removed");
    // A covered destination is flipped over when the marker reaches it.
    expect(sheet?.note).toContain("A covered location is flipped over when the marker reaches it");
    expect(sheet?.options.map((item) => item.label)).toEqual(expect.arrayContaining([expect.stringContaining("Lost Island")]));
    const covered = sheet?.options.find((item) => item.id === made.cells[7]);
    expect(covered?.label).toContain("Lost Island");
    // The row leads with the direction from the marker and carries the glyph's place.
    expect(covered?.label.startsWith("Right of the marker · Lost Island")).toBe(true);
    expect(covered?.place).toEqual({ row: 1, col: 2, from: { row: 1, col: 1 } });
    expect(JSON.stringify(sheet)).not.toMatch(/Jagged|Cliffs/);
  });

  it("says what an active location that is not full still needs, and that it must be filled, not explored", () => {
    const { sheet } = travelSheet({ cellProgress: [[6, 1]] });
    expect(sheet?.title).toBe(`Cursed Temple needs ${full("11074") - 1} more progress`);
    expect(sheet?.note).toBe("The players can travel from the active location once it is full.");
    expect(sheet?.options).toEqual([]);
  });

  it("lists a location the players cannot travel to with the reason and the Travel line once they can travel from the active one (the Gate Key)", () => {
    const { made, sheet } = travelSheet({ at: 8, map: MAP.map((code, at) => (at === 8 ? "12073" : code)), cellProgress: [[8, full("12073")]] });
    const temple = sheet?.unavailable?.find((item) => item.id === made.cells[9]);
    expect(temple?.reason).toMatch(/cannot pay that location's Travel cost/);
    expect(sheet?.options.some((item) => item.id === made.cells[9])).toBe(false);
  });

  it("tells a far location from a near one, and a covered Temple location with Temple Guardian in the victory display from any other, arming the confirm", () => {
    const made = templeTable(world, { map: MAP.map((code, at) => (at === 8 ? "12073" : code)), at: 8, phase: "Travel", key: "hero", victory: [CODES.guardian], cellProgress: [[8, full("12073")]], engaged: [{ code: "mild", seat: 0 }] });
    const far = islandTravelRow(made.state, made.ctx, made.cells[5] ?? "", nameOf(made.state));
    expect(far).toMatchObject({ lead: "3 left", words: "3 locations away", place: { row: 1, col: 0, from: { row: 1, col: 3 } } });
    const temple = islandTravelRow(made.state, made.ctx, made.cells[9] ?? "", nameOf(made.state));
    expect(temple?.words).toContain("Temple Guardian comes back");
    expect(temple?.caution).toBe("Tap again: Temple Guardian comes back into play, engaged with the player with the highest threat");
    const near = templeTable(world, { map: MAP, at: 6, phase: "Travel", engaged: [{ code: "mild", seat: 0 }] });
    const adjacent = islandTravelRow(near.state, near.ctx, near.cells[5] ?? "", nameOf(near.state));
    expect(adjacent).toMatchObject({ lead: "Left of the marker", words: null, caution: null });
  });

  it("names the enemy that attacks when the players travel to the right, only for a location to the right", () => {
    const made = templeTable(world, { map: MAP, at: 6, phase: "Travel", engaged: [{ code: CODES.profane, seat: 0 }], cellProgress: [[6, full("11074")]] });
    const right = islandTravelRow(made.state, made.ctx, made.cells[7] ?? "", nameOf(made.state));
    expect(right).toMatchObject({ lead: "Right of the marker", words: "Profane Dead attacks", caution: "Tap again: Profane Dead makes an immediate attack" });
    expect(islandTravelRow(made.state, made.ctx, made.cells[5] ?? "", nameOf(made.state))?.caution).toBeNull();
    expect(islandTravelRow(made.state, made.ctx, made.cells[1] ?? "", nameOf(made.state))).toMatchObject({ lead: "Above the marker", caution: null });
  });

  it("is silent in a game with no map", () => {
    const made = templeTable(world, { phase: "Travel" });
    expect(islandTravelNote(made.state, () => "x")).toBeNull();
    expect(islandBlocked(made.state)).toBeNull();
    expect(islandBlockedTitle(made.state, 3, "x")).toBeNull();
  });
});

describe("the prompts of the choices the scenario opens", () => {
  const pick = (island: "start" | "temple" | "secret") => ({ verb: "Pick" as const, pick: { type: "location" as const, control: "any" as const, island } });
  const host = (state: ScenarioState) => words(state);

  it("names the card and leads with the decision", () => {
    const made = templeTable(world, { map: MAP, at: 6, engaged: [{ code: "mild", seat: 0 }] });
    const w = host(made.state);
    expect(islandPickWords(pick("start"), { verb: "SetIslandActive" }, w, null)?.prompt).toBe("This card: choose the starting active location. The marker is put on it.");
    const key = made.cells[0] ?? "";
    expect(islandPickWords(pick("temple"), { verb: "LookAtFacedown" }, w, key)?.prompt).toContain("choose a Temple of the Deceived location to look at the facedown side of");
    expect(islandPickWords(pick("secret"), { verb: "LookAtSecret" }, w, key)).toMatchObject({ verb: "Look" });
    expect(islandPickWords({ verb: "PlaceProgressInStaging", left: 5 }, undefined, w, key)?.prompt).toContain("5 progress left to place. Choose a location in the staging area to put it on, or keep it on the quest");
    expect(islandPickWords({ verb: "RaiseThreatToAttach", code: CODES.spyglass, amount: 4, seat: 1 }, undefined, w, null)?.prompt).toBe("This card: Player 2, raise your threat by 4 to attach Spyglass to a hero?");
    expect(islandPickWords({ verb: "RaiseThreatToAttach", code: CODES.spyglass, amount: 4, seat: 1, accepted: true }, undefined, w, null)?.prompt).toBe("This card: choose the hero Spyglass is attached to.");
    expect(islandPickWords({ verb: "EngageFromVictory", name: "Temple Guardian" }, undefined, w, null)?.prompt).toContain("Players are tied for the highest threat");
  });

  it("states the real amounts: the threat Spyglass takes you to, and the progress left", () => {
    const made = templeTable(world, { map: MAP, at: 6, threat: [28, 28], engaged: [{ code: "mild", seat: 0 }] });
    const w = host(made.state);
    expect(islandOptionLabel({ verb: "RaiseThreatToAttach", code: CODES.spyglass, amount: 4, seat: 0 }, "attach", made.state, w)).toBe("Raise threat by 4 to 32 and attach Spyglass to a hero");
    expect(islandOptionLabel({ verb: "RaiseThreatToAttach", code: CODES.spyglass, amount: 4, seat: 0 }, "keep", made.state, w)).toBe("Keep my threat as it is");
    expect(islandOptionLabel({ verb: "PlaceProgressInStaging", left: 3 }, "keep", made.state, w)).toBe("Keep the rest on the quest");
    expect(islandOptionLabel({ verb: "PlaceProgressInStaging", left: 3 }, made.cells[1] ?? "", made.state, w)).toBeNull();
  });

  it("says the family's instructions in words", () => {
    expect(islandWords({ verb: "FlipSecret" })).toBe("flip over the secret at your location");
    expect(islandWords({ verb: "ShuffleIntoPlayerDeck" })).toBe("shuffle it into a player's deck");
    expect(islandWords({ verb: "Exhaust" })).toBeNull();
  });
});

describe("the sheet of the starting location", () => {
  it("shows the two flipped corners by name and nothing of the others", () => {
    const made = templeTable(world, { map: MAP, at: 0, phase: "Travel", engaged: [{ code: "mild", seat: 0 }] });
    const state = send(start(made.state), { type: "DeclineTravel" }, made.ctx).state;
    expect(state.cards[made.cells[0] ?? ""]?.face).toBe("A");
    expect(nameOf(state)(made.cells[1] ?? "")).toBe("Winding Caverns");
    expect(nameOf(state)(made.cells[2] ?? "")).toBe("Lost Island");
    // The Temple column lies Temple of the Deceived side up, whatever each one is.
    expect(nameOf(state)(made.cells[4] ?? "")).toBe("Temple of the Deceived");
  });
});

describe("telling look-alike locations apart", () => {
  it("tells covered locations, which all read Lost Island, by their place on the map and the progress on them", () => {
    const made = templeTable(world, { map: MAP, at: 6, engaged: [{ code: "mild", seat: 0 }], cellProgress: [[7, 3]] });
    const tell = (at: number) => islandTell(made.state, made.state.cards[made.cells[at] ?? ""]!);
    expect(tell(7)).toBe("3 progress · row 2, column 3");
    expect(tell(5)).toBe("row 2, column 1");
    expect(tell(11)).toBe("row 3, column 2");
    // A flipped location is told by its place as well, so a position is known for every location of the map.
    expect(tell(0)).toBe("row 1, column 1");
    expect(tell(4)).toBe("row 1, column 5");
  });
});
