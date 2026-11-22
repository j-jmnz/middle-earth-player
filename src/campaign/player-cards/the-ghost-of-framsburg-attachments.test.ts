// Rules: rr.attachment-cards, rr.restricted, rr.modifiers, rr.engaged, rr.quest-phase, rr.action, rr.cost, wor.guarded-x
// (data/rules/entries.json).
// The Ghost of Framsburg attachments, written from their card text (data/cards/TGoF.json; data/printed holds no ledger for this pack, so the
// lines are the text of data/cards and every intent goes through sendUnledgered): Warrior Sword 19089:A:2, Valiant Determination 19092:A:1,
// Ring of Thrór 19093:A:1, A:2 and A:3. The heroes, allies and events are in the-ghost-of-framsburg.test.ts.
import { beforeAll, describe, expect, it } from "vitest";

import type { Effect } from "../../catalog/boundary.ts";
import { EFFECTS } from "../../effects/index.ts";
import { ruleCause } from "../../rules/core/cause.ts";
import { placeDamage } from "../../rules/core/keywords.ts";
import { definePrinted } from "../../rules/core/printed.ts";
import { updateCard } from "../../rules/core/state.ts";
import { payFor, starterBase } from "../../../test/scenarios/a-shadow-of-the-past/starter-scene.ts";
import { loadPrinted } from "../../../test/harness/catalog.ts";
import { lineSpec } from "../../../test/harness/line-spec.ts";
import { begin, idsOf, type Run, type Scene, type Table } from "../../../test/harness/scene.ts";
import { choices, hosts, play, playerTable, printed, sendUnledgered, stat, triggers } from "../../../test/harness/player-table.ts";

const SWORD = "19089";
const VALIANT = "19092";
const RING = "19093";
// Core: Théodred (Leadership Warrior), Glóin (Leadership Dwarf), Gimli (Tactics Dwarf Warrior), Legolas (Tactics Warrior), Éowyn (Spirit, neither),
// Dúnhere (Spirit Warrior), Beravor (Lore, neither), the Gondorian Spearman (a Tactics Warrior ally). Citadel Plate: "Attach to a hero."
const THEODRED = "01002";
const GLOIN = "01003";
const GIMLI = "01004";
const LEGOLAS = "01005";
const EOWYN = "01007";
const DUNHERE = "01009";
const BERAVOR = "01012";
const SPEARMAN = "01029";
const PLATE = "01040";
const ALLY = "ally";
const PAL = "pal";
const CARD = "card";
// A Tactics ally that is not a Warrior; a Dwarf ally; an enemy that never engages by the engagement check.
const BOWMAN = "bowman";
const DWARF = "dwarf";
const RAM = "ram";

let base: Awaited<ReturnType<typeof starterBase>>;

const table = (effects: readonly Effect[], scene: Scene = {}, resources = 6): Table => playerTable(base, effects, scene, resources);

beforeAll(async () => {
  const starter = await starterBase();
  const cards = new Map([...starter.cards, ...(await loadPrinted([SWORD, VALIANT, RING, THEODRED, GLOIN, GIMLI, LEGOLAS, EOWYN, DUNHERE, BERAVOR, SPEARMAN, PLATE]))]);
  cards.set(BOWMAN, definePrinted({ code: BOWMAN, name: "Bowman", type: "ally", sphere: "tactics", cost: 1, willpower: 1, attack: 1, defense: 1, health: 2 }));
  cards.set(DWARF, definePrinted({ code: DWARF, name: "Dwarf", type: "ally", sphere: "leadership", cost: 1, willpower: 1, attack: 1, defense: 1, health: 2, traits: ["Dwarf"] }));
  cards.set(RAM, definePrinted({ code: RAM, name: "Ram", type: "enemy", threat: 0, engagementCost: 50, attack: 1, defense: 0, health: 9 }));
  base = { ...starter, cards };
});

