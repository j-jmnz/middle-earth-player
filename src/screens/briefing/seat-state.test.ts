import { describe, expect, it } from "vitest";

import { seatFolded, seatState, type SeatStateInput } from "./seat-state";

const deck = { id: "d1", heroes: ["h1", "h2", "h3"] };
const base: SeatStateInput = { seeded: "ready", deck, fallen: [], nameOf: (code) => `Hero ${code}`, readiness: new Map([["d1", { ready: true, text: "" }]]), short: null, missingRingBearer: false };

describe("a briefing seat's folded state", () => {
  it("says Ready, or the short line, for a deck that can be dealt", () => {
    expect(seatState(base)).toEqual({ text: "Ready", attention: false });
    expect(seatState({ ...base, short: "47 of 50 cards" })).toEqual({ text: "47 of 50 cards", attention: false });
  });

  it("needs attention with no deck, a deck that is not ready, a fallen hero or no Ring-bearer", () => {
    expect(seatState({ ...base, deck: null })).toEqual({ text: "No deck yet", attention: true });
    expect(seatState({ ...base, readiness: new Map([["d1", { ready: false, text: "Needs a hero" }]]) })).toEqual({ text: "Needs a hero", attention: true });
    expect(seatState({ ...base, readiness: new Map() })).toEqual({ text: "Not ready", attention: true });
    expect(seatState({ ...base, fallen: ["h2"] })).toEqual({ text: "Hero h2 fell and cannot be played", attention: true });
    expect(seatState({ ...base, fallen: ["h1", "h3"] }).text).toBe("Hero h1, Hero h3 fell and cannot be played");
    expect(seatState({ ...base, missingRingBearer: true })).toEqual({ text: "Needs a Ring-bearer", attention: true });
  });

  it("asks nothing while the starter decks load", () => {
    expect(seatState({ ...base, seeded: "pending", deck: null })).toEqual({ text: "Loading", attention: false });
  });

  it("opens a seat that needs attention whatever its stored fold", () => {
    expect(seatFolded(true, seatState(base))).toBe(true);
    expect(seatFolded(true, seatState({ ...base, deck: null }))).toBe(false);
    expect(seatFolded(false, seatState(base))).toBe(false);
  });
});
