// Rules: bts.valour, rr.modifiers, rr.quest-phase, rr.action, rr.ready, rr.response, rr.enters-play, rr.then, rr.planning-phase,
// rr.play-and-put-into-play, rr.cost, rr.deckbuilding (data/rules/entries.json).
// The City of Ulfast allies, events and contract, written from their card text (data/cards/TCoU.json; data/printed holds no ledger for this
// pack, so every intent goes through sendUnledgered): Angbor the Fearless 22028:A:1, Need Drives Them 22029:A:1, Knight of Belfalas 22034:A:1,
// Host of Galadhrim 22036:A:1, Forth, The Three Hunters! 22049:A:1. The attachments are in the-city-of-ulfast-attachments.test.ts.
import { beforeAll, describe, expect, it } from "vitest";

import type { Effect } from "../../catalog/boundary.ts";
import { deckRulesOf } from "../../catalog/deck-rules.ts";
import { deckSaveRefusal } from "../../catalog/deck-save.ts";
import { EFFECTS } from "../../effects/index.ts";
import { updateCard, withThreat } from "../../rules/core/state.ts";
import { legalIntents } from "../../rules/engine/reduce.ts";
import { starterBase } from "../../../test/scenarios/a-shadow-of-the-past/starter-scene.ts";
import { loadPrinted } from "../../../test/harness/catalog.ts";
import { lineSpec } from "../../../test/harness/line-spec.ts";
import { begin, idsOf, type Table } from "../../../test/harness/scene.ts";
import { choices, combat, deckSaveFacts, discarded, packRow, playCode, playerTableFor, questing, sendUnledgered, stat, triggers } from "../../../test/harness/player-table.ts";

const ANGBOR = "22028";
const NEED = "22029";
const KNIGHT = "22034";
const HOST = "22036";
const FORTH = "22049";
// Core: Aragorn (Leadership hero), Éowyn (Spirit hero), Denethor (a Gondor hero), Guard of the Citadel and Gondorian Spearman (Gondor allies),
// Snowbourn Scout (a Rohan ally), Silverlode Archer and Henamarth Riversong (Silvan allies).
const ARAGORN = "01001";
const EOWYN = "01007";
const DENETHOR = "01010";
const GUARD = "01013";
const SNOWBOURN = "01016";
const ARCHER = "01017";
const SPEARMAN = "01029";
const HENAMARTH = "01060";
const ALLY = "ally";
const PAL = "pal";

let base: Awaited<ReturnType<typeof starterBase>>;

const table = playerTableFor(() => base);

beforeAll(async () => {
  const starter = await starterBase();
  const cards = new Map([...starter.cards, ...(await loadPrinted([ANGBOR, NEED, KNIGHT, HOST, FORTH, ARAGORN, EOWYN, DENETHOR, GUARD, SNOWBOURN, ARCHER, SPEARMAN, HENAMARTH]))]);
  base = { ...starter, cards };
});

const threatened = (tab: Table, seat: number, threat: number): Table => ({ ...tab, state: withThreat(tab.state, seat, threat) });

describe("Angbor the Fearless (22028:A:1)", () => {
  // Aragorn pays for Angbor in hand; the player's threat is `threat`.
  const angbor = (effects: readonly Effect[], threat: number): Table => threatened(table(effects, { heroes: [{ code: ARAGORN, seat: 0 }], hand: [{ code: ANGBOR, seat: 0 }], deck: ["f0", "f0"] }), 0, threat);

  // "While your threat is 40 or higher, Angbor the Fearless gets +2 Attack and does not exhaust to quest.": played at threat 40 he has
  // Attack 1 + 2, and he commits to the quest without exhausting.
  lineSpec("22028:A:1", "Angbor the Fearless: at threat 40, +2 Attack and he does not exhaust to quest", (effects) => {
    const tab = angbor(effects, 40);
    const card = idsOf(tab, ANGBOR);
    const run = playCode(tab, ANGBOR);
    expect(stat(run.state, tab, card, "attack")).toBe(1 + 2);
    const quested = sendUnledgered(begin(questing(run.state)), { type: "Commit", cardIds: [card] }, tab.ctx);
    expect(quested.state.cards[card]).toMatchObject({ committed: true, exhausted: false });
  });

  // At threat 39: his printed Attack, and he exhausts to quest.
  it("22028:A:1 Angbor the Fearless: at threat 39 nothing changes", () => {
    const tab = angbor(EFFECTS, 39);
    const card = idsOf(tab, ANGBOR);
    const run = playCode(tab, ANGBOR);
    expect(stat(run.state, tab, card, "attack")).toBe(1);
    expect(sendUnledgered(begin(questing(run.state)), { type: "Commit", cardIds: [card] }, tab.ctx).state.cards[card]?.exhausted).toBe(true);
  });

  // "your threat": the other player at 45 does not count.
  it("22028:A:1 Angbor the Fearless: another player's threat does not count", () => {
    const tab = threatened(angbor(EFFECTS, 30), 1, 45);
    expect(stat(playCode(tab, ANGBOR).state, tab, idsOf(tab, ANGBOR), "attack")).toBe(1);
  });
});