describe("Warrior Sword (19089:A:2)", () => {
  // "Attach to a Tactics or Warrior character.": Legolas (both), Théodred and Dúnhere (Warriors that are not Tactics), the Bowman (a Tactics
  // ally that is not a Warrior) and the Gondorian Spearman are offered; Beravor and Éowyn (neither) are not.
  lineSpec("19089:A:2", "Warrior Sword: Attach to a Tactics or Warrior character", (effects) => {
    const tab = table(effects, { heroes: [{ code: LEGOLAS, seat: 0 }, { code: THEODRED, seat: 0 }, { code: DUNHERE, seat: 0 }, { code: BERAVOR, seat: 0 }, { code: EOWYN, seat: 0 }], allies: [{ code: BOWMAN, seat: 0 }, { code: SPEARMAN, seat: 0 }], hand: [{ code: SWORD, seat: 0 }] });
    const sword = idsOf(tab, SWORD);
    expect(hosts(tab, sword)).toEqual([LEGOLAS, THEODRED, DUNHERE, BOWMAN, SPEARMAN].map((code) => idsOf(tab, code)).sort());
  });

  // "Limit 1 per character.": Legolas holds a Sword already, so the second is offered for the Spearman only.
  lineSpec("19089:A:2", "Warrior Sword: limit 1 per character", (effects) => {
    const tab = table(effects, { heroes: [{ code: LEGOLAS, seat: 0 }, { code: BERAVOR, seat: 0 }], allies: [{ code: SPEARMAN, seat: 0 }], attached: [{ code: SWORD, host: LEGOLAS }], hand: [{ code: SWORD, seat: 0 }] });
    const held = tab.ids[SWORD]?.find((id) => tab.state.cards[id]?.zone === "hand") ?? "";
    expect(hosts(tab, held)).toEqual([idsOf(tab, SPEARMAN)]);
  });

  // "Attached character gets +1 Attack for each enemy engaged with you. (Limit +3 Attack.)": Legolas with the Sword and one enemy engaged
  // has +1; he optionally engages the Ram and the state that intent returns gives +2; with 5 enemies engaged, +3. The enemy engaged with
  // the other player does not count.
  lineSpec("19089:A:2", "Warrior Sword: +1 Attack for each enemy engaged with you, at most +3", (effects) => {
    const tab = table(effects, { seats: 2, start: "encounter", heroes: [{ code: LEGOLAS, seat: 0 }, { code: PAL, seat: 1 }], attached: [{ code: SWORD, host: LEGOLAS }], engaged: [{ code: RAM, seat: 0 }, { code: RAM, seat: 1 }], staging: [RAM] });
    const legolas = idsOf(tab, LEGOLAS);
    const attack = printed(tab, LEGOLAS, "attack");
    expect(stat(tab.state, tab, legolas, "attack")).toBe(attack + 1);
    const staged = tab.ids[RAM]?.find((id) => tab.state.cards[id]?.zone === "staging") ?? "";
    const run = sendUnledgered(begin(tab.state), { type: "Engage", enemyId: staged }, tab.ctx);
    expect(run.state.cards[staged]?.zone).toBe("engaged");
    expect(stat(run.state, tab, legolas, "attack")).toBe(attack + 2);
    const crowded = table(effects, { heroes: [{ code: LEGOLAS, seat: 0 }], attached: [{ code: SWORD, host: LEGOLAS }], engaged: Array.from({ length: 5 }, () => ({ code: RAM, seat: 0 })) });
    expect(stat(crowded.state, crowded, idsOf(crowded, LEGOLAS), "attack")).toBe(attack + 3);
  });
});

