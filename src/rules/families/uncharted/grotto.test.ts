// Rules: dcce.grotto-deck, dcce.setup-the-drowned-ruins, rr.explored, rr.travel, rr.active-location, rr.cannot (data/rules/entries.json). The Grotto deck and the double-sided locations whose two sides are two catalog
// cards (ledger lines 12092:A:1, 12092:B:2, 12094:A:1, 12094:A:2, 12098:A:2, 12099:A:1, 12100:A:2, 12105:A:1, 12108:A:1), on the Drowned Ruins' table (test/scenarios/the-drowned-ruins/scene.ts).
import { beforeAll, describe, expect, it } from "vitest";

import { syncConstants } from "../../interpret/constants.ts";
import { runInstruction } from "../../interpret/interpret.ts";
import { modifiedStat } from "../../core/keywords.ts";
import { settle } from "../../engine/machine.ts";
import { hasTrait, holds } from "../../interpret/conditions.ts";
import { attachBlocked } from "../../interpret/restrictions.ts";
import { moveCard } from "../../core/zones.ts";
import type { ScenarioState } from "../../core/state.ts";
import { CODES, finish, idOf, loadRuinsWorld, resolveRecords, ruinsTable, send, start, type RuinsLayout, type RuinsWorld } from "../../../../test/scenarios/the-drowned-ruins/scene.ts";
import { AUTHORED_EFFECTS } from "../../../effects/authored/the-drowned-ruins.ts";
import { dealDoubleSided } from "./deal.ts";
import { isDoubleSided, otherSideOf } from "./grotto.ts";

const SHRINE = { grotto: "12094", underwater: "12095" };
const UNDERSEA = { code: "12098", back: "12101" }; // Undersea Grotto over Dark Abyss
const CAVERNS = { code: "12099", back: "12102" }; // Cursed Caverns over Twisting Hollow
const HALLS = { code: "12100", back: "12103" }; // Water-logged Halls over Sunken Temple

let world: RuinsWorld;

beforeAll(async () => {
  world = await loadRuinsWorld();
});

const deck = (cards: readonly { code: string; back: string }[]) => cards.map((card) => ({ ...card, pile: "grottoDeck" as const }));
const make = (layout: RuinsLayout = {}) => ruinsTable(world, { phase: "Quest", ...layout });
const deckCodes = (state: ScenarioState) => (state.uncharted?.deck ?? []).map((id) => state.cards[id]?.code);
const stagingCodes = (state: ScenarioState) => state.staging.map((id) => state.cards[id]?.code);
// A verb run in the effect frame of the quest card (or of `source`), as its record would.
function run(made: ReturnType<typeof make>, instruction: Parameters<typeof runInstruction>[1], source?: string, state: ScenarioState = made.state) {
  const steps: Parameters<typeof runInstruction>[4] = [];
  const next = runInstruction({ ...state, window: null }, instruction, { seat: 0, sourceId: source ?? state.questStage }, made.ctx, steps);
  return { state: settle(syncConstants(next, made.ctx), made.ctx, steps), steps };
}

