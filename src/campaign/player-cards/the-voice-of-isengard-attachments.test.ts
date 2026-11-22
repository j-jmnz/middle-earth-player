// Rules: rr.attachment-cards, rr.restricted, rr.response, rr.cost, rr.shadow-effects, rr.step-6-1, rr.doomed-x, rr.destroy,
// rr.triggered-ability (data/rules/entries.json).
// The Voice of Isengard attachments, each printed line tested from the words on the card (data/cards/VoI.json: data/printed holds no
// ledger for this pack, so the lines are the text of data/cards and every intent goes through sendUnledgered): Rohan Warhorse 07008:A:1
// and A:2, Silver Lamp 07009:A:1 and A:2, Keys of Orthanc 07010:A:1 and A:2.
import { beforeAll, describe, expect, it } from "vitest";

import type { Effect } from "../../catalog/boundary.ts";
import { EFFECTS } from "../../effects/index.ts";
import { definePrinted } from "../../rules/core/printed.ts";
import { updateCard } from "../../rules/core/state.ts";
import { starterBase } from "../../../test/scenarios/a-shadow-of-the-past/starter-scene.ts";
import { loadPrinted } from "../../../test/harness/catalog.ts";
import { lineSpec } from "../../../test/harness/line-spec.ts";
import { begin, idsOf, type Scene, type Table } from "../../../test/harness/scene.ts";
import { attach, attacking, combat, fillers, hosts, play, playerTable, sendUnledgered, triggers } from "../../../test/harness/player-table.ts";

const WARHORSE = "07008";
const LAMP = "07009";
const KEYS = "07010";
// Deep Knowledge: "Doomed 2. Action: Each player draws 2 cards." (Lore, cost 0).
const DEEP = "07012";
// Core Théodred (Leadership, Rohan), Gimli (Tactics, not Rohan), Éowyn (Spirit, Rohan), Denethor (Lore, Gondor), Eleanor (Spirit, Gondor),
// Legolas (Tactics).
const THEODRED = "01002";
const GIMLI = "01004";
const LEGOLAS = "01005";
const EOWYN = "01007";
const ELEANOR = "01008";
const DENETHOR = "01010";
// Snowbourn Scout: a Rohan ally. Horseback Archer: a Tactics Rohan ally.
const SNOWBOURN = "01016";
const ARCHER = "01030";
// Stand-ins: an enemy an attack of 2 destroys, an enemy that survives, a location for the shadow card.
const FRAIL = "frail";
const WALL = "wall";
const GLADE = "glade";
const DOOM = "doom";
const PAL = "pal";
const PLAIN = "plain";

let base: Awaited<ReturnType<typeof starterBase>>;

const table = (effects: readonly Effect[], scene: Scene = {}, resources = 6): Table => playerTable(base, effects, scene, resources);

beforeAll(async () => {
  const starter = await starterBase();
  const codes = [WARHORSE, LAMP, KEYS, DEEP, THEODRED, GIMLI, LEGOLAS, EOWYN, ELEANOR, DENETHOR, SNOWBOURN, ARCHER];
  const cards = new Map([...starter.cards, ...(await loadPrinted(codes))]);
  cards.set(FRAIL, definePrinted({ code: FRAIL, name: "Frail", type: "enemy", threat: 1, engagementCost: 50, attack: 1, defense: 0, health: 1 }));
  cards.set(WALL, definePrinted({ code: WALL, name: "Wall", type: "enemy", threat: 1, engagementCost: 50, attack: 1, defense: 9, health: 9 }));
  cards.set(DOOM, definePrinted({ code: DOOM, name: "Doom", type: "treachery", keywords: { doomed: 1 } }));
  cards.set(GLADE, definePrinted({ code: GLADE, name: "Glade", type: "location", threat: 1, questPoints: 5 }));
  base = { ...starter, cards };
});

