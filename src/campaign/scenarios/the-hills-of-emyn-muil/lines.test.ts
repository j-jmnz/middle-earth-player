// Rules: rr.surge, rr.victory, rr.active-location, rr.travel, rr.blank, rr.cannot, rr.forced, rr.reveal, rr.step-6-4-3, rr.effects, rr.damage, faq.lasting-effects, sotm.emyn-muil-victory-points (data/rules/entries.json); ledger lines 02082:B:1, 02082:B:2, 02083:A:2, 02085:A:1,
// 02086:A:1, 02088:A:1, 02091:A:1, 02093:A:1, 900702:A:2, 900705:A:1, 900707:A:2, 900708:A:2, 900709:A:1.
// What a spec row cannot express on The Hills of Emyn Muil: a negative, a game over several steps, a choice. Each test starts its title with the line id it covers.
import { describe, expect, it } from "vitest";

import type { EngineStep } from "../../../rules/core/intents.ts";
import type { Effect } from "../../../catalog/boundary.ts";
import { allyCard, finish, first, idsOf, legalIntents, resolveRecords, revealFromTop, send, start, tableFromLayout, type Layout } from "../../../../test/harness/scene-kit.ts";
import { modifiedStat } from "../../../rules/core/keywords.ts";
import { updateCard, type ScenarioState } from "../../../rules/core/state.ts";
import { definePrinted } from "../../../rules/core/printed.ts";
import { placeQuestProgress } from "../../../rules/quest/quest.ts";
import { playCost } from "../../../rules/player/attach.ts";
import { reduce } from "../../../rules/engine/reduce.ts";
import { restricted } from "../../../rules/interpret/restrictions.ts";
import { syncConstants } from "../../../rules/interpret/constants.ts";
import { settle } from "../../../rules/engine/machine.ts";
import { offerResponses } from "../../../rules/windows/responses.ts";
import { attachTo, moveCard, spawn } from "../../../rules/core/zones.ts";

const table = (layout: Layout) => tableFromLayout("the-hills-of-emyn-muil", layout);
const zoneOf = (state: ScenarioState, code: string): string | undefined => state.cards[first(state, code)]?.zone;

describe("02082:B:1 the first treachery gains surge while no location is in the staging area", () => {
  const reveal = (made: ReturnType<typeof table>, state: ScenarioState = made.state, code = "treachery") => revealFromTop(state, made.ctx, code, [] as EngineStep[]).state;

  it("02082:B:1 gains surge when no location is in the staging area, so the next card is revealed", () => {
    const made = table({ stage: "02082", phase: "Quest", deck: ["f0"] });
    expect(zoneOf(reveal(made), "f0")).toBe("staging");
  });

  it("02082:B:1 gains no surge while a location is in the staging area", () => {
    const made = table({ stage: "02082", phase: "Quest", staging: ["place"], deck: ["f0"] });
    expect(zoneOf(reveal(made), "f0")).toBe("encounterDeck");
  });

  it("02082:B:1 names only the first treachery of the quest phase: a later one gains no surge, nor one after a first that did not", () => {
    const made = table({ stage: "02082", phase: "Quest", deck: ["f0", "f0"] });
    const once = reveal(made);
    expect(zoneOf(once, "f0")).toBe("staging");
    const twice = reveal(made, once);
    expect(idsOf(twice, "f0").filter((id) => twice.cards[id]?.zone === "encounterDeck")).toHaveLength(1);
    // A first treachery revealed with a location staged gains none; the location leaving does not make the next the first.
    const held = table({ stage: "02082", phase: "Quest", staging: ["place"], deck: ["f0"] });
    const after = reveal(held);
    const gone = moveCard(after, first(after, "place"), { zone: "encounterDiscard" });
    expect(zoneOf(reveal(held, gone), "f0")).toBe("encounterDeck");
  });

  it("02082:B:1 does not apply outside the quest phase", () => {
    const made = table({ stage: "02082", phase: "Planning", deck: ["f0"] });
    expect(zoneOf(reveal(made), "f0")).toBe("encounterDeck");
  });
});

