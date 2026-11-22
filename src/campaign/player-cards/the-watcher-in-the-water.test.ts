// Rules: rr.response, rr.forced, rr.triggered-ability, rr.sentinel, rr.lasting-effects, rr.unique-cards, rr.ownership-and-control,
// rr.step-6-4-1 (data/rules/entries.json).
// The Watcher in the Water allies and events, each printed line tested from the words on the card (lineSpec, test/harness/line-spec.ts):
// Grave Cairn 04054:A:1, Watcher of the Bruinen 04056:A:2 and A:3, Arwen Undómiel 04058:A:1, Elrond's Counsel 04059:A:1 (the attachments
// are in the-watcher-in-the-water-attachments.test.ts). The lines are the text of data/cards/WitW.json (data/printed holds no ledger for
// this pack), so every intent goes through sendUnledgered.
import { beforeAll, describe, expect, it } from "vitest";

import type { Effect } from "../../catalog/boundary.ts";
import { EFFECTS } from "../../effects/index.ts";
import { ruleCause } from "../../rules/core/cause.ts";
import { hasKeyword, placeDamage } from "../../rules/core/keywords.ts";
import { definePrinted } from "../../rules/core/printed.ts";
import { legalIntents } from "../../rules/engine/reduce.ts";
import { starterBase } from "../../../test/scenarios/a-shadow-of-the-past/starter-scene.ts";
import { loadPrinted } from "../../../test/harness/catalog.ts";
import { lineSpec } from "../../../test/harness/line-spec.ts";
import { begin, idsOf, type Run, type Scene, type Table } from "../../../test/harness/scene.ts";
import { choices, combat, endRound, enter, fillers, passAll, playerTable, sendUnledgered, stat, triggers } from "../../../test/harness/player-table.ts";

const CAIRN = "04054";
const WATCHER = "04056";
const ARWEN = "04058";
const COUNSEL = "04059";
// Core Glorfindel (Lore Noldor, unique).
const GLORFINDEL = "01011";
const ALLY = "ally";
const PAL = "pal";
// An ally of Attack 3, an ally of Attack 0, a Spirit hero with no text, an enemy no attack here destroys.
const BRUTE = "brute";
const NOUGHT = "nought";
const SPIRIT = "spirit";
const WEAK = "weak";

let base: Awaited<ReturnType<typeof starterBase>>;

const table = (effects: readonly Effect[], scene: Scene = {}, resources = 6): Table => playerTable(base, effects, scene, resources);

beforeAll(async () => {
  const starter = await starterBase();
  const cards = new Map([...starter.cards, ...(await loadPrinted([CAIRN, WATCHER, ARWEN, COUNSEL, GLORFINDEL]))]);
  cards.set(BRUTE, definePrinted({ code: BRUTE, name: "Brute", type: "ally", sphere: "leadership", cost: 1, willpower: 1, attack: 3, defense: 1, health: 2 }));
  cards.set(NOUGHT, definePrinted({ code: NOUGHT, name: "Nought", type: "ally", sphere: "leadership", cost: 1, willpower: 1, attack: 0, defense: 1, health: 2 }));
  cards.set(SPIRIT, definePrinted({ code: SPIRIT, name: "Spirit", type: "hero", sphere: "spirit", threat: 8, willpower: 1, attack: 1, defense: 1, health: 3 }));
  cards.set(WEAK, definePrinted({ code: WEAK, name: "Weak", type: "enemy", threat: 1, engagementCost: 30, attack: 1, defense: 0, health: 9 }));
  base = { ...starter, cards };
});

// The card `id` is destroyed (9 damage), and a Pass lets the game resolve what that set off.
const destroyed = (tab: Table, id: string): Run => sendUnledgered(begin(placeDamage(tab.state, id, 9, tab.ctx.cards, [], "framework", ruleCause("rr.damage"))), { type: "Pass" }, tab.ctx);

