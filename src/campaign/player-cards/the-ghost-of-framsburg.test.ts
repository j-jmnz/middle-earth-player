// Rules: rr.action, rr.cost, rr.limits, rr.modifiers, rr.lasting-effects, rr.triggered-ability, rr.play-restrictions-and-permissions,
// rr.active-location, rr.attachment-cards, rr.step-6-4-1 (data/rules/entries.json).
// The Ghost of Framsburg heroes, allies and events, written from their card text (data/cards/TGoF.json; data/printed holds no ledger for
// this pack, so the lines are the text of data/cards and every intent goes through sendUnledgered): Dáin Ironfoot 19084:A:1, Soldier of
// Erebor 19085:A:1, Man the Walls 19086:A:1 and A:2, Mirkwood Hunter 19087:A:2, Familiar Lands 19088:A:1, Descendant of Girion 19091:A:1.
// The attachments are in the-ghost-of-framsburg-attachments.test.ts.
import { beforeAll, describe, expect, it } from "vitest";

import type { Effect } from "../../catalog/boundary.ts";
import { EFFECTS } from "../../effects/index.ts";
import { definePrinted } from "../../rules/core/printed.ts";
import { updateCard } from "../../rules/core/state.ts";
import { attachTo, spawn } from "../../rules/core/zones.ts";
import { legalIntents } from "../../rules/engine/reduce.ts";
import { playCost } from "../../rules/player/attach.ts";
import { refusal, starterBase } from "../../../test/scenarios/a-shadow-of-the-past/starter-scene.ts";
import { loadPrinted } from "../../../test/harness/catalog.ts";
import { lineSpec } from "../../../test/harness/line-spec.ts";
import { begin, idsOf, type Run, type Scene, type Table } from "../../../test/harness/scene.ts";
import { combat, endRound, enter, fillers, passAll, play, playCode, playerTable, printed, questing, sendUnledgered, stat, triggers } from "../../../test/harness/player-table.ts";

const DAIN = "19084";
const SOLDIER = "19085";
const WALLS = "19086";
const HUNTER = "19087";
const LANDS = "19088";
const GIRION = "19091";
// Squire's Helm: a Leadership Item attachment of cost 1 for an ally.
const HELM = "19003";
// Beravor (Lore) pays for the Lore cards.
const BERAVOR = "01012";
const ALLY = "ally";
const PAL = "pal";
const CARD = "card";
const PLAIN = "plain";
// An enemy of attack 2 that engages by no engagement check; two locations of threat 3.
const BRUTE = "brute";
const LOC = "loc";
// A Leadership attachment of cost 1 that is not an Item.
const CHARM = "charm";

let base: Awaited<ReturnType<typeof starterBase>>;

const table = (effects: readonly Effect[], scene: Scene = {}, resources = 6): Table => playerTable(base, effects, scene, resources);

beforeAll(async () => {
  const starter = await starterBase();
  const cards = new Map([...starter.cards, ...(await loadPrinted([DAIN, SOLDIER, WALLS, HUNTER, LANDS, GIRION, HELM, BERAVOR]))]);
  cards.set(BRUTE, definePrinted({ code: BRUTE, name: "Brute", type: "enemy", threat: 1, engagementCost: 50, attack: 2, defense: 0, health: 9 }));
  cards.set(LOC, definePrinted({ code: LOC, name: "Loc", type: "location", threat: 3, questPoints: 5 }));
  cards.set(CHARM, definePrinted({ code: CHARM, name: "Charm", type: "attachment", sphere: "leadership", cost: 1, traits: ["Condition"] }));
  base = { ...starter, cards };
});

// The ids of the PlayCard intents the engine offers.
const playable = (tab: Table, state = tab.state): string[] => legalIntents(state, tab.ctx).flatMap((intent) => (intent.type === "PlayCard" ? [intent.cardId] : []));

