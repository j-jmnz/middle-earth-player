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

  it("reveals the surge of a card that eliminated the seat revealing it, for the first seat still in the game (rr.player-elimination, rr.surge)", () => {
    const doomed = definePrinted({ code: "doom", name: "Doom", type: "treachery", threat: 0, keywords: { doomed: 1, surge: true } });
    const later = definePrinted({ code: "later", name: "Later", type: "enemy", threat: 0, engagementCost: 50 });
    const cards = cardMap([doomed, later, hero("aragorn", "leadership"), hero("gimli", "tactics")]);
    let state = blankScenario({ seatCount: 2, seed: 4, definition: fixtureDefinition(["stage"]) });
    state = spawn(state, "aragorn", { zone: "heroes", seat: 0 }).state;
    state = spawn(state, "gimli", { zone: "heroes", seat: 1 }).state;
    state = { ...state, seats: [{ ...state.seats[0], threat: 49 }, { ...state.seats[1], threat: 10 }] };
    const doom = spawn(state, "doom", { zone: "encounterDeck" });
    const second = spawn(doom.state, "later", { zone: "encounterDeck" });
    state = { ...second.state, phase: "Quest", mode: "questCommit", window: { kind: "pass" }, activeSeat: 0, firstPlayer: 0 };
    const ctx = { effects: [], cards };
    const first = expectOk(reduce(state, { type: "Pass" }, ctx));
    const revealed = expectOk(reduce(first.state, { type: "Pass" }, ctx));
    expect(revealed.state.cards[second.id]?.controller).toBe(1);
    expect(revealed.state.seats[0]?.eliminated).toBe(true);
    expect(revealed.state.encounterDeck).toEqual([]);
    expect(revealed.state.staging).toContain(second.id);
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

  // The reset is the rules' (rr.running-out-of-cards): a surging card that is the only card of the game is shuffled back and revealed inside its own surge, for as long as a pass changes the game. A pass that finds the table of an earlier pass ends the chain (quest/surge-chain.ts repeatsChain).
  function surgeScene(keywords: { surge: true; doomed?: number }, threat: number) {
    const loom = definePrinted({ code: "loom", name: "Loom", type: "treachery", threat: 0, keywords });
    const cards = cardMap([loom, hero("aragorn", "leadership")]);
    let state = blankScenario({ seatCount: 1, seed: 4, definition: fixtureDefinition(["stage"]) });
    state = spawn(state, "aragorn", { zone: "heroes", seat: 0 }).state;
    const surging = spawn(state, "loom", { zone: "encounterDeck" });
    state = { ...surging.state, phase: "Quest", mode: "questCommit", window: { kind: "pass" }, activeSeat: 0, firstPlayer: 0 };
    state = { ...state, seats: [{ ...state.seats[0], threat }, state.seats[1]] };
    return { state, cards, loom: surging.id };
  }

  it("shuffles a surging card that is the only card left back and reveals it again, for the doomed one until the threat is 50 (rr.surge, rr.running-out-of-cards)", () => {
    const { state, cards } = surgeScene({ surge: true, doomed: 2 }, 30);
    const revealed = expectOk(reduce(state, { type: "Pass" }, { effects: [], cards }));
    expect(revealed.steps.filter((step) => step.kind === "reveal")).toHaveLength(10);
    expect(revealed.state.seats[0]?.threat).toBe(50);
    expect(revealed.state.lost).toBe(true);
  });

  it("ends a surge chain whose pass changes nothing: the second reveal finds the table of the first and the reset is held (rr.surge)", () => {
    const { state, cards } = surgeScene({ surge: true }, 0);
    const done = expectOk(reduce(state, { type: "Pass" }, { effects: [], cards }));
    expect(done.steps.filter((step) => step.kind === "reveal")).toHaveLength(2);
    expect(done.state.stack).toEqual([]);
    expect(done.state.lost).toBe(false);
  });

  it("shuffles the discard pile back in the middle of a surge chain when a Hide card follows the surging one (rr.running-out-of-cards)", () => {
    const loom = definePrinted({ code: "loom", name: "Loom", type: "treachery", threat: 0, keywords: { surge: true } });
    const hider = definePrinted({ code: "hider", name: "Hider", type: "enemy", threat: 1, engagementCost: 50, keywords: { hide: 1 } });
    const cards = cardMap([loom, hider, hero("aragorn", "leadership")]);
    let state = blankScenario({ seatCount: 1, seed: 4, definition: fixtureDefinition(["stage"]) });
    state = spawn(state, "aragorn", { zone: "heroes", seat: 0 }).state;
    state = spawn(spawn(state, "loom", { zone: "encounterDeck" }).state, "hider", { zone: "encounterDeck" }).state;
    state = { ...state, phase: "Quest", mode: "questCommit", window: { kind: "pass" }, activeSeat: 0, firstPlayer: 0 };
    const ctx = { effects: [], cards };
    let step = expectOk(reduce(state, { type: "Pass" }, ctx));
    expect(step.state.window?.kind).toBe("hideCommit");
    step = expectOk(reduce(step.state, { type: "CommitHide", cardIds: [] }, ctx));
    for (let pass = 0; pass < 5 && step.state.stack.length > 0; pass += 1) step = expectOk(reduce(step.state, { type: "Pass" }, ctx));
    expect(step.steps.filter((entry) => entry.kind === "resetEncounterDeck")).toEqual([expect.objectContaining({ count: 1 })]);
    expect(step.state.encounterDeck.map((id) => step.state.cards[id]?.code)).toEqual(["loom"]);
    expect(step.state.window?.kind).toBe("travel");
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
