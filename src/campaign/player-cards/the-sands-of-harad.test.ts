// Rules: rr.response, rr.triggered-ability, rr.cost, rr.limits, rr.ready, rr.lasting-effects, rr.modifiers, rr.enters-play,
// rr.discard-pile-and-victory-display (data/rules/entries.json).
// The Sands of Harad heroes, allies and side quest, written from their card text (data/cards/TSoH.json; data/printed holds no ledger for
// this box, so every intent goes through sendUnledgered): Gimli 16001:A:2, Legolas 16002:A:2, Greenwood Archer 16003:A:2, Erebor Guard
// 16004:A:2, The Storm Comes 16013:A:1. The events are in the-sands-of-harad-events.test.ts, the attachments in
// the-sands-of-harad-attachments.test.ts.
import { beforeAll, describe, expect, it } from "vitest";

import type { Effect } from "../../catalog/boundary.ts";
import { EFFECTS } from "../../effects/index.ts";
import { definePrinted } from "../../rules/core/printed.ts";
import { updateCard, withMode } from "../../rules/core/state.ts";
import { refusal, starterBase } from "../../../test/scenarios/a-shadow-of-the-past/starter-scene.ts";
import { loadPrinted } from "../../../test/harness/catalog.ts";
import { lineSpec } from "../../../test/harness/line-spec.ts";
import { begin, idsOf, type Run, type Scene, type Table } from "../../../test/harness/scene.ts";
import { choices, combat, fillers, passAll, play, playCode, playerTable, sendUnledgered, stat, triggers } from "../../../test/harness/player-table.ts";

const GIMLI = "16001";
const LEGOLAS = "16002";
const ARCHER = "16003";
const EREBOR = "16004";
const STORM = "16013";
// Core: Aragorn and Glóin (Leadership heroes), Éowyn (Spirit), Glorfindel (Lore), Snowbourn Scout (an ally).
const ARAGORN = "01001";
const GLOIN = "01003";
const EOWYN = "01007";
const GLORFINDEL = "01011";
const SNOWBOURN = "01016";
const WEAK = "weak";
const CARD = "card";

let base: Awaited<ReturnType<typeof starterBase>>;

const table = (effects: readonly Effect[], scene: Scene = {}, resources = 6): Table => playerTable(base, effects, scene, resources);

beforeAll(async () => {
  const starter = await starterBase();
  const codes = [GIMLI, LEGOLAS, ARCHER, EREBOR, STORM, ARAGORN, GLOIN, EOWYN, GLORFINDEL, SNOWBOURN];
  const cards = new Map([...starter.cards, ...(await loadPrinted(codes))]);
  cards.set(WEAK, definePrinted({ code: WEAK, name: "Weak", type: "enemy", threat: 3, engagementCost: 30, attack: 1, defense: 0, health: 9 }));
  base = { ...starter, cards };
});

