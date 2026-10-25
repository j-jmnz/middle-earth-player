// Rules: rr.delayed-effects, rr.lasting-effects, rr.limits, rr.explored, rr.discard-pile-and-victory-display, rr.ownership-and-control (data/rules/entries.json).
// Phase 9 batch 4: temporary play, play from a discard pile, and delayed triggers of the starter cards.
import { beforeAll, describe, expect, it } from "vitest";

import { placeProgress } from "../rules/effect-verbs.ts";
import { destroyCard, modifiedStat } from "../rules/keywords.ts";
import { settle } from "../rules/machine.ts";
import { legalIntents, type PlayerIntent } from "../rules/reduce.ts";
import { syncConstants } from "../rules/constants.ts";
import { spawn } from "../rules/zones.ts";
import { fund, payFor, refusal, starterBase } from "../../scripts/starter-scene.ts";
import { begin, buildTable, idsOf, send, type Run, type Scene, type Table } from "../../scripts/test-scene.ts";

const SAM = "141002";
const PIPPIN = "141004";
const MERRY = "141003";
const EOWYN = "01007";
const BOROMIR = "142004";
const AXEHAND = "01028";
const GANDALF = "01073";
const BEORN = "01031";
const TOOK = "01043";
const DAGGER = "141014";
const CLOAK = "141013";
const STEWARD = "01026";
const BAMFURLONG = "141034";

let base: Awaited<ReturnType<typeof starterBase>>;

beforeAll(async () => {
  base = await starterBase();
});

function table(scene: Scene = {}, resources = 6): Table {
  const tab = buildTable(base, { ring: "none", start: "planning", ...scene });
  let state = tab.state;
  for (let seat = 0; seat < (scene.seats ?? 1); seat += 1) state = fund(state, seat, resources);
  return { ...tab, state };
}

function play(tab: Table, run: Run, code: string, extra: Partial<Extract<PlayerIntent, { type: "PlayCard" }>> = {}): Run {
  const cardId = tab.ids[code]?.[0] ?? "";
  return send(run, { type: "PlayCard", cardId, payments: payFor(run.state, tab.ctx, cardId, run.state.activeSeat), ...extra }, tab.ctx);
}

function choices(run: Run, tab: Table): string[] {
  return legalIntents(run.state, tab.ctx).flatMap((intent) => (intent.type === "Choose" ? [intent.optionId] : []));
}

// A card put into a player's discard pile, the last one on top.
function discard(tab: Table, code: string, seat: number): Table {
  const spawned = spawn(tab.state, code, { zone: "discard", seat });
  (tab.ids[code] ??= []).push(spawned.id);
  return { ...tab, state: spawned.state };
}

describe("Sneak Attack (01023:A:1)", () => {
  it("puts an ally into play from the hand, and returns it to the hand at the end of the phase", () => {
    const tab = table({ heroes: [{ code: SAM, seat: 0 }], hand: [{ code: "01023", seat: 0 }, { code: BOROMIR, seat: 0 }] });
    const boromir = idsOf(tab, BOROMIR);
    let run = play(tab, begin(tab.state), "01023");
    expect(run.state.cards[boromir]?.zone).toBe("play");
    expect(run.state.cards[boromir]?.controller).toBe(0);
    expect(run.state.delayed).toHaveLength(1);
    // It is still in play while the phase goes on.
    expect(run.state.window).toEqual({ kind: "pass" });
    // The planning phase ends: the ally goes back to the hand before anything else happens.
    run = send(run, { type: "Pass" }, tab.ctx);
    expect(run.state.mode).toBe("questCommit");
    expect(run.state.cards[boromir]?.zone).toBe("hand");
    expect(run.state.delayed).toEqual([]);
  });

  it("asks which ally when the hand holds different ones, and does not offer a unique ally that is already in play", () => {
    const tab = table({ heroes: [{ code: SAM, seat: 0 }], allies: [{ code: BOROMIR, seat: 0 }], hand: [{ code: "01023", seat: 0 }, { code: BOROMIR, seat: 0 }, { code: AXEHAND, seat: 0 }, { code: GANDALF, seat: 0 }] });
    let run = play(tab, begin(tab.state), "01023");
    // The second Boromir cannot enter play: the other copy is in play.
    expect(choices(run, tab).sort()).toEqual([idsOf(tab, AXEHAND), idsOf(tab, GANDALF)].sort());
    run = send(run, { type: "Choose", optionId: idsOf(tab, GANDALF) }, tab.ctx);
    expect(run.state.cards[idsOf(tab, GANDALF)]?.zone).toBe("play");
  });

  it("leaves an ally that already left play where it is", () => {
    const tab = table({ heroes: [{ code: SAM, seat: 0 }], hand: [{ code: "01023", seat: 0 }, { code: AXEHAND, seat: 0 }] });
    const axehand = idsOf(tab, AXEHAND);
    let run = play(tab, begin(tab.state), "01023");
    const state = destroyCard(run.state, axehand, tab.ctx.cards, []);
    run = send(begin(state), { type: "Pass" }, tab.ctx);
    expect(run.state.cards[axehand]?.zone).toBe("discard");
  });
});

