import { beforeAll, describe, expect, it } from "vitest";

import { characters } from "../rules/combat/combat.ts";
import { legalIntents } from "../rules/engine/reduce.ts";
import {
  codeOf, codesOf, first, FRODO, loadWorld, reveal, RIDER, RING, SAM, send, start, table, frames,
  type Layout, type World,
} from "../../scripts/past-scene.ts";

let world: World;

beforeAll(async () => {
  world = await loadWorld();
});

function make(layout: Layout = {}) {
  return table(world, layout);
}

describe("whenRevealed on locations and treacheries", () => {
  it("141033 whenRevealed: ReturnToStaging the active location, then Travel to self", () => {
    const { state, ctx } = make({ deck: ["141033"], active: "141031" });
    const run = reveal(state, ctx);
    expect(codeOf(run.state, run.state.activeLocation)).toBe("141033");
    expect(codesOf(run.state, run.state.staging)).toEqual(["141031"]);
  });

  it("141033 whenRevealed: with no active location it travels at once", () => {
    const { state, ctx } = make({ deck: ["141033"] });
    const run = reveal(state, ctx);
    expect(codeOf(run.state, run.state.activeLocation)).toBe("141033");
    expect(run.state.staging).toEqual([]);
  });

  it("141073 whenRevealed: Choose between SearchMove targets, then ShuffleEncounterDeck", () => {
    const { state, ctx } = make({ deck: ["141073", "f0", "f0", "f0"], discard: [RIDER] });
    const opened = reveal(state, ctx);
    expect(opened.state.window).toEqual({ kind: "choose", seat: 0, options: ["staging", "engage"] });
    const rider = first(opened.state, RIDER);
    const cursor = opened.state.seedCursor;
    const engaged = send(opened, { type: "Choose", optionId: "engage" }, ctx);
    expect(engaged.state.cards[rider]?.zone).toBe("engaged");
    expect(engaged.state.cards[rider]?.controller).toBe(0);
    expect(engaged.state.seedCursor).toBeGreaterThan(cursor);
    const staged = send(opened, { type: "Choose", optionId: "staging" }, ctx);
    expect(staged.state.cards[rider]?.zone).toBe("staging");
  });

  it("141073 whenRevealed: with no searchable match only the shuffle runs", () => {
    const { state, ctx } = make({ deck: ["141073", "f0", "f0", "f0"] });
    const run = reveal(state, ctx);
    expect(run.state.window?.kind).not.toBe("choose");
    expect(run.state.seedCursor).toBeGreaterThan(state.seedCursor);
  });

  it("141076 whenRevealed: Choose exhaust or RaiseThreat, then surge", () => {
    const { state, ctx } = make({ deck: ["141076", "f0"] });
    const opened = reveal(state, ctx);
    expect(opened.state.window).toEqual({ kind: "choose", seat: 0, options: ["exhaust", "threat"] });
    const ring = first(opened.state, RING);
    const exhausted = send(opened, { type: "Choose", optionId: "exhaust" }, ctx);
    expect(exhausted.state.cards[ring]?.exhausted).toBe(true);
    expect(exhausted.state.seats[0]?.threat).toBe(8);
    expect(codesOf(exhausted.state, exhausted.state.staging)).toContain("f0");
    const raised = send(opened, { type: "Choose", optionId: "threat" }, ctx);
    expect(raised.state.seats[0]?.threat).toBe(11);
    expect(raised.state.cards[ring]?.exhausted).toBe(false);
  });

  it("141076 whenRevealed: the choice is skipped when one option is legal", () => {
    for (const ring of ["exhausted", "none"] as const) {
      const { state, ctx } = make({ deck: ["141076", "f0"], ring });
      const run = reveal(state, ctx);
      expect(run.state.window?.kind).not.toBe("choose");
      expect(run.state.seats[0]?.threat).toBe(11);
    }
  });

  it("141043 whenRevealed: AttachSelf to a chosen hero, then surge", () => {
    const { state, ctx } = make({ deck: ["141043", "f0"] });
    const opened = reveal(state, ctx);
    const sam = first(opened.state, SAM);
    const frodo = first(opened.state, FRODO);
    expect(opened.state.window).toEqual({ kind: "choose", seat: 0, options: [frodo, sam] });
    const attached = send(opened, { type: "Choose", optionId: sam }, ctx);
    const card = first(attached.state, "141043");
    expect(attached.state.cards[card]).toMatchObject({ zone: "attached", host: sam });
    expect(attached.state.cards[sam]?.attachments).toEqual([card]);
    // Surge: the next card was revealed too.
    expect(codesOf(attached.state, attached.state.staging)).toContain("f0");
  });

  it("141043 whenRevealed: \"Attach to a hero\" offers every player's heroes, and the first player chooses", () => {
    const { state, ctx } = make({ seats: 2, deck: ["f0", "141043", "f0", "f0"] });
    // Seat 0 reveals a filler, then seat 1 reveals Have You Seen Baggins?.
    const opened = reveal(state, ctx, 2);
    const merry = first(opened.state, "141003");
    expect(opened.state.window).toMatchObject({ kind: "choose", seat: 0 });
    expect(opened.state.window?.kind === "choose" ? opened.state.window.options : []).toEqual([first(opened.state, FRODO), first(opened.state, SAM), merry]);
    const attached = send(opened, { type: "Choose", optionId: merry }, ctx);
    expect(attached.state.cards[first(attached.state, "141043")]).toMatchObject({ zone: "attached", host: merry });
  });

  it("141074 whenRevealed: AttachSelf to an enemy with the trait", () => {
    const { state, ctx } = make({ deck: ["141074", "f0"], engaged: [{ code: RIDER, seat: 0 }] });
    const run = reveal(state, ctx);
    const rider = first(run.state, RIDER);
    const steed = first(run.state, "141074");
    expect(run.state.cards[steed]).toMatchObject({ zone: "attached", host: rider });
  });

  it("141074 whenRevealed: AttachSelf finds no enemy with the trait, so the treachery is discarded (ltp.revealed-treachery)", () => {
    // A spare card keeps the deck from running out, which would shuffle the discard pile back in (rr.running-out-of-cards).
    const { state, ctx } = make({ deck: ["141074", "f0", "f0"] });
    const run = reveal(state, ctx);
    const steed = first(run.state, "141074");
    expect(run.state.cards[steed]?.zone).toBe("encounterDiscard");
    expect(run.state.cards[steed]?.host).toBeNull();
  });

  it("141075 whenRevealed: ReturnToStaging, then GainSurge only when noneReturned", () => {
    const withRider = make({ deck: ["141075", "f0"], engaged: [{ code: RIDER, seat: 0 }] });
    const returned = reveal(withRider.state, withRider.ctx);
    const rider = first(returned.state, RIDER);
    expect(returned.state.cards[rider]?.zone).toBe("staging");
    expect(returned.state.cards[rider]?.controller).toBeNull();
    expect(returned.state.encounterDeck).toHaveLength(1);
    expect(codesOf(returned.state, returned.state.encounterDiscard)).toEqual(["141075"]);
    const without = make({ deck: ["141075", "f0", "f0"] });
    const surged = reveal(without.state, without.ctx);
    expect(surged.state.encounterDeck).toHaveLength(1);
    // The resolved treachery goes to the encounter discard pile before its surge reveals the next card (ltp.revealed-treachery, rr.surge).
    expect(codesOf(surged.state, surged.state.staging)).toEqual(["f0"]);
    expect(codesOf(surged.state, surged.state.encounterDiscard)).toEqual(["141075"]);
  });
});