describe("Valiant Determination (19092:A:1)", () => {
  // "Attach to an ally. Attached ally does not exhaust to quest.": the Ally of either player is offered, Éowyn (a hero) is not; on the Ally,
  // it commits to the quest and stays ready, while the Bowman, committed with it, exhausts.
  lineSpec("19092:A:1", "Valiant Determination: goes on an ally, which does not exhaust to quest", (effects) => {
    const tab = table(effects, { seats: 2, heroes: [{ code: EOWYN, seat: 0 }, { code: PAL, seat: 1 }], allies: [{ code: ALLY, seat: 0 }, { code: BOWMAN, seat: 0 }, { code: ALLY, seat: 1 }], hand: [{ code: VALIANT, seat: 0 }], deck: [RAM] });
    const [ally = "", theirs = ""] = tab.ids[ALLY] ?? [];
    const card = idsOf(tab, VALIANT);
    expect(hosts(tab, card)).toEqual([ally, idsOf(tab, BOWMAN), theirs].sort());
    let run = play(begin(tab.state), tab, card, ally);
    expect(run.state.cards[card]?.host).toBe(ally);
    const quest = { ...run.state, phase: "Quest" as const, boundaryPhase: "Quest" as const, mode: "questCommit" as const, window: { kind: "pass" as const }, activeSeat: 0 };
    run = sendUnledgered(begin(quest), { type: "Commit", cardIds: [ally, idsOf(tab, BOWMAN)] }, tab.ctx);
    expect(run.state.cards[ally]).toMatchObject({ committed: true, exhausted: false });
    expect(run.state.cards[idsOf(tab, BOWMAN)]).toMatchObject({ committed: true, exhausted: true });
  });
});

