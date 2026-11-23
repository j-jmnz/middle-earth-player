// Rules: rr.restricted, rr.action, rr.response, rr.forced, rr.cost, rr.limits, rr.triggered-ability, rr.ready, rr.shadow-effects,
// rr.cancel, rr.damage, rr.lasting-effects, rr.quest-phase, rr.combat-phase (data/rules/entries.json).
// The Dead Marshes hero, allies and event, each printed line tested from the words on the card (lineSpec, test/harness/line-spec.ts):
// Boromir 02095:A:1 and A:2, Dúnedain Watcher 02096:A:1, Vassal of the Windlord 02098:A:1 and A:2, We Do Not Sleep 02101:A:1. The lines
// are the text of data/cards/TDM.json (data/printed holds no ledger for this pack), so every intent goes through sendUnledgered. The
// shadow effect the Watcher cancels is a fixture record (line fixture:A:1). The attachments are in the-dead-marshes-attachments.test.ts.
import { beforeAll, describe, expect, it } from "vitest";

import type { Effect } from "../../catalog/boundary.ts";
import { EFFECTS } from "../../effects/index.ts";
import { definePrinted } from "../../rules/core/printed.ts";
import { updateCard } from "../../rules/core/state.ts";
import { starterBase } from "../../../test/scenarios/a-shadow-of-the-past/starter-scene.ts";
import { loadPrinted } from "../../../test/harness/catalog.ts";
import { lineSpec } from "../../../test/harness/line-spec.ts";
import { begin, idsOf, type Run, type Scene, type Table } from "../../../test/harness/scene.ts";
import { atDefense, attacking, choices, combat, enter, exhausted, hosts, passAll, playCode, playerTable, questing, sendUnledgered, triggers } from "../../../test/harness/player-table.ts";

const BOROMIR = "02095";
const WATCHER = "02096";
const VASSAL = "02098";
const SLEEP = "02101";
// Core Aragorn (Leadership), Théodred (Leadership, Rohan), Éowyn (Spirit, Rohan); the Snowbourn Scout (a Rohan ally).
const ARAGORN = "01001";
const THEODRED = "01002";
const EOWYN = "01007";
const SCOUT = "01016";
// The Pal (a Leadership hero) and a plain Leadership ally, from the scene kit.
const PAL = "pal";
const ALLY = "ally";
// A restricted attachment with no text; an enemy of Attack 2 and one of Attack 4, neither engaging by the engagement check.
const GEAR = "gear";
const BRUTE = "brute";
const HAMMER = "hammer";
// A treachery whose shadow effect gives the attacker +3 Attack (a fixture record, line fixture:A:1).
const BOOST = "boost";

let base: Awaited<ReturnType<typeof starterBase>>;

const boostShadow: Effect = { id: "boost:shadow:1", cardCode: BOOST, lines: ["fixture:A:1"], timing: "shadow", instructions: [{ verb: "ModifyStat", stat: "attack", amount: 3, until: "endOfAttack", target: "attacker" }] };

const table = (effects: readonly Effect[], scene: Scene = {}, resources = 6): Table => playerTable(base, [...effects, boostShadow], scene, resources);

beforeAll(async () => {
  const starter = await starterBase();
  const codes = [BOROMIR, WATCHER, VASSAL, SLEEP, ARAGORN, THEODRED, EOWYN, SCOUT];
  const cards = new Map([...starter.cards, ...(await loadPrinted(codes))]);
  cards.set(GEAR, definePrinted({ code: GEAR, name: "Gear", type: "attachment", sphere: "neutral", cost: 0, keywords: { restricted: true } }));
  cards.set(BRUTE, definePrinted({ code: BRUTE, name: "Brute", type: "enemy", threat: 1, engagementCost: 50, attack: 2, defense: 0, health: 9 }));
  cards.set(HAMMER, definePrinted({ code: HAMMER, name: "Hammer", type: "enemy", threat: 1, engagementCost: 50, attack: 4, defense: 0, health: 9 }));
  cards.set(BOOST, definePrinted({ code: BOOST, name: "Boost", type: "treachery" }));
  base = { ...starter, cards };
});


