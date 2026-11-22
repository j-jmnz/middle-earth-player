// Rules: rr.resource-phase, rr.step-1-3, rr.step-0-1, rr.resource-match, rr.deckbuilding, rr.attachment-cards, rr.restricted, rr.action, rr.limits,
// rr.lasting-effects, bts.valour, rr.cannot, rr.enters-play, rr.response (data/rules/entries.json).
// The Treachery of Rhudaur heroes, allies, events and side quest, written from their card text (data/cards/ToR.json; data/printed holds no ledger
// for this box yet): Erestor 10084:A:1 and A:2, Reinforcements 10085:A:1, Send for Aid 10086:A:1, Horn's Cry 10088:A:1 and A:2, Galadhrim Weaver
// 10089:A:1 and A:2, Galdor of the Havens 10091:A:1. The attachments are in the-treachery-of-rhudaur-attachments.test.ts; Galdor's tests use
// the Elven Spear's Action to discard a card.
import { readFileSync } from "node:fs";

import { beforeAll, describe, expect, it } from "vitest";

import type { Effect } from "../../catalog/boundary.ts";
import { deckSaveRefusal, type DeckSaveCard } from "../../catalog/deck-save.ts";
import { EFFECTS } from "../../effects/index.ts";
import { definePrinted } from "../../rules/core/printed.ts";
import { withMode, withThreat, type ScenarioState } from "../../rules/core/state.ts";
import { attachTo, spawn } from "../../rules/core/zones.ts";
import { settle } from "../../rules/engine/machine.ts";
import { syncConstants } from "../../rules/interpret/constants.ts";
import { payFor, refusal, starterBase } from "../../../test/scenarios/a-shadow-of-the-past/starter-scene.ts";
import { loadPrinted } from "../../../test/harness/catalog.ts";
import { lineSpec } from "../../../test/harness/line-spec.ts";
import { begin, idsOf, type Run, type Scene, type Table } from "../../../test/harness/scene.ts";
import { attacking, choices, combat, playerTable, sendUnledgered, stat, triggers } from "../../../test/harness/player-table.ts";

const ERESTOR = "10084";
const REINFORCEMENTS = "10085";
const SEND_FOR_AID = "10086";
const SPEAR = "10087";
const HORN = "10088";
const WEAVER = "10089";
const GALDOR = "10091";
// Core heroes: Aragorn, Théodred and Glóin (Leadership), Legolas (Tactics, Silvan), Éowyn (Spirit, Rohan).
const ARAGORN = "01001";
const THEODRED = "01002";
const GLOIN = "01003";
const LEGOLAS = "01005";
const EOWYN = "01007";
const WEAK = "weak";
const PAL = "pal";
const CARD = "card";

let base: Awaited<ReturnType<typeof starterBase>>;

const table = (effects: readonly Effect[], scene: Scene = {}, resources = 6): Table => playerTable(base, effects, scene, resources);

beforeAll(async () => {
  const starter = await starterBase();
  const cards = new Map([...starter.cards, ...(await loadPrinted([ERESTOR, REINFORCEMENTS, SEND_FOR_AID, SPEAR, HORN, WEAVER, GALDOR, ARAGORN, THEODRED, GLOIN, LEGOLAS, EOWYN]))]);
  cards.set(WEAK, definePrinted({ code: WEAK, name: "Weak", type: "enemy", threat: 1, engagementCost: 40, attack: 3, defense: 0, health: 9 }));
  base = { ...starter, cards };
});

// A deck of `count` filler cards for a seat.
const fillers = (count: number, seat = 0) => Array.from({ length: count }, () => ({ code: CARD, seat }));

// The engine moves on to `mode` (its phase begins) and runs to its next window.
function enter(state: ScenarioState, tab: Table, mode: Parameters<typeof withMode>[1]): Run {
  return begin(settle({ ...withMode(state, mode), window: null }, tab.ctx, []));
}

