// Rules: rr.response, rr.cancel, rr.reveal, rr.staging-area, rr.step-6-8-2, rr.active-location, rr.travel,
// rr.removed-from-game, rr.ownership-and-control, rr.play-and-put-into-play, rr.attachment-cards (data/rules/entries.json).
// The core-set Learn to Play Spirit deck (core-spirit), brought into scope on request (user request, 2026-10-26): Eleanor,
// Dúnhere, Lórien Guide, Strength of Will, Will of the West, A Light in the Dark, Fortune or Fate, The Favor of the Lady and
// Power in the Earth.
import { beforeAll, describe, expect, it } from "vitest";

import { syncConstants } from "../rules/constants.ts";
import { modifiedStat } from "../rules/keywords.ts";
import { stagingThreat } from "../rules/quest.ts";
import { legalIntents, legalTargets } from "../rules/reduce.ts";
import { updateCard, withMode, type ScenarioState } from "../rules/state.ts";
import { spawn } from "../rules/zones.ts";
import { fund, payFor, refusal, starterBase } from "../../scripts/starter-scene.ts";
import { loadPrinted } from "../../scripts/test-catalog.ts";
import { begin, buildTable, idsOf, send, type Run, type Scene, type Table } from "../../scripts/test-scene.ts";

const EOWYN = "01007";
const ELEANOR = "01008";
const DUNHERE = "01009";
const GUIDE = "01044";
const STRENGTH = "01047";
const WILL = "01049";
const LIGHT = "01052";
const FORTUNE = "01054";
const FAVOR = "01055";
const EARTH = "01056";
const LURE = "141076";
const BAG_END = "141031";
const STOCK_BROOK = "141033";
const AXEHAND = "01028";

let base: Awaited<ReturnType<typeof starterBase>>;

beforeAll(async () => {
  const starter = await starterBase();
  base = { ...starter, cards: new Map([...starter.cards, ...(await loadPrinted([ELEANOR, DUNHERE, GUIDE, STRENGTH, WILL, LIGHT, FORTUNE, FAVOR, EARTH]))]) };
});

function table(scene: Scene = {}, resources = 6): Table {
  const tab = buildTable(base, { ring: "none", start: "planning", ...scene });
  let state = tab.state;
  for (let seat = 0; seat < (scene.seats ?? 1); seat += 1) state = fund(state, seat, resources);
  return { ...tab, state: syncConstants(state, tab.ctx) };
}

function offered(state: ScenarioState, tab: Table): string[] {
  return legalIntents(state, tab.ctx).flatMap((intent) => (intent.type === "Trigger" ? [intent.effectId] : []));
}

function play(tab: Table, code: string, run: Run = begin(tab.state), hostId?: string): Run {
  const card = idsOf(tab, code);
  return send(run, { type: "PlayCard", cardId: card, payments: payFor(run.state, tab.ctx, card), ...(hostId ? { hostId } : {}) }, tab.ctx);
}

const attacking = (state: ScenarioState): ScenarioState => ({ ...withMode(state, "playerAttacks"), window: { kind: "playerAttack" }, activeSeat: 0 });

describe("Eleanor (01008:A:1)", () => {
  it("cancels the when revealed effects of a treachery just revealed, which is discarded and replaced by the next card", () => {
    const tab = table({ start: "quest", heroes: [{ code: ELEANOR, seat: 0 }, { code: EOWYN, seat: 0 }], deck: [LURE, "f3", "f0", "f0"] });
    const eleanor = idsOf(tab, ELEANOR);
    let run = send(begin(tab.state), { type: "Pass" }, tab.ctx);
    expect(offered(run.state, tab)).toEqual(["01008:response:1"]);
    run = send(run, { type: "Trigger", cardId: eleanor, effectId: "01008:response:1" }, tab.ctx);
    expect(run.state.cards[eleanor]?.exhausted).toBe(true);
    // Lure of the Ring's effect never raised the threat. It is in the discard pile; the next card was revealed in its place,
    // and Lure's Surge (a keyword, not a "when revealed" effect) still revealed one more.
    expect(run.steps.some((step) => step.kind === "threat" && "effect" in step.cause && step.cause.effect.startsWith(LURE))).toBe(false);
    expect(run.state.cards[idsOf(tab, LURE)]?.zone).toBe("encounterDiscard");
    expect(run.state.cards[idsOf(tab, "f3")]?.zone).toBe("staging");
    expect(run.state.cards[idsOf(tab, "f0")]?.zone).toBe("staging");
    expect(run.state.cards[tab.ids["f0"]?.[1] ?? ""]?.zone).toBe("encounterDeck");
    expect(run.steps.filter((step) => step.kind === "reveal")).toHaveLength(3);
  });

  it("is not offered against the when revealed effects of a card that is not a treachery", () => {
    const tab = table({ start: "quest", heroes: [{ code: ELEANOR, seat: 0 }, { code: EOWYN, seat: 0 }], deck: [STOCK_BROOK, "f0"] });
    const run = send(begin(tab.state), { type: "Pass" }, tab.ctx);
    expect(offered(run.state, tab)).not.toContain("01008:response:1");
  });
});

