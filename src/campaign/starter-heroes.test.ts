// Rules: rr.response, rr.limits, rr.action, rr.initiating-abilities-playing-cards, rr.resource-match (data/rules/entries.json).
// Phase 9 batch 5: the hero and attachment lines of the starter decks that the earlier batches did not cover.
import { beforeAll, describe, expect, it } from "vitest";

import { syncConstants } from "../rules/interpret/constants.ts";
import { modifiedStat } from "../rules/core/keywords.ts";
import { legalIntents } from "../rules/engine/reduce.ts";
import { updateCard, withMode } from "../rules/core/state.ts";
import { definePrinted } from "../rules/core/printed.ts";
import { spawn } from "../rules/core/zones.ts";
import { CHEAP, DEAR, fund, refusal, starterBase } from "../../scripts/starter-scene.ts";
import { begin, buildTable, idsOf, send, type Run, type Scene, type Table } from "../../scripts/test-scene.ts";

const SAM = "141002";
const MERRY = "141003";
const PIPPIN = "141004";
const THEODRED = "01002";
const EOWYN = "01007";
const GANDALF_HERO = "142002";
const BOROMIR = "142004";
const AXEHAND = "01028";
const STAFF = "142008";
const PIPE = "142009";
const FLAME = "142007";
const WEAK = "weak";

let base: Awaited<ReturnType<typeof starterBase>>;

beforeAll(async () => {
  base = await starterBase();
  base.cards.set(WEAK, definePrinted({ code: WEAK, name: "Weak", type: "enemy", threat: 1, engagementCost: 2, attack: 1, defense: 0, health: 1 }));
});

function table(scene: Scene = {}, resources = 6): Table {
  const tab = buildTable(base, { ring: "none", start: "planning", ...scene });
  let state = tab.state;
  for (let seat = 0; seat < (scene.seats ?? 1); seat += 1) state = fund(state, seat, resources);
  return { ...tab, state };
}

function choices(run: Run, tab: Table): string[] {
  return legalIntents(run.state, tab.ctx).flatMap((intent) => (intent.type === "Choose" ? [intent.optionId] : []));
}

const exhaust = (tab: Table, ...ids: string[]): Table => ({ ...tab, state: ids.reduce((state, id) => updateCard(state, id, { exhausted: true }), tab.state) });

describe("Théodred (01002:A:1)", () => {
  it("after he commits to a quest, a hero committed to it gets 1 resource", () => {
    const tab = table({ start: "quest", heroes: [{ code: THEODRED, seat: 0 }, { code: SAM, seat: 0 }] }, 0);
    const theodred = idsOf(tab, THEODRED);
    const sam = idsOf(tab, SAM);
    let run = send(begin(tab.state), { type: "Commit", cardIds: [theodred, sam] }, tab.ctx);
    expect(run.state.window).toEqual({ kind: "response", seat: 0 });
    run = send(run, { type: "Trigger", cardId: theodred, effectId: "01002:response:1" }, tab.ctx);
    expect(choices(run, tab).sort()).toEqual([theodred, sam].sort());
    run = send(run, { type: "Choose", optionId: sam }, tab.ctx);
    expect(run.state.cards[sam]?.resources).toBe(1);
    expect(run.state.cards[theodred]?.resources).toBe(0);
    expect(run.state.window).toEqual({ kind: "pass" });
  });

  it("is not offered when he stays home", () => {
    const tab = table({ start: "quest", heroes: [{ code: THEODRED, seat: 0 }, { code: SAM, seat: 0 }] }, 0);
    const run = send(begin(tab.state), { type: "Commit", cardIds: [idsOf(tab, SAM)] }, tab.ctx);
    expect(run.state.window).toEqual({ kind: "pass" });
  });
});

describe("Éowyn (01007:A:1)", () => {
  it("discards a card from the hand for +1 Willpower until the end of the phase; each player may do it once a round", () => {
    const tab = table({ seats: 2, heroes: [{ code: EOWYN, seat: 0 }, { code: MERRY, seat: 1 }], hand: [{ code: AXEHAND, seat: 0 }, { code: AXEHAND, seat: 0 }, { code: BOROMIR, seat: 1 }, { code: BOROMIR, seat: 1 }] });
    const eowyn = idsOf(tab, EOWYN);
    const effect = { type: "Trigger" as const, cardId: eowyn, effectId: "01007:action:1" };
    const printed = tab.ctx.cards.get(EOWYN)?.willpower ?? 0;
    let run = send(begin(tab.state), effect, tab.ctx);
    expect(run.state.cards[idsOf(tab, AXEHAND)]?.zone).toBe("discard");
    expect(modifiedStat(run.state, run.state.cards[eowyn] ?? ({} as never), "willpower", tab.ctx.cards)).toBe(printed + 1);
    expect(refusal(run.state, effect, tab.ctx)).toBe("That effect has already been used");
    // The other player triggers it too, from their own hand.
    run = send(run, { type: "Pass" }, tab.ctx);
    expect(run.state.activeSeat).toBe(1);
    run = send(run, effect, tab.ctx);
    expect(run.state.cards[idsOf(tab, BOROMIR)]?.zone).toBe("discard");
    expect(modifiedStat(run.state, run.state.cards[eowyn] ?? ({} as never), "willpower", tab.ctx.cards)).toBe(printed + 2);
    expect(refusal(run.state, effect, tab.ctx)).toBe("That effect has already been used");
  });

  it("needs a card in hand", () => {
    const tab = table({ heroes: [{ code: EOWYN, seat: 0 }] });
    expect(refusal(tab.state, { type: "Trigger", cardId: idsOf(tab, EOWYN), effectId: "01007:action:1" }, tab.ctx)).toBe("That effect cannot be triggered");
  });
});

