// Rules: rr.attachment-cards, rr.play-restrictions-and-permissions, rr.restricted, rr.cost, rr.response, rr.action, rr.modifiers, rr.hit-points, rr.ranged, rr.sentinel,
// rr.active-location (data/rules/entries.json).
// The Treason of Saruman attachments, written from their printed lines (data/printed): Arod 143008:A:1 and A:2, Ent Draught 143009:A:1 to A:3,
// Herugrim 143010:A:1 to A:3, Shadowfax 143014:A:1 to A:3.
import { beforeAll, describe, expect, it } from "vitest";

import type { Effect } from "../../catalog/boundary.ts";
import { EFFECTS } from "../../effects/index.ts";
import { hasKeyword, modifiedStat } from "../../rules/core/keywords.ts";
import { definePrinted } from "../../rules/core/printed.ts";
import { legalIntents } from "../../rules/engine/reduce.ts";
import { updateCard, type ScenarioState } from "../../rules/core/state.ts";
import { playCost } from "../../rules/player/attach.ts";
import { payFor, refusal, starterBase } from "../../../test/scenarios/a-shadow-of-the-past/starter-scene.ts";
import { loadPrinted } from "../../../test/harness/catalog.ts";
import { lineSpec } from "../../../test/harness/line-spec.ts";
import { begin, idsOf, send, type Run, type Scene, type Table } from "../../../test/harness/scene.ts";
import { attacking, choices, playerTable, triggers } from "../../../test/harness/player-table.ts";

const THEODEN = "143002";
const TREEBEARD = "143003";
const LEGOLAS = "143005";
const QUICKBEAM = "143006";
const HAMA = "143007";
const AROD = "143008";
const ENT_DRAUGHT = "143009";
const HERUGRIM = "143010";
const SHADOWFAX = "143014";
// Core Gimli: a Tactics hero that is not Legolas. Éowyn: a Spirit Rohan hero that is not Théoden.
const GIMLI = "01004";
const EOWYN = "01007";
// Gandalf, the hero of The Black Riders.
const GANDALF = "142002";
// Ori: a Lore hero that is not an Ent.
const ORI = "131004";
const WEAK = "weak";
const TOUGH = "tough";
// A location in the staging area for Arod's progress.
const LOCATION = "141034";

let base: Awaited<ReturnType<typeof starterBase>>;

const table = (effects: readonly Effect[], scene: Scene = {}, resources = 6): Table => playerTable(base, effects, scene, resources);

beforeAll(async () => {
  const starter = await starterBase();
  const cards = new Map([...starter.cards, ...(await loadPrinted([THEODEN, TREEBEARD, LEGOLAS, QUICKBEAM, HAMA, AROD, ENT_DRAUGHT, HERUGRIM, SHADOWFAX, GIMLI, EOWYN, GANDALF, ORI]))]);
  cards.set(TOUGH, definePrinted({ code: TOUGH, name: "Tough", type: "enemy", threat: 1, engagementCost: 40, attack: 1, defense: 0, health: 20 }));
  cards.set(WEAK, definePrinted({ code: WEAK, name: "Weak", type: "enemy", threat: 1, engagementCost: 40, attack: 1, defense: 0, health: 1 }));
  base = { ...starter, cards };
});

// The reason the card cannot be played on the host, or null when it can (paid in full from the heroes that can pay).
function onto(tab: Table, cardId: string, hostId: string, state: ScenarioState = tab.state): string | null {
  return refusal(state, { type: "PlayCard", cardId, hostId, payments: payFor(state, tab.ctx, cardId) }, tab.ctx);
}

// Every window is passed while the attack is still to resolve.
function passAll(run: Run, tab: Table): Run {
  let next = run;
  for (let guard = 0; guard < 10 && next.state.pendingStrike && legalIntents(next.state, tab.ctx).some((intent) => intent.type === "Pass"); guard += 1) next = send(next, { type: "Pass" }, tab.ctx);
  return next;
}