describe("Dáin Ironfoot (19084:A:1)", () => {
  // Dáin and the Pal, a deck of `cards` cards; the Brute is engaged and attacks in the combat phase.
  function attacked(effects: readonly Effect[], cards: number): { tab: Table; run: Run } {
    const tab = table(effects, { heroes: [{ code: DAIN, seat: 0 }, { code: PAL, seat: 0 }], engaged: [{ code: BRUTE, seat: 0 }], playerDeck: fillers(CARD, cards) });
    const run = passAll(combat(tab.state, tab), tab.ctx);
    expect(run.state.window?.kind).toBe("defense");
    return { tab, run };
  }

  // "While Dáin Ironfoot is defending, he gains, 'Action: Discard the top card of your deck to give Dáin Ironfoot +1 Defense for this
  // attack. (Limit 3 times per phase.)'": Dáin defends and uses it 3 times: Defense 3 + 3, the top 3 cards are discarded, and a fourth use
  // is not offered. The Brute's 2 Attack deals him nothing, and his Defense is 3 again once the attack is over.
  lineSpec("19084:A:1", "Dáin Ironfoot: while defending, discard the top card for +1 Defense for the attack, 3 times a phase", (effects) => {
    const { tab, run: asked } = attacked(effects, 5);
    const dain = idsOf(tab, DAIN);
    const deck = asked.state.seats[0]?.deck ?? [];
    let run = sendUnledgered(asked, { type: "DeclareDefender", defenderId: dain }, tab.ctx);
    for (let use = 1; use <= 3; use += 1) {
      expect(triggers(run.state, tab)).toContain("19084:action:1");
      run = sendUnledgered(run, { type: "Trigger", cardId: dain, effectId: "19084:action:1" }, tab.ctx);
      expect(stat(run.state, tab, dain, "defense")).toBe(printed(tab, DAIN, "defense") + use);
    }
    expect(triggers(run.state, tab)).not.toContain("19084:action:1");
    expect(run.state.seats[0]?.deck).toEqual(deck.slice(3));
    for (const id of deck.slice(0, 3)) expect(run.state.cards[id]?.zone).toBe("discard");
    run = passAll(run, tab.ctx, { responses: true });
    expect(run.state.cards[dain]?.damage).toBe(0);
    expect(stat(run.state, tab, dain, "defense")).toBe(printed(tab, DAIN, "defense"));
  });

  // "While Dáin Ironfoot is defending": in the combat phase's action window before the attack, and while the Pal defends, it is not offered.
  it("19084:A:1 Dáin Ironfoot: not offered while he is not defending", () => {
    const { tab, run: asked } = attacked(EFFECTS, 5);
    expect(triggers(combat(tab.state, tab).state, tab)).not.toContain("19084:action:1");
    const run = sendUnledgered(asked, { type: "DeclareDefender", defenderId: idsOf(tab, PAL) }, tab.ctx);
    expect(triggers(run.state, tab)).not.toContain("19084:action:1");
  });

  // An empty deck has no top card to discard: the cost cannot be paid.
  it("19084:A:1 Dáin Ironfoot: not offered with an empty deck", () => {
    const { tab, run: asked } = attacked(EFFECTS, 0);
    const run = sendUnledgered(asked, { type: "DeclareDefender", defenderId: idsOf(tab, DAIN) }, tab.ctx);
    expect(triggers(run.state, tab)).not.toContain("19084:action:1");
  });
});

describe("Soldier of Erebor (19085:A:1)", () => {
  // The Soldier exhausted in play, a deck of 7 cards.
  function exhausted(effects: readonly Effect[]): Table {
    const tab = table(effects, { heroes: [{ code: PAL, seat: 0 }], allies: [{ code: SOLDIER, seat: 0 }], playerDeck: fillers(CARD, 7) });
    return { ...tab, state: updateCard(tab.state, idsOf(tab, SOLDIER), { exhausted: true }) };
  }

  // "Action: Discard the top 3 cards from your deck to ready Soldier of Erebor. (Limit once per round.)": the top 3 cards are discarded and
  // the Soldier readies; exhausted again the same round, it is not offered; the next round it is.
  lineSpec("19085:A:1", "Soldier of Erebor: discard the top 3 cards to ready it, once per round", (effects) => {
    const tab = exhausted(effects);
    const soldier = idsOf(tab, SOLDIER);
    const deck = tab.state.seats[0]?.deck ?? [];
    const run = sendUnledgered(begin(tab.state), { type: "Trigger", cardId: soldier, effectId: "19085:action:1" }, tab.ctx);
    expect(run.state.cards[soldier]?.exhausted).toBe(false);
    expect(run.state.seats[0]?.deck).toEqual(deck.slice(3));
    for (const id of deck.slice(0, 3)) expect(run.state.cards[id]?.zone).toBe("discard");
    const again = updateCard(run.state, soldier, { exhausted: true });
    expect(triggers(again, tab)).not.toContain("19085:action:1");
    const next = endRound(again, tab);
    const planning = updateCard({ ...next.state, phase: "Planning", boundaryPhase: "Planning", mode: "planning", window: { kind: "pass" }, activeSeat: 0 }, soldier, { exhausted: true });
    expect(triggers(planning, tab)).toContain("19085:action:1");
  });

  // A ready Soldier: the Action can change nothing, so it is not offered and no card is discarded for nothing (rr.triggered-ability).
  it("19085:A:1 Soldier of Erebor: not offered while it is ready", () => {
    const tab = exhausted(EFFECTS);
    expect(triggers(updateCard(tab.state, idsOf(tab, SOLDIER), { exhausted: false }), tab)).not.toContain("19085:action:1");
  });
});