describe("Sam Gamgee (141002:A:1) and Pippin (141004:A:2)", () => {
  const scene = (): Table => table({ start: "encounter", heroes: [{ code: SAM, seat: 0 }, { code: PIPPIN, seat: 0 }], staging: [DEAR, CHEAP], playerDeck: [{ code: AXEHAND, seat: 0 }, { code: AXEHAND, seat: 0 }] });

  it("engaging an enemy that costs more than your threat readies Sam with +1 Willpower, Attack and Defense, and draws for Pippin", () => {
    const tab = scene();
    const sam = idsOf(tab, SAM);
    const marked = exhaust(tab, sam);
    let run = send(begin(marked.state), { type: "Engage", enemyId: idsOf(tab, DEAR) }, tab.ctx);
    expect(run.state.window).toEqual({ kind: "response", seat: 0 });
    const offered = legalIntents(run.state, tab.ctx).flatMap((intent) => (intent.type === "Trigger" ? [intent.effectId] : []));
    expect(offered.sort()).toEqual(["141002:response:1", "141004:response:1"]);
    run = send(run, { type: "Trigger", cardId: sam, effectId: "141002:response:1" }, tab.ctx);
    expect(run.state.cards[sam]?.exhausted).toBe(false);
    const plain = syncConstants(tab.state, tab.ctx);
    for (const stat of ["willpower", "attack", "defense"] as const) {
      expect(modifiedStat(run.state, run.state.cards[sam] ?? ({} as never), stat, tab.ctx.cards), stat).toBe(modifiedStat(plain, plain.cards[sam] ?? ({} as never), stat, tab.ctx.cards) + 1);
    }
    run = send(run, { type: "Trigger", cardId: idsOf(tab, PIPPIN), effectId: "141004:response:1" }, tab.ctx);
    expect(run.state.seats[0]?.hand).toHaveLength(1);
  });

  it("is not offered for an enemy whose engagement cost is no higher than your threat", () => {
    const tab = scene();
    const run = send(begin(tab.state), { type: "Engage", enemyId: idsOf(tab, CHEAP) }, tab.ctx);
    expect(run.state.window?.kind).not.toBe("response");
  });

  it("is not offered to a player who did not engage", () => {
    const tab = table({ start: "encounter", seats: 2, heroes: [{ code: SAM, seat: 0 }, { code: PIPPIN, seat: 1 }], staging: [DEAR] });
    const run = send(begin(tab.state), { type: "Engage", enemyId: idsOf(tab, DEAR) }, tab.ctx);
    // Seat 0 engaged: Sam hears it, Pippin (seat 1) does not.
    const offered = legalIntents(run.state, tab.ctx).flatMap((intent) => (intent.type === "Trigger" ? [intent.effectId] : []));
    expect(offered).toEqual(["141002:response:1"]);
  });
});

describe("Merry (141003:A:2)", () => {
  it("after an attack he is in destroys an enemy, another character that attacked is readied", () => {
    const tab = table({ heroes: [{ code: MERRY, seat: 0 }], allies: [{ code: BOROMIR, seat: 0 }], engaged: [{ code: WEAK, seat: 0 }] });
    const merry = idsOf(tab, MERRY);
    const boromir = idsOf(tab, BOROMIR);
    const combat = { ...withMode(tab.state, "playerAttacks"), window: { kind: "playerAttack" as const }, activeSeat: 0 };
    let run = send(begin(combat), { type: "DeclareAttackers", enemyId: idsOf(tab, WEAK), attackerIds: [merry, boromir] }, tab.ctx);
    expect(run.state.cards[idsOf(tab, WEAK)]?.zone).not.toBe("engaged");
    expect(run.state.cards[boromir]?.exhausted).toBe(true);
    expect(run.state.window).toEqual({ kind: "response", seat: 0 });
    run = send(run, { type: "Trigger", cardId: merry, effectId: "141003:response:1" }, tab.ctx);
    expect(run.state.cards[boromir]?.exhausted).toBe(false);
    expect(run.state.cards[merry]?.exhausted).toBe(true);
    // The next attack is asked for again.
    expect(run.state.window).toEqual({ kind: "playerAttack" });
  });

  it("is not offered when the enemy survives", () => {
    const tab = table({ heroes: [{ code: MERRY, seat: 0 }], engaged: [{ code: CHEAP, seat: 0 }] });
    const combat = { ...withMode(tab.state, "playerAttacks"), window: { kind: "playerAttack" as const }, activeSeat: 0 };
    const run = send(begin(combat), { type: "DeclareAttackers", enemyId: idsOf(tab, CHEAP), attackerIds: [idsOf(tab, MERRY)] }, tab.ctx);
    expect(run.state.window?.kind).not.toBe("response");
  });
});