function play(tab: Table, code: string, run: Run = begin(tab.state)): Run {
  const card = tab.ids[code]?.find((id) => run.state.cards[id]?.zone === "hand") ?? idsOf(tab, code);
  return sendUnledgered(run, { type: "PlayCard", cardId: card, payments: payFor(run.state, tab.ctx, card) }, tab.ctx);
}

// Attaches cards the scene put in play to the hosts named, then brings the constants up to date.
function attach(tab: Table, pairs: readonly (readonly [string, string])[]): Table {
  let state = tab.state;
  for (const [id, host] of pairs) state = attachTo(state, id, host);
  return { ...tab, state: syncConstants(state, tab.ctx) };
}

// Puts cards on a seat's discard pile, the last one on top.
function discarded(tab: Table, codes: readonly string[], seat = 0): { tab: Table; ids: string[] } {
  let state = tab.state;
  const ids: string[] = [];
  for (const code of codes) {
    const made = spawn(state, code, { zone: "discard", seat });
    state = made.state;
    ids.push(made.id);
  }
  return { tab: { ...tab, state }, ids };
}

// Answers the question an effect asks with its first option, while it asks one.
function answerFirst(run: Run, tab: Table): Run {
  let next = run;
  for (let guard = 0; guard < 4 && next.state.window?.kind === "choose"; guard += 1) next = sendUnledgered(next, { type: "Choose", optionId: choices(next.state, tab)[0] ?? "" }, tab.ctx);
  return next;
}

describe("Erestor (10084:A:1, A:2)", () => {
  // "Draw 3 additional cards at the beginning of the resource phase."
  lineSpec("10084:A:1", "draws 4 cards in the resource phase, 3 more than the usual 1", (effects) => {
    const tab = table(effects, { heroes: [{ code: ERESTOR, seat: 0 }, { code: ARAGORN, seat: 0 }], playerDeck: fillers(6) }, 0);
    const run = enter(tab.state, tab, "beginRound");
    expect(run.state.seats[0]?.hand).toHaveLength(4);
    expect(run.state.seats[0]?.deck).toHaveLength(2);
  });

  // "At the end of the round, discard all cards in your hand.": Erestor's player discards both cards; the other player keeps theirs.
  lineSpec("10084:A:2", "discards every card of his player's hand at the end of the round, and only that hand", (effects) => {
    const tab = table(effects, { seats: 2, heroes: [{ code: ERESTOR, seat: 0 }, { code: ARAGORN, seat: 0 }, { code: PAL, seat: 1 }], hand: [...fillers(2), ...fillers(1, 1)] });
    const [first, second, other] = tab.ids[CARD] ?? [];
    let run = enter(tab.state, tab, "refresh");
    run = answerFirst(run, tab);
    expect(run.state.round).toBeGreaterThan(tab.state.round);
    expect(run.state.seats[0]?.hand).toEqual([]);
    expect(run.state.cards[first ?? ""]?.zone).toBe("discard");
    expect(run.state.cards[second ?? ""]?.zone).toBe("discard");
    expect(run.state.cards[other ?? ""]?.zone).toBe("hand");
  });

  it("10084:A:2 keeps the hand at the end of a phase that is not the end of the round", () => {
    const tab = table(EFFECTS, { heroes: [{ code: ERESTOR, seat: 0 }, { code: ARAGORN, seat: 0 }], hand: fillers(2) });
    const run = enter(tab.state, tab, "questCommit");
    expect(run.state.seats[0]?.hand).toHaveLength(2);
  });
});

