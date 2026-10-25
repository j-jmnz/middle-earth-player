// Rules: rr.cancel, rr.response, rr.in-play-and-out-of-play, rr.restricted (data/rules/entries.json).
// Phase 9 batch 3: cancels, looking at the encounter deck, and searching a deck, played through the reducer.
import { beforeAll, describe, expect, it } from "vitest";

import { settle } from "../rules/machine.ts";
import { legalIntents } from "../rules/reduce.ts";
import { withMode } from "../rules/state.ts";
import { fund, payFor, starterBase } from "../../scripts/starter-scene.ts";
import { begin, buildTable, idsOf, send, type Run, type Scene, type Table } from "../../scripts/test-scene.ts";

const SAM = "141002";
const MERRY = "141003";
const EOWYN = "01007";
const RIDER = "141039";
const LURE = "141076";
const CROW = "141036";
const AXEHAND = "01028";
const BOROMIR = "142004";
const DAGGER = "141014";
const CLOAK = "141013";
const STEWARD = "01026";
const PIPE = "142009";

let base: Awaited<ReturnType<typeof starterBase>>;

beforeAll(async () => {
  base = await starterBase();
});

function table(scene: Scene = {}, resources = 6): Table {
  const tab = buildTable(base, { ring: "none", ...scene });
  let state = tab.state;
  for (let seat = 0; seat < (scene.seats ?? 1); seat += 1) state = fund(state, seat, resources);
  return { ...tab, state };
}

function choices(run: Run, tab: Table): string[] {
  return legalIntents(run.state, tab.ctx).flatMap((intent) => (intent.type === "Choose" ? [intent.optionId] : []));
}

describe("Response-only events", () => {
  it("are never offered as ordinary plays", () => {
    const tab = table({ heroes: [{ code: EOWYN, seat: 0 }], deck: ["f0"], hand: [{ code: "01050", seat: 0 }, { code: "01048", seat: 0 }] });
    const run = begin(tab.state);
    const played = legalIntents(run.state, tab.ctx).filter((intent) => intent.type === "PlayCard");
    expect(played.map((intent) => intent.cardId)).not.toContain(idsOf(tab, "01050"));
    expect(played.map((intent) => intent.cardId)).not.toContain(idsOf(tab, "01048"));
  });
});

describe("A Test of Will (01050:A:1)", () => {
  // The first encounter card is Lure of the Ring: "When Revealed: The first player must either exhaust The One Ring or raise
  // his threat by 3." With no Ring in play the choice is the threat.
  const scene = (): Table => table({ heroes: [{ code: EOWYN, seat: 0 }], deck: [LURE, "f0", "f0"], hand: [{ code: "01050", seat: 0 }] });

  it("cancels the when revealed effects of the card just revealed", () => {
    const tab = scene();
    let run = send(begin(tab.state), { type: "Pass" }, tab.ctx);
    expect(run.state.window).toEqual({ kind: "response", seat: 0 });
    const event = idsOf(tab, "01050");
    expect(legalIntents(run.state, tab.ctx)).toContainEqual({ type: "Trigger", cardId: event, effectId: "01050:response:1" });
    run = send(run, { type: "Trigger", cardId: event, effectId: "01050:response:1", payments: payFor(run.state, tab.ctx, event) }, tab.ctx);
    // The card was still revealed, but its effect never asked the first player anything. The treachery is then
    // discarded (rr.treachery-cards).
    expect(run.state.cards[idsOf(tab, LURE)]?.zone).toBe("encounterDiscard");
    expect(run.state.cards[event]?.zone).toBe("discard");
    expect(run.state.window?.kind).not.toBe("choose");
    expect(run.steps.some((step) => step.kind === "threat")).toBe(false);
  });

  it("lets the effect resolve when the response is passed", () => {
    const tab = scene();
    let run = send(begin(tab.state), { type: "Pass" }, tab.ctx);
    run = send(run, { type: "Pass" }, tab.ctx);
    expect(run.state.cards[idsOf(tab, "01050")]?.zone).toBe("hand");
    // The effect resolved: the only legal choice, raising threat, is made without asking.
    expect(run.steps.some((step) => step.kind === "threat" && step.amount === 3)).toBe(true);
  });

  it("is not offered against The Ring Draws Them while The One Ring is exhausted (141079:A:2)", () => {
    for (const ring of ["ready", "exhausted"] as const) {
      const tab = table({ ring, heroes: [{ code: EOWYN, seat: 0 }], deck: ["141079", "f0", "f0", "f0"], hand: [{ code: "01050", seat: 0 }] });
      const run = send(begin(tab.state), { type: "Pass" }, tab.ctx);
      const offered = legalIntents(run.state, tab.ctx).some((intent) => intent.type === "Trigger" && intent.effectId === "01050:response:1");
      expect(offered).toBe(ring === "ready");
    }
  });

  it("is not offered when the card has no when revealed effect", () => {
    const tab = table({ heroes: [{ code: EOWYN, seat: 0 }], deck: ["f0"], hand: [{ code: "01050", seat: 0 }] });
    const run = send(begin(tab.state), { type: "Pass" }, tab.ctx);
    expect(run.state.window?.kind).not.toBe("response");
  });
});