describe("Gandalf, the hero (142002:A:1)", () => {
  const scene = (extra: Scene = {}): Table =>
    table({ heroes: [{ code: GANDALF_HERO, seat: 0 }, { code: SAM, seat: 0 }], playerDeck: [{ code: BOROMIR, seat: 0 }, { code: AXEHAND, seat: 0 }, { code: AXEHAND, seat: 0 }], ...extra });

  it("plays the top card of the deck once per phase, paying with his icons", () => {
    const tab = scene();
    const gandalf = idsOf(tab, GANDALF_HERO);
    const [top, second] = tab.state.seats[0]?.deck ?? [];
    const intent = { type: "PlayCard" as const, cardId: top ?? "", payments: [{ heroId: gandalf, amount: 4 }] };
    expect(legalIntents(tab.state, tab.ctx)).toContainEqual({ type: "PlayCard", cardId: top });
    expect(legalIntents(tab.state, tab.ctx)).not.toContainEqual({ type: "PlayCard", cardId: second });
    // Boromir is a Tactics ally; Sam is Leadership and cannot pay for it, Gandalf can.
    expect(refusal(tab.state, { ...intent, payments: [{ heroId: idsOf(tab, SAM), amount: 4 }] }, tab.ctx)).toBe("Wrong sphere");
    const run = send(begin(tab.state), intent, tab.ctx);
    expect(run.state.cards[top ?? ""]?.zone).toBe("play");
    expect(run.state.cards[gandalf]?.resources).toBe(2);
    // The next card is not offered again this phase.
    const next = run.state.seats[0]?.deck[0] ?? "";
    expect(legalIntents(run.state, tab.ctx)).not.toContainEqual({ type: "PlayCard", cardId: next });
    expect(refusal(run.state, { type: "PlayCard", cardId: next, payments: [] }, tab.ctx)).toBe("That card is not in hand");
  });

  it("the permission is back in the next phase", () => {
    const tab = scene();
    const gandalf = idsOf(tab, GANDALF_HERO);
    let run = send(begin(tab.state), { type: "PlayCard", cardId: tab.state.seats[0]?.deck[0] ?? "", payments: [{ heroId: gandalf, amount: 4 }] }, tab.ctx);
    run = send(run, { type: "Pass" }, tab.ctx);
    expect(run.state.mode).toBe("questCommit");
    // The next phase's pass window is not the planning window, so allies wait; an event could be played now.
    const planning = { ...withMode(run.state, "planning"), window: { kind: "pass" as const }, activeSeat: 0 };
    const next = planning.seats[0]?.deck[0] ?? "";
    expect(legalIntents(planning, tab.ctx)).not.toContainEqual({ type: "PlayCard", cardId: next });
    const later = { ...planning, round: planning.round + 1 };
    expect(legalIntents(later, tab.ctx)).toContainEqual({ type: "PlayCard", cardId: next });
  });
});

describe("Flame of Anor (142007:A:1)", () => {
  it("goes to the victory display, discards the top card, readies an Istari character, and gives +X Attack, X the discarded cost", () => {
    const tab = table({ heroes: [{ code: GANDALF_HERO, seat: 0 }, { code: SAM, seat: 0 }], hand: [{ code: FLAME, seat: 0 }], playerDeck: [{ code: BOROMIR, seat: 0 }, { code: AXEHAND, seat: 0 }] });
    const gandalf = idsOf(tab, GANDALF_HERO);
    const marked = exhaust(tab, gandalf);
    const flame = idsOf(tab, FLAME);
    const run = send(begin(marked.state), { type: "PlayCard", cardId: flame, payments: [{ heroId: gandalf, amount: 1 }] }, tab.ctx);
    expect(run.state.cards[flame]?.zone).toBe("victory");
    expect(run.state.cards[idsOf(tab, BOROMIR)]?.zone).toBe("discard");
    expect(run.state.cards[gandalf]?.exhausted).toBe(false);
    expect(modifiedStat(run.state, run.state.cards[gandalf] ?? ({} as never), "attack", tab.ctx.cards)).toBe((tab.ctx.cards.get(GANDALF_HERO)?.attack ?? 0) + (tab.ctx.cards.get(BOROMIR)?.cost ?? 0));
  });

  it("needs an Istari character you control", () => {
    const tab = table({ heroes: [{ code: SAM, seat: 0 }], hand: [{ code: FLAME, seat: 0 }], playerDeck: [{ code: BOROMIR, seat: 0 }] });
    expect(refusal(tab.state, { type: "PlayCard", cardId: idsOf(tab, FLAME), payments: [{ heroId: idsOf(tab, SAM), amount: 1 }] }, tab.ctx)).toBe("That card has no legal target");
  });
});