describe("Arod (143008:A:1, A:2)", () => {
  // "Attach to a hero or Legolas."
  lineSpec("143008:A:1", "goes on a hero or the Legolas ally, not on another ally", (effects) => {
    const tab = table(effects, { heroes: [{ code: GIMLI, seat: 0 }], allies: [{ code: LEGOLAS, seat: 0 }, { code: HAMA, seat: 0 }], hand: [{ code: AROD, seat: 0 }] });
    const arod = idsOf(tab, AROD);
    expect(onto(tab, arod, idsOf(tab, HAMA))).not.toBeNull();
    expect(onto(tab, arod, idsOf(tab, LEGOLAS))).toBeNull();
    expect(onto(tab, arod, idsOf(tab, GIMLI))).toBeNull();
  });

  // "Response: After attached character participates in an attack that destroys an enemy, exhaust Arod to place 1 progress token on any location."
  lineSpec("143008:A:2", "after the attached character's attack destroys an enemy, exhausts to place 1 progress on a location", (effects) => {
    // The scene puts Arod on the hero Gimli without the attach rule, so this line is read apart from line 1.
    const tab = table(effects, { heroes: [{ code: GIMLI, seat: 0 }], attached: [{ code: AROD, host: GIMLI }], engaged: [{ code: WEAK, seat: 0 }], staging: [LOCATION, LOCATION], active: LOCATION });
    const arod = idsOf(tab, AROD);
    const [first, second, active] = tab.ids[LOCATION] ?? [];
    let run = send(begin(attacking(tab.state)), { type: "DeclareAttackers", enemyId: idsOf(tab, WEAK), attackerIds: [idsOf(tab, GIMLI)] }, tab.ctx);
    run = send(run, { type: "Trigger", cardId: arod, effectId: "143008:response:1" }, tab.ctx);
    // "Any location": those in the staging area and the active one.
    expect(choices(run.state, tab).sort()).toEqual([first, second, active].sort());
    run = send(run, { type: "Choose", optionId: second ?? "" }, tab.ctx);
    expect(run.state.cards[arod]?.exhausted).toBe(true);
    expect([first, second, active].map((id) => run.state.cards[id ?? ""]?.progress)).toEqual([0, 1, 0]);
  });

  it("143008:A:2 is not offered while Arod is exhausted", () => {
    const tab = table(EFFECTS, { heroes: [{ code: GIMLI, seat: 0 }], attached: [{ code: AROD, host: GIMLI }], engaged: [{ code: WEAK, seat: 0 }], staging: [LOCATION] });
    const state = updateCard(tab.state, idsOf(tab, AROD), { exhausted: true });
    const run = send(begin(attacking(state)), { type: "DeclareAttackers", enemyId: idsOf(tab, WEAK), attackerIds: [idsOf(tab, GIMLI)] }, tab.ctx);
    expect(triggers(run.state, tab)).not.toContain("143008:response:1");
  });
});