describe("the Grotto deck (dcce.grotto-deck)", () => {
  it("deals each Grotto location Grotto side faceup with its own Underwater side behind it, and the set-aside Shrine's pairing", () => {
    const made = make({ doubleSided: [...deck([UNDERSEA, UNDERSEA, CAVERNS]), { code: SHRINE.grotto, back: SHRINE.underwater, pile: "setAside" }], setAside: [SHRINE.grotto] });
    const cards = (made.state.uncharted?.deck ?? []).map((id) => made.state.cards[id]);
    expect(cards.map((card) => [card?.code, card?.other, card?.face])).toEqual([["12098", "12101", "up"], ["12098", "12101", "up"], ["12099", "12102", "up"]]);
    expect(cards.every((card) => card && hasTrait(made.state, card.id, "Grotto", made.ctx) && !hasTrait(made.state, card.id, "Underwater", made.ctx))).toBe(true);
    // The Shrine, dealt apart from the deck, knows its other side, and is a double-sided location; Grotto codes go back to the deck.
    const shrine = made.state.cards[idOf(made.state, SHRINE.grotto)]!;
    expect(otherSideOf(made.state, shrine)).toBe(SHRINE.underwater);
    expect(isDoubleSided(made.state, shrine)).toBe(true);
    expect(made.state.uncharted?.codes).toEqual(expect.arrayContaining(["12098", "12099", SHRINE.grotto]));
  });

  it("deals nothing for a set-aside card that is not a Grotto location, and nothing at all with no pairing", () => {
    const made = make();
    const plain = dealDoubleSided(made.state, [{ code: CODES.captainSahir, back: "11076", pile: "setAside" }], made.ctx);
    expect(plain).toBe(made.state);
    expect(plain.uncharted).toBeUndefined();
  });

  it("prepares the deck by shuffling it (12092:A:1)", () => {
    const pairs = [UNDERSEA, CAVERNS, HALLS, UNDERSEA, CAVERNS, HALLS];
    const made = make({ doubleSided: deck(pairs) });
    const shuffled = run(made, { verb: "PrepareGrottoDeck" }).state;
    expect(deckCodes(shuffled).slice().sort()).toEqual(pairs.map((card) => card.code).sort());
    expect(deckCodes(shuffled)).not.toEqual(deckCodes(made.state));
    // Each card keeps the Underwater side it was dealt with.
    for (const id of shuffled.uncharted?.deck ?? []) expect(pairs.some((pair) => pair.code === shuffled.cards[id]?.code && pair.back === shuffled.cards[id]?.other)).toBe(true);
  });
});

describe("The Grotto, Setup (12092:A:1)", () => {
  const setup = AUTHORED_EFFECTS.find((effect) => effect.id === "12092:setup:1")!;
  const adds = setup.instructions.flatMap((instruction) => (instruction.verb === "AddFromGrottoDeck" ? [instruction] : []));

  it("adds 2 locations Grotto side faceup (3 with 3 or more players) and gives Sahír to the first player and Na'asiyah to the last", () => {
    expect(adds.map((instruction) => instruction.count)).toEqual([2, 3]);
    const made = make({ seats: 2, doubleSided: deck([UNDERSEA, CAVERNS, HALLS]), setAside: [CODES.captainSahir, CODES.naAsiyah] });
    const scope = { actor: 0, sourceId: null, returned: 0 };
    expect(adds[0]?.when && holds(made.state, adds[0].when, scope, made.ctx)).toBe(true);
    expect(adds[1]?.when && holds(made.state, adds[1].when, scope, made.ctx)).toBe(false);
    const done = resolveRecords(made.state, made.ctx, CODES.stage1, "setup", idOf(made.state, CODES.stage1));
    expect(stagingCodes(done.state)).toEqual(["12098", "12099"]);
    expect(done.state.staging.every((id) => done.state.cards[id]?.face === "up" && done.state.cards[id]?.other != null)).toBe(true);
    expect(deckCodes(done.state)).toEqual(["12100"]);
    expect(done.state.cards[idOf(done.state, CODES.captainSahir)]).toMatchObject({ zone: "play", controller: 0 });
    expect(done.state.cards[idOf(done.state, CODES.naAsiyah)]).toMatchObject({ zone: "play", controller: 1 });
  });
});

const stat = (made: ReturnType<typeof make>, state: ScenarioState, id: string, which: "threat" | "questPoints") => modifiedStat(state, state.cards[id]!, which, made.ctx.cards);