describe("Reinforcements (10085:A:1)", () => {
  // "You must spend resources from 3 different heroes' resource pools to play this card.": 3 resources from one Leadership hero are
  // refused, 1 from each of 3 Leadership heroes is accepted.
  lineSpec("10085:A:1", "is paid from 3 different heroes' pools, not from one", (effects) => {
    const tab = table(effects, { heroes: [{ code: ARAGORN, seat: 0 }, { code: THEODRED, seat: 0 }, { code: GLOIN, seat: 0 }], hand: [{ code: REINFORCEMENTS, seat: 0 }, { code: "ally", seat: 0 }] });
    const card = idsOf(tab, REINFORCEMENTS);
    const [aragorn, theodred, gloin] = [idsOf(tab, ARAGORN), idsOf(tab, THEODRED), idsOf(tab, GLOIN)];
    expect(refusal(tab.state, { type: "PlayCard", cardId: card, payments: [{ heroId: aragorn, amount: 3 }] }, tab.ctx)).not.toBeNull();
    expect(refusal(tab.state, { type: "PlayCard", cardId: card, payments: [{ heroId: aragorn, amount: 2 }, { heroId: theodred, amount: 1 }] }, tab.ctx)).not.toBeNull();
    const three = [aragorn, theodred, gloin].map((heroId) => ({ heroId, amount: 1 }));
    expect(refusal(tab.state, { type: "PlayCard", cardId: card, payments: three }, tab.ctx)).toBeNull();
  });
});

describe("Send for Aid (10086:A:1)", () => {
  // "Limit 1 per deck." The deck check reads the card's deck limit (data/cards/ToR.json), which the DeckLimit record restates, so this is a
  // plain test: a deck with two copies is refused, one with one copy is not.
  it("10086:A:1 a deck holds at most 1 copy", () => {
    const rows = JSON.parse(readFileSync(new URL("../../../data/cards/ToR.json", import.meta.url), "utf8")) as { code: string; name: string; type: string; sphere: string | null; deckLimit: number | null }[];
    const row = rows.find((card) => card.code === SEND_FOR_AID);
    expect(row?.deckLimit).toBe(1);
    const fact = (name: string, typeCode: string, sphereCode: string | null, deckLimit: number | null): DeckSaveCard => ({ name, typeCode, sphereCode, deckLimit, deckLegal: true, traits: null });
    const facts = new Map<string, DeckSaveCard>([["h1", fact("Hero", "hero", "leadership", null)], [SEND_FOR_AID, fact(row?.name ?? "", row?.type ?? "", row?.sphere ?? null, row?.deckLimit ?? null)]]);
    for (let index = 0; index < 50; index += 1) facts.set(`e${index}`, fact(`Event ${index}`, "event", "leadership", 3));
    const events = Array.from({ length: 50 }, (_, index) => ({ code: `e${index}`, count: 1 }));
    expect(deckSaveRefusal(["h1"], [...events, { code: SEND_FOR_AID, count: 1 }], facts)).toBeNull();
    expect(deckSaveRefusal(["h1"], [...events, { code: SEND_FOR_AID, count: 2 }], facts)).toMatchObject({ cardCode: SEND_FOR_AID });
  });
});

