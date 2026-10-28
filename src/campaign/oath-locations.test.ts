// Rules: rr.travel, rr.active-location, rr.explored, rr.search, rr.cancel, rr.engaged, rr.drawing-cards, rr.first-player, rr.action (data/rules/entries.json). The
// Oath's locations on a table of plain-number heroes (scripts/oath-scene.ts): Travel costs, Responses, the Quest Action of Spider Den and The Eaves of Mirkwood.
import { beforeAll, describe, expect, it } from "vitest";

import type { Effect, Instruction } from "../catalog/boundary.ts";
import { syncConstants } from "../rules/constants.ts";
import { pushEffectFrame } from "../rules/effect-frames.ts";
import type { EngineStep } from "../rules/intents.ts";
import { modifiedStat } from "../rules/keywords.ts";
import { legalIntents, legalTargets } from "../rules/legal.ts";
import { settle } from "../rules/machine.ts";
import { offerResponses } from "../rules/responses.ts";
import type { PlayerIntent, ReduceContext } from "../rules/reduce.ts";
import { flagged, type ScenarioState } from "../rules/state.ts";
import { causeProblems } from "../../scripts/cause-check.ts";
import { codesIn, loadOathWorld, oathTable, settleChoices, travelTo, type OathLayout, type OathWorld } from "../../scripts/oath-scene.ts";
import { first, reveal, send, start, type Run } from "../../scripts/past-scene.ts";

let world: OathWorld;

beforeAll(async () => {
  world = await loadOathWorld();
});

function make(layout: OathLayout = {}) {
  const made = oathTable(world, layout);
  return { ...made, state: syncConstants(made.state, made.ctx) };
}

function frame(state: ScenarioState, instructions: readonly Instruction[], sourceId: string, ctx: ReduceContext, steps: EngineStep[] = []): ScenarioState {
  const pushed = pushEffectFrame(state, { frame: "ResolveEffect", sourceId, actor: 0, peril: false, effectId: "test", instructions, cancel: null, blockCancel: null }, steps);
  return settle({ ...pushed, window: null }, ctx, steps);
}

const offerOf = (state: ScenarioState, ctx: ReduceContext, cardId: string) => legalIntents(state, ctx).find((intent) => intent.type === "Trigger" && intent.cardId === cardId) as PlayerIntent | undefined;

describe("The Eaves of Mirkwood (41010:A:1)", () => {
  it("holds encounterUncancelable while it is the active location, and only then", () => {
    expect(flagged(make({ active: "41010" }).state, "table", "encounterUncancelable")).toBe(true);
    expect(flagged(make({ staging: ["41010"] }).state, "table", "encounterUncancelable")).toBe(false);
  });

  it("offers no Response that cancels a When Revealed effect while it is the active location", () => {
    const layout = { deck: ["41026", "f0"], hand: ["cancel"] } as const;
    const open = make(layout);
    const revealing = reveal(open.state, open.ctx);
    expect(offerOf(revealing.state, open.ctx, first(revealing.state, "cancel"))).toBeDefined();
    const barred = make({ ...layout, active: "41010" });
    const stopped = reveal(barred.state, barred.ctx);
    expect(offerOf(stopped.state, barred.ctx, first(stopped.state, "cancel"))).toBeUndefined();
    // The effect resolved: Obsidian Arrows dealt its 2 damage.
    const settled = settleChoices(stopped, barred.ctx);
    expect(Object.values(settled.state.cards).filter((card) => card.zone === "heroes").reduce((sum, card) => sum + card.damage, 0)).toBe(2);
  });
});

