// Rules: rr.attachment-cards, rr.location-cards, rr.active-location, rr.deckbuilding, rr.quest-phase, rr.exhausted, rr.action, rr.cost,
// rr.damage, rr.triggered-ability (data/rules/entries.json).
// The Foundations of Stone attachments, written from their card text (data/cards/FoS.json; data/printed holds no ledger for this pack, so
// every intent goes through sendUnledgered): Path of Need 04103:A:1 and A:2, Light of Valinor 04107:A:1 and A:2, Healing Herbs 04109:A:1
// and A:2, Asfaloth 04110:A:1 and A:2.
import { beforeAll, describe, expect, it } from "vitest";

import type { Effect } from "../../catalog/boundary.ts";
import { deckSaveRefusal } from "../../catalog/deck-save.ts";
import { EFFECTS } from "../../effects/index.ts";
import { definePrinted } from "../../rules/core/printed.ts";
import { updateCard } from "../../rules/core/state.ts";
import { starterBase } from "../../../test/scenarios/a-shadow-of-the-past/starter-scene.ts";
import { loadPrinted } from "../../../test/harness/catalog.ts";
import { lineSpec } from "../../../test/harness/line-spec.ts";
import { begin, idsOf, type Scene, type Table } from "../../../test/harness/scene.ts";
import { attach, attacking, choices, combat, deckSaveFacts, hosts, packRow, passAll, play, playerTable, sendUnledgered, triggers } from "../../../test/harness/player-table.ts";

const GLORFINDEL = "04101";
const PATH = "04103";
const SCOUT = "04104";
const VALINOR = "04107";
const HERBS = "04109";
const ASFALOTH = "04110";
// Core heroes: Aragorn (Leadership, Dúnedain), Legolas (Tactics, Silvan), Éowyn (Spirit, Rohan), Beravor (Lore, Dúnedain). Erestor: a Lore
// Noldor hero. Henamarth Riversong: a Lore Silvan ally. The Trollshaw Scout: a Noldor ally.
const ARAGORN = "01001";
const LEGOLAS = "01005";
const EOWYN = "01007";
const BERAVOR = "01012";
const ERESTOR = "10084";
const HENAMARTH = "01060";
const WEAK = "weak";
const LOC = "loc";
const PAL = "pal";

let base: Awaited<ReturnType<typeof starterBase>>;

const table = (effects: readonly Effect[], scene: Scene = {}, resources = 6): Table => playerTable(base, effects, scene, resources);

beforeAll(async () => {
  const starter = await starterBase();
  const cards = new Map([...starter.cards, ...(await loadPrinted([GLORFINDEL, PATH, SCOUT, VALINOR, HERBS, ASFALOTH, ARAGORN, LEGOLAS, EOWYN, BERAVOR, ERESTOR, HENAMARTH]))]);
  cards.set(WEAK, definePrinted({ code: WEAK, name: "Weak", type: "enemy", threat: 1, engagementCost: 40, attack: 1, defense: 0, health: 9 }));
  cards.set(LOC, definePrinted({ code: LOC, name: "Loc", type: "location", threat: 1, questPoints: 9 }));
  base = { ...starter, cards };
});

const exhausted = (tab: Table, id: string): Table => ({ ...tab, state: updateCard(tab.state, id, { exhausted: true }) });