describe("Man the Walls (19086:A:1, A:2)", () => {
  // Two players; the first holds two copies of Man the Walls and two Allies, the second an Ally.
  function walls(effects: readonly Effect[]): Table {
    return table(effects, { seats: 2, heroes: [{ code: PAL, seat: 0 }, { code: PAL, seat: 1 }], hand: [{ code: WALLS, seat: 0 }, { code: WALLS, seat: 0 }, { code: ALLY, seat: 0 }, { code: ALLY, seat: 0 }, { code: ALLY, seat: 1 }] });
  }

  // "Play only if no other copies of Man the Walls have been played this round.": once a copy is played, the other copy is not offered;
  // the next round it is.
  lineSpec("19086:A:1", "Man the Walls: only one copy is played each round", (effects) => {
    const tab = walls(effects);
    const [first = "", second = ""] = tab.ids[WALLS] ?? [];
    expect(playable(tab)).toContain(second);
    const run = play(begin(tab.state), tab, first);
    expect(run.state.cards[first]?.zone).toBe("discard");
    expect(playable(tab, run.state)).not.toContain(second);
    const next = endRound(run.state, tab);
    expect(playable(tab, { ...next.state, phase: "Planning", boundaryPhase: "Planning", mode: "planning", window: { kind: "pass" }, activeSeat: 0 })).toContain(second);
  });

  // "Planning Action: Reduce the cost of the next ally played by each player this phase by 1. Those allies cannot quest this round.": the
  // first player's next Ally costs 0 and the one after it 1; the second player's next Ally costs 0. In the quest phase the Ally played for
  // 0 cannot commit, the one played for 1 can.
  lineSpec("19086:A:2", "Man the Walls: the next ally of each player costs 1 less and cannot quest this round", (effects) => {
    const tab = walls(effects);
    const [cheap = "", full = "", theirs = ""] = tab.ids[ALLY] ?? [];
    let run = play(begin(tab.state), tab, tab.ids[WALLS]?.[0] ?? "");
    expect(playCost(run.state, theirs, 1, tab.ctx)).toBe(0);
    expect(playCost(run.state, cheap, 0, tab.ctx)).toBe(0);
    run = sendUnledgered(run, { type: "PlayCard", cardId: cheap, payments: [] }, tab.ctx);
    expect(run.state.cards[cheap]?.zone).toBe("play");
    expect(playCost(run.state, full, 0, tab.ctx)).toBe(1);
    run = play(run, tab, full);
    const quest = questing(run.state);
    expect(refusal(quest, { type: "Commit", cardIds: [cheap] }, tab.ctx)).not.toBeNull();
    expect(refusal(quest, { type: "Commit", cardIds: [full] }, tab.ctx)).toBeNull();
  });

  // "Planning Action": in the quest phase it is not played.
  it("19086:A:2 Man the Walls: not played outside the planning phase", () => {
    const tab = walls(EFFECTS);
    expect(playable(tab, questing(tab.state))).not.toContain(tab.ids[WALLS]?.[0]);
  });
});

describe("Mirkwood Hunter (19087:A:2)", () => {
  // Beravor; the Hunter in hand; the active location holds `active` attachments, the location in the staging area two.
  function hunter(effects: readonly Effect[], active: number): Table {
    const tab = table(effects, { heroes: [{ code: BERAVOR, seat: 0 }], hand: [{ code: HUNTER, seat: 0 }], active: LOC, staging: [LOC] });
    const [staged = "", place = ""] = tab.ids[LOC] ?? [];
    let state = tab.state;
    for (const [host, count] of [[place, active], [staged, 2]] as const) {
      for (let index = 0; index < count; index += 1) {
        const made = spawn(state, PLAIN, { zone: "play", seat: 0 });
        state = attachTo(made.state, made.id, host);
      }
    }
    return { ...tab, state };
  }

  // "Reduce the cost to play Mirkwood Hunter by 1 for each attachment on the active location.": with 2 attachments on the active location it
  // costs 4 - 2, and is played for 2; the attachments on the location in the staging area do not count.
  lineSpec("19087:A:2", "Mirkwood Hunter: costs 1 less for each attachment on the active location", (effects) => {
    const tab = hunter(effects, 2);
    const card = idsOf(tab, HUNTER);
    expect(playCost(tab.state, card, 0, tab.ctx)).toBe(2);
    const run = sendUnledgered(begin(tab.state), { type: "PlayCard", cardId: card, payments: [{ heroId: idsOf(tab, BERAVOR), amount: 2 }] }, tab.ctx);
    expect(run.state.cards[card]?.zone).toBe("play");
    expect(run.state.cards[idsOf(tab, BERAVOR)]?.resources).toBe(6 - 2);
  });

  it("19087:A:2 Mirkwood Hunter: its printed cost with no attachment on the active location", () => {
    const tab = hunter(EFFECTS, 0);
    expect(playCost(tab.state, idsOf(tab, HUNTER), 0, tab.ctx)).toBe(4);
  });
});

