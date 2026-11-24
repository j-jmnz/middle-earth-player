import { describe, expect, it } from "vitest";

import { cardMap, expectOk, fixtureDefinition, hero } from "../core/test-fixture.ts";
import { definePrinted } from "../core/printed.ts";
import { addToStaging, reduce } from "../engine/reduce.ts";
import { blankScenario, type ScenarioState } from "../core/state.ts";
import { spawn } from "../core/zones.ts";

function encounter(code: string, surge = false) {
  return definePrinted({ code, name: code, type: "enemy", threat: 0, engagementCost: 50, keywords: { surge } });
}

function commitState(): { state: ScenarioState; ids: string[]; cards: ReturnType<typeof cardMap> } {
  const cards = cardMap([encounter("surge", true), encounter("follow"), encounter("other"), encounter("aside", true)]);
  let state = blankScenario({ seatCount: 2, seed: 4, definition: fixtureDefinition(["stage"]) });
  const ids: string[] = [];
  for (const code of ["surge", "follow", "other"]) {
    const spawned = spawn(state, code, { zone: "encounterDeck" });
    state = spawned.state;
    ids.push(spawned.id);
  }
  state = { ...state, phase: "Quest", mode: "questCommit", window: { kind: "pass" }, activeSeat: 0, firstPlayer: 0 };
  return { state, ids, cards };
}

