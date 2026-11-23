// Rules: rr.constant-ability, rr.cost, rr.modifiers, rr.action, rr.response, rr.triggered-ability, rr.lasting-effects, rr.enters-play,
// rr.play-and-put-into-play, rr.reveal, rr.resources, rr.move, rr.staging-area, rr.step-6-4-1, rr.ready (data/rules/entries.json).
// The Heirs of Númenor heroes, allies and events, each printed line tested from the words on the card (lineSpec, test/harness/line-spec.ts):
// Beregond 05001:A:2, Boromir 05002:A:1, Errand-rider 05003:A:1, Citadel Custodian 05004:A:1, Wealth of Gondor 05006:A:1, Behind Strong
// Walls 05008:A:1, Damrod 05010:A:1, Light the Beacons 05011:A:1, Hunter of Lamedon 05014:A:1, Envoy of Pelargir 05018:A:1. The lines are
// the text of data/cards/HoN.json (data/printed holds no ledger for this pack), so every intent goes through sendUnledgered.
import { beforeAll, describe, expect, it } from "vitest";

import type { Effect } from "../../catalog/boundary.ts";
import { EFFECTS } from "../../effects/index.ts";
import { definePrinted } from "../../rules/core/printed.ts";
import { updateCard } from "../../rules/core/state.ts";
import { playCost } from "../../rules/player/attach.ts";
import { refusal, starterBase } from "../../../test/scenarios/a-shadow-of-the-past/starter-scene.ts";
import { loadPrinted } from "../../../test/harness/catalog.ts";
import { lineSpec } from "../../../test/harness/line-spec.ts";
import { begin, idsOf, type Run, type Table } from "../../../test/harness/scene.ts";
import { atDefense, canPlay, choices, endRound, enter, passAll, play, playerTableFor, sendUnledgered, stat, triggers } from "../../../test/harness/player-table.ts";

const BEREGOND = "05001";
const BOROMIR = "05002";
const ERRAND = "05003";
const CUSTODIAN = "05004";
const WEALTH = "05006";
const WALLS = "05008";
const DAMROD = "05010";
const BEACONS = "05011";
const HUNTER = "05014";
const ENVOY = "05018";
// Core Aragorn (Leadership, Dúnedain, Noble), Legolas (Tactics, not Gondor), Eleanor (Spirit, Gondor, Noble), Denethor (Lore, Gondor),
// Guard of the Citadel (a Leadership Gondor ally), Gondorian Spearman (a Tactics Gondor ally), Blade of Gondolin (a Weapon), Citadel
// Plate (an Armor), Horn of Gondor (an Artifact, neither).
const ARAGORN = "01001";
const LEGOLAS = "01005";
const ELEANOR = "01008";
const DENETHOR = "01010";
const GUARD = "01013";
const SPEARMAN = "01029";
const BLADE = "01039";
const PLATE = "01040";
const HORN = "01042";
const ALLY = "ally";
const PAL = "pal";
// A Spirit hero with no Trait; an Outlands ally; enemies that no attack here destroys.
const SPIRIT = "spirit";
const OUTLAND = "outland";
const WEAK = "weak";

let base: Awaited<ReturnType<typeof starterBase>>;

const table = playerTableFor(() => base);

beforeAll(async () => {
  const starter = await starterBase();
  const codes = [BEREGOND, BOROMIR, ERRAND, CUSTODIAN, WEALTH, WALLS, DAMROD, BEACONS, HUNTER, ENVOY, ARAGORN, LEGOLAS, ELEANOR, DENETHOR, GUARD, SPEARMAN, BLADE, PLATE, HORN];
  const cards = new Map([...starter.cards, ...(await loadPrinted(codes))]);
  cards.set(SPIRIT, definePrinted({ code: SPIRIT, name: "Spirit", type: "hero", sphere: "spirit", threat: 8, willpower: 1, attack: 1, defense: 1, health: 3 }));
  cards.set(OUTLAND, definePrinted({ code: OUTLAND, name: "Outland", type: "ally", sphere: "lore", cost: 1, willpower: 1, attack: 1, defense: 1, health: 1, traits: ["Outlands"] }));
  cards.set(WEAK, definePrinted({ code: WEAK, name: "Weak", type: "enemy", threat: 1, engagementCost: 30, attack: 1, defense: 0, health: 9 }));
  base = { ...starter, cards };
});