describe("Rohan Warhorse (07008:A:1, A:2)", () => {
  // "Attach to a Tactics or Rohan hero.": Gimli (Tactics), Théodred and Éowyn (Rohan) are each offered; Denethor (neither) and the
  // Horseback Archer (a Tactics Rohan ally) are not.
  lineSpec("07008:A:1", "Rohan Warhorse: Attach to a Tactics or Rohan hero", (effects) => {
    const tab = table(effects, { heroes: [{ code: GIMLI, seat: 0 }, { code: THEODRED, seat: 0 }, { code: EOWYN, seat: 0 }, { code: DENETHOR, seat: 0 }], allies: [{ code: ARCHER, seat: 0 }], hand: [{ code: WARHORSE, seat: 0 }] });
    const warhorse = idsOf(tab, WARHORSE);
    expect(hosts(tab, warhorse)).toEqual([idsOf(tab, GIMLI), idsOf(tab, THEODRED), idsOf(tab, EOWYN)].sort());
    expect(play(begin(tab.state), tab, warhorse, idsOf(tab, EOWYN)).state.cards[warhorse]?.host).toBe(idsOf(tab, EOWYN));
  });

  // "Restricted.": a third restricted attachment cannot stay on the hero (rr.restricted): with two Warhorses on Gimli, a third played on
  // him sends one of them to the discard pile.
  it("07008:A:1 Rohan Warhorse: Restricted", () => {
    const start = table(EFFECTS, { heroes: [{ code: GIMLI, seat: 0 }], hand: [{ code: WARHORSE, seat: 0 }, { code: WARHORSE, seat: 0 }, { code: WARHORSE, seat: 0 }] });
    const [first = "", second = "", third = ""] = start.ids[WARHORSE] ?? [];
    const gimli = idsOf(start, GIMLI);
    let run = play(play(begin(start.state), start, first, gimli), start, second, gimli);
    expect(run.state.cards[gimli]?.attachments).toHaveLength(2);
    run = play(run, start, third, gimli);
    for (let guard = 0; guard < 3 && run.state.window?.kind === "choose"; guard += 1) run = sendUnledgered(run, { type: "Choose", optionId: first }, start.ctx);
    expect([first, second, third].filter((id) => run.state.cards[id]?.host === gimli)).toHaveLength(2);
  });

  // "Response: After attached hero participates in an attack that destroys an enemy, exhaust Rohan Warhorse to ready attached hero.":
  // Gimli and Legolas attack the Frail and destroy it; the Warhorse exhausts and Gimli is readied, Legolas is not.
  lineSpec("07008:A:2", "Rohan Warhorse: after the attached hero's attack destroys an enemy, exhaust it to ready him", (effects) => {
    const start = table(effects, { heroes: [{ code: GIMLI, seat: 0 }, { code: LEGOLAS, seat: 0 }], attached: [{ code: WARHORSE, host: GIMLI }], engaged: [{ code: FRAIL, seat: 0 }] });
    const tab = attach(start, []);
    const [gimli, legolas, warhorse, frail] = [idsOf(tab, GIMLI), idsOf(tab, LEGOLAS), idsOf(tab, WARHORSE), idsOf(tab, FRAIL)];
    let run = sendUnledgered(begin(attacking(tab.state)), { type: "DeclareAttackers", enemyId: frail, attackerIds: [gimli, legolas] }, tab.ctx);
    expect(run.state.cards[frail]?.zone).not.toBe("engaged");
    expect(run.state.cards[gimli]?.exhausted).toBe(true);
    // Legolas's own Response to the same attack is offered first; it is passed.
    expect(triggers(run.state, tab)).toEqual(["01005:response:1"]);
    run = sendUnledgered(run, { type: "Pass" }, tab.ctx);
    expect(triggers(run.state, tab)).toContain("07008:response:1");
    run = sendUnledgered(run, { type: "Trigger", cardId: warhorse, effectId: "07008:response:1" }, tab.ctx);
    expect(run.state.cards[warhorse]?.exhausted).toBe(true);
    expect(run.state.cards[gimli]?.exhausted).toBe(false);
    expect(run.state.cards[legolas]?.exhausted).toBe(true);
  });

  // An attack the attached hero is not in: no Response.
  it("07008:A:2 Rohan Warhorse: not offered when the attached hero did not attack", () => {
    const tab = table(EFFECTS, { heroes: [{ code: GIMLI, seat: 0 }, { code: LEGOLAS, seat: 0 }], attached: [{ code: WARHORSE, host: GIMLI }], engaged: [{ code: FRAIL, seat: 0 }] });
    const run = sendUnledgered(begin(attacking(tab.state)), { type: "DeclareAttackers", enemyId: idsOf(tab, FRAIL), attackerIds: [idsOf(tab, LEGOLAS)] }, tab.ctx);
    expect(run.state.cards[idsOf(tab, FRAIL)]?.zone).not.toBe("engaged");
    expect(triggers(run.state, tab)).not.toContain("07008:response:1");
  });

  // An attack that does not destroy the enemy: no Response.
  it("07008:A:2 Rohan Warhorse: not offered when the attack does not destroy the enemy", () => {
    const tab = table(EFFECTS, { heroes: [{ code: GIMLI, seat: 0 }], attached: [{ code: WARHORSE, host: GIMLI }], engaged: [{ code: WALL, seat: 0 }] });
    const run = sendUnledgered(begin(attacking(tab.state)), { type: "DeclareAttackers", enemyId: idsOf(tab, WALL), attackerIds: [idsOf(tab, GIMLI)] }, tab.ctx);
    expect(run.state.cards[idsOf(tab, WALL)]?.zone).toBe("engaged");
    expect(triggers(run.state, tab)).not.toContain("07008:response:1");
  });
});