describe("Gimli (16001:A:2)", () => {
  // Gimli, Legolas and Aragorn, both exhausted; Gimli defends the first attack of `enemies` Weak engaged with the player.
  function defended(effects: readonly Effect[], enemies = 1): { tab: Table; run: Run } {
    const scene = table(effects, { heroes: [{ code: GIMLI, seat: 0 }, { code: LEGOLAS, seat: 0 }, { code: ARAGORN, seat: 0 }], engaged: Array.from({ length: enemies }, () => ({ code: WEAK, seat: 0 })) });
    const tab = { ...scene, state: updateCard(updateCard(scene.state, idsOf(scene, LEGOLAS), { exhausted: true }), idsOf(scene, ARAGORN), { exhausted: true }) };
    const opened = passAll(combat(tab.state, tab), tab.ctx);
    const run = enemies > 1 ? passAll(sendUnledgered(opened, { type: "ChooseEnemy", enemyId: tab.ids[WEAK]?.[0] ?? "" }, tab.ctx), tab.ctx) : opened;
    expect(run.state.window?.kind).toBe("defense");
    return { tab, run: sendUnledgered(run, { type: "DeclareDefender", defenderId: idsOf(tab, GIMLI) }, tab.ctx) };
  }

  // The Response, paid with 1 resource from Gimli's pool.
  const respond = (run: Run, tab: Table): Run => sendUnledgered(run, { type: "Trigger", cardId: idsOf(tab, GIMLI), effectId: "16001:response:1", payments: [{ heroId: idsOf(tab, GIMLI), amount: 1 }] }, tab.ctx);

  // "Response: After Gimli is declared as a defender, spend 1 resource from his pool to ready another hero. If that hero is Legolas, he
  // gets +1 Attack until the end of the phase.": Gimli pays 1 of his 6; Legolas and Aragorn are offered, not Gimli; Legolas readies and
  // has Attack 3 + 1 until the combat phase ends.
  lineSpec("16001:A:2", "Gimli: after he defends, pay 1 from his pool to ready another hero; Legolas gets +1 Attack this phase", (effects) => {
    const { tab, run: declared } = defended(effects);
    const [gimli, legolas, aragorn] = [idsOf(tab, GIMLI), idsOf(tab, LEGOLAS), idsOf(tab, ARAGORN)];
    expect(triggers(declared.state, tab)).toContain("16001:response:1");
    let run = respond(declared, tab);
    expect(run.state.cards[gimli]?.resources).toBe(6 - 1);
    expect(choices(run.state, tab).sort()).toEqual([legolas, aragorn].sort());
    run = sendUnledgered(run, { type: "Choose", optionId: legolas }, tab.ctx);
    expect(run.state.cards[legolas]?.exhausted).toBe(false);
    expect(run.state.cards[aragorn]?.exhausted).toBe(true);
    expect(stat(run.state, tab, legolas, "attack")).toBe(3 + 1);
    expect(stat(withMode(run.state, "refresh"), tab, legolas, "attack")).toBe(3);
  });

  // A hero not named Legolas is readied and gets no Attack.
  it("16001:A:2 Gimli: a hero other than Legolas readies and gets no Attack", () => {
    const { tab, run: declared } = defended(EFFECTS);
    const aragorn = idsOf(tab, ARAGORN);
    const run = sendUnledgered(respond(declared, tab), { type: "Choose", optionId: aragorn }, tab.ctx);
    expect(run.state.cards[aragorn]?.exhausted).toBe(false);
    expect(stat(run.state, tab, aragorn, "attack")).toBe(3);
    expect(stat(run.state, tab, idsOf(tab, LEGOLAS), "attack")).toBe(3);
  });

  // "spend 1 resource from his pool": with an empty pool the cost cannot be paid, so the Response is not offered.
  it("16001:A:2 Gimli: not offered with no resource in his pool", () => {
    const { tab, run } = defended(EFFECTS);
    expect(triggers(updateCard(run.state, idsOf(tab, GIMLI), { resources: 0 }), tab)).not.toContain("16001:response:1");
  });

  // "After Gimli is declared as a defender": Aragorn, readied, defends instead and Gimli's Response is not offered.
  it("16001:A:2 Gimli: not offered when another hero defends", () => {
    const scene = table(EFFECTS, { heroes: [{ code: GIMLI, seat: 0 }, { code: ARAGORN, seat: 0 }], engaged: [{ code: WEAK, seat: 0 }] });
    const run = passAll(combat(scene.state, scene), scene.ctx);
    expect(run.state.window?.kind).toBe("defense");
    expect(triggers(sendUnledgered(run, { type: "DeclareDefender", defenderId: idsOf(scene, ARAGORN) }, scene.ctx).state, scene)).not.toContain("16001:response:1");
  });

  // "(Limit once per phase.)": Gimli, readied again, defends the second attack of the phase and is not offered it again.
  it("16001:A:2 Gimli: limit once per phase", () => {
    const { tab, run: declared } = defended(EFFECTS, 2);
    const gimli = idsOf(tab, GIMLI);
    let run = passAll(sendUnledgered(respond(declared, tab), { type: "Choose", optionId: idsOf(tab, LEGOLAS) }, tab.ctx), tab.ctx, { responses: true });
    run = { ...run, state: updateCard(run.state, gimli, { exhausted: false }) };
    expect(run.state.window?.kind).toBe("defense");
    run = sendUnledgered(run, { type: "DeclareDefender", defenderId: gimli }, tab.ctx);
    expect(triggers(run.state, tab)).not.toContain("16001:response:1");
  });
});