describe("Horn's Cry (10088:A:1, A:2)", () => {
  // Two seats; each holds one enemy engaged with it, and one more lies in the staging area. Legolas (Tactics) pays for the card.
  function horn(effects: readonly Effect[], threat: number): { tab: Table; mine: string; theirs: string; staged: string } {
    const scene = table(effects, { seats: 2, heroes: [{ code: LEGOLAS, seat: 0 }, { code: PAL, seat: 1 }], hand: [{ code: HORN, seat: 0 }], engaged: [{ code: WEAK, seat: 0 }, { code: WEAK, seat: 1 }], staging: [WEAK] });
    // The scene puts the staging area's cards in before the engaged ones.
    const [staged, mine, theirs] = scene.ids[WEAK] ?? [];
    return { tab: { ...scene, state: withThreat(scene.state, 0, threat) }, mine: mine ?? "", theirs: theirs ?? "", staged: staged ?? "" };
  }

  // "Action: All enemies get -1 Attack until the end of the phase."
  lineSpec("10088:A:1", "gives every enemy -1 Attack until the end of the phase", (effects) => {
    const { tab, mine, theirs, staged } = horn(effects, 8);
    let run = play(tab, HORN);
    if (run.state.window?.kind === "choose") {
      // Below 40 threat the Valour Action is no choice.
      expect(choices(run.state, tab)).toEqual(["all"]);
      run = sendUnledgered(run, { type: "Choose", optionId: "all" }, tab.ctx);
    }
    for (const id of [mine, theirs, staged]) expect(stat(run.state, tab, id, "attack")).toBe(2);
    const later = enter(run.state, tab, "questCommit");
    for (const id of [mine, theirs, staged]) expect(stat(later.state, tab, id, "attack")).toBe(3);
  });

  // "Valour Action: Choose a player. Each enemy engaged with that player gets -3 Attack until the end of the phase." (bts.valour: at threat 40 or
  // higher the player picks one of the two effects): the other player is chosen, so only their enemy gets -3, and no enemy gets the -1.
  lineSpec("10088:A:2", "at threat 40 gives -3 Attack to each enemy engaged with the chosen player only", (effects) => {
    const { tab, mine, theirs, staged } = horn(effects, 40);
    let run = play(tab, HORN);
    expect(choices(run.state, tab).sort()).toEqual(["all", "valour-other", "valour-you"]);
    run = sendUnledgered(run, { type: "Choose", optionId: "valour-other" }, tab.ctx);
    expect(stat(run.state, tab, theirs, "attack")).toBe(0);
    expect(stat(run.state, tab, mine, "attack")).toBe(3);
    expect(stat(run.state, tab, staged, "attack")).toBe(3);
    const later = enter(run.state, tab, "questCommit");
    expect(stat(later.state, tab, theirs, "attack")).toBe(3);
  });

  it("10088:A:2 the player may choose themself", () => {
    const { tab, mine, theirs } = horn(EFFECTS, 41);
    const run = sendUnledgered(play(tab, HORN), { type: "Choose", optionId: "valour-you" }, tab.ctx);
    expect(stat(run.state, tab, mine, "attack")).toBe(0);
    expect(stat(run.state, tab, theirs, "attack")).toBe(3);
  });
});

describe("Galadhrim Weaver (10089:A:1, A:2)", () => {
  // "Cannot attack or defend.": the Weaver is no defender against an attack and no attacker, where Legolas is both.
  lineSpec("10089:A:1", "cannot be declared as a defender or as an attacker", (effects) => {
    const tab = table(effects, { heroes: [{ code: LEGOLAS, seat: 0 }], allies: [{ code: WEAVER, seat: 0 }], engaged: [{ code: WEAK, seat: 0 }] });
    const [weaver, legolas, weak] = [idsOf(tab, WEAVER), idsOf(tab, LEGOLAS), idsOf(tab, WEAK)];
    let run = combat(tab.state, tab);
    for (let guard = 0; guard < 6 && run.state.window?.kind === "frameAction"; guard += 1) run = sendUnledgered(run, { type: "Pass" }, tab.ctx);
    expect(run.state.window?.kind).toBe("defense");
    expect(refusal(run.state, { type: "DeclareDefender", defenderId: legolas }, tab.ctx)).toBeNull();
    expect(refusal(run.state, { type: "DeclareDefender", defenderId: weaver }, tab.ctx)).not.toBeNull();
    const declaring = attacking(tab.state);
    expect(refusal(declaring, { type: "DeclareAttackers", enemyId: weak, attackerIds: [legolas] }, tab.ctx)).toBeNull();
    expect(refusal(declaring, { type: "DeclareAttackers", enemyId: weak, attackerIds: [weaver] }, tab.ctx)).not.toBeNull();
  });

  // "Response: After Galadhrim Weaver enters play, shuffle the top card of your discard pile into your deck.": the card put on the pile last
  // goes into the deck; the one under it stays.
  lineSpec("10089:A:2", "after it enters play, shuffles the top card of the discard pile into the deck", (effects) => {
    const { tab, ids } = discarded(table(effects, { heroes: [{ code: EOWYN, seat: 0 }], hand: [{ code: WEAVER, seat: 0 }], playerDeck: fillers(3) }), [CARD, CARD]);
    const [under, top] = ids;
    const cursor = tab.state.seedCursor;
    let run = play(tab, WEAVER);
    expect(triggers(run.state, tab)).toContain("10089:response:1");
    run = sendUnledgered(run, { type: "Trigger", cardId: idsOf(tab, WEAVER), effectId: "10089:response:1" }, tab.ctx);
    expect(run.state.cards[top ?? ""]?.zone).toBe("deck");
    expect(run.state.cards[under ?? ""]?.zone).toBe("discard");
    expect(run.state.seats[0]?.deck).toHaveLength(4);
    expect(run.state.seedCursor).toBeGreaterThan(cursor);
  });

  it("10089:A:2 is not offered with an empty discard pile", () => {
    const tab = table(EFFECTS, { heroes: [{ code: EOWYN, seat: 0 }], hand: [{ code: WEAVER, seat: 0 }], playerDeck: fillers(3) });
    expect(triggers(play(tab, WEAVER).state, tab)).not.toContain("10089:response:1");
  });
});