describe("02082:B:2 the stage cannot be defeated before the locations are gone and 20 victory points are held", () => {
  const holds = (layout: Layout): boolean => {
    const made = table({ stage: "02082", ...layout });
    return restricted(syncConstants(made.state, made.ctx), made.ctx, "advance").length > 0;
  };
  const TWENTY = ["02083", "02084", "02083", "02084"];

  it("02082:B:2 holds while an Emyn Muil location is in the staging area or active", () => {
    expect(holds({ staging: ["02085"], victory: TWENTY })).toBe(true);
    expect(holds({ active: "02085", victory: TWENTY })).toBe(true);
  });

  it("02082:B:2 holds with fewer than 20 victory points, whatever else is in play", () => {
    expect(holds({ victory: ["02083", "02084", "02083"] })).toBe(true);
    expect(holds({})).toBe(true);
  });

  it("02082:B:2 lets go once no Emyn Muil location is in play and the display holds 20 victory points; a location in the display or the discard pile is not in play", () => {
    expect(holds({ victory: [...TWENTY, "02085"] })).toBe(false);
    expect(holds({ victory: TWENTY, discard: ["02086"] })).toBe(false);
  });

  it("02082:B:2 keeps the progress placed while it holds, and the stage is defeated once both hold", () => {
    const gate = (made: ReturnType<typeof table>) => (state: ScenarioState) => restricted(state, made.ctx, "advance").length === 0;
    const held = table({ stage: "02082", staging: ["02085"], victory: TWENTY });
    const waiting = placeQuestProgress(syncConstants(held.state, held.ctx), 1, held.cards, [], gate(held));
    expect(waiting.cards[first(waiting, "02082")]?.progress).toBe(1);
    expect(waiting.stageCleared).not.toBe(true);
    const free = table({ stage: "02082", victory: TWENTY });
    expect(placeQuestProgress(syncConstants(free.state, free.ctx), 1, free.cards, [], gate(free)).stageCleared).toBe(true);
  });
});

describe("02083:A:2 Amon Hen bars events", () => {
  const offered = (layout: Layout): boolean => {
    const made = table({ phase: "Planning", hand: ["filler"], ...layout });
    return legalIntents(syncConstants(made.state, made.ctx), made.ctx).some((intent) => intent.type === "PlayCard" && "cardId" in intent && intent.cardId === first(made.state, "filler"));
  };

  it("02083:A:2 bars every event while Amon Hen is the active location, and not while it is in the staging area", () => {
    expect(offered({})).toBe(true);
    expect(offered({ active: "02083" })).toBe(false);
    expect(offered({ staging: ["02083"] })).toBe(true);
  });

  it("02083:A:2 bars the events of every player", () => {
    expect(offered({ seats: 2, active: "02083", hand: [{ code: "filler", seat: 1 }] })).toBe(false);
  });
});

describe("02085:A:1 The East Wall of Rohan taxes non-Rohan allies", () => {
  const costs = (layout: Layout): { ally: number; rohan: number; event: number } => {
    const made = table({ phase: "Planning", hand: ["ally", "event"], ...layout });
    made.cards.set("rohan", allyCard("rohan", 1, { traits: ["Rohan"] }));
    const state = spawn(made.state, "rohan", { zone: "hand", seat: 0 }).state;
    const cost = (code: string) => playCost(state, first(state, code), 0, made.ctx) ?? 0;
    return { ally: cost("ally"), rohan: cost("rohan"), event: cost("event") };
  };

  it("02085:A:1 makes a non-Rohan ally cost 2 more while it is the active location, a Rohan ally and an event nothing", () => {
    expect(costs({})).toEqual({ ally: 1, rohan: 1, event: 1 });
    expect(costs({ active: "02085" })).toEqual({ ally: 3, rohan: 1, event: 1 });
  });

  it("02085:A:1 does not tax while it is in the staging area", () => {
    expect(costs({ staging: ["02085"] }).ally).toBe(1);
  });
});