describe("Beregond (05001:A:2)", () => {
  // "Lower the cost to play Weapon and Armor attachments on Beregond by 2.": Citadel Plate (Armor, 4) costs 2 on Beregond; the Blade of
  // Gondolin (Weapon, 1) costs nothing on him; Legolas pays the full 4 for the Plate.
  lineSpec("05001:A:2", "Weapon and Armor attachments cost 2 less on him", (effects) => {
    const tab = table(effects, { heroes: [{ code: BEREGOND, seat: 0 }, { code: LEGOLAS, seat: 0 }], hand: [{ code: PLATE, seat: 0 }, { code: BLADE, seat: 0 }] });
    const [beregond, plate, blade] = [idsOf(tab, BEREGOND), idsOf(tab, PLATE), idsOf(tab, BLADE)];
    let run = sendUnledgered(begin(tab.state), { type: "PlayCard", cardId: plate, hostId: beregond, payments: [{ heroId: beregond, amount: 2 }] }, tab.ctx);
    expect(run.state.cards[plate]?.host).toBe(beregond);
    expect(run.state.cards[beregond]?.resources).toBe(6 - 2);
    run = sendUnledgered(run, { type: "PlayCard", cardId: blade, hostId: beregond, payments: [] }, tab.ctx);
    expect(run.state.cards[blade]?.host).toBe(beregond);
  });

  // On Legolas the Plate costs its printed 4; an Artifact (Horn of Gondor) on Beregond costs its printed 1.
  it("05001:A:2 lowers nothing on another hero, nor for an attachment that is not a Weapon or Armor", () => {
    const tab = table(EFFECTS, { heroes: [{ code: BEREGOND, seat: 0 }, { code: LEGOLAS, seat: 0 }], hand: [{ code: PLATE, seat: 0 }, { code: HORN, seat: 0 }] });
    const [beregond, legolas, plate, horn] = [idsOf(tab, BEREGOND), idsOf(tab, LEGOLAS), idsOf(tab, PLATE), idsOf(tab, HORN)];
    expect(refusal(tab.state, { type: "PlayCard", cardId: plate, hostId: legolas, payments: [{ heroId: legolas, amount: 2 }] }, tab.ctx)).not.toBeNull();
    expect(refusal(tab.state, { type: "PlayCard", cardId: horn, hostId: beregond, payments: [] }, tab.ctx)).not.toBeNull();
    const run = sendUnledgered(begin(tab.state), { type: "PlayCard", cardId: horn, hostId: beregond, payments: [{ heroId: beregond, amount: 1 }] }, tab.ctx);
    expect(run.state.cards[horn]?.host).toBe(beregond);
  });
});

describe("Boromir (05002:A:1)", () => {
  // "While Boromir has at least 1 resource in his resource pool, Gondor allies get +1 Attack.": with 1 resource the Guard of the Citadel
  // (Gondor, Attack 1) and the other player's Gondorian Spearman have Attack 2; the plain ally and Denethor (a Gondor hero) do not change.
  // Boromir spends his last resource on an ally, and in the state that intent returns the Guard is back to 1.
  lineSpec("05002:A:1", "Gondor allies get +1 Attack while he has a resource, and lose it when he spends the last", (effects) => {
    const scene = table(effects, { seats: 2, heroes: [{ code: BOROMIR, seat: 0 }, { code: DENETHOR, seat: 1 }], allies: [{ code: GUARD, seat: 0 }, { code: ALLY, seat: 0 }, { code: SPEARMAN, seat: 1 }], hand: [{ code: ALLY, seat: 0 }] });
    const boromir = idsOf(scene, BOROMIR);
    const tab = { ...scene, state: updateCard(scene.state, boromir, { resources: 1 }) };
    const [guard, spearman, denethor] = [idsOf(tab, GUARD), idsOf(tab, SPEARMAN), idsOf(tab, DENETHOR)];
    const [plain, held] = tab.ids[ALLY] ?? [];
    // A Pass brings the constants up to date on the new resource count.
    const before = sendUnledgered(begin(tab.state), { type: "Pass" }, tab.ctx).state;
    expect(stat(before, tab, guard, "attack")).toBe(1 + 1);
    expect(stat(before, tab, spearman, "attack")).toBe(1 + 1);
    expect(stat(before, tab, plain ?? "", "attack")).toBe(1);
    expect(stat(before, tab, denethor, "attack")).toBe(1);
    const run = sendUnledgered(begin(tab.state), { type: "PlayCard", cardId: held ?? "", payments: [{ heroId: boromir, amount: 1 }] }, tab.ctx);
    expect(run.state.cards[boromir]?.resources).toBe(0);
    expect(stat(run.state, tab, guard, "attack")).toBe(1);
  });
});

