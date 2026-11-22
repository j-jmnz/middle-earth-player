// Rules: rr.triggered-ability, rr.response, rr.action, rr.limits, rr.lasting-effects, rr.restricted, rr.doomed-x, rr.sentinel,
// rr.step-3-2, rr.step-6-4-1, rr.step-6-8a (data/rules/entries.json).
// Celebrimbor's Secret heroes, allies and events, each printed line tested from the words on the card (data/cards/CS.json: data/printed
// holds no ledger for this pack, so the lines are the text of data/cards): Galadriel 08112:A:1 and A:2, Orophin 08114:A:2, Henneth
// Annûn Guard 08115:A:1, Charge of the Rohirrim 08116:A:1, Galadriel's Handmaiden 08117:A:1, Wandering Ent 08119:A:1 and A:2. The
// attachments are in celebrimbors-secret-attachments.test.ts.
import { beforeAll, describe, expect, it } from "vitest";

import type { Effect } from "../../catalog/boundary.ts";
import { EFFECTS } from "../../effects/index.ts";
import { hasKeyword } from "../../rules/core/keywords.ts";
import { definePrinted } from "../../rules/core/printed.ts";
import { updateCard } from "../../rules/core/state.ts";
import { attachTo } from "../../rules/core/zones.ts";
import { syncConstants } from "../../rules/interpret/constants.ts";
import { refusal, starterBase } from "../../../test/scenarios/a-shadow-of-the-past/starter-scene.ts";
import { loadPrinted } from "../../../test/harness/catalog.ts";
import { lineSpec } from "../../../test/harness/line-spec.ts";
import { begin, idsOf, type Scene, type Table } from "../../../test/harness/scene.ts";
import { attach, attacking, choices, combat, discarded, hosts, play, playerTable, printed, questing, sendUnledgered, stat, triggers } from "../../../test/harness/player-table.ts";

const ARAGORN = "01001";
const THEODRED = "01002";
const GIMLI = "01004";
const EOWYN = "01007";
const DENETHOR = "01010";
const SCOUT = "01016";
const GALADRIEL = "08112";
const OROPHIN = "08114";
const GUARD = "08115";
const CHARGE = "08116";
const HANDMAIDEN = "08117";
const ENT = "08119";
// Stand-ins with no text: a Mount attachment, a restricted attachment, a Silvan event and an enemy that attacks.
const MOUNT = "mount";
const HEAVY = "heavy";
const SILVAN_EVENT = "silvanEvent";
const BRUTE = "brute";
const ALLY = "ally";
const PLAIN = "plain";

let base: Awaited<ReturnType<typeof starterBase>>;

const table = (effects: readonly Effect[], scene: Scene = {}, resources = 6): Table => playerTable(base, effects, scene, resources);

beforeAll(async () => {
  const starter = await starterBase();
  const codes = [ARAGORN, THEODRED, GIMLI, EOWYN, DENETHOR, SCOUT, GALADRIEL, OROPHIN, GUARD, CHARGE, HANDMAIDEN, ENT];
  const cards = new Map([...starter.cards, ...(await loadPrinted(codes))]);
  cards.set(MOUNT, definePrinted({ code: MOUNT, name: "Mount", type: "attachment", traits: ["Mount"], cost: 0 }));
  cards.set(HEAVY, definePrinted({ code: HEAVY, name: "Heavy", type: "attachment", traits: ["Item"], cost: 0, keywords: { restricted: true } }));
  cards.set(SILVAN_EVENT, definePrinted({ code: SILVAN_EVENT, name: "Silvan Song", type: "event", traits: ["Silvan"], cost: 0 }));
  cards.set(BRUTE, definePrinted({ code: BRUTE, name: "Brute", type: "enemy", threat: 1, engagementCost: 40, attack: 1, defense: 9, health: 9 }));
  base = { ...starter, cards };
});