describe("The Eaves of Mirkwood bars only the cancels (41010:A:1, rr.cancel)", () => {
  // "blade" hears the Shadow window with a Response that only raises Defense (Round Shield, 19118:response:1) and one that cancels the effect.
  const shield: Effect = { id: "blade:response:1", cardCode: "blade", lines: ["blade:A:1"], timing: "response", trigger: "shadowPending", cost: { kind: "exhaustSelf" }, instructions: [{ verb: "ModifyStat", stat: "defense", amount: 2, until: "endOfAttack", target: "host" }] };
  const cancels: Effect = { id: "blade:response:2", cardCode: "blade", lines: ["blade:A:2"], timing: "response", trigger: "shadowPending", instructions: [{ verb: "CancelEffect" }] };
  const offeredIn = (layout: OathLayout, trigger: "shadowPending" | "whenRevealedPending") => {
    const made = make({ ...layout, attachments: ["blade"] });
    const ctx = { ...made.ctx, effects: [...made.ctx.effects, shield, cancels, { ...cancels, id: "blade:response:3", trigger: "whenRevealedPending" as const }] };
    const opened = offerResponses(made.state, { trigger, seat: 0 }, ctx, []);
    const top = opened.stack[opened.stack.length - 1];
    return top?.data.kind === "responses" ? top.data.offers.map((offer) => offer.effectId).sort() : [];
  };

  it("offers a Response that does not cancel and not one that does, in the Shadow window", () => {
    expect(offeredIn({}, "shadowPending")).toEqual(["blade:response:1", "blade:response:2"]);
    expect(offeredIn({ active: "41010" }, "shadowPending")).toEqual(["blade:response:1"]);
  });

  it("opens no When Revealed window for a cancel alone, and keeps it for the rest", () => {
    expect(offeredIn({}, "whenRevealedPending")).toEqual(["blade:response:3"]);
    expect(offeredIn({ active: "41010" }, "whenRevealedPending")).toEqual([]);
  });

  it("does not offer the paid cancel of an encounter card's own effect (141077:A:2), and does when The Eaves of Mirkwood is not active", () => {
    const paid = (layout: OathLayout) => {
      const made = make({ ...layout, resources: 1 });
      const pushed = pushEffectFrame(made.state, { frame: "ResolveEffect", sourceId: first(made.state, "41011"), actor: 0, peril: false, effectId: "test", instructions: [], cancel: { amount: 1, sphere: null, unless: null }, blockCancel: null }, []);
      return settle({ ...pushed, window: null }, made.ctx, []).window?.kind;
    };
    expect(paid({ staging: ["41011"] })).toBe("cancelOffer");
    expect(paid({ staging: ["41011"], active: "41010" })).not.toBe("cancelOffer");
  });
});

describe("Tangled Grove (41011:A:1, 41011:A:2)", () => {
  it("has a Threat equal to the number of locations in the staging area", () => {
    const made = make({ staging: ["41011", "place", "place"] });
    expect(modifiedStat(made.state, made.state.cards[first(made.state, "41011")]!, "threat", world.cards)).toBe(3);
    const alone = make({ staging: ["41011"] });
    expect(modifiedStat(alone.state, alone.state.cards[first(alone.state, "41011")]!, "threat", world.cards)).toBe(1);
  });

  it("has each player discard 1 card at random from his hand to travel there, and bars the travel when a player has none", () => {
    const made = make({ seats: 2, staging: ["41011"], phase: "Travel", hand: ["filler", "ally"] });
    const grove = first(made.state, "41011");
    expect(legalTargets(made.state, { type: "Travel" }, made.ctx)).toContain(grove);
    const run = travelTo(made.state, made.ctx, "41011");
    expect(run.state.activeLocation).toBe(grove);
    expect(run.state.seats[0].hand).toHaveLength(1);
    expect(run.state.seats[1].hand).toHaveLength(1);
    expect(run.state.seats[0].discard).toHaveLength(1);
    expect(run.state.seats[1].discard).toHaveLength(1);
    expect(causeProblems(run.steps)).toEqual([]);
    // Seat 1 has no card to discard.
    const empty: ScenarioState = { ...made.state, seats: [made.state.seats[0], { ...made.state.seats[1], hand: [] }] };
    expect(legalTargets(empty, { type: "Travel" }, made.ctx)).not.toContain(grove);
  });
});

describe("Forest Gate (41012:A:1)", () => {
  it("lets the first player draw 2 cards after the players travel there", () => {
    const made = make({ staging: ["41012"], phase: "Travel", deckOf: ["filler", "filler", "filler"] });
    const gate = first(made.state, "41012");
    const run = send(start(made.state), { type: "Travel", locationId: gate }, made.ctx);
    const offer = offerOf(run.state, made.ctx, gate);
    expect(offer).toBeDefined();
    const after = settleChoices(send(run, offer as PlayerIntent, made.ctx), made.ctx);
    expect(after.state.seats[0].hand).toHaveLength(2);
  });
});