describe("Errand-rider (05003:A:1)", () => {
  // "Action: Exhaust Errand-rider to move 1 resource from the resource pool of a hero you control to another hero's resource pool.": the
  // resource may come from the Pal or Aragorn (heroes you control), not from the other player's Denethor; it goes to Denethor. The
  // Errand-rider exhausts.
  lineSpec("05003:A:1", "exhausts to move 1 resource from a hero you control to another hero", (effects) => {
    const tab = table(effects, { seats: 2, heroes: [{ code: PAL, seat: 0 }, { code: ARAGORN, seat: 0 }, { code: DENETHOR, seat: 1 }], allies: [{ code: ERRAND, seat: 0 }] }, 2);
    const [pal, aragorn, denethor, errand] = [idsOf(tab, PAL), idsOf(tab, ARAGORN), idsOf(tab, DENETHOR), idsOf(tab, ERRAND)];
    let run = sendUnledgered(begin(tab.state), { type: "Trigger", cardId: errand, effectId: "05003:action:1" }, tab.ctx);
    expect(run.state.cards[errand]?.exhausted).toBe(true);
    expect(choices(run.state, tab).sort()).toEqual([pal, aragorn].sort());
    run = sendUnledgered(run, { type: "Choose", optionId: pal }, tab.ctx);
    expect(choices(run.state, tab).sort()).toEqual([aragorn, denethor].sort());
    run = sendUnledgered(run, { type: "Choose", optionId: denethor }, tab.ctx);
    expect(run.state.cards[pal]?.resources).toBe(2 - 1);
    expect(run.state.cards[denethor]?.resources).toBe(2 + 1);
    expect(run.state.cards[aragorn]?.resources).toBe(2);
  });

  // With no resource on a hero you control there is nothing to move.
  it("05003:A:1 is not offered when no hero you control has a resource", () => {
    const tab = table(EFFECTS, { heroes: [{ code: PAL, seat: 0 }, { code: ARAGORN, seat: 0 }], allies: [{ code: ERRAND, seat: 0 }] }, 0);
    expect(triggers(tab.state, tab)).not.toContain("05003:action:1");
  });

  it("05003:A:1 is not offered when there is no other hero", () => {
    const tab = table(EFFECTS, { heroes: [{ code: PAL, seat: 0 }], allies: [{ code: ERRAND, seat: 0 }] }, 2);
    expect(triggers(tab.state, tab)).not.toContain("05003:action:1");
  });
});

describe("Citadel Custodian (05004:A:1)", () => {
  // "Lower the cost to play Citadel Custodian by 1 for each Gondor ally in play.": the Guard of the Citadel and the other player's
  // Gondorian Spearman make 2, so it costs 5 - 2 = 3; the plain ally and Denethor (a Gondor hero) do not count. It is played for 3.
  lineSpec("05004:A:1", "costs 1 less for each Gondor ally in play", (effects) => {
    const tab = table(effects, { seats: 2, heroes: [{ code: ARAGORN, seat: 0 }, { code: DENETHOR, seat: 1 }], allies: [{ code: GUARD, seat: 0 }, { code: ALLY, seat: 0 }, { code: SPEARMAN, seat: 1 }], hand: [{ code: CUSTODIAN, seat: 0 }] });
    const [aragorn, custodian] = [idsOf(tab, ARAGORN), idsOf(tab, CUSTODIAN)];
    expect(playCost(tab.state, custodian, 0, tab.ctx)).toBe(5 - 2);
    const run = sendUnledgered(begin(tab.state), { type: "PlayCard", cardId: custodian, payments: [{ heroId: aragorn, amount: 3 }] }, tab.ctx);
    expect(run.state.cards[custodian]?.zone).toBe("play");
    expect(run.state.cards[aragorn]?.resources).toBe(6 - 3);
  });
});