describe("Need Drives Them (22029:A:1)", () => {
  // "Action: Each player whose threat is 40 or higher readies all characters he controls.": the first player (threat 40) readies Aragorn and
  // the ally; the second player (threat 39) keeps the Pal and the Guard exhausted. Aragorn (Leadership) pays 3 while exhausted.
  lineSpec("22029:A:1", "Need Drives Them: each player at threat 40 or higher readies all their characters", (effects) => {
    const scene = table(effects, { seats: 2, heroes: [{ code: ARAGORN, seat: 0 }, { code: PAL, seat: 1 }], allies: [{ code: ALLY, seat: 0 }, { code: GUARD, seat: 1 }], hand: [{ code: NEED, seat: 0 }] });
    const ids = [ARAGORN, ALLY, PAL, GUARD].map((code) => idsOf(scene, code));
    let state = withThreat(withThreat(scene.state, 0, 40), 1, 39);
    for (const id of ids) state = updateCard(state, id, { exhausted: true });
    const tab = { ...scene, state };
    const run = playCode(tab, NEED);
    expect(ids.map((id) => run.state.cards[id]?.exhausted)).toEqual([false, false, true, true]);
    expect(run.state.cards[idsOf(tab, ARAGORN)]?.resources).toBe(6 - 3);
  });

  // Every player below 40: no character readies, so the event can change nothing (rr.triggered-ability) and is not offered.
  it("22029:A:1 Need Drives Them: not offered while no player's threat is 40 or higher", () => {
    const scene = table(EFFECTS, { heroes: [{ code: ARAGORN, seat: 0 }], allies: [{ code: ALLY, seat: 0 }], hand: [{ code: NEED, seat: 0 }] });
    const tab = { ...scene, state: updateCard(withThreat(scene.state, 0, 39), idsOf(scene, ALLY), { exhausted: true }) };
    expect(legalIntents(tab.state, tab.ctx).some((intent) => intent.type === "PlayCard" && intent.cardId === idsOf(tab, NEED))).toBe(false);
  });
});

describe("Knight of Belfalas (22034:A:1)", () => {
  // Éowyn (Spirit) pays for the Knight; the first player's discard pile holds the Guard and the Spearman (Gondor allies), the Snowbourn Scout
  // (Rohan) and Denethor (a Gondor hero); the second player's holds a Guard.
  function knight(effects: readonly Effect[], pile: readonly string[]): { tab: Table; pile: string[]; theirs: string } {
    const scene = table(effects, { seats: 2, heroes: [{ code: EOWYN, seat: 0 }, { code: PAL, seat: 1 }], hand: [{ code: KNIGHT, seat: 0 }] });
    const { tab, ids } = discarded(scene, [...pile.map((code) => [code, 0] as const), [GUARD, 1]]);
    return { tab, pile: ids.slice(0, -1), theirs: ids.at(-1) ?? "" };
  }

  // "Response: After Knight of Belfalas enters play, return a Gondor ally from your discard pile to your hand.": the two Gondor allies of
  // the player's own pile are offered; the Spearman goes to the hand and the rest stay.
  lineSpec("22034:A:1", "Knight of Belfalas: after it enters play, return a Gondor ally from the discard pile to the hand", (effects) => {
    const { tab, pile: [guard = "", spearman = "", scout = "", denethor = ""], theirs } = knight(effects, [GUARD, SPEARMAN, SNOWBOURN, DENETHOR]);
    let run = playCode(tab, KNIGHT);
    expect(triggers(run.state, tab)).toContain("22034:response:1");
    run = sendUnledgered(run, { type: "Trigger", cardId: idsOf(tab, KNIGHT), effectId: "22034:response:1" }, tab.ctx);
    expect(choices(run.state, tab).sort()).toEqual([guard, spearman].sort());
    run = sendUnledgered(run, { type: "Choose", optionId: spearman }, tab.ctx);
    expect(run.state.cards[spearman]?.zone).toBe("hand");
    for (const id of [guard, scout, denethor, theirs]) expect(run.state.cards[id]?.zone).toBe("discard");
  });

  // No Gondor ally in the player's own pile (a Rohan ally and a Gondor hero there, a Gondor ally in the other player's): not offered.
  it("22034:A:1 Knight of Belfalas: not offered with no Gondor ally in its player's discard pile", () => {
    const { tab } = knight(EFFECTS, [SNOWBOURN, DENETHOR]);
    expect(triggers(playCode(tab, KNIGHT).state, tab)).not.toContain("22034:response:1");
  });
});