describe("A Test of Will on top of Gandalf's deck (142002:A:1)", () => {
  it("is offered as if it were in the hand, paid with Gandalf's icons, and spends his permission for the phase", () => {
    const tab = table({ heroes: [{ code: "142002", seat: 0 }], deck: [LURE, "f0", "f0"], playerDeck: [{ code: "01050", seat: 0 }, { code: AXEHAND, seat: 0 }] });
    const event = idsOf(tab, "01050");
    const gandalf = idsOf(tab, "142002");
    let run = send(begin(tab.state), { type: "Pass" }, tab.ctx);
    expect(run.state.window).toEqual({ kind: "response", seat: 0 });
    expect(legalIntents(run.state, tab.ctx)).toContainEqual({ type: "Trigger", cardId: event, effectId: "01050:response:1" });
    run = send(run, { type: "Trigger", cardId: event, effectId: "01050:response:1", payments: [{ heroId: gandalf, amount: 1 }] }, tab.ctx);
    expect(run.state.cards[event]?.zone).toBe("discard");
    expect(run.steps.some((step) => step.kind === "threat")).toBe(false);
    expect(run.state.uses.some((use) => use.sourceId === gandalf && use.phase === "Quest")).toBe(true);
  });
});

describe("Hasty Stroke (01048:A:1)", () => {
  // A Black Rider engaged with seat 0 and Green Hill Country (Shadow: +1 Attack) dealt to it as a shadow card. Eowyn pays, Sam defends.
  const scene = (): Table => table({ heroes: [{ code: SAM, seat: 0 }, { code: EOWYN, seat: 0 }], engaged: [{ code: RIDER, seat: 0 }], deck: [CROW], hand: [{ code: "01048", seat: 0 }] });
  const defended = (tab: Table): Run => {
    const combat = settle({ ...withMode(tab.state, "combatStart"), window: null }, tab.ctx, []);
    expect(combat.window?.kind).toBe("defense");
    return send(begin(combat), { type: "DeclareDefender", defenderId: idsOf(tab, SAM) }, tab.ctx);
  };
  const damage = (run: Run, tab: Table): number => run.steps.flatMap((step) => (step.kind === "damage" && step.targetId === idsOf(tab, SAM) ? [step.amount] : []))[0] ?? 0;

  it("cancels the shadow effect just triggered, so the attack is only the enemy's own strength", () => {
    const tab = scene();
    let run = defended(tab);
    expect(run.state.window).toEqual({ kind: "response", seat: 0 });
    const event = idsOf(tab, "01048");
    run = send(run, { type: "Trigger", cardId: event, effectId: "01048:response:1", payments: payFor(run.state, tab.ctx, event) }, tab.ctx);
    const plain = (tab.ctx.cards.get(RIDER)?.attack ?? 0) - (tab.ctx.cards.get(SAM)?.defense ?? 0);
    expect(damage(run, tab)).toBe(plain);
    expect(run.state.cards[event]?.zone).toBe("discard");
    expect(run.state.pendingAttack).toBeNull();
  });

  it("lets the shadow effect resolve when the response is passed", () => {
    const tab = scene();
    let run = defended(tab);
    run = send(run, { type: "Pass" }, tab.ctx);
    const plain = (tab.ctx.cards.get(RIDER)?.attack ?? 0) - (tab.ctx.cards.get(SAM)?.defense ?? 0);
    expect(damage(run, tab)).toBeGreaterThan(plain);
    expect(run.state.cards[idsOf(tab, "01048")]?.zone).toBe("hand");
  });

  it("is not offered against a shadow card with no shadow effect", () => {
    const tab = table({ heroes: [{ code: SAM, seat: 0 }, { code: EOWYN, seat: 0 }], engaged: [{ code: RIDER, seat: 0 }], deck: ["f0"], hand: [{ code: "01048", seat: 0 }] });
    const combat = settle({ ...withMode(tab.state, "combatStart"), window: null }, tab.ctx, []);
    const run = send(begin(combat), { type: "DeclareDefender", defenderId: idsOf(tab, SAM) }, tab.ctx);
    expect(run.state.window?.kind).not.toBe("response");
  });
});