describe("02086:A:1 The North Stair", () => {
  // The players travel to The North Stair with the cards given on the encounter discard pile, the top one last.
  const travelThere = (layout: Layout) => {
    const made = table({ phase: "Travel", staging: ["02086"], ...layout });
    const run = finish(send(start(made.state), { type: "Travel", locationId: first(made.state, "02086") }, made.ctx), made.ctx);
    return { made, state: run.state };
  };

  it("02086:A:1 moves an enemy from the top of the discard pile to the staging area", () => {
    const { state } = travelThere({ discard: ["f3", "f0"] });
    expect(zoneOf(state, "f0")).toBe("staging");
    expect(zoneOf(state, "f3")).toBe("encounterDiscard");
  });

  it("02086:A:1 moves a location to the staging area", () => {
    expect(zoneOf(travelThere({ discard: ["place"] }).state, "place")).toBe("staging");
  });

  it("02086:A:1 resolves the When Revealed effects of a treachery on top, which then stays in the discard pile and is not added to the staging area", () => {
    const { state } = travelThere({ discard: ["f0", "02092"], committed: ["dh1"] });
    expect(state.cards[first(state, "dh1")]?.damage).toBe(2);
    expect(zoneOf(state, "02092")).toBe("encounterDiscard");
    expect(state.staging).not.toContain(first(state, "02092"));
  });

  it("02086:A:1 gains no surge from the card, and does nothing with an empty discard pile", () => {
    const { state } = travelThere({ discard: ["02091"], deck: ["f0"] });
    expect(zoneOf(state, "f0")).toBe("encounterDeck");
    const empty = travelThere({});
    expect(empty.state.staging).toEqual([first(empty.state, "02086")].filter((id) => empty.state.staging.includes(id)));
  });
});

describe("02088:A:1 Shores of Nen Hithoel", () => {
  const travelThere = (layout: Layout) => {
    const made = table({ phase: "Travel", staging: ["02088"], ...layout });
    return { made, result: reduce(start(made.state).state, { type: "Travel", locationId: first(made.state, "02088") }, made.ctx) };
  };

  it("02088:A:1 has the first player discard an event card from his hand to travel, whichever event he chooses", () => {
    const { made, result } = travelThere({ hand: ["ally", "c2"] });
    expect(result.ok).toBe(true);
    const run = finish({ state: result.ok ? result.state : made.state, steps: [] }, made.ctx);
    expect(zoneOf(run.state, "c2")).toBe("discard");
    expect(zoneOf(run.state, "ally")).toBe("hand");
    expect(run.state.activeLocation).toBe(first(run.state, "02088"));
  });

  it("02088:A:1 bars the trip when the first player holds no event, though another player does", () => {
    expect(travelThere({ hand: ["ally"] }).result.ok).toBe(false);
    expect(travelThere({ seats: 2, hand: [{ code: "filler", seat: 1 }] }).result.ok).toBe(false);
  });

  it("02088:A:1 reads the first player's hand, not the active player's", () => {
    const { made, result } = travelThere({ seats: 2, firstPlayer: 1, hand: [{ code: "filler", seat: 1 }] });
    expect(result.ok).toBe(true);
    const run = finish({ state: result.ok ? result.state : made.state, steps: [] }, made.ctx);
    expect(run.state.cards[first(run.state, "filler")]).toMatchObject({ zone: "discard" });
  });
});

describe("02091:A:1 Impassable Chasm", () => {
  it("02091:A:1 takes all the progress off the active location, which returns to the staging area and is not discarded", () => {
    const made = table({ phase: "Quest", active: "02085", deck: ["f0"] });
    const state = updateCard(made.state, first(made.state, "02085"), { progress: 3 });
    const run = resolveRecords(state, made.ctx, "02091", "whenRevealed");
    const muil = run.state.cards[first(run.state, "02085")];
    expect(muil).toMatchObject({ zone: "staging", progress: 0 });
    expect(run.state.activeLocation ?? null).toBeNull();
    expect(zoneOf(run.state, "f0")).toBe("encounterDeck");
  });

  it("02091:A:1 gains surge when no location moves", () => {
    const made = table({ phase: "Quest", staging: ["place"], deck: ["f0"] });
    expect(zoneOf(revealFromTop(made.state, made.ctx, "02091", []).state, "f0")).toBe("staging");
  });
});