describe("Grave Cairn (04054:A:1)", () => {
  // The Pal pays; the Brute (Attack 3), an ally and the other player's Spirit hero are in play; Grave Cairn is in hand; the Weak enemy is
  // engaged, so the combat phase stops at its attack.
  const scene = (effects: readonly Effect[], allies: readonly string[] = [BRUTE, ALLY]) =>
    table(effects, { seats: 2, heroes: [{ code: PAL, seat: 0 }, { code: SPIRIT, seat: 1 }], allies: allies.map((code) => ({ code, seat: 0 })), engaged: [{ code: WEAK, seat: 0 }], hand: [{ code: CAIRN, seat: 0 }] });

  // "Response: After a character leaves play, add its Attack to another character's Attack until the end of the round.": the Brute is
  // destroyed; the ally gets +3 Attack, which it keeps through the round and loses when the round ends.
  lineSpec("04054:A:1", "after a character leaves play, its Attack goes to another character until the end of the round", (effects) => {
    const tab = scene(effects);
    const [brute, ally, cairn] = [idsOf(tab, BRUTE), idsOf(tab, ALLY), idsOf(tab, CAIRN)];
    let run = destroyed(tab, brute);
    expect(run.state.cards[brute]?.zone).toBe("discard");
    expect(triggers(run.state, tab)).toContain("04054:response:1");
    run = sendUnledgered(run, { type: "Trigger", cardId: cairn, effectId: "04054:response:1", payments: [{ heroId: idsOf(tab, PAL), amount: 1 }] }, tab.ctx);
    expect(choices(run.state, tab).sort()).toEqual([idsOf(tab, PAL), ally, idsOf(tab, SPIRIT)].sort());
    run = sendUnledgered(run, { type: "Choose", optionId: ally }, tab.ctx);
    expect(stat(run.state, tab, ally, "attack")).toBe(1 + 3);
    // In the combat phase of the same round it still has it.
    const later = passAll(enter(run.state, tab, "combatStart"), tab.ctx).state;
    expect([later.phase, later.round]).toEqual(["Combat", run.state.round]);
    expect(stat(later, tab, ally, "attack")).toBe(1 + 3);
    expect(stat(endRound(run.state, tab).state, tab, ally, "attack")).toBe(1);
  });

  // An enemy that leaves play is not a character.
  it("04054:A:1 is not offered when an enemy leaves play", () => {
    const tab = table(EFFECTS, { heroes: [{ code: PAL, seat: 0 }], allies: [{ code: ALLY, seat: 0 }], engaged: [{ code: WEAK, seat: 0 }], hand: [{ code: CAIRN, seat: 0 }] });
    const run = destroyed(tab, idsOf(tab, WEAK));
    expect(run.state.cards[idsOf(tab, WEAK)]?.zone).toBe("encounterDiscard");
    expect(triggers(run.state, tab)).not.toContain("04054:response:1");
  });

  it("04054:A:1 is not offered when the character that leaves play has Attack 0", () => {
    const tab = scene(EFFECTS, [NOUGHT, ALLY]);
    const run = destroyed(tab, idsOf(tab, NOUGHT));
    expect(run.state.cards[idsOf(tab, NOUGHT)]?.zone).toBe("discard");
    expect(triggers(run.state, tab)).not.toContain("04054:response:1");
  });
});

