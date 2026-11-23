// Rules: rr.action, rr.limits, rr.resources, rr.move, rr.play-restrictions-and-permissions, rr.discard-pile-and-victory-display, rr.ready, rr.cost,
// rr.response, rr.destroy, rr.damage, rr.traits, rr.search (data/rules/entries.json).
// The Flight of the Stormcaller heroes and allies, written from their card text (data/cards/FotS.json; data/printed holds no ledger for this pack
// yet): Denethor 12001:A:2, Azain Silverbeard 12004:A:1, Glorfindel 12006:A:1 and A:2, Imladris Caregiver 12008:A:1, Guardian of Rivendell
// 12010:A:1.
import { beforeAll, describe, expect, it } from "vitest";

import type { Effect } from "../../catalog/boundary.ts";
import { EFFECTS } from "../../effects/index.ts";
import { definePrinted } from "../../rules/core/printed.ts";
import { updateCard } from "../../rules/core/state.ts";
import { spawn } from "../../rules/core/zones.ts";
import { payFor, refusal, starterBase } from "../../../test/scenarios/a-shadow-of-the-past/starter-scene.ts";
import { loadPrinted } from "../../../test/harness/catalog.ts";
import { lineSpec } from "../../../test/harness/line-spec.ts";
import { begin, idsOf, type Run, type Scene, type Table } from "../../../test/harness/scene.ts";
import { answerFirst, attacking, choices, chooseIfAsked, fillers, passWhile, playerTableFor, sendUnledgered, triggers } from "../../../test/harness/player-table.ts";

const DENETHOR = "12001";
const AZAIN = "12004";
const GLORFINDEL = "12006";
const CAREGIVER = "12008";
const GUARDIAN = "12010";
// Core heroes: Eleanor (Spirit, Gondor), Glóin (Leadership, Dwarf), Legolas (Tactics), Éowyn (Spirit), core Denethor (Lore, Gondor).
const GLOIN = "01003";
const LEGOLAS = "01005";
const EOWYN = "01007";
const ELEANOR = "01008";
const LORE_DENETHOR = "01010";
// Orcs and a Troll: the destroyed enemy and the ones that share a Trait with it or not.
const FRAIL_ORC = "frailOrc";
const ORC = "orc";
const TROLL = "troll";
const PAL = "pal";
const CARD = "card";

let base: Awaited<ReturnType<typeof starterBase>>;

const table = playerTableFor(() => base);

beforeAll(async () => {
  const starter = await starterBase();
  const cards = new Map([...starter.cards, ...(await loadPrinted([DENETHOR, AZAIN, GLORFINDEL, CAREGIVER, GUARDIAN, GLOIN, LEGOLAS, EOWYN, ELEANOR, LORE_DENETHOR]))]);
  cards.set(FRAIL_ORC, definePrinted({ code: FRAIL_ORC, name: "Frail Orc", type: "enemy", traits: ["Orc", "Goblin"], threat: 1, engagementCost: 40, attack: 1, defense: 0, health: 1 }));
  cards.set(ORC, definePrinted({ code: ORC, name: "Orc", type: "enemy", traits: ["Orc"], threat: 1, engagementCost: 40, attack: 1, defense: 0, health: 9 }));
  cards.set(TROLL, definePrinted({ code: TROLL, name: "Troll", type: "enemy", traits: ["Troll"], threat: 1, engagementCost: 40, attack: 1, defense: 0, health: 9 }));
  base = { ...starter, cards };
});