describe("Wealth of Gondor (05006:A:1)", () => {
  // "Action: Choose a Gondor hero. Add 1 resource to that hero's resource pool.": Denethor and the other player's Eleanor are offered;
  // Aragorn and the Guard of the Citadel (a Gondor ally) are not. Eleanor gets 1 resource.
  lineSpec("05006:A:1", "1 resource to a chosen Gondor hero", (effects) => {
    const tab = table(effects, { seats: 2, heroes: [{ code: ARAGORN, seat: 0 }, { code: DENETHOR, seat: 0 }, { code: ELEANOR, seat: 1 }], allies: [{ code: GUARD, seat: 0 }], hand: [{ code: WEALTH, seat: 0 }] });
    const [denethor, eleanor] = [idsOf(tab, DENETHOR), idsOf(tab, ELEANOR)];
    let run = play(begin(tab.state), tab, idsOf(tab, WEALTH));
    expect(choices(run.state, tab).sort()).toEqual([denethor, eleanor].sort());
    run = sendUnledgered(run, { type: "Choose", optionId: eleanor }, tab.ctx);
    expect(run.state.cards[eleanor]?.resources).toBe(6 + 1);
    expect(run.state.cards[denethor]?.resources).toBe(6);
  });

  // With no Gondor hero in play there is nothing to choose.
  it("05006:A:1 is not played without a Gondor hero", () => {
    const tab = table(EFFECTS, { heroes: [{ code: ARAGORN, seat: 0 }], allies: [{ code: GUARD, seat: 0 }], hand: [{ code: WEALTH, seat: 0 }] });
    expect(canPlay(tab.state, tab, idsOf(tab, WEALTH))).toBe(false);
  });
});

describe("Behind Strong Walls (05008:A:1)", () => {
  // Legolas pays (Tactics); `defender` defends the Weak enemy's attack; the Guard of the Citadel stands by.
  function defending(effects: readonly Effect[], defender: string): { tab: Table; run: Run } {
    const tab = table(effects, { heroes: [{ code: LEGOLAS, seat: 0 }, { code: DENETHOR, seat: 0 }, { code: ARAGORN, seat: 0 }], allies: [{ code: GUARD, seat: 0 }], engaged: [{ code: WEAK, seat: 0 }], hand: [{ code: WALLS, seat: 0 }] });
    let run = atDefense(tab);
    run = sendUnledgered(run, { type: "DeclareDefender", defenderId: idsOf(tab, defender) }, tab.ctx);
    return { tab, run };
  }

  // "Action: Ready a defending Gondor character. That character gets +1 Defense until the end of the phase.": Denethor defends and
  // exhausts; the event readies him (the Guard, not defending, is no choice) and the attack strikes Defense 3 + 1. He keeps it to the
  // end of the combat phase and loses it then.
  lineSpec("05008:A:1", "readies a defending Gondor character, +1 Defense until the end of the phase", (effects) => {
    const { tab, run: declared } = defending(effects, DENETHOR);
    const denethor = idsOf(tab, DENETHOR);
    expect(declared.state.cards[denethor]?.exhausted).toBe(true);
    let run = sendUnledgered(declared, { type: "PlayCard", cardId: idsOf(tab, WALLS), payments: [{ heroId: idsOf(tab, LEGOLAS), amount: 1 }] }, tab.ctx);
    // Denethor is the one choice, so no question is asked.
    expect(run.state.window?.kind).not.toBe("choose");
    expect(run.state.cards[denethor]?.exhausted).toBe(false);
    expect(stat(run.state, tab, denethor, "defense")).toBe(3 + 1);
    const before = run.steps.length;
    run = passAll(run, tab.ctx, { responses: true });
    const strikes = run.steps.slice(before).flatMap((step) => (step.kind === "strike" && step.side === "enemy" ? [step.defense] : []));
    expect(strikes).toEqual([3 + 1]);
    const refresh = enter(run.state, tab, "refresh").state;
    // The combat phase is over and the round has not ended yet.
    expect([refresh.phase, refresh.round]).toEqual(["End of round", run.state.round]);
    expect(stat(refresh, tab, denethor, "defense")).toBe(3);
  });

  // Aragorn defends (not Gondor): the event cannot be played.
  it("05008:A:1 is not played while the defender is not Gondor", () => {
    const { tab, run } = defending(EFFECTS, ARAGORN);
    expect(canPlay(run.state, tab, idsOf(tab, WALLS))).toBe(false);
  });
});