describe("Galdor of the Havens (10091:A:1)", () => {
  // "Response: After 1 or more cards are discarded from your hand, draw 1 card. Limit once per round."
  lineSpec("10091:A:1", "draws 1 card after a card is discarded from the hand, once a round", (effects) => {
    const tab = table(effects, { heroes: [{ code: LEGOLAS, seat: 0 }], attached: [{ code: SPEAR, host: LEGOLAS }], allies: [{ code: GALDOR, seat: 0 }], hand: fillers(3), playerDeck: fillers(3) });
    const [spear, galdor] = [idsOf(tab, SPEAR), idsOf(tab, GALDOR)];
    let run = answerFirst(sendUnledgered(begin(tab.state), { type: "Trigger", cardId: spear, effectId: "10087:action:1" }, tab.ctx), tab);
    expect(triggers(run.state, tab)).toContain("10091:response:1");
    run = sendUnledgered(run, { type: "Trigger", cardId: galdor, effectId: "10091:response:1" }, tab.ctx);
    expect(run.state.seats[0]?.hand).toHaveLength(3);
    expect(run.state.seats[0]?.deck).toHaveLength(2);
    // A second discard in the same round: no second draw.
    run = answerFirst(sendUnledgered(run, { type: "Trigger", cardId: spear, effectId: "10087:action:1" }, tab.ctx), tab);
    // Not offered to either seat.
    for (const seat of [0, 1]) expect(triggers({ ...run.state, activeSeat: seat }, tab)).not.toContain("10091:response:1");
  });
});

describe("Galdor of the Havens (10091:A:1), another player's hand", () => {
  it("10091:A:1 is not offered when a card is discarded from another player's hand", () => {
    const scene = table(EFFECTS, { seats: 2, heroes: [{ code: EOWYN, seat: 0 }, { code: LEGOLAS, seat: 1 }], allies: [{ code: GALDOR, seat: 0 }, { code: SPEAR, seat: 1 }], hand: fillers(1, 1), playerDeck: fillers(2) });
    const tab = attach(scene, [[idsOf(scene, SPEAR), idsOf(scene, LEGOLAS)]]);
    const run = answerFirst(sendUnledgered(begin({ ...tab.state, activeSeat: 1 }), { type: "Trigger", cardId: idsOf(tab, SPEAR), effectId: "10087:action:1" }, tab.ctx), tab);
    expect(run.state.cards[idsOf(tab, CARD)]?.zone).toBe("discard");
    // Not offered to either seat.
    for (const seat of [0, 1]) expect(triggers({ ...run.state, activeSeat: seat }, tab)).not.toContain("10091:response:1");
  });
});