describe("Spider Den (41013:A:1)", () => {
  it("lets any player, in the quest phase, search the deck and discard pile for a Spider enemy, put it into play engaged with him and discard Spider Den", () => {
    const made = make({ seats: 2, staging: ["41013"], deck: ["f0", "spider", "f0"], discard: ["spider"] });
    const den = first(made.state, "41013");
    expect(offerOf(made.state, made.ctx, den)).toBeDefined();
    // Seat 0 is the active player in the table's first window.
    const spent = send(start(made.state), offerOf(made.state, made.ctx, den) as PlayerIntent, made.ctx);
    const done = settleChoices(spent, made.ctx);
    const spiders = Object.values(done.state.cards).filter((card) => card.zone === "engaged");
    expect(spiders).toHaveLength(1);
    expect(spiders[0]?.controller).toBe(0);
    expect(done.state.cards[den]?.zone).toBe("encounterDiscard");
    expect(causeProblems(done.steps)).toEqual([]);
  });

  it("is not offered without a Spider in the encounter deck or discard pile, or outside the quest phase", () => {
    const none = make({ staging: ["41013"], deck: ["f0"] });
    expect(offerOf(none.state, none.ctx, first(none.state, "41013"))).toBeUndefined();
    const late = make({ staging: ["41013"], deck: ["spider"], phase: "Combat" });
    expect(offerOf(late.state, late.ctx, first(late.state, "41013"))).toBeUndefined();
  });
});

describe("Goblin Trail (41014:A:1, 41014:A:2)", () => {
  it("has the players reveal the top card of the encounter deck to travel there", () => {
    const made = make({ staging: ["41014"], phase: "Travel", deck: ["f3", "f0"] });
    const run = travelTo(made.state, made.ctx, "41014");
    expect(run.state.activeLocation).toBe(first(made.state, "41014"));
    expect(codesIn(run.state, "staging")).toEqual(["f3"]);
  });

  it("puts 6 progress on the current quest when it leaves play as an explored location (and not when it is merely discarded)", () => {
    const made = make({ stage: "41002", active: "41014" });
    const trail = first(made.state, "41014");
    const explored = frame(made.state, [{ verb: "PlaceProgressOn", amount: 99, target: "activeLocation" }], made.hero, made.ctx);
    expect(explored.window).toMatchObject({ kind: "response" });
    const run: Run = send({ state: explored, steps: [] }, offerOf(explored, made.ctx, trail) as PlayerIntent, made.ctx);
    const after = settleChoices(run, made.ctx);
    expect(after.state.cards[after.state.questStage ?? ""]?.progress).toBe(6);
    const plain = frame(make({ stage: "41002", active: "41014" }).state, [{ verb: "Discard", target: { kind: "activeLocation" } }], made.hero, made.ctx);
    expect(offerOf(plain, made.ctx, trail)).toBeUndefined();
  });
});

describe("Abandoned Camp (41015:A:1, 41015:A:2)", () => {
  it("discards the top card of the encounter deck to travel there, and adds it to the staging area if it is an enemy", () => {
    const enemy = make({ staging: ["41015"], phase: "Travel", deck: ["f3", "f0"] });
    const run = travelTo(enemy.state, enemy.ctx, "41015");
    expect(run.state.activeLocation).toBe(first(enemy.state, "41015"));
    expect(codesIn(run.state, "staging")).toEqual(["f3"]);
    expect(codesIn(run.state, "encounterDiscard")).toEqual([]);
    const location = make({ staging: ["41015"], phase: "Travel", deck: ["place", "f0"] });
    const other = travelTo(location.state, location.ctx, "41015");
    expect(codesIn(other.state, "staging")).toEqual([]);
    expect(codesIn(other.state, "encounterDiscard")).toEqual(["place"]);
  });

  it("has the first player discard the top card of his deck after the players travel there, and put it into play if it is an ally", () => {
    const camp = (deckOf: readonly string[]) => {
      const made = make({ staging: ["41015"], phase: "Travel", deck: ["f0", "f0"], deckOf });
      const id = first(made.state, "41015");
      const traveled = send(start(made.state), { type: "Travel", locationId: id }, made.ctx);
      const offer = offerOf(traveled.state, made.ctx, id);
      expect(offer).toBeDefined();
      return settleChoices(send(traveled, offer as PlayerIntent, made.ctx), made.ctx);
    };
    const ally = camp(["ally", "filler"]);
    expect(codesIn(ally.state, "play")).toContain("ally");
    expect(ally.state.seats[0].deck).toHaveLength(1);
    const event = camp(["filler", "ally"]);
    expect(codesIn(event.state, "play")).not.toContain("filler");
    expect(event.state.seats[0].discard).toHaveLength(1);
  });
});