describe("Damrod (05010:A:1)", () => {
  // "Action: Discard Damrod from play to lower your threat by 1 for each enemy in the staging area.": two enemies in the staging area (the
  // engaged one does not count) lower the threat from 8 to 6, and Damrod goes to the discard pile.
  lineSpec("05010:A:1", "discards himself to lower the threat by 1 for each enemy in the staging area", (effects) => {
    const tab = table(effects, { heroes: [{ code: SPIRIT, seat: 0 }], allies: [{ code: DAMROD, seat: 0 }], staging: [WEAK, WEAK], engaged: [{ code: WEAK, seat: 0 }] });
    const damrod = idsOf(tab, DAMROD);
    const run = sendUnledgered(begin(tab.state), { type: "Trigger", cardId: damrod, effectId: "05010:action:1" }, tab.ctx);
    expect(run.state.cards[damrod]?.zone).toBe("discard");
    expect(run.state.seats[0]?.threat).toBe(8 - 2);
  });

  // With no enemy in the staging area the threat would not change.
  it("05010:A:1 is not offered with no enemy in the staging area", () => {
    const tab = table(EFFECTS, { heroes: [{ code: SPIRIT, seat: 0 }], allies: [{ code: DAMROD, seat: 0 }], engaged: [{ code: WEAK, seat: 0 }] });
    expect(triggers(tab.state, tab)).not.toContain("05010:action:1");
  });
});

describe("Light the Beacons (05011:A:1)", () => {
  // "Action: All characters get +2 Defense and do not exhaust to defend until the end of the round.": Eleanor pays 5; she, the ally and
  // the other player's Spirit hero have +2 Defense. The ally defends and stays ready. An ally played after the event gets nothing
  // (rr.lasting-effects), and when the round ends the Defense is back.
  lineSpec("05011:A:1", "all characters get +2 Defense and do not exhaust to defend until the end of the round", (effects) => {
    const tab = table(effects, { seats: 2, heroes: [{ code: ELEANOR, seat: 0 }, { code: SPIRIT, seat: 1 }], allies: [{ code: ALLY, seat: 0 }], hand: [{ code: BEACONS, seat: 0 }], engaged: [{ code: WEAK, seat: 0 }] });
    const [eleanor, spirit] = [idsOf(tab, ELEANOR), idsOf(tab, SPIRIT)];
    const [ally] = tab.ids[ALLY] ?? [];
    let run = sendUnledgered(begin(tab.state), { type: "PlayCard", cardId: idsOf(tab, BEACONS), payments: [{ heroId: eleanor, amount: 5 }] }, tab.ctx);
    expect(stat(run.state, tab, eleanor, "defense")).toBe(2 + 2);
    expect(stat(run.state, tab, ally ?? "", "defense")).toBe(1 + 2);
    expect(stat(run.state, tab, spirit, "defense")).toBe(1 + 2);
    run = atDefense(tab, run.state);
    run = sendUnledgered(run, { type: "DeclareDefender", defenderId: ally ?? "" }, tab.ctx);
    expect(run.state.cards[ally ?? ""]?.exhausted).toBe(false);
    expect(stat(endRound(run.state, tab).state, tab, ally ?? "", "defense")).toBe(1);
  });

  // An ally that enters play after the event is not affected.
  it("05011:A:1 an ally played after it gets no Defense", () => {
    const tab = table(EFFECTS, { heroes: [{ code: ELEANOR, seat: 0 }, { code: ARAGORN, seat: 0 }], hand: [{ code: BEACONS, seat: 0 }, { code: ALLY, seat: 0 }] });
    let run = sendUnledgered(begin(tab.state), { type: "PlayCard", cardId: idsOf(tab, BEACONS), payments: [{ heroId: idsOf(tab, ELEANOR), amount: 5 }] }, tab.ctx);
    run = sendUnledgered(run, { type: "PlayCard", cardId: idsOf(tab, ALLY), payments: [{ heroId: idsOf(tab, ARAGORN), amount: 1 }] }, tab.ctx);
    expect(stat(run.state, tab, idsOf(tab, ALLY), "defense")).toBe(1);
  });
});

