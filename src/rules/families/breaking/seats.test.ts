// Rules: mec109.multiple-staging-areas, mec109.peril, rr.player-elimination, rr.step-3-4, rr.active-location (data/rules/entries.json). The seat-aware reads
// of the engine while stages are separate: the extra reveals of stage 4B, a count per living player, an attachment's hosts, a Peril card's Responses, a view merged
// back, the first player lock and the slots a card takes.
import { beforeAll, describe, expect, it } from "vitest";

import { definePrinted } from "../../printed.ts";
import { refCard } from "../../amounts.ts";
import { attachmentHostIds } from "../../attach.ts";
import { holds } from "../../conditions.ts";
import { failQuest } from "../../quest.ts";
import { offerResponses } from "../../responses.ts";
import { flagged, updateCard, withSeat } from "../../state.ts";
import { syncConstants } from "../../constants.ts";
import { moveCard } from "../../zones.ts";
import { activeOf, mergeView, stageOf, viewOf } from "./areas.ts";
import { revealSeat } from "../encounter/reveal.ts";
import { FRODOS_CHOICE, fire, loadBreakingWorld, makeBreaking, type BreakingLayout, type BreakingWorld } from "../../../../scripts/breaking-scene.ts";
import { first } from "../../../../scripts/past-scene.ts";

let world: BreakingWorld;

beforeAll(async () => {
  world = await loadBreakingWorld();
  world.cards.set("141016", definePrinted({ code: "141016", name: "Elf-stone", type: "attachment", sphere: "lore", cost: 1 }));
}, 60_000);

const heroes = [["strong"], ["weak"]] as const;
const make = (layout: BreakingLayout = {}) => makeBreaking(world, { seats: 2, stage: "separate", frodo: false, heroes, threats: [30, 30], ...layout });

describe("the extra reveals of stage 4B (142067:B:1)", () => {
  it("go to the seat on 4B alone while stages are separate, and to the seats in turn otherwise", () => {
    const table = make({ stages: ["142067", "142063"] });
    expect([0, 1, 2, 3].map((index) => revealSeat(table.state, index, [0, 1]))).toEqual([0, 1, 0, 0]);
    // Seat 1 on 4B: the extras are its own.
    const other = make({ stages: ["142063", "142067"] });
    expect([0, 1, 2, 3].map((index) => revealSeat(other.state, index, [0, 1]))).toEqual([0, 1, 1, 1]);
    // Not separate: the seats in turn.
    const { separate: _separate, ...shared } = table.state;
    expect([0, 1, 2, 3].map((index) => revealSeat(shared, index, [0, 1]))).toEqual([0, 1, 0, 1]);
  });
});

describe("a count per player", () => {
  it("counts the living seats (rr.player-elimination)", () => {
    const table = make({ staging: ["place"] });
    const place = first(table.state, "place");
    const state = updateCard(table.state, place, { resources: 3 });
    const condition = { kind: "tokens", code: "place", min: 3, perPlayer: true } as const;
    const scope = { actor: 0, sourceId: null, returned: 0 };
    expect(holds(state, condition, scope, table.ctx)).toBe(false);
    const alone = withSeat(state, 1, { ...state.seats[1], eliminated: true });
    expect(holds(alone, condition, scope, table.ctx)).toBe(true);
  });
});

describe("an attachment's hosts while stages are separate", () => {
  it("Elf-stone (141016) goes on the playing seat's own active location", () => {
    const table = make({ active: ["place", "place"] });
    const [one, two] = [table.state.seats[0].active ?? "", table.state.seats[1].active ?? ""];
    expect(one).not.toBe("");
    expect(two).not.toBe(one);
    expect(attachmentHostIds(table.state, 0, "141016", table.ctx)).toEqual([one]);
    expect(attachmentHostIds(table.state, 1, "141016", table.ctx)).toEqual([two]);
    expect(activeOf(viewOf(table.state, 1), 1)).toBe(two);
  });

  it("the active location a reference names is the acting seat's", () => {
    const table = make({ active: ["place", "place"] });
    const [one, two] = [table.state.seats[0].active ?? "", table.state.seats[1].active ?? ""];
    expect(refCard(table.state, "activeLocation", { actor: 0, sourceId: null })).toBe(one);
    expect(refCard(table.state, "activeLocation", { actor: 1, sourceId: null })).toBe(two);
  });
});