describe("flipping a double-sided location (12098:A:2, 12099:A:1, 12100:A:2, 12094:A:2, dcce.grotto-deck)", () => {
  it("shows the Underwater side's Traits and numbers and removes all progress from it", () => {
    const made = make({ sided: [{ ...UNDERSEA, zone: "staging", progress: 2 }] });
    const id = idOf(made.state, UNDERSEA.code);
    expect(stat(made, made.state, id, "threat")).toBe(2);
    const flipped = run(made, { verb: "FlipDoubleSided" }, id);
    expect(flipped.state.cards[id]).toMatchObject({ code: UNDERSEA.back, other: UNDERSEA.code, progress: 0 });
    expect(hasTrait(flipped.state, id, "Underwater", made.ctx)).toBe(true);
    expect(hasTrait(flipped.state, id, "Grotto", made.ctx)).toBe(false);
    expect(stat(made, flipped.state, id, "threat")).toBe(5);
    expect(stat(made, flipped.state, id, "questPoints")).toBe(12);
    expect(flipped.steps).toContainEqual(expect.objectContaining({ kind: "progress", targetId: id, amount: -2 }));
  });

  it("keeps its progress with keepProgress (12094:A:2), and a second flip shows the Grotto side again", () => {
    const made = make({ sided: [{ code: SHRINE.grotto, back: SHRINE.underwater, zone: "activeLocation", progress: 4 }] });
    const id = idOf(made.state, SHRINE.grotto);
    const flipped = run(made, { verb: "FlipDoubleSided", keepProgress: true }, id).state;
    expect(flipped.cards[id]).toMatchObject({ code: SHRINE.underwater, other: SHRINE.grotto, progress: 4 });
    const back = run(made, { verb: "FlipDoubleSided" }, id, flipped).state;
    expect(back.cards[id]).toMatchObject({ code: SHRINE.grotto, other: SHRINE.underwater, progress: 0 });
  });

  it("does nothing to a card with no second side (the quest card, a single-sided location)", () => {
    const made = make({ staging: [CODES.drownedCave] });
    const id = idOf(made.state, CODES.drownedCave);
    expect(run(made, { verb: "FlipDoubleSided" }, id).state.cards[id]?.code).toBe(CODES.drownedCave);
  });

  it("is announced as flipped over", () => {
    const made = make({ sided: [{ ...UNDERSEA, zone: "staging" }] });
    const id = idOf(made.state, UNDERSEA.code);
    const flipped = runInstruction({ ...made.state, window: null }, { verb: "FlipDoubleSided" }, { seat: 0, sourceId: id }, made.ctx, []);
    expect(flipped.pendingEvents).toContainEqual({ trigger: "flippedOver", seat: null, cardId: id });
  });

  it("is refused for the active location while the table holds noFlipActive, but not for a location in the staging area (12105:A:1)", () => {
    const made = make({ sided: [{ ...UNDERSEA, zone: "activeLocation" }, { ...CAVERNS, zone: "staging" }] });
    const [active, staged] = [idOf(made.state, UNDERSEA.code), idOf(made.state, CAVERNS.code)];
    const barred = { ...made.state, modifiers: [...made.state.modifiers, { instanceId: "table", sourceId: "x", stat: "noFlipActive" as const, amount: 1, until: "endOfRound" as const }] };
    expect(run(made, { verb: "FlipDoubleSided" }, active, barred).state.cards[active]?.code).toBe(UNDERSEA.code);
    expect(run(made, { verb: "FlipDoubleSided" }, staged, barred).state.cards[staged]?.code).toBe(CAVERNS.back);
    expect(run(made, { verb: "FlipDoubleSided" }, active).state.cards[active]?.code).toBe(UNDERSEA.back);
  });

  it("is offered as a Response after the players travel to the Grotto location, which may be passed (12098:A:2, 12099:A:1, 12100:A:2)", () => {
    for (const pair of [UNDERSEA, CAVERNS, HALLS]) {
      const made = ruinsTable(world, { phase: "Travel", sided: [{ ...pair, zone: "staging" }] });
      const id = idOf(made.state, pair.code);
      const traveled = send(start(made.state), { type: "Travel", locationId: id }, made.ctx);
      expect(traveled.state.window?.kind).toBe("response");
      const flipped = send(traveled, { type: "Trigger", cardId: id, effectId: `${pair.code}:response:1` }, made.ctx);
      expect(flipped.state.cards[id]?.code).toBe(pair.back);
      expect(flipped.state.activeLocation).toBe(id);
      const passed = send(send(start(made.state), { type: "Travel", locationId: id }, made.ctx), { type: "Pass" }, made.ctx);
      expect(passed.state.cards[id]?.code).toBe(pair.code);
    }
  });
});