describe("Henamarth Riversong (01060:A:1)", () => {
  it("shows the top card of the encounter deck and changes nothing", () => {
    const tab = table({ start: "planning", heroes: [{ code: SAM, seat: 0 }], allies: [{ code: "01060", seat: 0 }], deck: [LURE, "f0"] });
    const top = idsOf(tab, LURE);
    let run = send(begin(tab.state), { type: "Trigger", cardId: idsOf(tab, "01060"), effectId: "01060:action:1" }, tab.ctx);
    expect(run.state.window).toEqual({ kind: "look", seat: 0, cardIds: [top] });
    expect(legalIntents(run.state, tab.ctx)).toEqual([{ type: "Pass" }]);
    expect(run.state.cards[idsOf(tab, "01060")]?.exhausted).toBe(true);
    run = send(run, { type: "Pass" }, tab.ctx);
    expect(run.state.window).toEqual({ kind: "pass" });
    expect(run.state.encounterDeck[0]).toBe(top);
  });
});

describe("Galadriel (142003:A:2)", () => {
  it("searches the top 5 cards for an attachment of cost 3 or less, puts it into play, and the rest back in an order the player chooses", () => {
    const deck = [AXEHAND, DAGGER, BOROMIR, CLOAK, STEWARD, AXEHAND, AXEHAND];
    const tab = table({
      start: "planning",
      heroes: [{ code: SAM, seat: 0 }, { code: MERRY, seat: 0 }],
      hand: [{ code: "142003", seat: 0 }],
      playerDeck: deck.map((code) => ({ code, seat: 0 })),
    });
    const names = (run: Run) => run.state.seats[0]?.deck.slice(0, 7).map((id) => run.state.cards[id]?.code);
    let run = send(begin(tab.state), { type: "PlayCard", cardId: idsOf(tab, "142003"), payments: payFor(tab.state, tab.ctx, idsOf(tab, "142003")) }, tab.ctx);
    expect(run.state.window).toEqual({ kind: "response", seat: 0 });
    run = send(run, { type: "Trigger", cardId: idsOf(tab, "142003"), effectId: "142003:response:1" }, tab.ctx);
    // Dagger, Cloak (Hobbit only) and Steward are the attachments of cost 3 or less among the top five.
    expect(choices(run, tab).sort()).toEqual([tab.ids[DAGGER]?.[0], tab.ids[CLOAK]?.[0], tab.ids[STEWARD]?.[0]].sort());
    run = send(run, { type: "Choose", optionId: idsOf(tab, DAGGER) }, tab.ctx);
    expect(choices(run, tab).sort()).toEqual([idsOf(tab, SAM), idsOf(tab, MERRY)].sort());
    run = send(run, { type: "Choose", optionId: idsOf(tab, MERRY) }, tab.ctx);
    const dagger = run.state.cards[idsOf(tab, DAGGER)];
    expect(dagger?.zone).toBe("play");
    expect(dagger?.host).toBe(idsOf(tab, MERRY));
    expect(names(run)?.slice(0, 4).sort()).toEqual([AXEHAND, BOROMIR, CLOAK, STEWARD].sort());
    // Put the remaining four back: Steward first, then Cloak, then Boromir, then the Axehand.
    for (const code of [STEWARD, CLOAK, BOROMIR]) {
      expect(run.state.window?.kind).toBe("choose");
      run = send(run, { type: "Choose", optionId: idsOf(tab, code) }, tab.ctx);
    }
    expect(names(run)?.slice(0, 4)).toEqual([STEWARD, CLOAK, BOROMIR, AXEHAND]);
    expect(run.state.window).toEqual({ kind: "pass" });
    expect(run.state.stack).toEqual([]);
  });

  it("does not offer a unique attachment already in play, because it would be put into play (rr.unique-cards)", () => {
    const deck = [STEWARD, DAGGER, AXEHAND, AXEHAND, AXEHAND];
    const tab = table({
      start: "planning",
      heroes: [{ code: SAM, seat: 0 }, { code: MERRY, seat: 0 }],
      attached: [{ code: STEWARD, host: SAM }],
      hand: [{ code: "142003", seat: 0 }],
      playerDeck: deck.map((code) => ({ code, seat: 0 })),
    });
    let run = send(begin(tab.state), { type: "PlayCard", cardId: idsOf(tab, "142003"), payments: payFor(tab.state, tab.ctx, idsOf(tab, "142003")) }, tab.ctx);
    run = send(run, { type: "Trigger", cardId: idsOf(tab, "142003"), effectId: "142003:response:1" }, tab.ctx);
    // Only the Dagger is offered, so it is taken without a choice; the next question is its host.
    expect(choices(run, tab).sort()).toEqual([idsOf(tab, SAM), idsOf(tab, MERRY)].sort());
  });

  it("with no attachment of cost 3 or less in the top five, the five go back in any order", () => {
    const tab = table({ start: "planning", heroes: [{ code: SAM, seat: 0 }], hand: [{ code: "142003", seat: 0 }], playerDeck: [AXEHAND, BOROMIR, AXEHAND, AXEHAND, AXEHAND, STEWARD].map((code) => ({ code, seat: 0 })) });
    let run = send(begin(tab.state), { type: "PlayCard", cardId: idsOf(tab, "142003"), payments: payFor(tab.state, tab.ctx, idsOf(tab, "142003")) }, tab.ctx);
    run = send(run, { type: "Trigger", cardId: idsOf(tab, "142003"), effectId: "142003:response:1" }, tab.ctx);
    // Only Boromir and the Axehand are different, so the player is asked once for the top position.
    expect(choices(run, tab).sort()).toEqual([idsOf(tab, BOROMIR), tab.ids[AXEHAND]?.[0]].sort());
  });
});