describe("Beorn (01031:A:1)", () => {
  it("gains +5 Attack until the end of the phase, then is shuffled back into the deck; once per round", () => {
    const tab = table({ heroes: [{ code: SAM, seat: 0 }], allies: [{ code: BEORN, seat: 0 }], playerDeck: [{ code: AXEHAND, seat: 0 }, { code: AXEHAND, seat: 0 }] });
    const beorn = idsOf(tab, BEORN);
    let run = send(begin(tab.state), { type: "Trigger", cardId: beorn, effectId: "01031:action:1" }, tab.ctx);
    expect(modifiedStat(run.state, run.state.cards[beorn] ?? ({} as never), "attack", tab.ctx.cards)).toBe((tab.ctx.cards.get(BEORN)?.attack ?? 0) + 5);
    expect(refusal(run.state, { type: "Trigger", cardId: beorn, effectId: "01031:action:1" }, tab.ctx)).toBe("That effect has already been used");
    const cursor = run.state.seedCursor;
    run = send(run, { type: "Pass" }, tab.ctx);
    expect(run.state.cards[beorn]?.zone).toBe("deck");
    expect(run.state.seats[0]?.deck).toContain(beorn);
    expect(run.state.seats[0]?.play).not.toContain(beorn);
    expect(run.state.seedCursor).toBeGreaterThan(cursor);
  });
});

describe("Beorn (01031:A:1) after he left play", () => {
  it("is not shuffled back from the discard pile once he was destroyed (faq.simultaneous-effects)", () => {
    const tab = table({ heroes: [{ code: SAM, seat: 0 }], allies: [{ code: BEORN, seat: 0 }], playerDeck: [{ code: AXEHAND, seat: 0 }] });
    const beorn = idsOf(tab, BEORN);
    let run = send(begin(tab.state), { type: "Trigger", cardId: beorn, effectId: "01031:action:1" }, tab.ctx);
    run = { ...run, state: destroyCard(run.state, beorn, tab.ctx.cards, []) };
    run = send(run, { type: "Pass" }, tab.ctx);
    expect(run.state.cards[beorn]?.zone).toBe("discard");
    expect(run.state.seats[0]?.deck).not.toContain(beorn);
  });
});

