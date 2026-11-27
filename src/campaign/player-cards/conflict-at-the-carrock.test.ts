// Rules: rr.attachment-cards, rr.modifiers, rr.lasting-effects, rr.action, rr.response, rr.cost, rr.triggered-ability, rr.traits, rr.ready,
// rr.resource-match (data/rules/entries.json).
// The Conflict at the Carrock allies and events, with Nor am I a Stranger (tested beside Éomund), written from their card text
// (data/cards/CatC.json; data/printed holds no ledger for this pack, so the lines are the text of data/cards and every intent goes through
// sendUnledgered): Second Breakfast 02027:A:1, Beorning Beekeeper 02028:A:1, Éomund 02030:A:1, Nor am I a Stranger 02031:A:1 and A:2,
// Longbeard Map-Maker 02032:A:1. The other attachments are in conflict-at-the-carrock-attachments.test.ts.
import { beforeAll, describe, expect, it } from "vitest";

import type { Effect } from "../../catalog/boundary.ts";
import { EFFECTS } from "../../effects/index.ts";
import { definePrinted } from "../../rules/core/printed.ts";
import { updateCard } from "../../rules/core/state.ts";
import { legalIntents } from "../../rules/engine/reduce.ts";
import { starterBase } from "../../../test/scenarios/a-shadow-of-the-past/starter-scene.ts";
import { loadPrinted } from "../../../test/harness/catalog.ts";
import { lineDefault, lineSpec } from "../../../test/harness/line-spec.ts";
import { begin, idsOf, type Run, type Table } from "../../../test/harness/scene.ts";
import { atDefense, combat, discarded, hosts, passAll, play, playerTableFor, printed, sendUnledgered, stat, triggers } from "../../../test/harness/player-table.ts";

const BREAKFAST = "02027";
const BEEKEEPER = "02028";
const EOMUND = "02030";
const STRANGER = "02031";
const MAPMAKER = "02032";
// Core Aragorn (Leadership, not Rohan), Théodred (Leadership Rohan hero), Éowyn (Spirit Rohan hero), Legolas (Tactics), Beravor (Lore),
// Snowbourn Scout (Leadership Rohan ally). The Black Rider (Attack 5) destroys Éomund.
const ARAGORN = "01001";
const THEODRED = "01002";
const LEGOLAS = "01005";
const EOWYN = "01007";
const BERAVOR = "01012";
const SNOWBOURN = "01016";
const RIDER = "141039";
const PAL = "pal";
const PLAIN = "plain";
const CARD = "card";
// The Plain attachment (test/harness/scene.ts) and a Lore attachment of cost 1 with no text; the Card event.
const LORE_GEAR = "lore-gear";
// An enemy that engages nobody and that 1 damage does not destroy.
const WALL = "wall";

let base: Awaited<ReturnType<typeof starterBase>>;

const table = playerTableFor(() => base);

beforeAll(async () => {
  const starter = await starterBase();
  const codes = [BREAKFAST, BEEKEEPER, EOMUND, STRANGER, MAPMAKER, ARAGORN, THEODRED, LEGOLAS, EOWYN, BERAVOR, SNOWBOURN, RIDER];
  const cards = new Map([...starter.cards, ...(await loadPrinted(codes))]);
  cards.set(LORE_GEAR, definePrinted({ code: LORE_GEAR, name: "Lore Gear", type: "attachment", sphere: "lore", cost: 1 }));
  cards.set(WALL, definePrinted({ code: WALL, name: "Wall", type: "enemy", threat: 1, engagementCost: 50, attack: 1, defense: 9, health: 9 }));
  base = { ...starter, cards };
});

describe("Second Breakfast (02027:A:1)", () => {
  // "Action: Each player returns the topmost attachment card from his discard pile to his hand.": the first player's pile holds two
  // attachments under an event, the second player's one attachment under an event: the upper attachment of the first pile and the second
  // player's attachment go to their hands; the lower attachment and the events stay. Aragorn (Leadership) pays 1.
  lineSpec("02027:A:1", "Second Breakfast: each player returns the topmost attachment of his discard pile to his hand", (effects) => {
    const scene = table(effects, { seats: 2, heroes: [{ code: ARAGORN, seat: 0 }, { code: PAL, seat: 1 }], hand: [{ code: BREAKFAST, seat: 0 }] });
    const { tab, ids: [lower = "", upper = "", event = "", theirs = "", theirEvent = ""] } = discarded(scene, [[LORE_GEAR, 0], [PLAIN, 0], [CARD, 0], [PLAIN, 1], [CARD, 1]]);
    const breakfast = idsOf(tab, BREAKFAST);
    const run = passAll(play(begin(tab.state), tab, breakfast), tab.ctx);
    expect(run.state.window?.kind).not.toBe("choose");
    expect(run.state.seats[0]?.hand).toEqual([upper]);
    expect(run.state.seats[1]?.hand).toEqual([theirs]);
    expect(run.state.seats[0]?.discard).toEqual([lower, event, breakfast]);
    expect(run.state.seats[1]?.discard).toEqual([theirEvent]);
    expect(run.state.cards[idsOf(tab, ARAGORN)]?.resources).toBe(6 - 1);
  });

  // With no attachment in any discard pile the Action can return nothing, so it is not played (rr.triggered-ability).
  it("02027:A:1 Second Breakfast: not played with no attachment in a discard pile", () => {
    const scene = table(EFFECTS, { heroes: [{ code: ARAGORN, seat: 0 }], hand: [{ code: BREAKFAST, seat: 0 }] });
    const { tab } = discarded(scene, [[CARD, 0]]);
    expect(legalIntents(tab.state, tab.ctx).some((intent) => intent.type === "PlayCard" && intent.cardId === idsOf(tab, BREAKFAST))).toBe(false);
  });
});