describe("Ent Draught (143009:A:1 to A:3)", () => {
  // "Play only if you control at least 1 Ent character."
  lineSpec("143009:A:1", "is played only while you control an Ent character", (effects) => {
    const ents = table(effects, { heroes: [{ code: TREEBEARD, seat: 0 }, { code: ORI, seat: 0 }], hand: [{ code: ENT_DRAUGHT, seat: 0 }] });
    expect(onto(ents, idsOf(ents, ENT_DRAUGHT), idsOf(ents, ORI))).toBeNull();
    const none = table(effects, { heroes: [{ code: ORI, seat: 0 }, { code: GIMLI, seat: 0 }], hand: [{ code: ENT_DRAUGHT, seat: 0 }] });
    expect(onto(none, idsOf(none, ENT_DRAUGHT), idsOf(none, ORI))).not.toBeNull();
  });

  // "Attach to a character. Limit 1 per character."
  lineSpec("143009:A:2", "goes on a character, an ally too, and one per character", (effects) => {
    const tab = table(effects, { heroes: [{ code: TREEBEARD, seat: 0 }], allies: [{ code: QUICKBEAM, seat: 0 }], hand: [{ code: ENT_DRAUGHT, seat: 0 }, { code: ENT_DRAUGHT, seat: 0 }], engaged: [{ code: WEAK, seat: 0 }] });
    const [first, second] = tab.ids[ENT_DRAUGHT] ?? [];
    const treebeard = idsOf(tab, TREEBEARD);
    expect(onto(tab, first ?? "", idsOf(tab, WEAK))).not.toBeNull();
    expect(onto(tab, first ?? "", idsOf(tab, QUICKBEAM))).toBeNull();
    const run = send(begin(tab.state), { type: "PlayCard", cardId: first ?? "", hostId: treebeard, payments: payFor(tab.state, tab.ctx, first ?? "") }, tab.ctx);
    expect(run.state.cards[treebeard]?.attachments).toEqual([first]);
    expect(onto(tab, second ?? "", treebeard, run.state)).not.toBeNull();
    expect(onto(tab, second ?? "", idsOf(tab, QUICKBEAM), run.state)).toBeNull();
  });

  // "Attached character gets +2 hit points."
  lineSpec("143009:A:3", "gives the attached character +2 hit points", (effects) => {
    const tab = table(effects, { heroes: [{ code: TREEBEARD, seat: 0 }, { code: GIMLI, seat: 0 }], attached: [{ code: ENT_DRAUGHT, host: TREEBEARD }] });
    const hitPoints = (code: string): number => modifiedStat(tab.state, tab.state.cards[idsOf(tab, code)]!, "hitPoints", tab.ctx.cards);
    expect(hitPoints(TREEBEARD)).toBe((tab.ctx.cards.get(TREEBEARD)?.health ?? 0) + 2);
    expect(hitPoints(GIMLI)).toBe(tab.ctx.cards.get(GIMLI)?.health ?? 0);
  });
});

describe("Herugrim (143010:A:1 to A:3)", () => {
  // "Attach to a Rohan hero. Restricted."
  lineSpec("143010:A:1", "goes on a Rohan hero, not on a Rohan ally or a hero that is not Rohan", (effects) => {
    const tab = table(effects, { heroes: [{ code: EOWYN, seat: 0 }, { code: GIMLI, seat: 0 }], allies: [{ code: HAMA, seat: 0 }], hand: [{ code: HERUGRIM, seat: 0 }] });
    const herugrim = idsOf(tab, HERUGRIM);
    expect(onto(tab, herugrim, idsOf(tab, EOWYN))).toBeNull();
    expect(onto(tab, herugrim, idsOf(tab, GIMLI))).not.toBeNull();
    expect(onto(tab, herugrim, idsOf(tab, HAMA))).not.toBeNull();
  });

  it("143010:A:1 is Restricted", () => {
    const tab = table(EFFECTS, { heroes: [{ code: EOWYN, seat: 0 }], attached: [{ code: HERUGRIM, host: EOWYN }] });
    expect(hasKeyword(tab.state, idsOf(tab, HERUGRIM), "restricted", tab.ctx.cards)).toBe(true);
  });

  // "Reduce the cost to play Herugrim on Théoden by 1."
  lineSpec("143010:A:2", "costs 1 less on Théoden, its printed cost on another Rohan hero", (effects) => {
    const tab = table(effects, { heroes: [{ code: THEODEN, seat: 0 }, { code: EOWYN, seat: 0 }], hand: [{ code: HERUGRIM, seat: 0 }] });
    const herugrim = idsOf(tab, HERUGRIM);
    const printed = tab.ctx.cards.get(HERUGRIM)?.cost ?? 0;
    expect(playCost(tab.state, herugrim, 0, tab.ctx, idsOf(tab, THEODEN))).toBe(printed - 1);
    expect(playCost(tab.state, herugrim, 0, tab.ctx, idsOf(tab, EOWYN))).toBe(printed);
    const theoden = idsOf(tab, THEODEN);
    const run = send(begin(tab.state), { type: "PlayCard", cardId: herugrim, hostId: theoden, payments: [{ heroId: theoden, amount: printed - 1 }] }, tab.ctx);
    expect(run.state.cards[theoden]?.attachments).toEqual([herugrim]);
  });

  // "Response: After attached hero is declared as an attacker, exhaust Herugrim to add attached hero's Willpower to its Attack for this attack."
  lineSpec("143010:A:3", "exhausts to add the hero's Willpower to its Attack for this attack", (effects) => {
    const tab = table(effects, { heroes: [{ code: THEODEN, seat: 0 }], attached: [{ code: HERUGRIM, host: THEODEN }], engaged: [{ code: TOUGH, seat: 0 }] });
    const [theoden, herugrim] = [idsOf(tab, THEODEN), idsOf(tab, HERUGRIM)];
    const printed = tab.ctx.cards.get(THEODEN)!;
    let run = send(begin(attacking(tab.state)), { type: "DeclareAttackers", enemyId: idsOf(tab, TOUGH), attackerIds: [theoden] }, tab.ctx);
    run = send(run, { type: "Trigger", cardId: herugrim, effectId: "143010:response:1" }, tab.ctx);
    expect(run.state.cards[herugrim]?.exhausted).toBe(true);
    run = passAll(run, tab);
    const strike = run.steps.find((step) => step.kind === "strike" && step.side === "player");
    expect(strike?.kind === "strike" ? strike.attack : null).toBe((printed.attack ?? 0) + (printed.willpower ?? 0));
    // "For this attack": the Attack is back to its printed value afterwards.
    expect(modifiedStat(run.state, run.state.cards[theoden]!, "attack", tab.ctx.cards)).toBe(printed.attack);
  });
});