describe("Path of Need (04103:A:1, A:2)", () => {
  // "Limit 1 per deck." The deck check reads the card's deck limit (data/cards/FoS.json), which the DeckLimit record restates.
  it("04103:A:1 Path of Need: a deck holds at most 1 copy", () => {
    const row = packRow("FoS", PATH);
    expect(row?.deckLimit).toBe(1);
    const events = Array.from({ length: 50 }, (_, index) => ({ code: `e${index}`, count: 1 }));
    expect(deckSaveRefusal(["h1"], [...events, { code: PATH, count: 1 }], deckSaveFacts(row))).toBeNull();
    expect(deckSaveRefusal(["h1"], [...events, { code: PATH, count: 2 }], deckSaveFacts(row))).toMatchObject({ cardCode: PATH });
  });

  // "Attach to a location.": the active location and a location in the staging area are offered; Aragorn (a hero) and the engaged enemy
  // are not. Aragorn (Leadership) pays its cost of 4.
  lineSpec("04103:A:1", "Path of Need: Attach to a location", (effects) => {
    const tab = table(effects, { heroes: [{ code: ARAGORN, seat: 0 }], active: LOC, staging: [LOC], engaged: [{ code: WEAK, seat: 0 }], hand: [{ code: PATH, seat: 0 }] });
    const path = idsOf(tab, PATH);
    const [staged = "", active = ""] = tab.ids[LOC] ?? [];
    expect(tab.state.cards[active]?.zone).toBe("activeLocation");
    expect(hosts(tab, path)).toEqual([active, staged].sort());
    const run = play(begin(tab.state), tab, path, active);
    expect(run.state.cards[path]?.host).toBe(active);
    expect(run.state.cards[idsOf(tab, ARAGORN)]?.resources).toBe(6 - 4);
  });

  // Path of Need on the active location (`active` true) or on a location in the staging area, Aragorn and Legolas (heroes) and a plain ally.
  function path(effects: readonly Effect[], onActive: boolean): { tab: Table; aragorn: string; legolas: string; ally: string; weak: string } {
    const scene = table(effects, { start: "quest", heroes: [{ code: ARAGORN, seat: 0 }, { code: LEGOLAS, seat: 0 }], allies: [{ code: "ally", seat: 0 }, { code: PATH, seat: 0 }], active: LOC, staging: [LOC], engaged: [{ code: WEAK, seat: 0 }, { code: WEAK, seat: 0 }], deck: ["f0", "f0"] });
    const [staged = "", active = ""] = scene.ids[LOC] ?? [];
    const tab = attach(scene, [[idsOf(scene, PATH), onActive ? active : staged]]);
    return { tab, aragorn: idsOf(tab, ARAGORN), legolas: idsOf(tab, LEGOLAS), ally: idsOf(tab, "ally"), weak: idsOf(tab, WEAK) };
  }

  // "Heroes do not exhaust to attack, defend, or commit to a quest while attached location is the active location.": Aragorn commits and
  // stays ready while the ally that commits with him exhausts; in combat Legolas defends and Aragorn attacks, and neither exhausts.
  lineSpec("04103:A:2", "Path of Need: heroes do not exhaust to quest, defend or attack while it is on the active location", (effects) => {
    const { tab, aragorn, legolas, ally, weak } = path(effects, true);
    const quested = sendUnledgered(begin(tab.state), { type: "Commit", cardIds: [aragorn, ally] }, tab.ctx);
    expect(quested.state.cards[aragorn]).toMatchObject({ committed: true, exhausted: false });
    expect(quested.state.cards[ally]?.exhausted).toBe(true);
    let run = passAll(combat(tab.state, tab), tab.ctx);
    if (run.state.window?.kind === "chooseEnemy") run = passAll(sendUnledgered(run, { type: "ChooseEnemy", enemyId: weak }, tab.ctx), tab.ctx);
    expect(run.state.window?.kind).toBe("defense");
    run = sendUnledgered(run, { type: "DeclareDefender", defenderId: legolas }, tab.ctx);
    expect(run.state.cards[legolas]?.exhausted).toBe(false);
    const attacked = sendUnledgered(begin(attacking(tab.state)), { type: "DeclareAttackers", enemyId: weak, attackerIds: [aragorn] }, tab.ctx);
    expect(attacked.state.cards[aragorn]?.exhausted).toBe(false);
  });

  // On a location in the staging area it does nothing: Aragorn exhausts to commit and to attack.
  it("04103:A:2 Path of Need: heroes exhaust as usual while its location is not the active location", () => {
    const { tab, aragorn, weak } = path(EFFECTS, false);
    const quested = sendUnledgered(begin(tab.state), { type: "Commit", cardIds: [aragorn] }, tab.ctx);
    expect(quested.state.cards[aragorn]?.exhausted).toBe(true);
    const attacked = sendUnledgered(begin(attacking(tab.state)), { type: "DeclareAttackers", enemyId: weak, attackerIds: [aragorn] }, tab.ctx);
    expect(attacked.state.cards[aragorn]?.exhausted).toBe(true);
  });
});