describe("Stand and Fight (01051:A:1)", () => {
  it("pays X and puts an ally of printed cost X from any discard pile into play under your control", () => {
    let tab = table({ seats: 2, heroes: [{ code: EOWYN, seat: 0 }, { code: MERRY, seat: 1 }], hand: [{ code: "01051", seat: 0 }] });
    tab = discard(tab, BOROMIR, 1);
    tab = discard(tab, GANDALF, 0);
    const stand = idsOf(tab, "01051");
    const boromir = idsOf(tab, BOROMIR);
    const eowyn = idsOf(tab, EOWYN);
    let run = send(begin(tab.state), { type: "PlayCard", cardId: stand, payments: [{ heroId: eowyn, amount: 4 }] }, tab.ctx);
    expect(run.state.cards[boromir]?.zone).toBe("play");
    expect(run.state.cards[boromir]?.controller).toBe(0);
    expect(run.state.cards[boromir]?.owner).toBe(1);
    expect(run.state.cards[stand]?.zone).toBe("discard");
    // When it is destroyed it goes to its owner's discard pile.
    const destroyed = destroyCard(run.state, boromir, tab.ctx.cards, []);
    expect(destroyed.seats[1]?.discard).toContain(boromir);
    expect(destroyed.seats[0]?.discard).not.toContain(boromir);
    // Gandalf is neutral, and a neutral ally does not belong to "any sphere" (faq.stand-and-fight).
    run = send(begin(tab.state), { type: "PlayCard", cardId: stand, payments: [{ heroId: eowyn, amount: 5 }] }, tab.ctx);
    expect(run.state.cards[idsOf(tab, GANDALF)]?.zone).toBe("discard");
  });

  it("can be played for any X, and an X with no ally of that cost does nothing", () => {
    let tab = table({ heroes: [{ code: EOWYN, seat: 0 }], hand: [{ code: "01051", seat: 0 }] });
    tab = discard(tab, BOROMIR, 0);
    const run = send(begin(tab.state), { type: "PlayCard", cardId: idsOf(tab, "01051"), payments: [{ heroId: idsOf(tab, EOWYN), amount: 2 }] }, tab.ctx);
    expect(run.state.cards[idsOf(tab, BOROMIR)]?.zone).toBe("discard");
    expect(run.state.cards[idsOf(tab, "01051")]?.zone).toBe("discard");
  });
});

describe("Dwarven Tomb (01053:A:1)", () => {
  it("returns a Spirit card from your discard pile to your hand", () => {
    let tab = table({ heroes: [{ code: EOWYN, seat: 0 }], hand: [{ code: "01053", seat: 0 }] });
    tab = discard(tab, CLOAK, 0);
    tab = discard(tab, TOOK, 0);
    const run = play(tab, begin(tab.state), "01053");
    expect(run.state.cards[idsOf(tab, TOOK)]?.zone).toBe("hand");
    expect(run.state.cards[idsOf(tab, CLOAK)]?.zone).toBe("discard");
    // The Tomb does not return itself: it is in the discard pile only after its effect is done.
    expect(run.state.cards[idsOf(tab, "01053")]?.zone).toBe("discard");
  });

  it("cannot be played with no Spirit card in the discard pile", () => {
    let tab = table({ heroes: [{ code: EOWYN, seat: 0 }], hand: [{ code: "01053", seat: 0 }] });
    tab = discard(tab, CLOAK, 0);
    expect(refusal(tab.state, { type: "PlayCard", cardId: idsOf(tab, "01053"), payments: payFor(tab.state, tab.ctx, idsOf(tab, "01053")) }, tab.ctx)).toBe("That card has no legal target");
  });
});

describe("Erebor Hammersmith (01059:A:1)", () => {
  it("returns the topmost attachment of a chosen player's discard pile to its owner's hand", () => {
    // Erebor is a Lore ally, so seat 0's hero is Pippin, a Lore hero.
    let t = table({ seats: 2, heroes: [{ code: PIPPIN, seat: 0 }, { code: MERRY, seat: 1 }], hand: [{ code: "01059", seat: 0 }] });
    t = discard(t, DAGGER, 0);
    t = discard(t, CLOAK, 0);
    t = discard(t, STEWARD, 1);
    let run = play(t, begin(t.state), "01059");
    expect(run.state.window).toEqual({ kind: "response", seat: 0 });
    run = send(run, { type: "Trigger", cardId: idsOf(t, "01059"), effectId: "01059:response:1" }, t.ctx);
    // Cloak is on top of seat 0's pile (the Dagger is under it), the Steward alone in seat 1's.
    expect(choices(run, t).sort()).toEqual([idsOf(t, CLOAK), idsOf(t, STEWARD)].sort());
    run = send(run, { type: "Choose", optionId: idsOf(t, STEWARD) }, t.ctx);
    expect(run.state.seats[1]?.hand).toContain(idsOf(t, STEWARD));
    expect(run.state.seats[0]?.hand).not.toContain(idsOf(t, STEWARD));
    expect(run.state.window).toEqual({ kind: "pass" });
  });
});