describe("Denethor (12001:A:2)", () => {
  // "Action: Move 1 resource from Denethor's resource pool to another Gondor hero's resource pool. (Limit once per round.)": Eleanor (Gondor) is a
  // choice and takes the resource; Glóin (not Gondor) is not a choice.
  lineSpec("12001:A:2", "moves 1 resource from his pool to another Gondor hero's, once a round", (effects) => {
    const scene = table(effects, { heroes: [{ code: DENETHOR, seat: 0 }, { code: ELEANOR, seat: 0 }, { code: GLOIN, seat: 0 }] }, 0);
    const [denethor, eleanor] = [idsOf(scene, DENETHOR), idsOf(scene, ELEANOR)];
    const tab = { ...scene, state: updateCard(scene.state, denethor, { resources: 2 }) };
    let run = sendUnledgered(begin(tab.state), { type: "Trigger", cardId: denethor, effectId: "12001:action:1" }, tab.ctx);
    expect(run.state.window?.kind).not.toBe("choose");
    run = chooseIfAsked(run, tab, eleanor);
    expect(run.state.cards[denethor]?.resources).toBe(1);
    expect(run.state.cards[eleanor]?.resources).toBe(1);
    expect(run.state.cards[idsOf(tab, GLOIN)]?.resources).toBe(0);
    // A resource is left, but the limit is once per round.
    expect(triggers(run.state, tab)).not.toContain("12001:action:1");
  });

  it("12001:A:2 is not offered with an empty pool, or with no other Gondor hero", () => {
    const empty = table(EFFECTS, { heroes: [{ code: DENETHOR, seat: 0 }, { code: ELEANOR, seat: 0 }] }, 0);
    expect(triggers(empty.state, empty)).not.toContain("12001:action:1");
    const alone = table(EFFECTS, { heroes: [{ code: DENETHOR, seat: 0 }, { code: GLOIN, seat: 0 }] }, 2);
    expect(triggers(alone.state, alone)).not.toContain("12001:action:1");
  });
});

describe("Azain Silverbeard (12004:A:1)", () => {
  // "Response: After Azain Silverbeard participates in an attack that destroys an enemy, spend 1 Tactics resource to deal 2 damage to another enemy
  // that shares a Trait with the destroyed enemy. Any player may trigger this response.": Azain destroys the Frail Orc (Orc, Goblin); the other Orc
  // takes 2 damage, the Troll is no choice, and Legolas pays the Tactics resource.
  function destroys(effects: readonly Effect[], scene: Scene): { tab: Table; run: Run } {
    const tab = table(effects, scene, 1);
    let run = sendUnledgered(begin(attacking(tab.state)), { type: "DeclareAttackers", enemyId: idsOf(tab, FRAIL_ORC), attackerIds: [idsOf(tab, AZAIN)] }, tab.ctx);
    run = passWhile(run, tab, (run) => !triggers(run.state, tab).includes("12004:response:1") && run.state.window?.kind === "frameAction", 6);
    return { tab, run };
  }

  lineSpec("12004:A:1", "after his attack destroys an enemy, spends 1 Tactics resource to deal 2 damage to another enemy sharing a Trait", (effects) => {
    const { tab, run: destroyed } = destroys(effects, { heroes: [{ code: LEGOLAS, seat: 0 }, { code: EOWYN, seat: 0 }], allies: [{ code: AZAIN, seat: 0 }], engaged: [{ code: FRAIL_ORC, seat: 0 }, { code: TROLL, seat: 0 }], staging: [ORC] });
    const [legolas, orc, troll] = [idsOf(tab, LEGOLAS), idsOf(tab, ORC), idsOf(tab, TROLL)];
    expect(destroyed.state.cards[idsOf(tab, FRAIL_ORC)]?.zone).toBe("encounterDiscard");
    expect(triggers(destroyed.state, tab)).toContain("12004:response:1");
    let run = sendUnledgered(destroyed, { type: "Trigger", cardId: idsOf(tab, AZAIN), effectId: "12004:response:1", payments: [{ heroId: legolas, amount: 1 }] }, tab.ctx);
    expect(run.state.window?.kind).not.toBe("choose");
    run = chooseIfAsked(run, tab, orc);
    expect(run.state.cards[orc]?.damage).toBe(2);
    expect(run.state.cards[troll]?.damage).toBe(0);
    expect(run.state.cards[legolas]?.resources).toBe(0);
  });

  // "Any player may trigger this response.": the other player's Legolas pays the Tactics resource, Azain's player having none.
  lineSpec("12004:A:1", "the other player may trigger it and pay the Tactics resource", (effects) => {
    const { tab, run: destroyed } = destroys(effects, { seats: 2, heroes: [{ code: EOWYN, seat: 0 }, { code: LEGOLAS, seat: 1 }], allies: [{ code: AZAIN, seat: 0 }], engaged: [{ code: FRAIL_ORC, seat: 0 }], staging: [ORC] });
    const [legolas, orc] = [idsOf(tab, LEGOLAS), idsOf(tab, ORC)];
    expect(triggers(destroyed.state, tab)).toContain("12004:response:1");
    let run = sendUnledgered(destroyed, { type: "Trigger", cardId: idsOf(tab, AZAIN), effectId: "12004:response:1", payments: [{ heroId: legolas, amount: 1 }] }, tab.ctx);
    run = chooseIfAsked(run, tab, orc);
    expect(run.state.cards[orc]?.damage).toBe(2);
    expect(run.state.cards[legolas]?.resources).toBe(0);
  });

  it("12004:A:1 is not offered when no other enemy shares a Trait with the destroyed one", () => {
    const { tab, run } = destroys(EFFECTS, { heroes: [{ code: LEGOLAS, seat: 0 }], allies: [{ code: AZAIN, seat: 0 }], engaged: [{ code: FRAIL_ORC, seat: 0 }, { code: TROLL, seat: 0 }] });
    expect(run.state.cards[idsOf(tab, FRAIL_ORC)]?.zone).toBe("encounterDiscard");
    expect(triggers(run.state, tab)).not.toContain("12004:response:1");
  });
});