describe("Watcher of the Bruinen (04056:A:2, A:3)", () => {
  // The Watcher is the only character that can defend the Weak enemy's attack; `hand` cards are in the player's hand.
  function defends(effects: readonly Effect[], hand: number): { tab: Table; run: Run } {
    const tab = table(effects, { heroes: [{ code: PAL, seat: 0 }], allies: [{ code: WATCHER, seat: 0 }], engaged: [{ code: WEAK, seat: 0 }], hand: fillers("card", hand) });
    let run = passAll(combat(tab.state, tab), tab.ctx);
    expect(run.state.window?.kind).toBe("defense");
    run = sendUnledgered(run, { type: "DeclareDefender", defenderId: idsOf(tab, WATCHER) }, tab.ctx);
    return { tab, run };
  }

  // "Watcher of the Bruinen does not exhaust to defend.": declared as the defender, it stays ready.
  lineSpec("04056:A:2", "does not exhaust to defend", (effects) => {
    const { tab, run } = defends(effects, 1);
    expect(run.state.cards[idsOf(tab, WATCHER)]?.exhausted).toBe(false);
  });

  // "Forced: After Watcher of the Bruinen defends, either discard it from play or discard 1 card from your hand.": with a card in hand the
  // player chooses; discarding the card keeps the Watcher in play.
  lineSpec("04056:A:3", "after it defends, the player discards it or 1 card from hand", (effects) => {
    const { tab, run: declared } = defends(effects, 1);
    let run = passAll(declared, tab.ctx, { responses: true });
    expect(choices(run.state, tab).sort()).toEqual(["discard", "hand"]);
    run = sendUnledgered(run, { type: "Choose", optionId: "hand" }, tab.ctx);
    // The one card in hand is discarded without a question, and the attack is over.
    expect(run.state.window?.kind).toBe("playerAttack");
    expect(run.state.seats[0]?.hand).toHaveLength(0);
    expect(run.state.seats[0]?.discard).toHaveLength(1);
    expect(run.state.cards[idsOf(tab, WATCHER)]?.zone).toBe("play");
  });

  // Choosing "discard" puts the Watcher in the discard pile and the hand is kept.
  it("04056:A:3 the player may discard the Watcher instead", () => {
    const { tab, run: declared } = defends(EFFECTS, 1);
    let run = passAll(declared, tab.ctx, { responses: true });
    run = sendUnledgered(run, { type: "Choose", optionId: "discard" }, tab.ctx);
    expect(run.state.cards[idsOf(tab, WATCHER)]?.zone).toBe("discard");
    expect(run.state.seats[0]?.hand).toHaveLength(1);
  });

  // With an empty hand the only way to resolve it is to discard the Watcher.
  it("04056:A:3 with no card in hand the Watcher is discarded", () => {
    const { tab, run: declared } = defends(EFFECTS, 0);
    const run = passAll(declared, tab.ctx, { responses: true });
    // No question is asked: the Watcher is discarded and the combat goes on to the player attacks.
    expect(run.state.window?.kind).toBe("playerAttack");
    expect(run.state.cards[idsOf(tab, WATCHER)]?.zone).toBe("discard");
  });
});