describe("Legolas (16002:A:2)", () => {
  // Legolas, Gimli and Aragorn (both exhausted), `hand` in the hand; Legolas commits to the quest.
  function committed(effects: readonly Effect[], hand: readonly string[]): { tab: Table; run: Run } {
    const scene = table(effects, { start: "quest", heroes: [{ code: LEGOLAS, seat: 0 }, { code: GIMLI, seat: 0 }, { code: ARAGORN, seat: 0 }], hand: hand.map((code) => ({ code, seat: 0 })), deck: ["f0", "f0"] });
    const tab = { ...scene, state: updateCard(updateCard(scene.state, idsOf(scene, GIMLI), { exhausted: true }), idsOf(scene, ARAGORN), { exhausted: true }) };
    return { tab, run: sendUnledgered(begin(tab.state), { type: "Commit", cardIds: [idsOf(tab, LEGOLAS)] }, tab.ctx) };
  }

  // "Response: After Legolas commits to a quest, discard a card from your hand to ready another hero. If that hero is Gimli, he gets
  // +1 Willpower until the end of the phase.": the player picks which of the two cards to discard, then Gimli or Aragorn (not Legolas);
  // Gimli readies with Willpower 2 + 1, and once the quest phase is over his Willpower is 2 again.
  lineSpec("16002:A:2", "Legolas: after he commits, discard a card to ready another hero; Gimli gets +1 Willpower this phase", (effects) => {
    const { tab, run: done } = committed(effects, [CARD, SNOWBOURN]);
    const [legolas, gimli, aragorn, card, scout] = [idsOf(tab, LEGOLAS), idsOf(tab, GIMLI), idsOf(tab, ARAGORN), idsOf(tab, CARD), idsOf(tab, SNOWBOURN)];
    expect(triggers(done.state, tab)).toContain("16002:response:1");
    let run = sendUnledgered(done, { type: "Trigger", cardId: legolas, effectId: "16002:response:1" }, tab.ctx);
    expect(choices(run.state, tab).sort()).toEqual([card, scout].sort());
    run = sendUnledgered(run, { type: "Choose", optionId: scout }, tab.ctx);
    expect(choices(run.state, tab).sort()).toEqual([gimli, aragorn].sort());
    run = sendUnledgered(run, { type: "Choose", optionId: gimli }, tab.ctx);
    expect(run.state.cards[scout]?.zone).toBe("discard");
    expect(run.state.cards[card]?.zone).toBe("hand");
    expect(run.state.cards[gimli]?.exhausted).toBe(false);
    expect(stat(run.state, tab, gimli, "willpower")).toBe(2 + 1);
    expect(stat(withMode(run.state, "travel"), tab, gimli, "willpower")).toBe(2);
  });

  // A hero not named Gimli readies with no Willpower.
  it("16002:A:2 Legolas: a hero other than Gimli readies and gets no Willpower", () => {
    const { tab, run: done } = committed(EFFECTS, [CARD]);
    const aragorn = idsOf(tab, ARAGORN);
    const run = sendUnledgered(sendUnledgered(done, { type: "Trigger", cardId: idsOf(tab, LEGOLAS), effectId: "16002:response:1" }, tab.ctx), { type: "Choose", optionId: aragorn }, tab.ctx);
    expect(run.state.seats[0]?.hand).toEqual([]);
    expect(run.state.cards[aragorn]?.exhausted).toBe(false);
    expect(stat(run.state, tab, aragorn, "willpower")).toBe(2);
    expect(stat(run.state, tab, idsOf(tab, GIMLI), "willpower")).toBe(2);
  });

  // "discard a card from your hand": with an empty hand the cost cannot be paid.
  it("16002:A:2 Legolas: not offered with an empty hand", () => {
    const { tab, run } = committed(EFFECTS, []);
    expect(triggers(run.state, tab)).not.toContain("16002:response:1");
  });

  // "After Legolas commits": another hero committing does not trigger it.
  it("16002:A:2 Legolas: not offered when only another character commits", () => {
    const scene = table(EFFECTS, { start: "quest", heroes: [{ code: LEGOLAS, seat: 0 }, { code: ARAGORN, seat: 0 }], hand: [{ code: CARD, seat: 0 }], deck: ["f0", "f0"] });
    const run = sendUnledgered(begin(scene.state), { type: "Commit", cardIds: [idsOf(scene, ARAGORN)] }, scene.ctx);
    expect(triggers(run.state, scene)).not.toContain("16002:response:1");
  });
});