describe("Shrine to Morgoth, Grotto side (12094:A:1, 12094:A:2)", () => {
  it("cannot have attachments and cannot enter the staging area", () => {
    const made = make({ sided: [{ code: SHRINE.grotto, back: SHRINE.underwater, zone: "activeLocation" }] });
    const id = idOf(made.state, SHRINE.grotto);
    expect(attachBlocked(made.state, made.ctx, id, CODES.blackKey)).toBe(true);
    expect(attachBlocked(made.state, made.ctx, id, CODES.revenant)).toBe(true);
    // The move to the staging area does not happen: the Shrine stays the active location.
    const moved = moveCard(made.state, id, { zone: "staging" });
    expect(moved.cards[id]?.zone).toBe("activeLocation");
    expect(moved.staging).not.toContain(id);
    // Any other location can be returned to the staging area.
    const other = make({ sided: [{ ...UNDERSEA, zone: "activeLocation" }] });
    expect(moveCard(other.state, idOf(other.state, UNDERSEA.code), { zone: "staging" }).cards[idOf(other.state, UNDERSEA.code)]?.zone).toBe("staging");
  });

  it("flips to its Underwater side at the beginning of the quest phase, keeping its progress tokens", () => {
    const made = make({ sided: [{ code: SHRINE.grotto, back: SHRINE.underwater, zone: "activeLocation", progress: 6 }] });
    const id = idOf(made.state, SHRINE.grotto);
    // The Quest phase begins (the event the engine queues as the phase changes): the Forced effect hears it.
    const begun = settle({ ...made.state, window: null, pendingEvents: [{ trigger: "beginningOfPhase", seat: null, phase: "Quest" }] }, made.ctx, []);
    expect(begun.cards[id]).toMatchObject({ code: SHRINE.underwater, other: SHRINE.grotto, progress: 6 });
    // It is not the Forced effect of any other phase.
    const refresh = settle({ ...made.state, window: null, pendingEvents: [{ trigger: "beginningOfPhase", seat: null, phase: "Refresh" }] }, made.ctx, []);
    expect(refresh.cards[id]?.code).toBe(SHRINE.grotto);
  });
});

describe("Ancient Depths, When Revealed (12108:A:1)", () => {
  it("adds the top Grotto location to the staging area and flips it to its Underwater side, and cannot be canceled", () => {
    const record = AUTHORED_EFFECTS.find((effect) => effect.id === "12108:whenRevealed:1")!;
    expect(record.uncancelable).toBeDefined();
    const made = make({ doubleSided: deck([UNDERSEA, CAVERNS]) });
    const top = made.state.uncharted!.deck[0]!;
    const done = resolveRecords(made.state, made.ctx, CODES.ancientDepths, "whenRevealed");
    expect(done.state.cards[top]).toMatchObject({ zone: "staging", code: UNDERSEA.back, other: UNDERSEA.code });
    expect(deckCodes(done.state)).toEqual([CAVERNS.code]);
    expect(hasTrait(done.state, top, "Underwater", made.ctx)).toBe(true);
  });
});

describe("The Grotto, side B: after a double-sided location is explored (12092:B:2, dcce.grotto-deck)", () => {
  const explore = (made: ReturnType<typeof make>, id: string) => {
    const next = runInstruction({ ...made.state, window: null }, { verb: "ProgressQuest", amount: stat(made, made.state, id, "questPoints") }, { seat: 0, sourceId: made.state.questStage }, made.ctx, []);
    return finish(start(settle(syncConstants(next, made.ctx), made.ctx, [])), made.ctx);
  };

  it("shuffles an explored Grotto side back into the deck, Grotto side up, and adds the next top location to the staging area", () => {
    const made = make({ doubleSided: deck([CAVERNS, HALLS]), sided: [{ ...UNDERSEA, zone: "activeLocation" }] });
    const id = idOf(made.state, UNDERSEA.code);
    const explored = explore(made, id);
    expect(explored.state.victory).not.toContain(id);
    expect(explored.state.cards[id]).toMatchObject({ zone: "unchartedDeck", code: UNDERSEA.code, other: UNDERSEA.back, face: "up", progress: 0 });
    expect(explored.state.encounterDiscard).not.toContain(id);
    // The record added the top of the deck as it stood: one of the two that were there, the explored card having joined the bottom.
    expect(stagingCodes(explored.state)).toHaveLength(1);
    expect(["12099", "12100"]).toContain(stagingCodes(explored.state)[0]);
    expect(explored.state.uncharted?.deck).toHaveLength(2);
  });

  it("places an explored Underwater side in the victory display, where it counts as Underwater, and adds the next top location", () => {
    const made = make({ doubleSided: deck([CAVERNS]), sided: [{ ...UNDERSEA, zone: "activeLocation" }] });
    const id = idOf(made.state, UNDERSEA.code);
    const flipped = { ...made, state: run(made, { verb: "FlipDoubleSided" }, id).state };
    const explored = explore(flipped, id);
    expect(explored.state.victory).toContain(id);
    expect(explored.state.cards[id]?.code).toBe(UNDERSEA.back);
    expect(stagingCodes(explored.state)).toEqual([CAVERNS.code]);
  });

  it("does not answer the exploration of a location that is not double-sided", () => {
    const made = make({ doubleSided: deck([CAVERNS]), staging: [CODES.drownedCave] });
    const id = idOf(made.state, CODES.drownedCave);
    const active = { ...made, state: { ...moveCard(made.state, id, { zone: "activeLocation" }) } };
    const explored = explore(active, id);
    expect(stagingCodes(explored.state)).not.toContain(CAVERNS.code);
  });
});