describe("Host of Galadhrim (22036:A:1)", () => {
  // Aragorn pays 4. The first player controls a Silverlode Archer and Henamarth (Silvan allies, both exhausted) and a plain ally; the
  // second player controls a Silverlode Archer too.
  function host(effects: readonly Effect[]): { tab: Table; archer: string; mine: string; plain: string; theirs: string } {
    const scene = table(effects, { seats: 2, heroes: [{ code: ARAGORN, seat: 0 }, { code: PAL, seat: 1 }], allies: [{ code: ARCHER, seat: 0 }, { code: HENAMARTH, seat: 0 }, { code: ALLY, seat: 0 }, { code: ARCHER, seat: 1 }], hand: [{ code: HOST, seat: 0 }] }, 10);
    const [mine, plain] = [idsOf(scene, HENAMARTH), idsOf(scene, ALLY)];
    const [archer = "", theirs = ""] = scene.ids[ARCHER] ?? [];
    const state = updateCard(updateCard(scene.state, archer, { exhausted: true }), mine, { exhausted: true });
    return { tab: { ...scene, state }, archer, mine, plain, theirs };
  }

  // "Planning Action: Return each Silvan ally you control to your hand. Then, play each of those allies from your hand one at a time at no
  // cost.": the Archer and Henamarth leave play and come back ready, with nothing paid but the 4 for the event; the plain ally
  // and the other player's Archer are not touched.
  lineSpec("22036:A:1", "Host of Galadhrim: return each Silvan ally you control to the hand, then play them at no cost", (effects) => {
    const { tab, archer, mine, plain, theirs } = host(effects);
    const run = playCode(tab, HOST);
    // Both are played back with no question asked.
    expect(run.state.window?.kind).not.toBe("choose");
    for (const id of [archer, mine]) expect(run.state.cards[id]).toMatchObject({ zone: "play", controller: 0, exhausted: false });
    expect(run.state.seats[0]?.hand).toEqual([]);
    expect(run.state.cards[idsOf(tab, ARAGORN)]?.resources).toBe(10 - 4);
    expect(run.state.cards[plain]?.zone).toBe("play");
    expect(run.state.cards[theirs]).toMatchObject({ zone: "play", controller: 1 });
  });

  // "Planning Action": not played in the combat phase.
  it("22036:A:1 Host of Galadhrim: not played outside the planning phase", () => {
    const { tab } = host(EFFECTS);
    const run = combat(tab.state, tab);
    expect(legalIntents(run.state, tab.ctx).some((intent) => intent.type === "PlayCard" && intent.cardId === idsOf(tab, HOST))).toBe(false);
  });
});

describe("Forth, The Three Hunters! (22049:A:1)", () => {
  // "Your deck cannot include ally cards.": with the contract, a deck of 50 events and an ally is refused; without the ally it is not, and
  // without the contract the ally is allowed.
  lineSpec("22049:A:1", "Forth, The Three Hunters!: the deck cannot include ally cards", (effects) => {
    const row = packRow("TCoU", FORTH);
    expect(row?.type).toBe("contract");
    const facts = deckSaveFacts(row);
    facts.set(ALLY, { name: "Ally", typeCode: "ally", sphereCode: "leadership", deckLimit: 3, deckLegal: true, traits: null });
    const events = Array.from({ length: 50 }, (_, index) => ({ code: `e${index}`, count: 1 }));
    const rules = deckRulesOf(effects, [FORTH]);
    expect(deckSaveRefusal(["h1"], [...events, { code: FORTH, count: 1 }], facts, [], rules)).toBeNull();
    expect(deckSaveRefusal(["h1"], [...events, { code: ALLY, count: 1 }], facts)).toBeNull();
    expect(deckSaveRefusal(["h1"], [...events, { code: FORTH, count: 1 }, { code: ALLY, count: 1 }], facts, [], rules)).toMatchObject({ cardCode: ALLY });
  });
});