describe("a revealed treachery is discarded after it resolves (ltp.revealed-treachery, rr.treachery-cards, rr.step-3-3)", () => {
  it("141076 Lure of the Ring goes to the encounter discard pile once its effect has resolved, before its surge", () => {
    const { state, ctx } = make({ deck: ["141076", "f0", "f0"], ring: "none" });
    const run = reveal(state, ctx);
    const lure = first(run.state, "141076");
    expect(run.state.cards[lure]?.zone).toBe("encounterDiscard");
    expect(run.state.encounterDiscard).toEqual([lure]);
    // Surge revealed the next card, which is a staging card and stays.
    expect(codesOf(run.state, run.state.staging)).toEqual(["f0"]);
  });

  it("a treachery whose text attaches it (141043, a Condition) stays where its text put it", () => {
    const { state, ctx } = make({ deck: ["141043", "f0"] });
    const opened = reveal(state, ctx);
    const sam = first(opened.state, SAM);
    const attached = send(opened, { type: "Choose", optionId: sam }, ctx);
    const card = first(attached.state, "141043");
    expect(attached.state.cards[card]).toMatchObject({ zone: "attached", host: sam });
    expect(attached.state.encounterDiscard).toEqual([]);
  });
});

describe("141041 whenRevealed after Hide", () => {
  it("Hide runs before whenRevealed, and hideFailed applies the conditional UncommitAll", () => {
    const { state, ctx } = make({ deck: ["141041", "f3", "f3", "f0"] });
    const sam = first(state, SAM);
    const frodo = first(state, FRODO);
    let run = send(start(state), { type: "Commit", cardIds: [sam] }, ctx);
    run = send(run, { type: "Pass" }, ctx);
    expect(run.state.cards[sam]?.committed).toBe(true);
    expect(run.state.window).toEqual({ kind: "hideCommit", seat: 0 });
    run = send(run, { type: "CommitHide", cardIds: [] }, ctx);
    run = send(run, { type: "Pass" }, ctx);
    expect(frames(run.steps).filter((entry) => entry.includes("reveal") || entry.includes("hide") || entry.includes("whenRevealed"))).toEqual([
      "push:reveal",
      "push:hide",
      "pop:hide",
      "push:whenRevealed",
      "pop:whenRevealed",
      "pop:reveal",
    ]);
    expect(run.state.cards[sam]?.committed).toBe(false);
    expect(run.state.cards[sam]?.exhausted).toBe(true);
    expect(run.state.cards[frodo]?.exhausted).toBe(false);
  });

  it("hideSucceeded leaves the conditional UncommitAll unapplied", () => {
    const { state, ctx } = make({ deck: ["141041", "f0", "f0", "f0"] });
    const sam = first(state, SAM);
    const frodo = first(state, FRODO);
    let run = send(start(state), { type: "Commit", cardIds: [sam] }, ctx);
    run = send(run, { type: "Pass" }, ctx);
    run = send(run, { type: "CommitHide", cardIds: [frodo] }, ctx);
    run = send(run, { type: "Pass" }, ctx);
    expect(run.steps.filter((step) => step.kind === "hideTest")).toMatchObject([{ success: true }]);
    expect(run.state.hideFailures).toEqual([]);
    expect(run.state.cards[sam]?.committed).toBe(false);
  });
});