describe("Silver Lamp (07009:A:1, A:2)", () => {
  // "Attach to a Spirit hero.": Éowyn and Eleanor (Spirit) are offered; Denethor (Lore) and the Snowbourn Scout (an ally) are not.
  lineSpec("07009:A:1", "Silver Lamp: Attach to a Spirit hero", (effects) => {
    const tab = table(effects, { heroes: [{ code: EOWYN, seat: 0 }, { code: ELEANOR, seat: 0 }, { code: DENETHOR, seat: 0 }], allies: [{ code: SNOWBOURN, seat: 0 }], hand: [{ code: LAMP, seat: 0 }] });
    const lamp = idsOf(tab, LAMP);
    expect(hosts(tab, lamp)).toEqual([idsOf(tab, EOWYN), idsOf(tab, ELEANOR)].sort());
    expect(play(begin(tab.state), tab, lamp, idsOf(tab, ELEANOR)).state.cards[lamp]?.host).toBe(idsOf(tab, ELEANOR));
  });

  // The combat phase begins with the Wall engaged with the first player and the encounter deck holding Glades: the shadow card dealt to
  // the Wall, and its face.
  function shadowFace(effects: readonly Effect[], seats: 1 | 2, engagedSeat: number, exhausted: boolean): string | undefined {
    const start = table(effects, { seats, heroes: [{ code: EOWYN, seat: 0 }, ...(seats === 2 ? [{ code: PAL, seat: 1 }] : [])], attached: [{ code: LAMP, host: EOWYN }], engaged: [{ code: WALL, seat: engagedSeat }], deck: [GLADE, GLADE, GLADE] });
    const state = exhausted ? updateCard(start.state, idsOf(start, EOWYN), { exhausted: true }) : start.state;
    const tab = attach({ ...start, state }, []);
    const run = combat(tab.state, tab);
    const shadow = run.state.cards[idsOf(tab, WALL)]?.shadowId ?? "";
    return run.state.cards[shadow]?.face;
  }

  // "While attached hero is ready, shadow cards dealt to enemies engaged with you are dealt face up.": Éowyn is ready, the Wall's shadow
  // card is face up.
  lineSpec("07009:A:2", "Silver Lamp: shadow cards dealt to enemies engaged with you are face up while the hero is ready", (effects) => {
    expect(shadowFace(effects, 1, 0, false)).toBe("up");
  });

  // Éowyn exhausted: the shadow card is dealt face down.
  it("07009:A:2 Silver Lamp: face down while the attached hero is exhausted", () => {
    expect(shadowFace(EFFECTS, 1, 0, true)).toBe("down");
  });

  // "engaged with you": the shadow card of an enemy engaged with the other player is dealt face down.
  it("07009:A:2 Silver Lamp: an enemy engaged with another player gets its shadow face down", () => {
    expect(shadowFace(EFFECTS, 2, 1, false)).toBe("down");
  });
});