describe("Beorning Beekeeper (02028:A:1)", () => {
  // "Action: Discard Beorning Beekeeper from play to deal 1 damage to each enemy in the staging area.": the two Walls in the staging area
  // take 1 damage each, the Wall engaged with the player takes none, and the Beekeeper is in the discard pile.
  lineSpec("02028:A:1", "Beorning Beekeeper: discard it to deal 1 damage to each enemy in the staging area", (effects) => {
    const tab = table(effects, { heroes: [{ code: LEGOLAS, seat: 0 }], allies: [{ code: BEEKEEPER, seat: 0 }], staging: [WALL, WALL], engaged: [{ code: WALL, seat: 0 }] });
    const [first = "", second = "", engaged = ""] = tab.ids[WALL] ?? [];
    const keeper = idsOf(tab, BEEKEEPER);
    expect(triggers(tab.state, tab)).toContain("02028:action:1");
    const run = sendUnledgered(begin(tab.state), { type: "Trigger", cardId: keeper, effectId: "02028:action:1" }, tab.ctx);
    expect(run.state.cards[first]?.damage).toBe(1);
    expect(run.state.cards[second]?.damage).toBe(1);
    expect(run.state.cards[engaged]?.damage).toBe(0);
    expect(run.state.cards[keeper]?.zone).toBe("discard");
    expect(run.state.seats[0]?.discard).toEqual([keeper]);
  });

  // With no enemy in the staging area the Action can deal no damage, so it is not offered (rr.triggered-ability).
  it("02028:A:1 Beorning Beekeeper: not offered with no enemy in the staging area", () => {
    const tab = table(EFFECTS, { heroes: [{ code: LEGOLAS, seat: 0 }], allies: [{ code: BEEKEEPER, seat: 0 }], engaged: [{ code: WALL, seat: 0 }] });
    expect(triggers(tab.state, tab)).not.toContain("02028:action:1");
  });
});