describe("Glorfindel (12006:A:1, A:2)", () => {
  // "Glorfindel can be played from your discard pile.": he lies in the discard pile and Éowyn pays his 5.
  lineSpec("12006:A:1", "is played from the discard pile", (effects) => {
    const tab = table(effects, { heroes: [{ code: EOWYN, seat: 0 }, { code: GLOIN, seat: 0 }] });
    const made = spawn(tab.state, GLORFINDEL, { zone: "discard", seat: 0 });
    const run = sendUnledgered(begin(made.state), { type: "PlayCard", cardId: made.id, payments: payFor(made.state, tab.ctx, made.id) }, tab.ctx);
    expect(run.state.cards[made.id]).toMatchObject({ zone: "play", controller: 0 });
  });

  it("12006:A:1 is not played from another player's discard pile", () => {
    const tab = table(EFFECTS, { seats: 2, heroes: [{ code: EOWYN, seat: 0 }, { code: PAL, seat: 1 }] });
    const made = spawn(tab.state, GLORFINDEL, { zone: "discard", seat: 1 });
    expect(refusal(made.state, { type: "PlayCard", cardId: made.id, payments: [{ heroId: idsOf(tab, EOWYN), amount: 5 }] }, tab.ctx)).not.toBeNull();
  });

  // "Action: Discard a card from your hand to ready Glorfindel. (Limit once per phase.)"
  lineSpec("12006:A:2", "discards a card from the hand to ready himself, once a phase", (effects) => {
    const scene = table(effects, { heroes: [{ code: EOWYN, seat: 0 }], allies: [{ code: GLORFINDEL, seat: 0 }], hand: fillers(CARD, 2) });
    const glorfindel = idsOf(scene, GLORFINDEL);
    const tab = { ...scene, state: updateCard(scene.state, glorfindel, { exhausted: true }) };
    let run = answerFirst(sendUnledgered(begin(tab.state), { type: "Trigger", cardId: glorfindel, effectId: "12006:action:1" }, tab.ctx), tab);
    expect(run.state.cards[glorfindel]?.exhausted).toBe(false);
    expect(run.state.seats[0]?.hand).toHaveLength(1);
    expect(run.state.seats[0]?.discard).toHaveLength(1);
    // Exhausted again in the same phase, a card in hand: not offered.
    run = begin(updateCard(run.state, glorfindel, { exhausted: true }));
    expect(triggers(run.state, tab)).not.toContain("12006:action:1");
  });

  it("12006:A:2 is not offered while Glorfindel is ready, or with an empty hand", () => {
    const ready = table(EFFECTS, { heroes: [{ code: EOWYN, seat: 0 }], allies: [{ code: GLORFINDEL, seat: 0 }], hand: fillers(CARD, 2) });
    expect(triggers(ready.state, ready)).not.toContain("12006:action:1");
    const empty = table(EFFECTS, { heroes: [{ code: EOWYN, seat: 0 }], allies: [{ code: GLORFINDEL, seat: 0 }] });
    expect(triggers(updateCard(empty.state, idsOf(empty, GLORFINDEL), { exhausted: true }), empty)).not.toContain("12006:action:1");
  });
});