describe("Keys of Orthanc (07010:A:1, A:2)", () => {
  // "Attach to a hero.": every hero is offered (the other player's too); an ally is not.
  lineSpec("07010:A:1", "Keys of Orthanc: Attach to a hero", (effects) => {
    const tab = table(effects, { seats: 2, heroes: [{ code: DENETHOR, seat: 0 }, { code: GIMLI, seat: 0 }, { code: PAL, seat: 1 }], allies: [{ code: SNOWBOURN, seat: 0 }], hand: [{ code: KEYS, seat: 0 }] });
    const keys = idsOf(tab, KEYS);
    expect(hosts(tab, keys)).toEqual([idsOf(tab, DENETHOR), idsOf(tab, GIMLI), idsOf(tab, PAL)].sort());
    expect(play(begin(tab.state), tab, keys, idsOf(tab, GIMLI)).state.cards[keys]?.host).toBe(idsOf(tab, GIMLI));
  });

  // "Response: After you raise your threat from the Doomed keyword, exhaust Keys of Orthanc to add 1 resource to attached hero's
  // resource pool.": Deep Knowledge (Doomed 2) is played by Denethor; the Keys on Gimli exhaust and Gimli gets 1 resource.
  lineSpec("07010:A:2", "Keys of Orthanc: after a Doomed threat raise, exhaust them to add 1 resource to the attached hero", (effects) => {
    const tab = table(effects, { heroes: [{ code: DENETHOR, seat: 0 }, { code: GIMLI, seat: 0 }], attached: [{ code: KEYS, host: GIMLI }], hand: [{ code: DEEP, seat: 0 }], playerDeck: fillers(PLAIN, 4) });
    const [gimli, keys] = [idsOf(tab, GIMLI), idsOf(tab, KEYS)];
    let run = play(begin(tab.state), tab, idsOf(tab, DEEP));
    expect(run.state.seats[0]?.threat).toBe(8 + 2);
    expect(triggers(run.state, tab)).toContain("07010:response:1");
    run = sendUnledgered(run, { type: "Trigger", cardId: keys, effectId: "07010:response:1" }, tab.ctx);
    expect(run.state.cards[keys]?.exhausted).toBe(true);
    expect(run.state.cards[gimli]?.resources).toBe(6 + 1);
  });

  // An encounter card with Doomed revealed in the staging step raises the threat from the Doomed keyword (rr.doomed-x): the Keys answer it.
  lineSpec("07010:A:2", "Keys of Orthanc: after a doomed encounter card is revealed, 1 resource to the attached hero", (effects) => {
    const tab = table(effects, { start: "quest", heroes: [{ code: DENETHOR, seat: 0 }, { code: GIMLI, seat: 0 }], allies: [{ code: SNOWBOURN, seat: 0 }], attached: [{ code: KEYS, host: GIMLI }], deck: [DOOM, GLADE] });
    const [gimli, keys] = [idsOf(tab, GIMLI), idsOf(tab, KEYS)];
    let run = sendUnledgered(begin(tab.state), { type: "Commit", cardIds: [idsOf(tab, SNOWBOURN)] }, tab.ctx);
    run = sendUnledgered(run, { type: "Pass" }, tab.ctx);
    expect(run.state.seats[0]?.threat).toBe(8 + 1);
    expect(triggers(run.state, tab)).toContain("07010:response:1");
    run = sendUnledgered(run, { type: "Trigger", cardId: keys, effectId: "07010:response:1" }, tab.ctx);
    expect(run.state.cards[gimli]?.resources).toBe(6 + 1);
  });

  // The Keys exhausted: the cost cannot be paid, so the Response is not offered.
  it("07010:A:2 Keys of Orthanc: not offered while exhausted", () => {
    const start = table(EFFECTS, { heroes: [{ code: DENETHOR, seat: 0 }, { code: GIMLI, seat: 0 }], attached: [{ code: KEYS, host: GIMLI }], hand: [{ code: DEEP, seat: 0 }], playerDeck: fillers(PLAIN, 4) });
    const tab = { ...start, state: updateCard(start.state, idsOf(start, KEYS), { exhausted: true }) };
    const run = play(begin(tab.state), tab, idsOf(tab, DEEP));
    expect(run.state.seats[0]?.threat).toBe(8 + 2);
    expect(triggers(run.state, tab)).not.toContain("07010:response:1");
  });
});