describe("02093:A:1 Slick Footing", () => {
  const SEATS = { seats: 2 as const, deckOf: ["f0", "f0", "f0", "f0"] };
  const slip = (progress: Readonly<Record<string, number>>) => {
    const made = table({ ...SEATS, active: "02085", staging: ["place", "02086"] });
    let state = made.state;
    for (const [code, amount] of Object.entries(progress)) state = updateCard(state, first(state, code), { progress: amount });
    return { made, run: resolveRecords(state, made.ctx, "02093", "whenRevealed") };
  };

  it("02093:A:1 removes 1 progress from each location in play, the active location too, and each player discards that many cards for every token removed in all", () => {
    const { run } = slip({ place: 1, "02085": 2, "02086": 0 });
    expect(run.state.cards[first(run.state, "place")]?.progress).toBe(0);
    expect(run.state.cards[first(run.state, "02085")]?.progress).toBe(1);
    expect(run.state.seats.map((seat) => seat.discard.length)).toEqual([2, 2]);
  });

  it("02093:A:1 discards nothing when no progress was removed", () => {
    const { run } = slip({});
    expect(run.state.seats.map((seat) => seat.discard.length)).toEqual([0, 0]);
  });

  it("02093:A:1 does not take the quest card's progress", () => {
    const made = table({ ...SEATS, stage: "02082", progress: 1 });
    const run = resolveRecords(made.state, made.ctx, "02093", "whenRevealed");
    expect(run.state.cards[first(run.state, "02082")]?.progress).toBe(1);
    expect(run.state.seats.map((seat) => seat.discard.length)).toEqual([0, 0]);
  });
});

describe("900702:A:1 and A:2 Tunneling Nameless Thing", () => {
  it("900702:A:1 moves from another player to the first player after the players travel", () => {
    const made = table({ seats: 2, phase: "Travel", active: "place", engaged: [{ code: "900702", seat: 1 }] });
    const run = resolveRecords(made.state, made.ctx, "900702", "forced", first(made.state, "900702"));
    expect(run.state.cards[first(run.state, "900702")]).toMatchObject({ zone: "engaged", controller: 0 });
  });

  it("900702:A:2 returns to the staging area while no location is active, at any time", () => {
    const made = table({ engaged: ["900702"] });
    const quiet = settle(syncConstants(made.state, made.ctx), made.ctx, []);
    expect(quiet.cards[first(quiet, "900702")]).toMatchObject({ zone: "staging", controller: null });
    const busy = table({ engaged: ["900702"], active: "place" });
    expect(zoneOf(settle(syncConstants(busy.state, busy.ctx), busy.ctx, []), "900702")).toBe("engaged");
  });

  it("900702:A:2 cannot be engaged while no location is active", () => {
    const made = table({ staging: ["900702"] });
    const id = first(made.state, "900702");
    expect(syncConstants(made.state, made.ctx).modifiers.some((modifier) => modifier.instanceId === id && modifier.stat === "cannotBeEngaged")).toBe(true);
    const busy = table({ staging: ["900702"], active: "place" });
    expect(syncConstants(busy.state, busy.ctx).modifiers.some((modifier) => modifier.stat === "cannotBeEngaged")).toBe(false);
  });
});

describe("900705:A:1 Sarn Gebir Rapids", () => {
  // A Response that cancels the When Revealed effects of the card just revealed, on an attachment in play.
  const cancels: Effect = { id: "blade:response:9", cardCode: "blade", lines: ["blade:A:1"], timing: "response", trigger: "whenRevealedPending", instructions: [{ verb: "CancelEffect" }] };
  const offered = (layout: Layout, revealed: string): string[] => {
    const made = table(layout);
    const ctx = { ...made.ctx, effects: [...made.ctx.effects, cancels], cards: new Map([...made.ctx.cards, ["blade", definePrinted({ code: "blade", name: "Blade", type: "attachment" })]]) };
    const blade = spawn(made.state, "blade", { zone: "play", seat: 0 });
    const card = spawn(attachTo(blade.state, blade.id, made.hero), revealed, { zone: "staging" });
    const opened = offerResponses(syncConstants(card.state, ctx), { trigger: "whenRevealedPending", seat: 0, subject: card.id }, ctx, []);
    const top = opened.stack[opened.stack.length - 1];
    return top?.data.kind === "responses" ? top.data.offers.map((offer) => offer.effectId) : [];
  };

  it("900705:A:1 makes the When Revealed effects of Hazard cards uncancelable while it is the active location", () => {
    expect(offered({}, "02091")).toEqual(["blade:response:9"]);
    expect(offered({ active: "900705" }, "02091")).toEqual([]);
    expect(offered({ active: "900705" }, "02093")).toEqual([]);
    expect(offered({ staging: ["900705"] }, "02091")).toEqual(["blade:response:9"]);
  });

  it("900705:A:1 leaves a card without the Hazard trait cancelable, Hazardous Terrain too", () => {
    expect(offered({ active: "900705" }, "900708")).toEqual(["blade:response:9"]);
    expect(offered({ active: "900705" }, "900709")).toEqual(["blade:response:9"]);
  });
});