describe("Dúnhere (01009:A:1)", () => {
  it("attacks an enemy in the staging area alone, with +1 Attack", () => {
    const tab = table({ heroes: [{ code: DUNHERE, seat: 0 }, { code: ELEANOR, seat: 0 }], staging: ["f3"] });
    const dunhere = idsOf(tab, DUNHERE);
    const enemy = idsOf(tab, "f3");
    const state = attacking(tab.state);
    expect(legalTargets(state, { type: "DeclareAttackers", cardId: dunhere }, tab.ctx)).toEqual([enemy]);
    expect(legalTargets(state, { type: "DeclareAttackers", cardId: idsOf(tab, ELEANOR) }, tab.ctx)).toEqual([]);
    expect(refusal(state, { type: "DeclareAttackers", enemyId: enemy, attackerIds: [dunhere, idsOf(tab, ELEANOR)] }, tab.ctx)).toBe("That character attacks the staging area only alone");
    const run = send(begin(state), { type: "DeclareAttackers", enemyId: enemy, attackerIds: [dunhere] }, tab.ctx);
    // Attack 2 + 1 against Defense 1.
    expect(run.state.cards[enemy]?.damage).toBe(2);
    expect(run.state.cards[enemy]?.zone).toBe("staging");
  });
});

describe("Lórien Guide (01044:A:1)", () => {
  it("after he commits to a quest, places 1 progress on the active location", () => {
    const tab = table({ start: "quest", heroes: [{ code: ELEANOR, seat: 0 }], allies: [{ code: GUIDE, seat: 0 }], active: BAG_END });
    let run = send(begin(tab.state), { type: "Commit", cardIds: [idsOf(tab, GUIDE)] }, tab.ctx);
    expect(offered(run.state, tab)).toEqual(["01044:response:1"]);
    run = send(run, { type: "Trigger", cardId: idsOf(tab, GUIDE), effectId: "01044:response:1" }, tab.ctx);
    expect(run.state.cards[idsOf(tab, BAG_END)]?.progress).toBe(1);
  });

  it("is not offered with no active location", () => {
    const tab = table({ start: "quest", heroes: [{ code: ELEANOR, seat: 0 }], allies: [{ code: GUIDE, seat: 0 }] });
    const run = send(begin(tab.state), { type: "Commit", cardIds: [idsOf(tab, GUIDE)] }, tab.ctx);
    expect(offered(run.state, tab)).toEqual([]);
  });
});

describe("Strength of Will (01047:A:1)", () => {
  it("after you travel to a location, exhausts a Spirit character to place 2 progress on it", () => {
    // An engaged enemy keeps the round from reaching the refresh phase, which would ready Eleanor again.
    const tab = table({ start: "travel", heroes: [{ code: ELEANOR, seat: 0 }, { code: AXEHAND, seat: 0 }], staging: [BAG_END], hand: [{ code: STRENGTH, seat: 0 }], engaged: [{ code: "f3", seat: 0 }] });
    const event = idsOf(tab, STRENGTH);
    let run = send(begin(tab.state), { type: "Travel", locationId: idsOf(tab, BAG_END) }, tab.ctx);
    expect(offered(run.state, tab)).toEqual(["01047:response:1"]);
    run = send(run, { type: "Trigger", cardId: event, effectId: "01047:response:1", payments: payFor(run.state, tab.ctx, event) }, tab.ctx);
    expect(run.state.cards[idsOf(tab, ELEANOR)]?.exhausted).toBe(true);
    expect(run.state.cards[idsOf(tab, BAG_END)]?.progress).toBe(2);
    expect(run.state.cards[event]?.zone).toBe("discard");
  });

  it("is not offered without a ready Spirit character", () => {
    const tab = table({ start: "travel", heroes: [{ code: ELEANOR, seat: 0 }], staging: [BAG_END], hand: [{ code: STRENGTH, seat: 0 }] });
    const state = updateCard(tab.state, idsOf(tab, ELEANOR), { exhausted: true });
    const run = send(begin(state), { type: "Travel", locationId: idsOf(tab, BAG_END) }, tab.ctx);
    expect(offered(run.state, tab)).toEqual([]);
  });
});