describe("Powerful Undertow, When Revealed (12105:A:1)", () => {
  it("bars flipping the active location this round and resolves an Underwater active location's Forced effect as the end of the quest phase", () => {
    // Drowned Cave is an Underwater location whose Forced effect (12104:A:2) is for the end of the quest phase: each player discards the top 10 cards of their deck. The table is in the Refresh phase.
    const cards = Array.from({ length: 12 }, (_, at) => `c${at % 4}`);
    const made = make({ phase: "Refresh", active: CODES.drownedCave, deckOf: cards, staging: [CODES.drownedCave] });
    const cave = made.state.activeLocation!;
    const done = resolveRecords(made.state, made.ctx, CODES.powerfulUndertow, "whenRevealed");
    expect(done.state.seats[0]?.deck).toHaveLength(2);
    expect(done.state.cards[cave]?.code).toBe(CODES.drownedCave);
    expect(done.state.modifiers.some((modifier) => modifier.stat === "noFlipActive" && modifier.instanceId === "table" && modifier.until === "endOfRound")).toBe(true);
    // The copy of Drowned Cave in the staging area did not hear it (the decks lost 10 cards once, not twice), and with no Underwater active location nothing resolves.
    const none = resolveRecords(make({ phase: "Refresh", deckOf: cards, staging: [CODES.drownedCave] }).state, made.ctx, CODES.powerfulUndertow, "whenRevealed");
    expect(none.state.seats[0]?.deck).toHaveLength(12);
  });

  it("bars the flip of the active location for the round it is revealed in", () => {
    const made = make({ sided: [{ ...UNDERSEA, zone: "activeLocation" }] });
    const id = idOf(made.state, UNDERSEA.code);
    const done = resolveRecords(made.state, made.ctx, CODES.powerfulUndertow, "whenRevealed");
    expect(run(made, { verb: "FlipDoubleSided" }, id, done.state).state.cards[id]?.code).toBe(UNDERSEA.code);
  });

  it("gains Doomed 3 instead when no Underwater location is active", () => {
    const made = make({ sided: [{ ...UNDERSEA, zone: "activeLocation" }], threat: [28, 28] });
    const done = resolveRecords(made.state, made.ctx, CODES.powerfulUndertow, "whenRevealed");
    expect(done.state.seats[0]?.threat).toBe(31);
    expect(done.state.cards[idOf(done.state, UNDERSEA.code)]?.code).toBe(UNDERSEA.code);
  });
});

describe("ResolveActiveForced (12105:A:1)", () => {
  it("queues the end of the phase for the active location only", () => {
    const made = make({ sided: [{ ...UNDERSEA, zone: "activeLocation" }, { ...CAVERNS, zone: "staging" }] });
    const queued = runInstruction({ ...made.state, window: null }, { verb: "ResolveActiveForced", phase: "Quest" }, { seat: 0, sourceId: null }, made.ctx, []);
    expect(queued.pendingEvents).toEqual([{ trigger: "endOfPhase", seat: null, phase: "Quest", cardId: idOf(made.state, UNDERSEA.code) }]);
    expect(runInstruction({ ...make().state, window: null }, { verb: "ResolveActiveForced", phase: "Quest" }, { seat: 0, sourceId: null }, made.ctx, []).pendingEvents).toBeUndefined();
  });
});