describe("Greenwood Archer (16003:A:2)", () => {
  // Glóin (Leadership) pays 2 for the Archer; Glóin and Aragorn are `exhausted`.
  const archer = (effects: readonly Effect[], exhausted: boolean): Table => {
    const scene = table(effects, { heroes: [{ code: GLOIN, seat: 0 }, { code: ARAGORN, seat: 0 }], hand: [{ code: ARCHER, seat: 0 }] });
    return { ...scene, state: updateCard(updateCard(scene.state, idsOf(scene, GLOIN), { exhausted }), idsOf(scene, ARAGORN), { exhausted }) };
  };

  // "Response: After Greenwood Archer enters play, ready a hero.": either hero is offered (not the Archer, an ally); Aragorn readies,
  // Glóin stays exhausted.
  lineSpec("16003:A:2", "Greenwood Archer: after it enters play, ready a hero", (effects) => {
    const tab = archer(effects, true);
    const [gloin, aragorn] = [idsOf(tab, GLOIN), idsOf(tab, ARAGORN)];
    let run = playCode(tab, ARCHER);
    expect(triggers(run.state, tab)).toContain("16003:response:1");
    run = sendUnledgered(run, { type: "Trigger", cardId: idsOf(tab, ARCHER), effectId: "16003:response:1" }, tab.ctx);
    expect(choices(run.state, tab).sort()).toEqual([gloin, aragorn].sort());
    run = sendUnledgered(run, { type: "Choose", optionId: aragorn }, tab.ctx);
    expect(run.state.cards[aragorn]?.exhausted).toBe(false);
    expect(run.state.cards[gloin]?.exhausted).toBe(true);
  });

  // Every hero ready: the Response can ready nothing, so it is not offered (rr.triggered-ability).
  it("16003:A:2 Greenwood Archer: not offered while every hero is ready", () => {
    const tab = archer(EFFECTS, false);
    expect(triggers(playCode(tab, ARCHER).state, tab)).not.toContain("16003:response:1");
  });
});