describe("Boromir (02095:A:1, A:2)", () => {
  // "Action: Raise your threat by 1 to ready Boromir. (Limit once per phase.)": exhausted, he readies for 1 threat (8 to 9). Exhausted
  // again in the same phase, the Action is not offered; in the combat phase it is offered again.
  lineSpec("02095:A:1", "raise your threat by 1 to ready him, limit once per phase", (effects) => {
    const start = table(effects, { heroes: [{ code: BOROMIR, seat: 0 }] });
    const boromir = idsOf(start, BOROMIR);
    const tab = exhausted(start, boromir);
    expect(triggers(tab.state, tab)).toContain("02095:action:1");
    const run = sendUnledgered(begin(tab.state), { type: "Trigger", cardId: boromir, effectId: "02095:action:1" }, tab.ctx);
    expect(run.state.cards[boromir]?.exhausted).toBe(false);
    expect(run.state.seats[0]?.threat).toBe(8 + 1);
    const again = updateCard(run.state, boromir, { exhausted: true });
    expect(triggers(again, tab)).not.toContain("02095:action:1");
    expect(triggers(combat(again, tab).state, tab)).toContain("02095:action:1");
  });

  // Boromir and Aragorn for the first player, the Pal for the second. Two enemies are engaged with the first player, one with the second.
  function engaged(effects: readonly Effect[]): Table {
    return table(effects, { seats: 2, heroes: [{ code: BOROMIR, seat: 0 }, { code: ARAGORN, seat: 0 }, { code: PAL, seat: 1 }], engaged: [{ code: BRUTE, seat: 0 }, { code: HAMMER, seat: 0 }, { code: BRUTE, seat: 1 }] });
  }

  // "Action: Discard Boromir to deal 2 damage to each enemy engaged with a single player.": the player chooses the first player; his
  // two enemies take 2 damage each, the second player's enemy none, and Boromir is in the discard pile.
  lineSpec("02095:A:2", "discard him to deal 2 damage to each enemy engaged with a single player", (effects) => {
    const tab = engaged(effects);
    const [boromir, [brute = "", other = ""], hammer] = [idsOf(tab, BOROMIR), tab.ids[BRUTE] ?? [], idsOf(tab, HAMMER)];
    expect(triggers(tab.state, tab)).toContain("02095:action:2");
    let run = sendUnledgered(begin(tab.state), { type: "Trigger", cardId: boromir, effectId: "02095:action:2" }, tab.ctx);
    expect(run.state.cards[boromir]?.zone).toBe("discard");
    expect(run.state.window?.kind).toBe("choose");
    expect(choices(run.state, tab)).toHaveLength(2);
    run = sendUnledgered(run, { type: "Choose", optionId: choices(run.state, tab)[0] ?? "" }, tab.ctx);
    expect(run.state.cards[brute]?.damage).toBe(2);
    expect(run.state.cards[hammer]?.damage).toBe(2);
    expect(run.state.cards[other]?.damage).toBe(0);
  });

  // With no enemy engaged with any player the damage has no target: not offered, and Boromir is not discarded for nothing.
  it("02095:A:2 is not offered when no enemy is engaged", () => {
    const tab = table(EFFECTS, { heroes: [{ code: BOROMIR, seat: 0 }], staging: [BRUTE] });
    expect(triggers(tab.state, tab)).not.toContain("02095:action:2");
  });
});

describe("Dúnedain Watcher (02096:A:1)", () => {
  // Aragorn (Defense 2) defends the Brute's attack (2), whose shadow card is the Boost (+3 Attack); the Watcher is in play.
  function defended(effects: readonly Effect[]): { tab: Table; run: Run } {
    const tab = table(effects, { heroes: [{ code: ARAGORN, seat: 0 }], allies: [{ code: WATCHER, seat: 0 }], engaged: [{ code: BRUTE, seat: 0 }], deck: [BOOST] });
    let run = atDefense(tab);
    run = passAll(sendUnledgered(run, { type: "DeclareDefender", defenderId: idsOf(tab, ARAGORN) }, tab.ctx), tab.ctx);
    return { tab, run };
  }

  // "Response: Discard Dúnedain Watcher from play to cancel the shadow effects of a card just triggered.": the Watcher goes to the
  // discard pile, the +3 is canceled, and the attack (2) against Defense 2 deals no damage.
  lineSpec("02096:A:1", "discard it from play to cancel a shadow effect just triggered", (effects) => {
    const { tab, run: asked } = defended(effects);
    const watcher = idsOf(tab, WATCHER);
    expect(triggers(asked.state, tab)).toContain("02096:response:1");
    const run = passAll(sendUnledgered(asked, { type: "Trigger", cardId: watcher, effectId: "02096:response:1" }, tab.ctx), tab.ctx, { responses: true });
    expect(run.state.cards[watcher]?.zone).toBe("discard");
    expect(run.state.cards[idsOf(tab, ARAGORN)]?.damage).toBe(0);
  });

  // Not used, the shadow effect resolves: 2 + 3 against Defense 2 is 3 damage, and the Watcher stays.
  it("02096:A:1 the shadow effect resolves when it is not used", () => {
    const { tab, run: asked } = defended(EFFECTS);
    const run = passAll(sendUnledgered(asked, { type: "Pass" }, tab.ctx), tab.ctx, { responses: true });
    expect(run.state.cards[idsOf(tab, ARAGORN)]?.damage).toBe(3);
    expect(run.state.cards[idsOf(tab, WATCHER)]?.zone).toBe("play");
  });
});