describe("Galadriel (08112:A:1)", () => {
  // "Galadriel cannot quest, attack, or defend.": a Commit, an attack and a defence with her are refused, and Éowyn can do each.
  lineSpec("08112:A:1", "Galadriel cannot quest, attack, or defend", (effects) => {
    const tab = table(effects, { start: "quest", heroes: [{ code: GALADRIEL, seat: 0 }, { code: EOWYN, seat: 0 }], engaged: [{ code: BRUTE, seat: 0 }] });
    const [galadriel, eowyn, brute] = [idsOf(tab, GALADRIEL), idsOf(tab, EOWYN), idsOf(tab, BRUTE)];
    expect(refusal(tab.state, { type: "Commit", cardIds: [galadriel] }, tab.ctx)).not.toBeNull();
    expect(refusal(tab.state, { type: "Commit", cardIds: [eowyn] }, tab.ctx)).toBeNull();
    const attack = attacking(tab.state);
    expect(refusal(attack, { type: "DeclareAttackers", enemyId: brute, attackerIds: [galadriel] }, tab.ctx)).not.toBeNull();
    expect(refusal(attack, { type: "DeclareAttackers", enemyId: brute, attackerIds: [eowyn] }, tab.ctx)).toBeNull();
    let run = combat(tab.state, tab);
    for (let guard = 0; guard < 10 && run.state.window?.kind !== "defense"; guard += 1) run = sendUnledgered(run, { type: "Pass" }, tab.ctx);
    expect(run.state.window?.kind).toBe("defense");
    expect(refusal(run.state, { type: "DeclareDefender", defenderId: galadriel }, tab.ctx)).not.toBeNull();
    expect(refusal(run.state, { type: "DeclareDefender", defenderId: eowyn }, tab.ctx)).toBeNull();
  });

  // "Allies you control do not exhaust to commit to the quest during the round they enter play.": the Handmaiden played this round
  // commits and stays ready; an ally that was in play before the round exhausts to commit.
  lineSpec("08112:A:1", "Galadriel: an ally that entered play this round commits without exhausting", (effects) => {
    const tab = table(effects, { heroes: [{ code: GALADRIEL, seat: 0 }, { code: EOWYN, seat: 0 }], allies: [{ code: ALLY, seat: 0 }], hand: [{ code: HANDMAIDEN, seat: 0 }] });
    const [handmaiden, ally] = [idsOf(tab, HANDMAIDEN), idsOf(tab, ALLY)];
    let run = play(begin(tab.state), tab, handmaiden);
    if (run.state.window?.kind === "response") run = sendUnledgered(run, { type: "Pass" }, tab.ctx);
    run = sendUnledgered(begin(questing(run.state)), { type: "Commit", cardIds: [handmaiden, ally] }, tab.ctx);
    expect(run.state.cards[handmaiden]).toMatchObject({ committed: true, exhausted: false });
    expect(run.state.cards[ally]).toMatchObject({ committed: true, exhausted: true });
  });
});

describe("Galadriel (08112:A:1), allies of another player", () => {
  // "Allies you control": with Galadriel on the other player's side, the ally you play this round exhausts to commit as usual.
  it("08112:A:1 Galadriel: an ally of a player who does not control her still exhausts to commit", () => {
    const tab = table(EFFECTS, { seats: 2, heroes: [{ code: ARAGORN, seat: 0 }, { code: GALADRIEL, seat: 1 }], hand: [{ code: ALLY, seat: 0 }] });
    const ally = idsOf(tab, ALLY);
    let run = play(begin(tab.state), tab, ally);
    expect(run.state.cards[ally]?.zone).toBe("play");
    run = sendUnledgered(begin(questing(run.state)), { type: "Commit", cardIds: [ally] }, tab.ctx);
    expect(run.state.cards[ally]).toMatchObject({ committed: true, exhausted: true });
  });
});

describe("Galadriel (08112:A:2)", () => {
  // "Action: Exhaust Galadriel to choose a player. That player reduces his threat by 1 and draws 1 card. (Limit once per round.)"
  lineSpec("08112:A:2", "Galadriel: exhaust to have a chosen player lower their threat by 1 and draw 1, once per round", (effects) => {
    const tab = table(effects, { seats: 2, heroes: [{ code: GALADRIEL, seat: 0 }, { code: ARAGORN, seat: 1 }], playerDeck: [{ code: "card", seat: 0 }, { code: "card", seat: 1 }] });
    const galadriel = idsOf(tab, GALADRIEL);
    let run = sendUnledgered(begin(tab.state), { type: "Trigger", cardId: galadriel, effectId: "08112:action:1" }, tab.ctx);
    expect(run.state.cards[galadriel]?.exhausted).toBe(true);
    expect(choices(run.state, tab).sort()).toEqual(["seat:0", "seat:1"]);
    run = sendUnledgered(run, { type: "Choose", optionId: "seat:1" }, tab.ctx);
    expect(run.state.seats[1]?.threat).toBe(5);
    expect(run.state.seats[1]?.hand).toHaveLength(1);
    expect(run.state.seats[0]?.threat).toBe(8);
    expect(run.state.seats[0]?.hand).toHaveLength(0);
    // Readied again in the same round, she cannot use it a second time.
    const ready = updateCard(run.state, galadriel, { exhausted: false });
    expect(triggers(ready, tab)).not.toContain("08112:action:1");
  });
});