describe("Gandalf's Staff (142008:A:2)", () => {
  const scene = (): Table => table({ heroes: [{ code: GANDALF_HERO, seat: 0 }, { code: SAM, seat: 0 }], attached: [{ code: STAFF, host: GANDALF_HERO }], playerDeck: [{ code: AXEHAND, seat: 0 }, { code: AXEHAND, seat: 0 }] }, 0);
  const use = (tab: Table): Run => send(begin(tab.state), { type: "Trigger", cardId: idsOf(tab, STAFF), effectId: "142008:action:1" }, tab.ctx);

  it("offers a card, a resource, and (only when an unique-free enemy holds a shadow card) a shadow discard", () => {
    const tab = scene();
    const run = use(tab);
    expect(run.state.cards[idsOf(tab, STAFF)]?.exhausted).toBe(true);
    expect(choices(run, tab).sort()).toEqual(["draw", "resource"]);
  });

  it("draws a card for the chosen player", () => {
    const tab = scene();
    let run = use(tab);
    run = send(run, { type: "Choose", optionId: "draw" }, tab.ctx);
    expect(run.state.seats[0]?.hand).toHaveLength(1);
  });

  it("adds a resource to a chosen hero's pool", () => {
    const tab = scene();
    let run = use(tab);
    run = send(run, { type: "Choose", optionId: "resource" }, tab.ctx);
    run = send(run, { type: "Choose", optionId: idsOf(tab, SAM) }, tab.ctx);
    expect(run.state.cards[idsOf(tab, SAM)]?.resources).toBe(1);
  });

  it("discards the shadow card of a non-unique enemy", () => {
    let tab = scene();
    const enemy = idsOf(tab, CHEAP) || undefined;
    expect(enemy).toBeUndefined();
    const spawned = spawn(tab.state, CHEAP, { zone: "engaged", seat: 0 });
    const shadow = spawn(spawned.state, "f0", { zone: "shadow", enemyId: spawned.id });
    tab = { ...tab, state: updateCard(shadow.state, spawned.id, { shadowId: shadow.id }) };
    let run = send(begin(tab.state), { type: "Trigger", cardId: idsOf(tab, STAFF), effectId: "142008:action:1" }, tab.ctx);
    expect(choices(run, tab).sort()).toEqual(["draw", "resource", "shadow"]);
    run = send(run, { type: "Choose", optionId: "shadow" }, tab.ctx);
    expect(run.state.cards[shadow.id]?.zone).toBe("encounterDiscard");
    expect(run.state.cards[spawned.id]?.shadowId).toBeNull();
  });
});

describe("Wizard Pipe (142009:A:2)", () => {
  it("exchanges a card in the hand with the top card of the deck", () => {
    const tab = table({ heroes: [{ code: GANDALF_HERO, seat: 0 }], attached: [{ code: PIPE, host: GANDALF_HERO }], hand: [{ code: AXEHAND, seat: 0 }], playerDeck: [{ code: BOROMIR, seat: 0 }, { code: "01014", seat: 0 }] }, 0);
    const run = send(begin(tab.state), { type: "Trigger", cardId: idsOf(tab, PIPE), effectId: "142009:action:1" }, tab.ctx);
    expect(run.state.cards[idsOf(tab, BOROMIR)]?.zone).toBe("hand");
    expect(run.state.cards[idsOf(tab, AXEHAND)]?.zone).toBe("deck");
    expect(run.state.seats[0]?.deck[0]).toBe(idsOf(tab, AXEHAND));
    expect(run.state.cards[idsOf(tab, PIPE)]?.exhausted).toBe(true);
  });

  it("needs a card in hand", () => {
    const tab = table({ heroes: [{ code: GANDALF_HERO, seat: 0 }], attached: [{ code: PIPE, host: GANDALF_HERO }], playerDeck: [{ code: BOROMIR, seat: 0 }] }, 0);
    expect(refusal(tab.state, { type: "Trigger", cardId: idsOf(tab, PIPE), effectId: "142009:action:1" }, tab.ctx)).toBe("That effect cannot be triggered");
  });
});