describe("Éomund and Nor am I a Stranger (02030:A:1, 02031:A:1, A:2)", () => {
  // Éomund (Defense 1, 2 hit points) defends the Black Rider's attack (5) and is destroyed. Théodred, Aragorn and the other player's
  // Snowbourn Scout are exhausted.
  function destroyed(state: Table["state"], tab: Table): Run {
    let next = state;
    for (const code of [THEODRED, ARAGORN, SNOWBOURN]) next = updateCard(next, idsOf(tab, code), { exhausted: true });
    let run = atDefense(tab, next);
    run = passAll(sendUnledgered(run, { type: "DeclareDefender", defenderId: idsOf(tab, EOMUND) }, tab.ctx), tab.ctx);
    expect(run.state.cards[idsOf(tab, EOMUND)]?.zone).toBe("discard");
    return run;
  }
  const scene = (effects: readonly Effect[]): Table =>
    table(effects, { seats: 2, heroes: [{ code: THEODRED, seat: 0 }, { code: ARAGORN, seat: 0 }, { code: EOWYN, seat: 0 }, { code: PAL, seat: 1 }], allies: [{ code: EOMUND, seat: 0 }, { code: SNOWBOURN, seat: 1 }], hand: [{ code: STRANGER, seat: 0 }], engaged: [{ code: RIDER, seat: 0 }] });

  // "Response: After Éomund leaves play, ready all Rohan characters in play.": Théodred and the other player's Snowbourn Scout are readied;
  // Aragorn (not Rohan) stays exhausted.
  lineSpec("02030:A:1", "Éomund: after he leaves play, ready all Rohan characters in play", (effects) => {
    const tab = scene(effects);
    const pending = destroyed(tab.state, tab);
    expect(triggers(pending.state, tab)).toContain("02030:response:1");
    const run = sendUnledgered(pending, { type: "Trigger", cardId: idsOf(tab, EOMUND), effectId: "02030:response:1" }, tab.ctx);
    expect(run.state.cards[idsOf(tab, THEODRED)]?.exhausted).toBe(false);
    expect(run.state.cards[idsOf(tab, SNOWBOURN)]?.exhausted).toBe(false);
    expect(run.state.cards[idsOf(tab, ARAGORN)]?.exhausted).toBe(true);
  });

  // With no exhausted Rohan character in play the Response can ready nothing, so it is not offered (rr.triggered-ability).
  it("02030:A:1 Éomund: not offered with no exhausted Rohan character", () => {
    const tab = table(EFFECTS, { heroes: [{ code: THEODRED, seat: 0 }, { code: ARAGORN, seat: 0 }], allies: [{ code: EOMUND, seat: 0 }], engaged: [{ code: RIDER, seat: 0 }] });
    let run = passAll(combat(tab.state, tab), tab.ctx);
    run = passAll(sendUnledgered(run, { type: "DeclareDefender", defenderId: idsOf(tab, EOMUND) }, tab.ctx), tab.ctx);
    expect(run.state.cards[idsOf(tab, EOMUND)]?.zone).toBe("discard");
    expect(triggers(run.state, tab)).not.toContain("02030:response:1");
  });

  // "Attach to a character.": the heroes and the allies of both players are offered; the enemy is not. Éowyn (Spirit) pays.
  lineDefault("02031:A:1", "Nor am I a Stranger: attach to a character", (effects) => {
    const tab = scene(effects);
    const stranger = idsOf(tab, STRANGER);
    const characters = [THEODRED, ARAGORN, EOWYN, PAL, EOMUND, SNOWBOURN].map((code) => idsOf(tab, code));
    expect(hosts(tab, stranger)).toEqual(characters.sort());
    expect(play(begin(tab.state), tab, stranger, idsOf(tab, ARAGORN)).state.cards[stranger]?.host).toBe(idsOf(tab, ARAGORN));
  });

  // "Attached character gains the Rohan trait.": played on Aragorn, he is a Rohan character in the state that intent returns, so Éomund
  // leaving play readies him.
  lineSpec("02031:A:2", "Nor am I a Stranger: the attached character gains the Rohan trait", (effects) => {
    const tab = scene(effects);
    const aragorn = idsOf(tab, ARAGORN);
    const played = play(begin(tab.state), tab, idsOf(tab, STRANGER), aragorn);
    const pending = destroyed(played.state, tab);
    const run = sendUnledgered(pending, { type: "Trigger", cardId: idsOf(tab, EOMUND), effectId: "02030:response:1" }, tab.ctx);
    expect(run.state.cards[aragorn]?.exhausted).toBe(false);
  });
});

describe("Longbeard Map-Maker (02032:A:1)", () => {
  // "Action: Spend 1 Lore resource to give Longbeard Map-Maker +1 Willpower until the end of the phase.": Beravor (Lore) pays 1, the Map-Maker
  // has Willpower 1 + 1, and 1 again in the quest phase that follows.
  lineSpec("02032:A:1", "Longbeard Map-Maker: spend 1 Lore resource for +1 Willpower until the end of the phase", (effects) => {
    const tab = table(effects, { heroes: [{ code: BERAVOR, seat: 0 }], allies: [{ code: MAPMAKER, seat: 0 }], deck: ["f0", "f0"] });
    const [beravor, maker] = [idsOf(tab, BERAVOR), idsOf(tab, MAPMAKER)];
    expect(triggers(tab.state, tab)).toContain("02032:action:1");
    const run = sendUnledgered(begin(tab.state), { type: "Trigger", cardId: maker, effectId: "02032:action:1", payments: [{ heroId: beravor, amount: 1 }] }, tab.ctx);
    expect(run.state.cards[beravor]?.resources).toBe(6 - 1);
    expect(stat(run.state, tab, maker, "willpower")).toBe(printed(tab, MAPMAKER, "willpower") + 1);
    const quest = sendUnledgered(run, { type: "Pass" }, tab.ctx);
    expect(quest.state.phase).toBe("Quest");
    expect(stat(quest.state, tab, maker, "willpower")).toBe(printed(tab, MAPMAKER, "willpower"));
  });

  // "Lore resource": Aragorn's Leadership resources do not pay for it, and the Action is not offered.
  it("02032:A:1 Longbeard Map-Maker: not offered without a Lore resource", () => {
    const tab = table(EFFECTS, { heroes: [{ code: ARAGORN, seat: 0 }], allies: [{ code: MAPMAKER, seat: 0 }] });
    expect(triggers(tab.state, tab)).not.toContain("02032:action:1");
  });
});