describe("Orophin (08114:A:2)", () => {
  // "Response: After Orophin enters play, return a Silvan ally from your discard pile to your hand.": the Handmaiden (Silvan ally) in
  // your discard pile is the only choice; the Snowbourn Scout (not Silvan), a Silvan event and the other player's Handmaiden are not.
  lineSpec("08114:A:2", "Orophin: after he enters play, a Silvan ally from your discard pile goes to your hand", (effects) => {
    const scene = table(effects, { seats: 2, heroes: [{ code: ARAGORN, seat: 0 }, { code: THEODRED, seat: 1 }], hand: [{ code: OROPHIN, seat: 0 }] });
    const { tab, ids } = discarded(scene, [[HANDMAIDEN, 0], [SCOUT, 0], [SILVAN_EVENT, 0], [HANDMAIDEN, 1]]);
    const [mine, scout, song, theirs] = ids;
    const orophin = idsOf(tab, OROPHIN);
    let run = play(begin(tab.state), tab, orophin);
    expect(triggers(run.state, tab)).toContain("08114:response:1");
    run = sendUnledgered(run, { type: "Trigger", cardId: orophin, effectId: "08114:response:1" }, tab.ctx);
    if (run.state.window?.kind === "choose") {
      expect(choices(run.state, tab)).toEqual([mine]);
      run = sendUnledgered(run, { type: "Choose", optionId: mine ?? "" }, tab.ctx);
    }
    expect(run.state.seats[0]?.hand).toEqual([mine]);
    expect(run.state.cards[scout ?? ""]?.zone).toBe("discard");
    expect(run.state.cards[song ?? ""]?.zone).toBe("discard");
    expect(run.state.cards[theirs ?? ""]?.zone).toBe("discard");
  });

  // rr.triggered-ability: the Response can change nothing with no Silvan ally in your discard pile, so it is not offered.
  it("08114:A:2 Orophin: no Response with no Silvan ally in your discard pile", () => {
    const scene = table(EFFECTS, { heroes: [{ code: ARAGORN, seat: 0 }], hand: [{ code: OROPHIN, seat: 0 }] });
    const { tab } = discarded(scene, [[SCOUT, 0], [SILVAN_EVENT, 0]]);
    const run = play(begin(tab.state), tab, idsOf(tab, OROPHIN));
    expect(triggers(run.state, tab)).not.toContain("08114:response:1");
  });
});

describe("Henneth Annûn Guard (08115:A:1)", () => {
  // "You may give Henneth Annûn Guard doomed 1 when you play it from your hand. If you do, it gains: "Response: After you play Henneth
  // Annûn Guard, choose a character. Until the end of the round, that character gets +2 Defense and gains sentinel."": doomed 1 raises
  // each player's threat by 1 (rr.doomed-x); the other player's Aragorn is a character to choose.
  lineSpec("08115:A:1", "Henneth Annûn Guard: doomed 1 on play, then a character gets +2 Defense and sentinel until the end of the round", (effects) => {
    const tab = table(effects, { seats: 2, heroes: [{ code: GIMLI, seat: 0 }, { code: THEODRED, seat: 1 }], hand: [{ code: GUARD, seat: 0 }] });
    const [guard, theodred] = [idsOf(tab, GUARD), idsOf(tab, THEODRED)];
    let run = play(begin(tab.state), tab, guard);
    expect(triggers(run.state, tab)).toContain("08115:response:1");
    run = sendUnledgered(run, { type: "Trigger", cardId: guard, effectId: "08115:response:1" }, tab.ctx);
    expect(choices(run.state, tab)).toEqual(expect.arrayContaining([idsOf(tab, GIMLI), theodred, guard]));
    run = sendUnledgered(run, { type: "Choose", optionId: theodred }, tab.ctx);
    expect(run.state.seats[0]?.threat).toBe(9);
    expect(run.state.seats[1]?.threat).toBe(7);
    expect(stat(run.state, tab, theodred, "defense")).toBe(printed(tab, THEODRED, "defense") + 2);
    expect(hasKeyword(run.state, theodred, "sentinel", tab.ctx.cards)).toBe(true);
    expect(stat(run.state, tab, idsOf(tab, GIMLI), "defense")).toBe(printed(tab, GIMLI, "defense"));
  });

  it("08115:A:1 Henneth Annûn Guard: declined, no threat is raised and nothing gains sentinel", () => {
    const tab = table(EFFECTS, { heroes: [{ code: GIMLI, seat: 0 }], hand: [{ code: GUARD, seat: 0 }] });
    let run = play(begin(tab.state), tab, idsOf(tab, GUARD));
    run = sendUnledgered(run, { type: "Pass" }, tab.ctx);
    expect(run.state.seats[0]?.threat).toBe(8);
    expect(hasKeyword(run.state, idsOf(tab, GIMLI), "sentinel", tab.ctx.cards)).toBe(false);
  });
});