describe("Light of Valinor (04107:A:1, A:2)", () => {
  // "Attach to a Noldor or Silvan hero.": Glorfindel (Noldor) and Legolas (Silvan) are offered; Éowyn (a hero of neither), the Trollshaw
  // Scout (a Noldor ally) and Henamarth Riversong (a Silvan ally) are not. Glorfindel (Spirit) pays.
  lineSpec("04107:A:1", "Light of Valinor: Attach to a Noldor or Silvan hero", (effects) => {
    const tab = table(effects, { heroes: [{ code: GLORFINDEL, seat: 0 }, { code: LEGOLAS, seat: 0 }, { code: EOWYN, seat: 0 }], allies: [{ code: SCOUT, seat: 0 }, { code: HENAMARTH, seat: 0 }], hand: [{ code: VALINOR, seat: 0 }] });
    const light = idsOf(tab, VALINOR);
    expect(hosts(tab, light)).toEqual([idsOf(tab, GLORFINDEL), idsOf(tab, LEGOLAS)].sort());
    expect(play(begin(tab.state), tab, light, idsOf(tab, LEGOLAS)).state.cards[light]?.host).toBe(idsOf(tab, LEGOLAS));
  });

  // "Attached hero does not exhaust to commit to a quest.": Legolas commits with it and stays ready; Éowyn, who commits beside him, exhausts.
  lineSpec("04107:A:2", "Light of Valinor: the attached hero does not exhaust to commit", (effects) => {
    const tab = table(effects, { start: "quest", heroes: [{ code: LEGOLAS, seat: 0 }, { code: EOWYN, seat: 0 }], attached: [{ code: VALINOR, host: LEGOLAS }], deck: ["f0", "f0"] });
    const [legolas, eowyn] = [idsOf(tab, LEGOLAS), idsOf(tab, EOWYN)];
    const run = sendUnledgered(begin(tab.state), { type: "Commit", cardIds: [legolas, eowyn] }, tab.ctx);
    expect(run.state.cards[legolas]).toMatchObject({ committed: true, exhausted: false });
    expect(run.state.cards[eowyn]).toMatchObject({ committed: true, exhausted: true });
  });
});

describe("Healing Herbs (04109:A:1, A:2)", () => {
  // "Attach to a Lore hero.": Beravor and Erestor (Lore heroes) are offered; Legolas (Tactics hero) and Henamarth Riversong (a Lore ally)
  // are not.
  lineSpec("04109:A:1", "Healing Herbs: Attach to a Lore hero", (effects) => {
    const tab = table(effects, { heroes: [{ code: BERAVOR, seat: 0 }, { code: ERESTOR, seat: 0 }, { code: LEGOLAS, seat: 0 }], allies: [{ code: HENAMARTH, seat: 0 }], hand: [{ code: HERBS, seat: 0 }] });
    const herbs = idsOf(tab, HERBS);
    expect(hosts(tab, herbs)).toEqual([idsOf(tab, BERAVOR), idsOf(tab, ERESTOR)].sort());
    expect(play(begin(tab.state), tab, herbs, idsOf(tab, ERESTOR)).state.cards[herbs]?.host).toBe(idsOf(tab, ERESTOR));
  });

  // Beravor holds the Herbs; Legolas has 3 damage and the other player's hero 1.
  function herbs(effects: readonly Effect[]): { tab: Table; herbs: string; beravor: string; legolas: string; pal: string } {
    const scene = table(effects, { seats: 2, heroes: [{ code: BERAVOR, seat: 0 }, { code: LEGOLAS, seat: 0 }, { code: PAL, seat: 1 }], attached: [{ code: HERBS, host: BERAVOR }] });
    const [legolas, pal] = [idsOf(scene, LEGOLAS), idsOf(scene, PAL)];
    const tab = { ...scene, state: updateCard(updateCard(scene.state, legolas, { damage: 3 }), pal, { damage: 1 }) };
    return { tab, herbs: idsOf(tab, HERBS), beravor: idsOf(tab, BERAVOR), legolas, pal };
  }

  // "Action: Discard Healing Herbs and exhaust attached hero to heal all damage on 1 character.": the damaged characters of both players are
  // offered; Legolas is healed of all 3, Beravor is exhausted and the Herbs are discarded. The other player's hero keeps its damage.
  lineSpec("04109:A:2", "Healing Herbs: discard it and exhaust the hero to heal all damage on 1 character", (effects) => {
    const { tab, herbs: card, beravor, legolas, pal } = herbs(effects);
    let run = sendUnledgered(begin(tab.state), { type: "Trigger", cardId: card, effectId: "04109:action:1" }, tab.ctx);
    expect(choices(run.state, tab).sort()).toEqual([legolas, pal].sort());
    run = sendUnledgered(run, { type: "Choose", optionId: legolas }, tab.ctx);
    expect(run.state.cards[legolas]?.damage).toBe(0);
    expect(run.state.cards[pal]?.damage).toBe(1);
    expect(run.state.cards[beravor]?.exhausted).toBe(true);
    expect(run.state.cards[card]?.zone).toBe("discard");
  });

  // No damaged character: nothing to heal, so the Action is not offered.
  it("04109:A:2 Healing Herbs: not offered with no damaged character", () => {
    const tab = table(EFFECTS, { heroes: [{ code: BERAVOR, seat: 0 }, { code: LEGOLAS, seat: 0 }], attached: [{ code: HERBS, host: BERAVOR }] });
    expect(triggers(tab.state, tab)).not.toContain("04109:action:1");
  });

  // An exhausted Beravor cannot exhaust to pay the cost (rr.exhausted).
  it("04109:A:2 Healing Herbs: not offered while the attached hero is exhausted", () => {
    const { tab, beravor } = herbs(EFFECTS);
    expect(triggers(exhausted(tab, beravor).state, tab)).not.toContain("04109:action:1");
  });
});