describe("Vassal of the Windlord (02098:A:1, A:2)", () => {
  // "Vassal of the Windlord cannot have restricted attachments.": the restricted Gear may go on Aragorn and the ally, not on the Vassal.
  lineSpec("02098:A:1", "cannot have restricted attachments", (effects) => {
    const tab = table(effects, { heroes: [{ code: ARAGORN, seat: 0 }], allies: [{ code: VASSAL, seat: 0 }, { code: ALLY, seat: 0 }], hand: [{ code: GEAR, seat: 0 }] });
    const offered = hosts(tab, idsOf(tab, GEAR));
    expect(offered).toContain(idsOf(tab, ARAGORN));
    expect(offered).toContain(idsOf(tab, ALLY));
    expect(offered).not.toContain(idsOf(tab, VASSAL));
  });

  // The Vassal and Aragorn in play, the Brute (Defense 0, 9 hit points) engaged; `attackers` attack it.
  function attacked(effects: readonly Effect[], attackers: readonly string[]): { tab: Table; run: Run } {
    const tab = table(effects, { heroes: [{ code: ARAGORN, seat: 0 }], allies: [{ code: VASSAL, seat: 0 }], engaged: [{ code: BRUTE, seat: 0 }] });
    const run = passAll(sendUnledgered(begin(attacking(tab.state)), { type: "DeclareAttackers", enemyId: idsOf(tab, BRUTE), attackerIds: attackers.map((code) => idsOf(tab, code)) }, tab.ctx), tab.ctx, { responses: true });
    return { tab, run };
  }

  // "Forced: After an attack in which Vassal of the Windlord attacked resolves, discard Vassal of the Windlord from play.": the Vassal
  // (Attack 3) and Aragorn (Attack 3) deal 6 damage to the Brute; the attack resolved, the Vassal goes to the discard pile and Aragorn stays.
  lineSpec("02098:A:2", "discarded after an attack in which it attacked resolves", (effects) => {
    const { tab, run } = attacked(effects, [VASSAL, ARAGORN]);
    expect(run.state.cards[idsOf(tab, BRUTE)]?.damage).toBe(6);
    expect(run.state.cards[idsOf(tab, VASSAL)]?.zone).toBe("discard");
    expect(run.state.cards[idsOf(tab, ARAGORN)]?.zone).toBe("heroes");
  });

  // Aragorn attacks alone: the Vassal stays in play.
  it("02098:A:2 stays in play after an attack it did not make", () => {
    const { tab, run } = attacked(EFFECTS, [ARAGORN]);
    expect(run.state.cards[idsOf(tab, BRUTE)]?.damage).toBe(3);
    expect(run.state.cards[idsOf(tab, VASSAL)]?.zone).toBe("play");
  });
});

describe("We Do Not Sleep (02101:A:1)", () => {
  // Éowyn (Spirit, Rohan) pays the 5; Théodred (Rohan hero), the Snowbourn Scout (Rohan ally) and Aragorn (not Rohan), at the quest phase.
  const sleep = (effects: readonly Effect[]): Table =>
    table(effects, { start: "quest", heroes: [{ code: EOWYN, seat: 0 }, { code: THEODRED, seat: 0 }, { code: ARAGORN, seat: 0 }], allies: [{ code: SCOUT, seat: 0 }], hand: [{ code: SLEEP, seat: 0 }], deck: ["f0", "f0"] });

  // "Action: Until the end of the phase, Rohan characters do not exhaust to commit to quests.": played before the commit, Théodred, Éowyn
  // and the Scout commit and stay ready; Aragorn exhausts. In the next quest phase the Rohan characters exhaust again.
  lineSpec("02101:A:1", "until the end of the phase Rohan characters do not exhaust to commit to quests", (effects) => {
    const tab = sleep(effects);
    const [eowyn, theodred, aragorn, scout] = [idsOf(tab, EOWYN), idsOf(tab, THEODRED), idsOf(tab, ARAGORN), idsOf(tab, SCOUT)];
    const played = playCode(tab, SLEEP);
    expect(played.state.cards[eowyn]?.resources).toBe(6 - 5);
    const run = sendUnledgered(played, { type: "Commit", cardIds: [eowyn, theodred, aragorn, scout] }, tab.ctx);
    expect([eowyn, theodred, scout, aragorn].map((id) => run.state.cards[id]?.committed)).toEqual([true, true, true, true]);
    expect([eowyn, theodred, scout].map((id) => run.state.cards[id]?.exhausted)).toEqual([false, false, false]);
    expect(run.state.cards[aragorn]?.exhausted).toBe(true);
    const later = sendUnledgered(begin(questing(enter(played.state, tab, "travel").state)), { type: "Commit", cardIds: [theodred] }, tab.ctx);
    expect(later.state.cards[theodred]?.exhausted).toBe(true);
  });
});