describe("Charge of the Rohirrim (08116:A:1)", () => {
  // "Action: Until the end of the phase, each Rohan character with a Mount attachment gets +3 Attack.": Théodred and the Snowbourn
  // Scout (Rohan, with a Mount) get it; Éowyn (Rohan, no Mount) and Gimli (a Mount, not Rohan) do not. A Mount attached to Éowyn
  // afterwards gives her nothing (rr.lasting-effects), and the bonus ends with the planning phase.
  lineSpec("08116:A:1", "Charge of the Rohirrim: each Rohan character with a Mount gets +3 Attack until the end of the phase", (effects) => {
    const scene = table(effects, { heroes: [{ code: GIMLI, seat: 0 }, { code: THEODRED, seat: 0 }, { code: EOWYN, seat: 0 }], allies: [{ code: SCOUT, seat: 0 }, { code: MOUNT, seat: 0 }, { code: MOUNT, seat: 0 }, { code: MOUNT, seat: 0 }, { code: MOUNT, seat: 0 }], hand: [{ code: CHARGE, seat: 0 }] });
    const [a, b, c, late] = scene.ids[MOUNT] ?? [];
    const [gimli, theodred, eowyn, scout] = [GIMLI, THEODRED, EOWYN, SCOUT].map((code) => idsOf(scene, code));
    const tab = attach(scene, [[a ?? "", theodred ?? ""], [b ?? "", scout ?? ""], [c ?? "", gimli ?? ""]]);
    let run = play(begin(tab.state), tab, idsOf(tab, CHARGE));
    expect(stat(run.state, tab, theodred ?? "", "attack")).toBe(printed(tab, THEODRED, "attack") + 3);
    expect(stat(run.state, tab, scout ?? "", "attack")).toBe(printed(tab, SCOUT, "attack") + 3);
    expect(stat(run.state, tab, eowyn ?? "", "attack")).toBe(printed(tab, EOWYN, "attack"));
    expect(stat(run.state, tab, gimli ?? "", "attack")).toBe(printed(tab, GIMLI, "attack"));
    const later = syncConstants(attachTo(run.state, late ?? "", eowyn ?? ""), tab.ctx);
    expect(stat(later, tab, eowyn ?? "", "attack")).toBe(printed(tab, EOWYN, "attack"));
    run = sendUnledgered(run, { type: "Pass" }, tab.ctx);
    expect(run.state.phase).not.toBe("Planning");
    expect(stat(run.state, tab, theodred ?? "", "attack")).toBe(printed(tab, THEODRED, "attack"));
  });
});

describe("Galadriel's Handmaiden (08117:A:1)", () => {
  // "Response: After Galadriel's Handmaiden enters play, choose a player. That player reduces his threat by 1."
  lineSpec("08117:A:1", "Galadriel's Handmaiden: after she enters play, the chosen player lowers their threat by 1", (effects) => {
    const tab = table(effects, { seats: 2, heroes: [{ code: EOWYN, seat: 0 }, { code: ARAGORN, seat: 1 }], hand: [{ code: HANDMAIDEN, seat: 0 }] });
    const handmaiden = idsOf(tab, HANDMAIDEN);
    let run = play(begin(tab.state), tab, handmaiden);
    run = sendUnledgered(run, { type: "Trigger", cardId: handmaiden, effectId: "08117:response:1" }, tab.ctx);
    expect(choices(run.state, tab).sort()).toEqual(["seat:0", "seat:1"]);
    run = sendUnledgered(run, { type: "Choose", optionId: "seat:1" }, tab.ctx);
    expect(run.state.seats[1]?.threat).toBe(5);
    expect(run.state.seats[0]?.threat).toBe(8);
  });
});

describe("Wandering Ent (08119)", () => {
  // "Cannot have restricted attachments.": a restricted attachment cannot go on the Ent, but can on another ally; a plain one can.
  lineSpec("08119:A:1", "Wandering Ent: cannot have restricted attachments", (effects) => {
    const tab = table(effects, { heroes: [{ code: DENETHOR, seat: 0 }], allies: [{ code: ENT, seat: 0 }, { code: ALLY, seat: 0 }], hand: [{ code: HEAVY, seat: 0 }, { code: PLAIN, seat: 0 }] });
    const [ent, heavy, plain] = [idsOf(tab, ENT), idsOf(tab, HEAVY), idsOf(tab, PLAIN)];
    expect(hosts(tab, heavy)).not.toContain(ent);
    expect(hosts(tab, heavy)).toContain(idsOf(tab, ALLY));
    expect(hosts(tab, plain)).toContain(ent);
  });

  // "Enters play exhausted."
  lineSpec("08119:A:2", "Wandering Ent: enters play exhausted", (effects) => {
    const tab = table(effects, { heroes: [{ code: DENETHOR, seat: 0 }], hand: [{ code: ENT, seat: 0 }] });
    const run = play(begin(tab.state), tab, idsOf(tab, ENT));
    expect(run.state.cards[idsOf(tab, ENT)]).toMatchObject({ zone: "play", exhausted: true });
  });
});