describe("Erebor Guard (16004:A:2)", () => {
  // Éowyn (Spirit) holds 2 resources; the deck holds `deck` cards.
  const guard = (effects: readonly Effect[], deck: number): Table => table(effects, { heroes: [{ code: EOWYN, seat: 0 }], hand: [{ code: EREBOR, seat: 0 }], playerDeck: fillers(CARD, deck) }, 2);

  // "Response: When you play Erebor Guard from your hand, discard the top 2 cards of your deck to reduce its cost by 2.": the Guard (cost
  // 4) is played for 2, and the top 2 of the 3 cards of the deck are discarded.
  lineSpec("16004:A:2", "Erebor Guard: discard the top 2 cards of the deck to pay 2 less", (effects) => {
    const tab = guard(effects, 3);
    const [eowyn, card] = [idsOf(tab, EOWYN), idsOf(tab, EREBOR)];
    const top = tab.state.seats[0]?.deck.slice(0, 2) ?? [];
    const run = sendUnledgered(begin(tab.state), { type: "PlayCard", cardId: card, payments: [{ heroId: eowyn, amount: 2 }] }, tab.ctx);
    expect(run.state.cards[card]?.zone).toBe("play");
    expect(run.state.cards[eowyn]?.resources).toBe(0);
    for (const id of top) expect(run.state.cards[id]?.zone).toBe("discard");
    expect(run.state.seats[0]?.deck).toHaveLength(1);
  });

  // With 1 card in the deck the top 2 cannot be discarded: the cost cannot be paid, so the Guard cannot be played for 2.
  it("16004:A:2 Erebor Guard: not played for 2 with 1 card in the deck", () => {
    const tab = guard(EFFECTS, 1);
    const intent = { type: "PlayCard" as const, cardId: idsOf(tab, EREBOR), payments: [{ heroId: idsOf(tab, EOWYN), amount: 2 }] };
    expect(refusal(tab.state, intent, tab.ctx)).not.toBeNull();
  });

  // Paid in full, the deck is not touched.
  it("16004:A:2 Erebor Guard: paid in full, nothing is discarded", () => {
    const tab = table(EFFECTS, { heroes: [{ code: EOWYN, seat: 0 }], hand: [{ code: EREBOR, seat: 0 }], playerDeck: fillers(CARD, 3) }, 4);
    const run = sendUnledgered(begin(tab.state), { type: "PlayCard", cardId: idsOf(tab, EREBOR), payments: [{ heroId: idsOf(tab, EOWYN), amount: 4 }] }, tab.ctx);
    expect(run.state.cards[idsOf(tab, EREBOR)]?.zone).toBe("play");
    expect(run.state.seats[0]?.deck).toHaveLength(3);
    expect(run.state.seats[0]?.discard).toEqual([]);
  });
});

describe("The Storm Comes (16013:A:1)", () => {
  // The player plays The Storm Comes (5 quest points) into the staging area, makes it the current quest, and Éowyn and Glorfindel
  // (Willpower 4 + 3) quest on it, so it is defeated. `shown` copies are in the victory display already.
  function defeated(effects: readonly Effect[], shown: number): { run: Run; storm: string; others: string[] } {
    const tab = table(effects, { heroes: [{ code: EOWYN, seat: 0 }, { code: GLORFINDEL, seat: 0 }], hand: [{ code: STORM, seat: 0 }], victory: Array.from({ length: shown }, () => STORM), deck: ["f0", "f0"] });
    const storm = tab.ids[STORM]?.find((id) => tab.state.cards[id]?.zone === "hand") ?? "";
    let run = play(begin(tab.state), tab, storm);
    expect(run.state.cards[storm]?.zone).toBe("staging");
    run = passAll(sendUnledgered(run, { type: "Pass" }, tab.ctx), tab.ctx);
    expect(choices(run.state, tab)).toContain(storm);
    run = sendUnledgered(run, { type: "Choose", optionId: storm }, tab.ctx);
    run = sendUnledgered(run, { type: "Commit", cardIds: [idsOf(tab, EOWYN), idsOf(tab, GLORFINDEL)] }, tab.ctx);
    run = passAll(sendUnledgered(run, { type: "Pass" }, tab.ctx), tab.ctx, { responses: true });
    expect(run.state.mode).toBe("travel");
    return { run, storm, others: (tab.ids[STORM] ?? []).filter((id) => id !== storm) };
  }

  // "Limit 1 copy of The Storm Comes in the victory display.": with one copy there already, the second one defeated goes to its owner's
  // discard pile; with none there, it is added to the victory display.
  lineSpec("16013:A:1", "The Storm Comes: a second copy defeated goes to the discard pile, not the victory display", (effects) => {
    const second = defeated(effects, 1);
    expect(second.run.state.cards[second.storm]?.zone).toBe("discard");
    expect(second.run.state.seats[0]?.discard).toEqual([second.storm]);
    expect(second.run.state.victory).toEqual(second.others);
    const first = defeated(effects, 0);
    expect(first.run.state.victory).toEqual([first.storm]);
  });
});