describe("900707:A:2 and A:3 Blast of Savage Wind", () => {
  // The Threat the card has in this state, the lasting effects read.
  const modifiedThreat = (state: ScenarioState, made: ReturnType<typeof table>, code: string): number => {
    const synced = syncConstants(state, made.ctx);
    return modifiedStat(synced, synced.cards[first(synced, code)]!, "threat", made.cards);
  };
  const threatOf = modifiedThreat;

  it("900707:A:2 removes all the progress from each Emyn Muil location in play, and not from another location", () => {
    const made = table({ active: "02085", staging: ["02086", "place"] });
    let state = made.state;
    for (const code of ["02085", "02086", "place"]) state = updateCard(state, first(state, code), { progress: 2 });
    const run = resolveRecords(state, made.ctx, "900707", "whenRevealed");
    expect(["02085", "02086", "place"].map((code) => run.state.cards[first(run.state, code)]?.progress)).toEqual([0, 0, 2]);
  });

  it("900707:A:2 gives each Emyn Muil location +2 Threat until the end of the round, one that arrives later in the round too", () => {
    const made = table({ staging: ["02086"] });
    const run = resolveRecords(made.state, made.ctx, "900707", "whenRevealed");
    const base = threatOf(made.state, made, "02086");
    expect(threatOf(run.state, made, "02086") - base).toBe(2);
    const late = spawn(run.state, "02089", { zone: "staging" });
    const lateBase = modifiedThreat(spawn(made.state, "02089", { zone: "staging" }).state, made, "02089");
    expect(modifiedThreat(late.state, made, "02089") - lateBase).toBe(2);
    const other = spawn(run.state, "place", { zone: "staging" });
    expect(modifiedThreat(other.state, made, "place")).toBe(made.cards.get("place")?.threat);
    const active = spawn(run.state, "02087", { zone: "activeLocation" });
    expect(modifiedThreat({ ...active.state, activeLocation: active.id }, made, "02087") - (made.cards.get("02087")?.threat ?? 0)).toBe(2);
  });
});

describe("900708:A:2 and A:3 Hazardous Terrain", () => {
  it("900708:A:2 shuffles the Hazard cards of the encounter discard pile back into the encounter deck, and no other card", () => {
    const made = table({ discard: ["02091", "treachery", "02093", "900708"], deck: ["f0"] });
    const run = resolveRecords(made.state, made.ctx, "900708", "whenRevealed");
    const deck = run.state.encounterDeck.map((id) => run.state.cards[id]?.code).sort();
    expect(deck).toEqual(["02091", "02093", "f0"]);
    expect(run.state.encounterDiscard.map((id) => run.state.cards[id]?.code).sort()).toEqual(["900708", "treachery"]);
  });

  it("900708:A:2 changes nothing with no Hazard card in the discard pile", () => {
    const made = table({ discard: ["treachery"], deck: ["f0"] });
    const run = resolveRecords(made.state, made.ctx, "900708", "whenRevealed");
    expect(run.state.encounterDeck.map((id) => run.state.cards[id]?.code)).toEqual(["f0"]);
  });
});

describe("900709:A:1 Retraced Steps", () => {
  it("900709:A:1 discards one Emyn Muil location of the victory display to the encounter discard pile, leaving the rest, and no other card", () => {
    const made = table({ victory: ["02083", "02084", "place"] });
    const run = resolveRecords(made.state, made.ctx, "900709", "whenRevealed");
    const display = run.state.victory.map((id) => run.state.cards[id]?.code).sort();
    expect(display).toHaveLength(2);
    expect(display).toContain("place");
    expect(run.state.encounterDiscard.map((id) => run.state.cards[id]?.code).filter((code) => code === "02083" || code === "02084")).toHaveLength(1);
  });

  it("900709:A:1 does nothing with no Emyn Muil location in the victory display", () => {
    const made = table({ victory: ["place"] });
    const run = resolveRecords(made.state, made.ctx, "900709", "whenRevealed");
    expect(run.state.victory.map((id) => run.state.cards[id]?.code)).toEqual(["place"]);
  });
});