describe("Imladris Caregiver (12008:A:1)", () => {
  // "Action: Discard a card from your hand to heal 1 damage on any character. (Limit twice per round).": the other player's damaged hero is healed
  // twice; a third use is not offered.
  lineSpec("12008:A:1", "discards a card from the hand to heal 1 damage on any character, twice a round", (effects) => {
    const scene = table(effects, { seats: 2, heroes: [{ code: EOWYN, seat: 0 }, { code: PAL, seat: 1 }], allies: [{ code: CAREGIVER, seat: 0 }], hand: fillers(CARD, 3) });
    const [caregiver, pal] = [idsOf(scene, CAREGIVER), idsOf(scene, PAL)];
    const tab = { ...scene, state: updateCard(scene.state, pal, { damage: 2 }) };
    let run = begin(tab.state);
    for (let use = 1; use <= 2; use += 1) {
      expect(triggers(run.state, tab)).toContain("12008:action:1");
      run = sendUnledgered(run, { type: "Trigger", cardId: caregiver, effectId: "12008:action:1" }, tab.ctx);
      for (let guard = 0; guard < 3 && run.state.window?.kind === "choose"; guard += 1) {
        const offered = choices(run.state, tab);
        run = sendUnledgered(run, { type: "Choose", optionId: offered.includes(pal) ? pal : (offered[0] ?? "") }, tab.ctx);
      }
      expect(run.state.cards[pal]?.damage).toBe(2 - use);
      expect(run.state.seats[0]?.hand).toHaveLength(3 - use);
    }
    // Damage is healed; a third use in the round is not offered though another character is damaged.
    const damaged = updateCard(run.state, idsOf(tab, EOWYN), { damage: 1 });
    expect(triggers(damaged, tab)).not.toContain("12008:action:1");
  });

  it("12008:A:1 is not offered with no damaged character", () => {
    const tab = table(EFFECTS, { heroes: [{ code: EOWYN, seat: 0 }], allies: [{ code: CAREGIVER, seat: 0 }], hand: fillers(CARD, 2) });
    expect(triggers(tab.state, tab)).not.toContain("12008:action:1");
  });
});

describe("Guardian of Rivendell (12010:A:1)", () => {
  // "As an additional cost to play Guardian of Rivendell from your hand, you must discard 2 cards from your hand."
  lineSpec("12010:A:1", "is played from the hand only by discarding 2 more cards from it", (effects) => {
    const tab = table(effects, { heroes: [{ code: EOWYN, seat: 0 }, { code: GLOIN, seat: 0 }], hand: [{ code: GUARDIAN, seat: 0 }, ...fillers(CARD, 3)] });
    const guardian = idsOf(tab, GUARDIAN);
    const run = answerFirst(sendUnledgered(begin(tab.state), { type: "PlayCard", cardId: guardian, payments: payFor(tab.state, tab.ctx, guardian) }, tab.ctx), tab);
    expect(run.state.cards[guardian]?.zone).toBe("play");
    expect(run.state.seats[0]?.hand).toHaveLength(1);
    expect(run.state.seats[0]?.discard).toHaveLength(2);
    // With 1 other card in hand the cost cannot be paid.
    const short = table(effects, { heroes: [{ code: EOWYN, seat: 0 }, { code: GLOIN, seat: 0 }], hand: [{ code: GUARDIAN, seat: 0 }, ...fillers(CARD, 1)] });
    const held = idsOf(short, GUARDIAN);
    expect(refusal(short.state, { type: "PlayCard", cardId: held, payments: payFor(short.state, short.ctx, held) }, short.ctx)).not.toBeNull();
  });
});