describe("surge", () => {
  it("reveals another card for the revealing seat before the next seat", () => {
    const { state, ids, cards } = commitState();
    const ctx = { effects: [], cards };
    const first = expectOk(reduce(state, { type: "Pass" }, ctx));
    expect(first.state.staging).toEqual([]);
    expect(first.state.activeSeat).toBe(1);
    const revealed = expectOk(reduce(first.state, { type: "Pass" }, ctx));
    expect(revealed.state.staging).toEqual(ids);
    expect(revealed.state.cards[ids[0] ?? ""]?.controller).toBe(0);
    expect(revealed.state.cards[ids[1] ?? ""]?.controller).toBe(0);
    expect(revealed.state.cards[ids[2] ?? ""]?.controller).toBe(1);
  });

  it("does not surge when the card is added to staging without a reveal", () => {
    let state = blankScenario({ seatCount: 1, seed: 4, definition: fixtureDefinition(["stage"]) });
    const surge = spawn(state, "aside", { zone: "encounterDeck" });
    state = surge.state;
    const next = spawn(state, "next", { zone: "encounterDeck" });
    state = next.state;
    const added = addToStaging(state, surge.id);
    expect(added.staging).toEqual([surge.id]);
    expect(added.encounterDeck).toEqual([next.id]);
    expect(added.cards[next.id]?.zone).toBe("encounterDeck");
  });

  it("does not reveal a card for a seat eliminated earlier in staging", () => {
    const doomed = definePrinted({
      code: "doom",
      name: "Doom",
      type: "treachery",
      threat: 0,
      keywords: { doomed: 1 },
    });
    const later = definePrinted({ code: "later", name: "Later", type: "enemy", threat: 0, engagementCost: 50 });
    const cards = cardMap([doomed, later, hero("aragorn", "leadership"), hero("gimli", "tactics")]);
    let state = blankScenario({ seatCount: 2, seed: 4, definition: fixtureDefinition(["stage"]) });
    state = spawn(state, "aragorn", { zone: "heroes", seat: 0 }).state;
    state = spawn(state, "gimli", { zone: "heroes", seat: 1 }).state;
    state = {
      ...state,
      seats: [
        { ...state.seats[0], threat: 10 },
        { ...state.seats[1], threat: 49 },
      ],
    };
    const doom = spawn(state, "doom", { zone: "encounterDeck" });
    state = doom.state;
    const second = spawn(state, "later", { zone: "encounterDeck" });
    state = {
      ...second.state,
      phase: "Quest",
      mode: "questCommit",
      window: { kind: "pass" },
      activeSeat: 0,
      firstPlayer: 0,
    };
    const ctx = { effects: [], cards };
    const first = expectOk(reduce(state, { type: "Pass" }, ctx));
    const revealed = expectOk(reduce(first.state, { type: "Pass" }, ctx));
    expect(revealed.state.seats[1]?.eliminated).toBe(true);
    expect(revealed.state.lost).toBe(false);
    // The resolved treachery is in the encounter discard pile (ltp.revealed-treachery).
    expect(revealed.state.staging).toEqual([]);
    expect(revealed.state.encounterDiscard).toEqual([doom.id]);
    expect(revealed.state.encounterDeck).toEqual([second.id]);
  });

  it("shuffles the encounter discard pile back in when the deck is out of cards in the quest phase (rr.running-out-of-cards)", () => {
    const later = definePrinted({ code: "later", name: "Later", type: "enemy", threat: 0, engagementCost: 50 });
    const cards = cardMap([later, hero("aragorn", "leadership")]);
    let state = blankScenario({ seatCount: 1, seed: 4, definition: fixtureDefinition(["stage"]) });
    state = spawn(state, "aragorn", { zone: "heroes", seat: 0 }).state;
    const gone = spawn(state, "later", { zone: "encounterDiscard" });
    state = { ...gone.state, phase: "Quest", mode: "questCommit", window: { kind: "pass" }, activeSeat: 0, firstPlayer: 0 };
    const revealed = expectOk(reduce(state, { type: "Pass" }, { effects: [], cards }));
    expect(revealed.steps.some((step) => step.kind === "resetEncounterDeck" && step.count === 1)).toBe(true);
    expect(revealed.state.staging).toEqual([gone.id]);
    expect(revealed.state.encounterDiscard).toEqual([]);
  });

  function surgeAlone(otherInDiscard: boolean) {
    const loom = definePrinted({ code: "loom", name: "Loom", type: "treachery", threat: 0, keywords: { surge: true } });
    const later = definePrinted({ code: "later", name: "Later", type: "enemy", threat: 0, engagementCost: 50 });
    const cards = cardMap([loom, later, hero("aragorn", "leadership")]);
    let state = blankScenario({ seatCount: 1, seed: 4, definition: fixtureDefinition(["stage"]) });
    state = spawn(state, "aragorn", { zone: "heroes", seat: 0 }).state;
    const surging = spawn(state, "loom", { zone: "encounterDeck" });
    state = surging.state;
    const other = otherInDiscard ? spawn(state, "later", { zone: "encounterDiscard" }) : null;
    if (other) state = other.state;
    state = { ...state, phase: "Quest", mode: "questCommit", window: { kind: "pass" }, activeSeat: 0, firstPlayer: 0 };
    return { revealed: expectOk(reduce(state, { type: "Pass" }, { effects: [], cards })), loom: surging.id, later: other?.id };
  }

  it("ends the surge chain when the only card left is the surging one: it is not shuffled back to be revealed inside its own surge (rr.surge, rr.running-out-of-cards, faq.last-encounter-card)", () => {
    const { revealed, loom } = surgeAlone(false);
    expect(revealed.state.stack).toEqual([]);
    expect(revealed.steps.filter((step) => step.kind === "reveal")).toHaveLength(1);
    // The reset after the last reveal runs as usual.
    expect(revealed.state.encounterDeck).toEqual([loom]);
  });

  it("still shuffles the discard pile in the middle of a surge chain when it holds other cards (rr.running-out-of-cards)", () => {
    const { revealed, later } = surgeAlone(true);
    expect(revealed.steps.some((step) => step.kind === "resetEncounterDeck" && step.count === 2)).toBe(true);
    // The pile came back with the surging card and the other card: the chain went on until the other card was revealed, and the surging card was revealed again on the way or not.
    expect(revealed.state.staging).toContain(later);
    expect(revealed.state.stack).toEqual([]);
  });

  it("does not surge after the revealing seat is eliminated", () => {
    const doomed = definePrinted({
      code: "doom",
      name: "Doom",
      type: "treachery",
      threat: 0,
      keywords: { doomed: 1, surge: true },
    });
    const extra = definePrinted({ code: "extra", name: "Extra", type: "enemy", threat: 0, engagementCost: 50 });
    const cards = cardMap([doomed, extra, hero("aragorn", "leadership", 8, 1)]);
    let state = blankScenario({ seatCount: 1, seed: 4, definition: fixtureDefinition(["stage"]) });
    state = spawn(state, "aragorn", { zone: "heroes", seat: 0 }).state;
    state = { ...state, seats: [{ ...state.seats[0], threat: 49 }, state.seats[1]] };
    const doom = spawn(state, "doom", { zone: "encounterDeck" });
    state = doom.state;
    const surged = spawn(state, "extra", { zone: "encounterDeck" });
    state = {
      ...surged.state,
      phase: "Quest",
      mode: "questCommit",
      window: { kind: "pass" },
      activeSeat: 0,
    };
    const revealed = expectOk(reduce(state, { type: "Pass" }, { effects: [], cards }));
    expect(revealed.state.lost).toBe(true);
    expect(revealed.state.staging).toEqual([doom.id]);
    expect(revealed.state.encounterDeck).toEqual([surged.id]);
  });

  it("deals when-revealed damage to an immune enemy and not to the source", () => {
    const sting = definePrinted({ code: "sting", name: "Sting", type: "treachery", threat: 0 });
    const immune = definePrinted({
      code: "orc",
      name: "Orc",
      type: "enemy",
      threat: 0,
      engagementCost: 50,
      health: 5,
      keywords: { immuneToPlayerCardEffects: true },
    });
    const cards = cardMap([sting, immune, hero("aragorn", "leadership")]);
    let state = blankScenario({ seatCount: 1, seed: 2, definition: fixtureDefinition(["stage"]) });
    state = spawn(state, "aragorn", { zone: "heroes", seat: 0 }).state;
    const orc = spawn(state, "orc", { zone: "engaged", seat: 0 });
    state = orc.state;
    const revealedCard = spawn(state, "sting", { zone: "encounterDeck" });
    state = {
      ...revealedCard.state,
      phase: "Quest",
      mode: "questCommit",
      window: { kind: "pass" },
      activeSeat: 0,
    };
    const resolved = expectOk(reduce(state, { type: "Pass" }, {
      effects: [{ id: "sting:whenRevealed:1", cardCode: "sting", lines: ["fixture:A:1"], timing: "whenRevealed", instructions: [{ verb: "DealDamage" }] }],
      cards,
    }));
    expect(resolved.state.cards[orc.id]?.damage).toBe(1);
    expect(resolved.state.cards[revealedCard.id]?.damage).toBe(0);
  });
});