describe("141042 whenRevealed ForEachPlayer", () => {
  it("lastFirst order asks the last seat first; a seat failing the hasEngaged requirement gets the HideTest", () => {
    const { state, ctx } = make({
      seats: 2,
      deck: ["141042", "f0", "f0", "f0", "f0"],
      engaged: [{ code: RIDER, seat: 1 }],
    });
    let run = reveal(state, ctx, 2);
    // Doomed raised both seats.
    expect(run.state.seats[0]?.threat).toBe(10);
    expect(run.state.seats[1]?.threat).toBe(8);
    expect(run.state.window).toEqual({ kind: "choose", seat: 1, options: ["return", "hide"] });
    expect(legalIntents(run.state, ctx)).toEqual([
      { type: "Choose", optionId: "return" },
      { type: "Choose", optionId: "hide" },
    ]);
    run = send(run, { type: "Choose", optionId: "return" }, ctx);
    const rider = first(run.state, RIDER);
    expect(run.state.cards[rider]?.zone).toBe("staging");
    // Seat 0 has no engaged Nazgul, so one option is legal and the Hide 2 test starts.
    expect(run.state.window).toEqual({ kind: "hideCommit", seat: 0 });
  });

  it("choosing the hide option starts the HideTest", () => {
    const { state, ctx } = make({
      seats: 2,
      deck: ["141042", "f0", "f0", "f0", "f0"],
      engaged: [{ code: RIDER, seat: 1 }],
    });
    let run = reveal(state, ctx, 2);
    run = send(run, { type: "Choose", optionId: "hide" }, ctx);
    expect(run.state.window).toEqual({ kind: "hideCommit", seat: 1 });
    expect(run.state.cards[first(run.state, RIDER)]?.zone).toBe("engaged");
  });
});

describe("141077 whenRevealed", () => {
  function gildorInPlay(resources: number) {
    const { state, ctx } = make({ deck: ["141077", "f0"], resources });
    const run = reveal(state, ctx);
    const gildor = first(run.state, "141077");
    return { run, ctx, gildor, frodo: first(run.state, FRODO), sam: first(run.state, SAM) };
  }

  it("TakeControl puts it in the first seat's play area, counted as a character", () => {
    const { run, ctx, gildor } = gildorInPlay(0);
    expect(run.state.cards[gildor]).toMatchObject({ zone: "play", controller: 0 });
    expect(characters(run.state, 0, ctx.cards)).toContain(gildor);
  });
});