describe("Bilbo Baggins (142006:A:1)", () => {
  it("searches the deck for a Pipe, adds it to the hand, and shuffles the deck", () => {
    const tab = table({
      start: "planning",
      heroes: [{ code: EOWYN, seat: 0 }],
      hand: [{ code: "142006", seat: 0 }],
      playerDeck: [AXEHAND, BOROMIR, PIPE, AXEHAND].map((code) => ({ code, seat: 0 })),
    });
    let run = send(begin(tab.state), { type: "PlayCard", cardId: idsOf(tab, "142006"), payments: payFor(tab.state, tab.ctx, idsOf(tab, "142006")) }, tab.ctx);
    expect(run.state.window).toEqual({ kind: "response", seat: 0 });
    run = send(run, { type: "Trigger", cardId: idsOf(tab, "142006"), effectId: "142006:response:1" }, tab.ctx);
    expect(run.state.cards[idsOf(tab, PIPE)]?.zone).toBe("hand");
    expect(run.state.seats[0]?.deck).toHaveLength(3);
    expect(run.state.seedCursor).toBeGreaterThan(tab.state.seedCursor);
    expect(run.state.window).toEqual({ kind: "pass" });
  });

  it("still shuffles the deck when there is no Pipe in it", () => {
    const tab = table({ start: "planning", heroes: [{ code: EOWYN, seat: 0 }], hand: [{ code: "142006", seat: 0 }], playerDeck: [AXEHAND, BOROMIR].map((code) => ({ code, seat: 0 })) });
    let run = send(begin(tab.state), { type: "PlayCard", cardId: idsOf(tab, "142006"), payments: payFor(tab.state, tab.ctx, idsOf(tab, "142006")) }, tab.ctx);
    run = send(run, { type: "Trigger", cardId: idsOf(tab, "142006"), effectId: "142006:response:1" }, tab.ctx);
    expect(run.state.seats[0]?.hand).toHaveLength(0);
    expect(run.state.seedCursor).toBeGreaterThan(tab.state.seedCursor);
  });
});