describe("Arwen Undómiel (04058:A:1)", () => {
  // "Response: After Arwen Undómiel exhausts, choose a character. That character gains sentinel and gets +1 Defense until the end of the
  // round.": Arwen exhausts as she is committed to the quest; the chosen ally gains sentinel and +1 Defense, which it keeps after the quest
  // phase and loses when the round ends.
  lineSpec("04058:A:1", "after she exhausts, a character gains sentinel and +1 Defense until the end of the round", (effects) => {
    const tab = table(effects, { start: "quest", heroes: [{ code: SPIRIT, seat: 0 }], allies: [{ code: ARWEN, seat: 0 }, { code: ALLY, seat: 0 }], engaged: [{ code: WEAK, seat: 0 }], deck: ["f0", "f0"] });
    const [arwen, ally] = [idsOf(tab, ARWEN), idsOf(tab, ALLY)];
    let run = sendUnledgered(begin(tab.state), { type: "Commit", cardIds: [arwen] }, tab.ctx);
    expect(run.state.cards[arwen]?.exhausted).toBe(true);
    expect(triggers(run.state, tab)).toContain("04058:response:1");
    run = sendUnledgered(run, { type: "Trigger", cardId: arwen, effectId: "04058:response:1" }, tab.ctx);
    expect(choices(run.state, tab).sort()).toEqual([idsOf(tab, SPIRIT), arwen, ally].sort());
    run = sendUnledgered(run, { type: "Choose", optionId: ally }, tab.ctx);
    expect(hasKeyword(run.state, ally, "sentinel", tab.ctx.cards)).toBe(true);
    expect(stat(run.state, tab, ally, "defense")).toBe(1 + 1);
    // The combat phase of the same round, its first attack waiting for a defender.
    const later = passAll(enter(run.state, tab, "combatStart"), tab.ctx).state;
    expect(later.round).toBe(run.state.round);
    expect(hasKeyword(later, ally, "sentinel", tab.ctx.cards)).toBe(true);
    expect(stat(later, tab, ally, "defense")).toBe(1 + 1);
    const next = endRound(run.state, tab).state;
    expect(hasKeyword(next, ally, "sentinel", tab.ctx.cards)).toBe(false);
    expect(stat(next, tab, ally, "defense")).toBe(1);
  });

  // Another character that exhausts offers nothing.
  it("04058:A:1 is not offered when another character exhausts", () => {
    const tab = table(EFFECTS, { start: "quest", heroes: [{ code: SPIRIT, seat: 0 }], allies: [{ code: ARWEN, seat: 0 }, { code: ALLY, seat: 0 }], deck: ["f0", "f0"] });
    const run = sendUnledgered(begin(tab.state), { type: "Commit", cardIds: [idsOf(tab, ALLY)] }, tab.ctx);
    expect(run.state.cards[idsOf(tab, ALLY)]?.exhausted).toBe(true);
    expect(triggers(run.state, tab)).not.toContain("04058:response:1");
  });
});

describe("Elrond's Counsel (04059:A:1)", () => {
  const playable = (tab: Table, state = tab.state) => legalIntents(state, tab.ctx).some((intent) => intent.type === "PlayCard" && intent.cardId === idsOf(tab, COUNSEL));

  // "Action: If you control a unique Noldor character, give another character +1 Willpower until the end of the phase and lower your
  // threat by 3.": Glorfindel is the only unique Noldor; the Spirit hero pays. The choice is any other character (Glorfindel is not
  // offered); the Spirit hero gets +1 Willpower until the planning phase ends, and the threat drops from 8 to 5.
  lineSpec("04059:A:1", "with a unique Noldor, another character gets +1 Willpower for the phase and the threat drops by 3", (effects) => {
    const tab = table(effects, { heroes: [{ code: GLORFINDEL, seat: 0 }, { code: SPIRIT, seat: 0 }], allies: [{ code: ALLY, seat: 0 }], hand: [{ code: COUNSEL, seat: 0 }] });
    const [glorfindel, spirit, ally] = [idsOf(tab, GLORFINDEL), idsOf(tab, SPIRIT), idsOf(tab, ALLY)];
    let run = sendUnledgered(begin(tab.state), { type: "PlayCard", cardId: idsOf(tab, COUNSEL), payments: [] }, tab.ctx);
    expect(choices(run.state, tab).sort()).toEqual([spirit, ally].sort());
    expect(choices(run.state, tab)).not.toContain(glorfindel);
    run = sendUnledgered(run, { type: "Choose", optionId: spirit }, tab.ctx);
    expect(stat(run.state, tab, spirit, "willpower")).toBe(1 + 1);
    expect(run.state.seats[0]?.threat).toBe(8 - 3);
    expect(stat(enter(run.state, tab, "questCommit").state, tab, spirit, "willpower")).toBe(1);
  });

  // A non-unique Noldor (the Watcher of the Bruinen) and the other player's Glorfindel do not meet the condition.
  it("04059:A:1 is not played without a unique Noldor character you control", () => {
    const tab = table(EFFECTS, { seats: 2, heroes: [{ code: SPIRIT, seat: 0 }, { code: GLORFINDEL, seat: 1 }], allies: [{ code: WATCHER, seat: 0 }], hand: [{ code: COUNSEL, seat: 0 }] });
    expect(playable(tab)).toBe(false);
  });
});