describe("quest stages", () => {
  it("141023 whenRevealed runs when the quest advances, with a Hide test inside it", () => {
    const { state, ctx } = make({ progress: 0, deck: ["f0", "f0", "f0", RIDER, "f0", "f0", "f0"], stage: "141022", victory: ["141031"] });
    const sam = first(state, SAM);
    let run = send(start(state), { type: "Commit", cardIds: [sam] }, ctx);
    const cursor = run.state.seedCursor;
    run = send(run, { type: "Pass" }, ctx);
    // A filler staged, the quest advanced, and 141039 is being revealed with its Hide test.
    expect(codeOf(run.state, run.state.questStage)).toBe("141023");
    expect(run.state.window).toEqual({ kind: "hideCommit", seat: 0 });
    expect(frames(run.steps)).toEqual(["push:reveal", "pop:reveal", "push:whenRevealed", "push:reveal", "push:hide"]);
    expect(run.state.mode).toBe("resolution");
    const frodo = first(run.state, FRODO);
    run = send(run, { type: "CommitHide", cardIds: [frodo] }, ctx);
    run = send(run, { type: "Pass" }, ctx);
    expect(codesOf(run.state, run.state.staging)).toContain(RIDER);
    expect(run.state.seedCursor).toBeGreaterThan(cursor);
    expect(run.state.mode).toBe("travel");
    expect(run.state.stack).toEqual([]);
  });

  it("141024 whenRevealed records run when the quest advances", () => {
    const { state, ctx } = make({ stage: "141023", progress: 13, deck: ["f0", "f0", "f0", RIDER, "f0"], setAside: ["141035"] });
    const sam = first(state, SAM);
    let run = send(start(state), { type: "Commit", cardIds: [sam] }, ctx);
    run = send(run, { type: "Pass" }, ctx);
    expect(codeOf(run.state, run.state.questStage)).toBe("141024");
    expect(codesOf(run.state, run.state.staging)).toContain("141035");
    expect(run.state.window).toEqual({ kind: "hideCommit", seat: 0 });
    const frodo = first(run.state, FRODO);
    run = send(run, { type: "CommitHide", cardIds: [frodo] }, ctx);
    run = send(run, { type: "Pass" }, ctx);
    expect(codesOf(run.state, run.state.staging)).toContain(RIDER);
    // The successful Hide test offers 141024's Response. Passing it lets the phase finish.
    expect(run.state.window).toEqual({ kind: "response", seat: 0 });
    run = send(run, { type: "Pass" }, ctx);
    expect(run.state.mode).toBe("travel");
  });
});

describe("141001 Frodo Baggins response on encounterRevealed", () => {
  it("spends a Fellowship resource and exhausts The One Ring to cancel the card just revealed, shuffles it back and reveals another", () => {
    const { state, ctx } = make({ deck: [RIDER, "f0", "f0", "f0"], resources: 1 });
    let run = reveal(state, ctx);
    const frodo = first(run.state, FRODO);
    const rider = first(run.state, RIDER);
    expect(run.state.window).toEqual({ kind: "response", seat: 0 });
    expect(legalIntents(run.state, ctx)).toContainEqual({ type: "Trigger", cardId: frodo, effectId: "141001:response:1" });
    run = send(run, { type: "Trigger", cardId: frodo, effectId: "141001:response:1", payments: [{ heroId: frodo, amount: 1 }] }, ctx);
    // The Black Rider's Hide test never happens: its effects were canceled before any of them resolved.
    expect(run.steps.some((step) => step.kind === "hideTest")).toBe(false);
    expect(run.state.cards[rider]?.zone).toBe("encounterDeck");
    expect(run.state.cards[frodo]?.resources).toBe(0);
    expect(run.state.cards[first(run.state, RING)]?.exhausted).toBe(true);
    expect(codesOf(run.state, run.state.staging)).toEqual(["f0"]);
  });

  it("is not offered while The One Ring is exhausted", () => {
    const { state, ctx } = make({ deck: [RIDER, "f0", "f0", "f0"], resources: 1, ring: "exhausted" });
    const run = reveal(state, ctx);
    expect(run.state.window?.kind).not.toBe("response");
  });
});