describe("Elf-stone (141016)", () => {
  const scene = (): Table =>
    table({ heroes: [{ code: PIPPIN, seat: 0 }], active: BAMFURLONG, hand: [{ code: "141016", seat: 0 }, { code: AXEHAND, seat: 0 }] }, 6);

  it("attaches to the active location and gives it +1 quest point (141016:A:1)", () => {
    const tab = scene();
    const location = idsOf(tab, BAMFURLONG);
    expect(refusal(tab.state, { type: "PlayCard", cardId: idsOf(tab, "141016"), payments: payFor(tab.state, tab.ctx, idsOf(tab, "141016")), hostId: idsOf(tab, PIPPIN) }, tab.ctx)).toBe("That host is illegal");
    const run = play(tab, begin(tab.state), "141016", { hostId: location });
    const after = syncConstants(run.state, tab.ctx);
    const printed = tab.ctx.cards.get(BAMFURLONG)?.questPoints ?? 0;
    expect(modifiedStat(after, after.cards[location] ?? ({} as never), "questPoints", tab.ctx.cards)).toBe(printed + 1);
  });

  it("after the location is explored, the first player puts an ally into play from the hand (141016:A:2)", () => {
    const tab = scene();
    const location = idsOf(tab, BAMFURLONG);
    const run = play(tab, begin(tab.state), "141016", { hostId: location });
    const printed = tab.ctx.cards.get(BAMFURLONG)?.questPoints ?? 0;
    const steps: Run["steps"] = [];
    // Printed points are not enough with the Elf-stone's extra one.
    const short = settle(placeProgress(syncConstants(run.state, tab.ctx), location, printed, tab.ctx, steps), tab.ctx, steps);
    expect(short.cards[location]?.zone).toBe("activeLocation");
    const explored = settle(placeProgress(short, location, 1, tab.ctx, steps), tab.ctx, steps);
    expect(explored.cards[location]?.zone).not.toBe("activeLocation");
    expect(explored.window).toEqual({ kind: "response", seat: 0 });
    const stone = idsOf(tab, "141016");
    expect(explored.cards[stone]?.zone).toBe("discard");
    const used = send({ state: explored, steps: [] }, { type: "Trigger", cardId: stone, effectId: "141016:response:1" }, tab.ctx);
    expect(used.state.cards[idsOf(tab, AXEHAND)]?.zone).toBe("play");
  });

  it("is not offered when the location leaves play without being explored", () => {
    const tab = scene();
    const location = idsOf(tab, BAMFURLONG);
    const run = play(tab, begin(tab.state), "141016", { hostId: location });
    const gone = settle(destroyCard(syncConstants(run.state, tab.ctx), location, tab.ctx.cards, []), tab.ctx, []);
    expect(gone.window?.kind).not.toBe("response");
    expect(gone.cards[idsOf(tab, AXEHAND)]?.zone).toBe("hand");
  });

  it("is not offered when the location leaves play with its printed points met but not the stone's extra one (rr.explored)", () => {
    const tab = scene();
    const location = idsOf(tab, BAMFURLONG);
    const run = play(tab, begin(tab.state), "141016", { hostId: location });
    const printed = tab.ctx.cards.get(BAMFURLONG)?.questPoints ?? 0;
    // Short of the Elf-stone's total, then removed by an effect: once the stone is discarded the location would look full.
    const short = settle(placeProgress(syncConstants(run.state, tab.ctx), location, printed, tab.ctx, []), tab.ctx, []);
    expect(short.cards[location]?.zone).toBe("activeLocation");
    const gone = settle(destroyCard(short, location, tab.ctx.cards, []), tab.ctx, []);
    expect(gone.cards[location]?.zone).not.toBe("activeLocation");
    expect(gone.window?.kind).not.toBe("response");
    expect(gone.cards[idsOf(tab, AXEHAND)]?.zone).toBe("hand");
  });
});