describe("a Response while a Peril card's staging resolves (mec109.peril)", () => {
  it("is offered to the revealing seat alone, though any player may trigger it", () => {
    const table = make({ stages: ["142067", "142063"], staging: ["grunt"] });
    const grunt = first(table.state, "grunt");
    const event = { trigger: "revealed", seat: 0, cardId: grunt, fromDeck: true } as const;
    const seats = (peril: number | null) => {
      const offered = offerResponses({ ...table.state, perilSeat: peril, window: null }, event, table.ctx, []);
      const data = offered.stack[offered.stack.length - 1]?.data;
      return data?.kind === "responses" ? data.offers.map((offer) => offer.seat) : [];
    };
    expect(seats(null)).toEqual([0, 1]);
    expect(seats(0)).toEqual([0]);
  });
});

describe("failQuest", () => {
  it("raises the threat of the seats named, or of every living seat", () => {
    const table = make();
    const some = failQuest(table.state, 4, [], [1]);
    expect(some.seats.map((seat) => seat.threat)).toEqual([30, 34]);
    const all = failQuest(table.state, 4, []);
    expect(all.seats.map((seat) => seat.threat)).toEqual([34, 34]);
  });
});

describe("Frodo's Choice (142068:A:2)", () => {
  it("locks the first player token for the rest of the game, whatever happens to the card", () => {
    const table = make({ areas: [[], [FRODOS_CHOICE]] });
    const choice = first(table.state, FRODOS_CHOICE);
    const locked = fire(table, table.state, choice, "142068:whenRevealed:1", [], "whenRevealed", 1);
    expect(flagged(locked, "table", "firstPlayerLocked")).toBe(true);
    const gone = syncConstants(moveCard(locked, choice, { zone: "encounterDiscard" }), table.ctx);
    expect(flagged(gone, "table", "firstPlayerLocked")).toBe(true);
  });
});

describe("a view merged back", () => {
  it("leaves a card another seat's area took in that area alone", () => {
    const table = make({ areas: [[], []], staging: ["grunt"] });
    const grunt = first(table.state, "grunt");
    // Seat 0's view puts the card into seat 1's area.
    const view = viewOf(table.state, 0);
    const moved = moveCard(view, grunt, { zone: "staging", area: 1 });
    const merged = mergeView(table.state, 0, moved);
    expect(merged.seats[0].staging).not.toContain(grunt);
    expect(merged.seats[1].staging).toEqual([grunt]);
    expect(merged.staging.filter((id) => id === grunt)).toHaveLength(1);
  });

  it("returns an enemy engaged with another seat to that seat's area only", () => {
    const table = make({ engaged: [{ code: "grunt", seat: 1 }] });
    const grunt = first(table.state, "grunt");
    const merged = mergeView(table.state, 0, moveCard(viewOf(table.state, 0), grunt, { zone: "staging" }));
    expect(merged.seats[0].staging).toEqual([]);
    expect(merged.seats[1].staging).toEqual([grunt]);
    expect(merged.staging).toEqual([grunt]);
  });
});

describe("a card that becomes a seat's active location or stage", () => {
  it("is that seat's, and the shared slots mirror it", () => {
    const table = make({ staging: ["place"] });
    const place = first(table.state, "place");
    const active = moveCard(table.state, place, { zone: "activeLocation", seat: 1 });
    expect(active.seats[1].active).toBe(place);
    expect(active.secondActiveLocation).toBe(place);
    expect(active.activeLocation).toBeNull();
    expect(active.staging).not.toContain(place);
    const stage = first(table.state, "142064");
    const staged = moveCard(table.state, stage, { zone: "questStage", seat: 1 });
    expect(staged.seats[1].stage).toBe(stage);
    expect(staged.questStage).toBeNull();
  });
});

describe("a stage the view reads", () => {
  it("is the view's own while it is open", () => {
    const table = make({ stages: ["142067", "142063"] });
    const view = viewOf(table.state, 0);
    expect(stageOf(view, 0)).toBe(table.state.seats[0].stage);
    expect(stageOf(view, 1)).toBe(table.state.seats[1].stage);
  });
});