describe("Hunter of Lamedon (05014:A:1)", () => {
  // Denethor pays (Lore); the deck holds `top` over a plain card.
  const scene = (effects: readonly Effect[], top: string) => table(effects, { heroes: [{ code: DENETHOR, seat: 0 }], hand: [{ code: HUNTER, seat: 0 }], playerDeck: [{ code: top, seat: 0 }, { code: "card", seat: 0 }] });

  // "Response: After you play Hunter of Lamedon from your hand, reveal the top card of your deck. If it is an Outlands card, add it to your
  // hand. Otherwise, discard it.": the Outlands ally on top goes to the hand.
  lineSpec("05014:A:1", "after he is played, the top card of the deck goes to the hand when it is Outlands", (effects) => {
    const tab = scene(effects, OUTLAND);
    const [hunter, outland] = [idsOf(tab, HUNTER), idsOf(tab, OUTLAND)];
    expect(tab.state.seats[0]?.deck[0]).toBe(outland);
    let run = play(begin(tab.state), tab, hunter);
    expect(triggers(run.state, tab)).toContain("05014:response:1");
    run = sendUnledgered(run, { type: "Trigger", cardId: hunter, effectId: "05014:response:1" }, tab.ctx);
    expect(run.state.cards[outland]?.zone).toBe("hand");
    expect(run.state.seats[0]?.deck).toHaveLength(1);
  });

  // The plain card on top is discarded; the card under it stays.
  it("05014:A:1 discards the top card when it is not Outlands", () => {
    const tab = scene(EFFECTS, ALLY);
    const [hunter, top] = [idsOf(tab, HUNTER), idsOf(tab, ALLY)];
    expect(tab.state.seats[0]?.deck[0]).toBe(top);
    let run = play(begin(tab.state), tab, hunter);
    run = sendUnledgered(run, { type: "Trigger", cardId: hunter, effectId: "05014:response:1" }, tab.ctx);
    expect(run.state.cards[top]?.zone).toBe("discard");
    expect(run.state.seats[0]?.hand).toHaveLength(0);
    expect(run.state.seats[0]?.deck).toHaveLength(1);
  });
});

describe("Envoy of Pelargir (05018:A:1)", () => {
  // "Response: After Envoy of Pelargir enters play, add 1 resource to a Gondor or Noble hero's resource pool.": Denethor (Gondor) and the
  // other player's Aragorn (Noble) are offered, the Pal and the Guard of the Citadel (a Gondor ally) are not. Aragorn gets 1.
  lineSpec("05018:A:1", "after he enters play, 1 resource to a Gondor or Noble hero", (effects) => {
    const tab = table(effects, { seats: 2, heroes: [{ code: PAL, seat: 0 }, { code: DENETHOR, seat: 0 }, { code: ARAGORN, seat: 1 }], allies: [{ code: GUARD, seat: 0 }], hand: [{ code: ENVOY, seat: 0 }] });
    const [envoy, denethor, aragorn] = [idsOf(tab, ENVOY), idsOf(tab, DENETHOR), idsOf(tab, ARAGORN)];
    let run = play(begin(tab.state), tab, envoy);
    const before = run.state.cards[aragorn]?.resources ?? 0;
    expect(triggers(run.state, tab)).toContain("05018:response:1");
    run = sendUnledgered(run, { type: "Trigger", cardId: envoy, effectId: "05018:response:1" }, tab.ctx);
    expect(choices(run.state, tab).sort()).toEqual([denethor, aragorn].sort());
    run = sendUnledgered(run, { type: "Choose", optionId: aragorn }, tab.ctx);
    expect(run.state.cards[aragorn]?.resources).toBe(before + 1);
  });

  // With no Gondor or Noble hero there is nothing to choose.
  it("05018:A:1 is not offered without a Gondor or Noble hero", () => {
    const tab = table(EFFECTS, { heroes: [{ code: PAL, seat: 0 }, { code: SPIRIT, seat: 0 }], hand: [{ code: ENVOY, seat: 0 }] });
    const run = play(begin(tab.state), tab, idsOf(tab, ENVOY));
    expect(run.state.cards[idsOf(tab, ENVOY)]?.zone).toBe("play");
    expect(triggers(run.state, tab)).not.toContain("05018:response:1");
  });
});