describe("Familiar Lands (19088:A:1)", () => {
  // Beravor; two locations in the staging area and the active location; when `attached`, the first staged one and the active one hold an attachment.
  function lands(effects: readonly Effect[], attached: boolean): { tab: Table; marked: string; bare: string; place: string } {
    const tab = table(effects, { heroes: [{ code: BERAVOR, seat: 0 }], hand: [{ code: LANDS, seat: 0 }], staging: [LOC, LOC], active: LOC });
    const [marked = "", bare = "", place = ""] = tab.ids[LOC] ?? [];
    let state = tab.state;
    if (attached) {
      for (const host of [marked, place]) {
        const made = spawn(state, PLAIN, { zone: "play", seat: 0 });
        state = attachTo(made.state, made.id, host);
      }
    }
    return { tab: { ...tab, state }, marked, bare, place };
  }

  // "Action: Each location with an attachment gets -2 Threat until the end of the phase.": the staged location and the active location with
  // an attachment have 3 - 2, the bare one 3; in the quest phase each has 3 again.
  lineSpec("19088:A:1", "Familiar Lands: each location with an attachment gets -2 Threat until the end of the phase", (effects) => {
    const { tab, marked, bare, place } = lands(effects, true);
    const run = playCode(tab, LANDS, begin(tab.state));
    expect(stat(run.state, tab, marked, "threat")).toBe(3 - 2);
    expect(stat(run.state, tab, place, "threat")).toBe(3 - 2);
    expect(stat(run.state, tab, bare, "threat")).toBe(3);
    const later = enter(run.state, tab, "questCommit");
    expect(stat(later.state, tab, marked, "threat")).toBe(3);
  });

  // No location has an attachment: its effect can change nothing, so it is not played (rr.triggered-ability).
  it("19088:A:1 Familiar Lands: not played when no location has an attachment", () => {
    const { tab } = lands(EFFECTS, false);
    expect(playable(tab)).not.toContain(idsOf(tab, LANDS));
  });
});

describe("Descendant of Girion (19091:A:1)", () => {
  // The Pal (Leadership) pays; the Descendant and a plain Ally in play; the Squire's Helm (an Item) and the Charm (not an Item) in hand.
  function girion(effects: readonly Effect[]): Table {
    return table(effects, { heroes: [{ code: PAL, seat: 0 }], allies: [{ code: GIRION, seat: 0 }, { code: ALLY, seat: 0 }], hand: [{ code: HELM, seat: 0 }, { code: CHARM, seat: 0 }] });
  }

  // "Reduce the cost to play Item attachments on Descendant of Girion by 1.": the Helm costs 0 on him and is played for nothing; on the
  // other Ally it costs its printed 1. The Charm, not an Item, costs 1 on him.
  lineSpec("19091:A:1", "Descendant of Girion: Item attachments played on him cost 1 less", (effects) => {
    const tab = girion(effects);
    const [helm, girionId, ally] = [idsOf(tab, HELM), idsOf(tab, GIRION), idsOf(tab, ALLY)];
    expect(playCost(tab.state, helm, 0, tab.ctx, ally)).toBe(1);
    expect(playCost(tab.state, helm, 0, tab.ctx, girionId)).toBe(0);
    expect(playCost(tab.state, idsOf(tab, CHARM), 0, tab.ctx, girionId)).toBe(1);
    const run = sendUnledgered(begin(tab.state), { type: "PlayCard", cardId: helm, hostId: girionId, payments: [] }, tab.ctx);
    expect(run.state.cards[helm]?.host).toBe(girionId);
    expect(run.state.cards[idsOf(tab, PAL)]?.resources).toBe(6);
  });
});