describe("Asfaloth (04110:A:1, A:2)", () => {
  // "Attach to a Noldor or Silvan hero.": Glorfindel and Legolas are offered; Beravor (Lore, neither), the Trollshaw Scout (a Noldor ally)
  // and Henamarth Riversong (a Silvan ally) are not. Beravor (Lore) pays.
  lineSpec("04110:A:1", "Asfaloth: Attach to a Noldor or Silvan hero", (effects) => {
    const tab = table(effects, { heroes: [{ code: GLORFINDEL, seat: 0 }, { code: LEGOLAS, seat: 0 }, { code: BERAVOR, seat: 0 }], allies: [{ code: SCOUT, seat: 0 }, { code: HENAMARTH, seat: 0 }], hand: [{ code: ASFALOTH, seat: 0 }] });
    const horse = idsOf(tab, ASFALOTH);
    expect(hosts(tab, horse)).toEqual([idsOf(tab, GLORFINDEL), idsOf(tab, LEGOLAS)].sort());
    expect(play(begin(tab.state), tab, horse, idsOf(tab, GLORFINDEL)).state.cards[horse]?.host).toBe(idsOf(tab, GLORFINDEL));
  });

  // Asfaloth on `host`, an active location and a location in the staging area.
  function horse(effects: readonly Effect[], host: string): { tab: Table; horse: string; staged: string; active: string } {
    const tab = table(effects, { heroes: [{ code: host, seat: 0 }], attached: [{ code: ASFALOTH, host }], active: LOC, staging: [LOC] });
    const [staged = "", active = ""] = tab.ids[LOC] ?? [];
    return { tab, horse: idsOf(tab, ASFALOTH), staged, active };
  }

  // "Action: Exhaust Asfaloth to place 1 progress token on any location.": on Legolas, both locations are offered; the one in the staging
  // area gets 1 progress and Asfaloth exhausts.
  lineSpec("04110:A:2", "Asfaloth: exhaust it to place 1 progress on any location", (effects) => {
    const { tab, horse: card, staged, active } = horse(effects, LEGOLAS);
    let run = sendUnledgered(begin(tab.state), { type: "Trigger", cardId: card, effectId: "04110:action:1" }, tab.ctx);
    expect(run.state.cards[card]?.exhausted).toBe(true);
    expect(choices(run.state, tab).sort()).toEqual([active, staged].sort());
    run = sendUnledgered(run, { type: "Choose", optionId: staged }, tab.ctx);
    expect(run.state.cards[staged]?.progress).toBe(1);
    expect(run.state.cards[active]?.progress).toBe(0);
  });

  // "(2 tokens instead if attached hero is Glorfindel.)": on Glorfindel the active location gets 2.
  it("04110:A:2 Asfaloth: 2 progress when the attached hero is Glorfindel", () => {
    const { tab, horse: card, active } = horse(EFFECTS, GLORFINDEL);
    let run = sendUnledgered(begin(tab.state), { type: "Trigger", cardId: card, effectId: "04110:action:1" }, tab.ctx);
    run = sendUnledgered(run, { type: "Choose", optionId: active }, tab.ctx);
    expect(run.state.cards[active]?.progress).toBe(2);
  });

  // No location in play: no card to place progress on, so the Action is not offered.
  it("04110:A:2 Asfaloth: not offered with no location in play", () => {
    const tab = table(EFFECTS, { heroes: [{ code: LEGOLAS, seat: 0 }], attached: [{ code: ASFALOTH, host: LEGOLAS }] });
    expect(triggers(tab.state, tab)).not.toContain("04110:action:1");
  });
});