describe("Shadowfax (143014:A:1 to A:3)", () => {
  // "Attach to Gandalf."
  lineSpec("143014:A:1", "goes on Gandalf and not on another hero", (effects) => {
    const tab = table(effects, { heroes: [{ code: GANDALF, seat: 0 }, { code: GIMLI, seat: 0 }], hand: [{ code: SHADOWFAX, seat: 0 }] });
    const shadowfax = idsOf(tab, SHADOWFAX);
    expect(onto(tab, shadowfax, idsOf(tab, GIMLI))).not.toBeNull();
    expect(onto(tab, shadowfax, idsOf(tab, GANDALF))).toBeNull();
  });

  // "Gandalf gains ranged and sentinel."
  lineSpec("143014:A:2", "the attached Gandalf gains ranged and sentinel", (effects) => {
    const tab = table(effects, { heroes: [{ code: GANDALF, seat: 0 }], attached: [{ code: SHADOWFAX, host: GANDALF }] });
    const gandalf = idsOf(tab, GANDALF);
    expect(hasKeyword(tab.state, gandalf, "ranged", tab.ctx.cards)).toBe(true);
    expect(hasKeyword(tab.state, gandalf, "sentinel", tab.ctx.cards)).toBe(true);
  });

  // "Action: Exhaust Shadowfax to ready Gandalf."
  lineSpec("143014:A:3", "exhausts to ready Gandalf", (effects) => {
    const tab = table(effects, { heroes: [{ code: GANDALF, seat: 0 }], attached: [{ code: SHADOWFAX, host: GANDALF }] });
    const [gandalf, shadowfax] = [idsOf(tab, GANDALF), idsOf(tab, SHADOWFAX)];
    const run = send(begin(updateCard(tab.state, gandalf, { exhausted: true })), { type: "Trigger", cardId: shadowfax, effectId: "143014:action:1" }, tab.ctx);
    expect(run.state.cards[gandalf]?.exhausted).toBe(false);
    expect(run.state.cards[shadowfax]?.exhausted).toBe(true);
    expect(triggers(run.state, tab)).not.toContain("143014:action:1");
  });
});