describe("Will of the West (01049:A:1)", () => {
  it("shuffles the chosen player's discard pile into their deck and is removed from the game", () => {
    const tab = table({ heroes: [{ code: ELEANOR, seat: 0 }], hand: [{ code: WILL, seat: 0 }], playerDeck: [{ code: AXEHAND, seat: 0 }] });
    let state = tab.state;
    const discarded: string[] = [];
    for (let count = 0; count < 3; count += 1) {
      const spawned = spawn(state, AXEHAND, { zone: "discard", seat: 0 });
      state = spawned.state;
      discarded.push(spawned.id);
    }
    const run = play({ ...tab, state }, WILL, begin(state));
    expect(run.state.seats[0]?.discard).toEqual([]);
    expect([...(run.state.seats[0]?.deck ?? [])].sort()).toEqual([idsOf(tab, AXEHAND), ...discarded].sort());
    expect(run.state.cards[idsOf(tab, WILL)]?.zone).toBe("removed");
  });
});

describe("A Light in the Dark (01052:A:1)", () => {
  it("returns an enemy engaged with a player to the staging area", () => {
    const tab = table({ heroes: [{ code: ELEANOR, seat: 0 }], hand: [{ code: LIGHT, seat: 0 }], engaged: [{ code: "f3", seat: 0 }] });
    const run = play(tab, LIGHT);
    expect(run.state.cards[idsOf(tab, "f3")]?.zone).toBe("staging");
    expect(run.state.seats[0]?.engaged).toEqual([]);
  });

  it("cannot be played with no enemy engaged", () => {
    const tab = table({ heroes: [{ code: ELEANOR, seat: 0 }], hand: [{ code: LIGHT, seat: 0 }], staging: ["f3"] });
    expect(refusal(tab.state, { type: "PlayCard", cardId: idsOf(tab, LIGHT), payments: payFor(tab.state, tab.ctx, idsOf(tab, LIGHT)) }, tab.ctx)).toBe("That card has no legal target");
  });
});

describe("Fortune or Fate (01054:A:1)", () => {
  it("puts a hero from a discard pile into play under its owner's control", () => {
    const tab = table({ seats: 2, heroes: [{ code: ELEANOR, seat: 0 }, { code: EOWYN, seat: 1 }], hand: [{ code: FORTUNE, seat: 0 }] });
    const spawned = spawn(tab.state, DUNHERE, { zone: "discard", seat: 1 });
    const run = play({ ...tab, state: spawned.state }, FORTUNE, begin(spawned.state));
    expect(run.state.cards[spawned.id]?.zone).toBe("heroes");
    expect(run.state.cards[spawned.id]?.controller).toBe(1);
    expect(run.state.seats[1]?.heroes).toContain(spawned.id);
  });
});

describe("The Favor of the Lady (01055) and Power in the Earth (01056), from the templates", () => {
  it("The Favor of the Lady gives the attached hero +1 Willpower", () => {
    const tab = table({ heroes: [{ code: ELEANOR, seat: 0 }], attached: [{ code: FAVOR, host: ELEANOR }] });
    expect(modifiedStat(tab.state, tab.state.cards[idsOf(tab, ELEANOR)]!, "willpower", tab.ctx.cards)).toBe(2);
  });

  it("Power in the Earth attaches to a location in the staging area and gives it -1 Threat", () => {
    const tab = table({ heroes: [{ code: ELEANOR, seat: 0 }], staging: [STOCK_BROOK], hand: [{ code: EARTH, seat: 0 }] });
    const location = idsOf(tab, STOCK_BROOK);
    expect(legalTargets(tab.state, { type: "PlayCard", cardId: idsOf(tab, EARTH) }, tab.ctx)).toEqual([location]);
    const before = stagingThreat(tab.state, tab.ctx.cards);
    const run = play(tab, EARTH, begin(tab.state), location);
    expect(run.state.cards[idsOf(tab, EARTH)]?.host).toBe(location);
    expect(stagingThreat(syncConstants(run.state, tab.ctx), tab.ctx.cards)).toBe(before - 1);
  });
});