describe("Ring of Thrór (19093:A:1, A:2, A:3)", () => {
  // Gimli, Glóin (Dwarf heroes) and Beravor, and a Dwarf ally; the Ring is played and searches the encounter deck for its guard, the Ram.
  function guarded(effects: readonly Effect[]): { tab: Table; run: Run } {
    const tab = table(effects, { heroes: [{ code: GIMLI, seat: 0 }, { code: GLOIN, seat: 0 }, { code: BERAVOR, seat: 0 }], allies: [{ code: DWARF, seat: 0 }], hand: [{ code: RING, seat: 0 }], deck: [RAM] });
    const ring = idsOf(tab, RING);
    const [hostId] = hosts(tab, ring);
    const run = sendUnledgered(begin(tab.state), { type: "PlayCard", cardId: ring, ...(hostId ? { hostId } : {}), payments: payFor(tab.state, tab.ctx, ring) }, tab.ctx);
    return { tab, run };
  }

  // "Guarded (enemy or location).": the Ram comes off the encounter deck into the staging area with the Ring attached to it.
  lineSpec("19093:A:1", "Ring of Thrór: is guarded by the first enemy or location of the encounter deck", (effects) => {
    const { tab, run } = guarded(effects);
    const [ring, ram] = [idsOf(tab, RING), idsOf(tab, RAM)];
    expect(run.state.cards[ram]?.zone).toBe("staging");
    expect(run.state.cards[ram]?.attachments).toEqual([ring]);
    expect(run.state.cards[ring]?.host).toBe(ram);
  });

  // Guarded: once the Ram leaves play, the Ring is free and its owner puts it into play (wor.guarded-x): it leaves the staging area and is
  // attached under the player's control, with no cost paid.
  lineSpec("19093:A:1", "Ring of Thrór: once its guard leaves play, its owner puts it into play", (effects) => {
    const { tab, run: played } = guarded(effects);
    const [ring, ram] = [idsOf(tab, RING), idsOf(tab, RAM)];
    const resources = played.state.cards[idsOf(tab, GIMLI)]?.resources;
    let run = sendUnledgered(begin(placeDamage(played.state, ram, 9, tab.ctx.cards, [], "framework", ruleCause("rr.damage"))), { type: "Pass" }, tab.ctx);
    expect(run.state.window?.kind).toBe("choose");
    run = sendUnledgered(run, { type: "Choose", optionId: idsOf(tab, GIMLI) }, tab.ctx);
    expect(run.state.cards[ring]).toMatchObject({ host: idsOf(tab, GIMLI), zone: "play", controller: 0 });
    expect(run.state.cards[idsOf(tab, GIMLI)]?.resources).toBe(resources);
  });

  // "Attach to a Dwarf hero.": the Ram destroyed, the player attaches the Ring to Gimli or Glóin; not to Beravor or the Dwarf ally.
  lineSpec("19093:A:2", "Ring of Thrór: once free of its guard, goes on a Dwarf hero", (effects) => {
    const { tab, run: played } = guarded(effects);
    const [ring, ram] = [idsOf(tab, RING), idsOf(tab, RAM)];
    let run = sendUnledgered(begin(placeDamage(played.state, ram, 9, tab.ctx.cards, [], "framework", ruleCause("rr.damage"))), { type: "Pass" }, tab.ctx);
    expect(run.state.cards[ram]?.zone).not.toBe("staging");
    expect(choices(run.state, tab).sort()).toEqual([idsOf(tab, GIMLI), idsOf(tab, GLOIN)].sort());
    run = sendUnledgered(run, { type: "Choose", optionId: idsOf(tab, GLOIN) }, tab.ctx);
    expect(run.state.cards[ring]).toMatchObject({ host: idsOf(tab, GLOIN), zone: "play", controller: 0 });
  });

  // Gimli, exhausted, holds the Ring; the deck's top card is `top`, then a plain card; Beravor is the other hero.
  function ringed(effects: readonly Effect[], top: string): Table {
    const tab = table(effects, { heroes: [{ code: GIMLI, seat: 0 }, { code: BERAVOR, seat: 0 }], attached: [{ code: RING, host: GIMLI }], playerDeck: [{ code: top, seat: 0 }, { code: CARD, seat: 0 }] });
    return { ...tab, state: updateCard(tab.state, idsOf(tab, GIMLI), { exhausted: true }) };
  }

  // "Action: Exhaust Thrór's Ring and discard the top card of your deck to ready attached hero. If the discarded card is an attachment, put
  // it into play.": the top card is Citadel Plate; the Ring exhausts, Gimli readies, and the Plate goes into play on the hero chosen (Beravor).
  lineSpec("19093:A:3", "Ring of Thrór: exhaust it and discard the top card to ready the hero, and put a discarded attachment into play", (effects) => {
    const tab = ringed(effects, PLATE);
    const [ring, gimli, plate] = [idsOf(tab, RING), idsOf(tab, GIMLI), idsOf(tab, PLATE)];
    let run = sendUnledgered(begin(tab.state), { type: "Trigger", cardId: ring, effectId: "19093:action:1" }, tab.ctx);
    expect(run.state.cards[ring]?.exhausted).toBe(true);
    expect(run.state.cards[gimli]?.exhausted).toBe(false);
    expect(run.state.window?.kind).toBe("choose");
    expect(choices(run.state, tab).sort()).toEqual([gimli, idsOf(tab, BERAVOR)].sort());
    run = sendUnledgered(run, { type: "Choose", optionId: idsOf(tab, BERAVOR) }, tab.ctx);
    expect(run.state.cards[plate]).toMatchObject({ zone: "play", host: idsOf(tab, BERAVOR), controller: 0 });
    expect(run.state.seats[0]?.deck).toHaveLength(1);
  });

  // The discarded card is an event: Gimli readies, and the event stays in the discard pile.
  it("19093:A:3 Ring of Thrór: a discarded card that is not an attachment stays in the discard pile", () => {
    const tab = ringed(EFFECTS, CARD);
    const top = tab.state.seats[0]?.deck[0] ?? "";
    const run = sendUnledgered(begin(tab.state), { type: "Trigger", cardId: idsOf(tab, RING), effectId: "19093:action:1" }, tab.ctx);
    expect(run.state.window?.kind).not.toBe("choose");
    expect(run.state.cards[idsOf(tab, GIMLI)]?.exhausted).toBe(false);
    expect(run.state.cards[top]?.zone).toBe("discard");
  });

  // An empty deck has no top card to discard: the cost cannot be paid.
  it("19093:A:3 Ring of Thrór: not offered with an empty deck", () => {
    const tab = table(EFFECTS, { heroes: [{ code: GIMLI, seat: 0 }], attached: [{ code: RING, host: GIMLI }] });
    expect(triggers(updateCard(tab.state, idsOf(tab, GIMLI), { exhausted: true }), tab)).not.toContain("19093:action:1");
  });
});
