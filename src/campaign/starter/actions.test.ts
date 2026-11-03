// Rules: rr.action, rr.response, rr.limits, rr.lasting-effects, rr.initiating-abilities-playing-cards, rr.framework-steps (data/rules/entries.json).
// Phase 9 batch 2: the simple Actions and Responses of the starter decks, played through the reducer.
import { beforeAll, describe, expect, it } from "vitest";

import { ruleCause } from "../../rules/core/cause.ts";
import { attackBarred, syncConstants } from "../../rules/interpret/constants.ts";
import { modifiedStat, placeDamage } from "../../rules/core/keywords.ts";
import { legalIntents, type PlayerIntent } from "../../rules/engine/reduce.ts";
import { settle } from "../../rules/engine/machine.ts";
import { updateCard, withMode, withThreat } from "../../rules/core/state.ts";
import { CHEAP, fund, payFor, refusal, starterBase } from "../../../test/scenarios/a-shadow-of-the-past/starter-scene.ts";
import { begin, buildTable, FRODO, idsOf, send, type Run, type Scene, type Table } from "../../../test/harness/scene.ts";

const SAM = "141002";
const MERRY = "141003";
const BOROMIR = "142004";
const FARAMIR = "01014";
const AXEHAND = "01028";

let base: Awaited<ReturnType<typeof starterBase>>;

beforeAll(async () => {
  base = await starterBase();
});

function table(scene: Scene = {}, resources = 6): Table {
  const tab = buildTable(base, { ring: "none", start: "planning", ...scene });
  let state = tab.state;
  for (let seat = 0; seat < (scene.seats ?? 1); seat += 1) state = fund(state, seat, resources);
  return { ...tab, state };
}

function play(tab: Table, run: Run, code: string, extra: Partial<Extract<PlayerIntent, { type: "PlayCard" }>> = {}, index = 0): Run {
  const cardId = tab.ids[code]?.[index] ?? "";
  return send(run, { type: "PlayCard", cardId, payments: payFor(run.state, tab.ctx, cardId, run.state.activeSeat), ...extra }, tab.ctx);
}

function trigger(run: Run, tab: Table, code: string, effectId: string, index = 0): Run {
  return send(run, { type: "Trigger", cardId: tab.ids[code]?.[index] ?? "", effectId }, tab.ctx);
}

function choices(run: Run, tab: Table): string[] {
  return legalIntents(run.state, tab.ctx).flatMap((intent) => (intent.type === "Choose" ? [intent.optionId] : []));
}

const exhaust = (tab: Table, ...ids: string[]): Table => ({ ...tab, state: ids.reduce((state, id) => updateCard(state, id, { exhausted: true }), tab.state) });

describe("Ever Vigilant (01020:A:1)", () => {
  it("readies the one exhausted ally, then the event is discarded and planning continues", () => {
    const tab = exhaust(table({ allies: [{ code: BOROMIR, seat: 0 }, { code: AXEHAND, seat: 0 }], hand: [{ code: "01020", seat: 0 }] }), "i4");
    const boromir = idsOf(tab, BOROMIR);
    const marked = exhaust(tab, boromir);
    const run = play(marked, begin(marked.state), "01020");
    expect(run.state.cards[boromir]?.exhausted).toBe(false);
    expect(run.state.cards[idsOf(tab, "01020")]?.zone).toBe("discard");
    expect(run.state.window).toEqual({ kind: "pass" });
    expect(run.state.stack).toEqual([]);
  });

  it("asks which of two different exhausted allies, and readies that one", () => {
    const tab = table({ allies: [{ code: BOROMIR, seat: 0 }, { code: AXEHAND, seat: 0 }], hand: [{ code: "01020", seat: 0 }] });
    const marked = exhaust(tab, idsOf(tab, BOROMIR), idsOf(tab, AXEHAND));
    let run = play(marked, begin(marked.state), "01020");
    expect(run.state.window?.kind).toBe("choose");
    expect(choices(run, marked).sort()).toEqual([idsOf(tab, BOROMIR), idsOf(tab, AXEHAND)].sort());
    run = send(run, { type: "Choose", optionId: idsOf(tab, AXEHAND) }, marked.ctx);
    expect(run.state.cards[idsOf(tab, AXEHAND)]?.exhausted).toBe(false);
    expect(run.state.cards[idsOf(tab, BOROMIR)]?.exhausted).toBe(true);
    expect(run.state.window).toEqual({ kind: "pass" });
  });

  it("cannot be played with no exhausted ally to choose (rr.initiating-abilities-playing-cards, step 1)", () => {
    const tab = table({ allies: [{ code: BOROMIR, seat: 0 }], hand: [{ code: "01020", seat: 0 }] });
    expect(refusal(tab.state, { type: "PlayCard", cardId: idsOf(tab, "01020"), payments: payFor(tab.state, tab.ctx, idsOf(tab, "01020")) }, tab.ctx)).toBe("That card has no legal target");
  });
});

describe("Common Cause (01021:A:1)", () => {
  it("exhausts a hero you control to ready a different hero", () => {
    const tab = table({ heroes: [{ code: SAM, seat: 0 }, { code: MERRY, seat: 0 }], hand: [{ code: "01021", seat: 0 }] });
    const sam = idsOf(tab, SAM);
    const merry = idsOf(tab, MERRY);
    const marked = exhaust(tab, merry);
    const run = play(marked, begin(marked.state), "01021");
    expect(run.state.cards[sam]?.exhausted).toBe(true);
    expect(run.state.cards[merry]?.exhausted).toBe(false);
    expect(run.state.cards[idsOf(tab, "01021")]?.zone).toBe("discard");
  });
});

describe("Grim Resolve (01025:A:1)", () => {
  it("readies every character in play", () => {
    const tab = table({ heroes: [{ code: SAM, seat: 0 }, { code: MERRY, seat: 0 }], allies: [{ code: BOROMIR, seat: 0 }], hand: [{ code: "01025", seat: 0 }] });
    const ids = [idsOf(tab, SAM), idsOf(tab, MERRY), idsOf(tab, BOROMIR)];
    const marked = exhaust(tab, ...ids);
    const run = play(marked, begin(marked.state), "01025");
    for (const id of ids) expect(run.state.cards[id]?.exhausted, id).toBe(false);
  });
});

describe("Halfling Determination (141009:A:1)", () => {
  it("gives a chosen Hobbit character +2 Willpower, Attack and Defense until the end of the phase", () => {
    const tab = table({ heroes: [{ code: SAM, seat: 0 }, { code: MERRY, seat: 0 }, { code: "01001", seat: 0 }], hand: [{ code: "141009", seat: 0 }] });
    let run = play(tab, begin(tab.state), "141009");
    expect(choices(run, tab).sort()).toEqual([idsOf(tab, SAM), idsOf(tab, MERRY)].sort());
    run = send(run, { type: "Choose", optionId: idsOf(tab, MERRY) }, tab.ctx);
    // Merry's own line already adds +1 Attack for each of the two Hobbit heroes.
    const plain = syncConstants(tab.state, tab.ctx);
    const stat = (state: typeof plain, code: string, name: "willpower" | "attack" | "defense") => modifiedStat(state, state.cards[idsOf(tab, code)] ?? ({} as never), name, tab.ctx.cards);
    for (const name of ["willpower", "attack", "defense"] as const) {
      expect(stat(run.state, MERRY, name), name).toBe(stat(plain, MERRY, name) + 2);
      expect(stat(run.state, SAM, name), name).toBe(stat(plain, SAM, name));
    }
    // The phase ends: the lasting effect is gone.
    const later = syncConstants(withMode(run.state, "questCommit"), tab.ctx);
    expect(stat(later, MERRY, "attack")).toBe(stat(plain, MERRY, "attack"));
  });
});

describe("Frodo's Intuition (141012:A:1)", () => {
  it("gives each hero you control +1 Willpower until the end of the round and draws a card for each Hobbit hero", () => {
    const tab = table({ heroes: [{ code: FRODO, seat: 0 }, { code: SAM, seat: 0 }, { code: "01001", seat: 0 }], hand: [{ code: "141012", seat: 0 }], playerDeck: [{ code: AXEHAND, seat: 0 }, { code: AXEHAND, seat: 0 }, { code: AXEHAND, seat: 0 }] });
    const run = play(tab, begin(tab.state), "141012");
    for (const code of [FRODO, SAM, "01001"]) {
      const hero = run.state.cards[idsOf(tab, code)];
      expect(modifiedStat(run.state, hero ?? ({} as never), "willpower", tab.ctx.cards), code).toBe((tab.ctx.cards.get(code)?.willpower ?? 0) + 1);
    }
    // Frodo and Sam are Hobbits, Aragorn is not.
    expect(run.state.seats[0]?.hand.filter((id) => run.state.cards[id]?.code === AXEHAND)).toHaveLength(2);
    expect(run.steps.filter((step) => step.kind === "draw")).toHaveLength(2);
  });
});

describe("Feint (01034:A:1)", () => {
  it("is refused outside the Combat phase", () => {
    const tab = table({ heroes: [{ code: MERRY, seat: 0 }], engaged: [{ code: CHEAP, seat: 0 }], hand: [{ code: "01034", seat: 0 }] });
    expect(refusal(tab.state, { type: "PlayCard", cardId: idsOf(tab, "01034"), payments: payFor(tab.state, tab.ctx, idsOf(tab, "01034")) }, tab.ctx)).toBe("That card cannot be played now");
    expect(legalIntents(tab.state, tab.ctx).some((intent) => intent.type === "PlayCard")).toBe(false);
  });

  it("opens the combat action window, and the enemy it is played on does not attack that phase", () => {
    const tab = table({ heroes: [{ code: MERRY, seat: 0 }], engaged: [{ code: CHEAP, seat: 0 }], hand: [{ code: "01034", seat: 0 }] });
    // Combat starts: the shadow cards are dealt, then the window after them (rr.framework-steps, 6.2) opens because the
    // player holds a Combat Action.
    const start = { ...withMode(tab.state, "combatStart"), window: null };
    const opened = settle(start, tab.ctx, []);
    expect(opened.mode).toBe("combatActions");
    expect(opened.window).toEqual({ kind: "frameAction" });
    expect(legalIntents(opened, tab.ctx)).toContainEqual({ type: "PlayCard", cardId: idsOf(tab, "01034") });
    let run = play(tab, begin(opened), "01034");
    const enemy = idsOf(tab, CHEAP);
    expect(attackBarred(run.state, enemy, 0)).toBe(true);
    run = send(run, { type: "Pass" }, tab.ctx);
    // The enemy would have attacked now; it did not, and the combat moved on to the player attacks.
    expect(run.state.window?.kind).not.toBe("defense");
    expect(run.steps.some((step) => step.kind === "attack" && step.side === "enemy")).toBe(false);
  });

  it("cannot be played with no enemy engaged with a player (rr.the-word-choose)", () => {
    const tab = table({ heroes: [{ code: MERRY, seat: 0 }], hand: [{ code: "01034", seat: 0 }] });
    const combat = { ...withMode(tab.state, "combatActions"), window: { kind: "pass" as const }, activeSeat: 0 };
    expect(refusal(combat, { type: "PlayCard", cardId: idsOf(tab, "01034"), payments: payFor(combat, tab.ctx, idsOf(tab, "01034")) }, tab.ctx)).toBe("That card has no legal target");
  });

  it("without a Combat Action in hand the window does not open, and the enemy attacks", () => {
    const tab = table({ heroes: [{ code: MERRY, seat: 0 }], engaged: [{ code: CHEAP, seat: 0 }], hand: [{ code: "01020", seat: 0 }] });
    const opened = settle({ ...withMode(tab.state, "combatStart"), window: null }, tab.ctx, []);
    expect(opened.window?.kind).toBe("defense");
  });
});

describe("Quick Strike (01035:A:1)", () => {
  it("exhausts a character to attack an eligible enemy at once", () => {
    const tab = table({ heroes: [{ code: MERRY, seat: 0 }], allies: [{ code: BOROMIR, seat: 0 }], engaged: [{ code: CHEAP, seat: 0 }], hand: [{ code: "01035", seat: 0 }] });
    const boromir = idsOf(tab, BOROMIR);
    const enemy = idsOf(tab, CHEAP);
    const marked = exhaust(tab, idsOf(tab, MERRY));
    const run = play(marked, begin(marked.state), "01035");
    expect(run.state.cards[boromir]?.exhausted).toBe(true);
    // 3 Attack against 1 Defense.
    expect(run.state.cards[enemy]?.damage).toBe(2);
    expect(run.steps).toContainEqual(expect.objectContaining({ kind: "damage", targetId: enemy, amount: 2 }));
    expect(run.state.window).toEqual({ kind: "pass" });
  });

  it("cannot be played when no ready character can attack", () => {
    const tab = table({ heroes: [{ code: MERRY, seat: 0 }], hand: [{ code: "01035", seat: 0 }] });
    expect(refusal(tab.state, { type: "PlayCard", cardId: idsOf(tab, "01035"), payments: payFor(tab.state, tab.ctx, idsOf(tab, "01035")) }, tab.ctx)).toBe("That card has no legal target");
  });
});

describe("Steward of Gondor (01026:A:3), Unexpected Courage (01057:A:2)", () => {
  it("Steward adds 2 resources to the attached hero, once while it is exhausted", () => {
    const tab = table({ heroes: [{ code: SAM, seat: 0 }], attached: [{ code: "01026", host: SAM }] }, 0);
    const steward = idsOf(tab, "01026");
    let run = trigger(begin(tab.state), tab, "01026", "01026:action:1");
    expect(run.state.cards[idsOf(tab, SAM)]?.resources).toBe(2);
    expect(run.state.cards[steward]?.exhausted).toBe(true);
    expect(refusal(run.state, { type: "Trigger", cardId: steward, effectId: "01026:action:1" }, tab.ctx)).toBe("That cost cannot be paid");
    run = send(run, { type: "Pass" }, tab.ctx);
    expect(run.state.mode).toBe("questCommit");
  });

  it("Unexpected Courage exhausts to ready the attached hero", () => {
    const tab = table({ heroes: [{ code: SAM, seat: 0 }], attached: [{ code: "01057", host: SAM }] });
    const marked = exhaust(tab, idsOf(tab, SAM));
    const run = trigger(begin(marked.state), marked, "01057", "01057:action:1");
    expect(run.state.cards[idsOf(tab, SAM)]?.exhausted).toBe(false);
    expect(run.state.cards[idsOf(tab, "01057")]?.exhausted).toBe(true);
  });
});

describe("Gléowine (01062:A:1), Faramir (01014:A:1)", () => {
  it("Gléowine exhausts to make the chosen player draw a card", () => {
    const tab = table({ seats: 2, heroes: [{ code: SAM, seat: 0 }, { code: MERRY, seat: 1 }], allies: [{ code: "01062", seat: 0 }], playerDeck: [{ code: AXEHAND, seat: 1 }, { code: AXEHAND, seat: 0 }] });
    let run = trigger(begin(tab.state), tab, "01062", "01062:action:1");
    expect(choices(run, tab)).toEqual(["seat:0", "seat:1"]);
    run = send(run, { type: "Choose", optionId: "seat:1" }, tab.ctx);
    expect(run.state.seats[1]?.hand).toHaveLength(1);
    expect(run.state.seats[0]?.hand).toHaveLength(0);
    expect(run.state.cards[idsOf(tab, "01062")]?.exhausted).toBe(true);
  });

  it("Faramir gives each character the chosen player controls +1 Willpower until the end of the phase", () => {
    const tab = table({ seats: 2, heroes: [{ code: SAM, seat: 0 }, { code: MERRY, seat: 1 }], allies: [{ code: FARAMIR, seat: 0 }, { code: BOROMIR, seat: 1 }] });
    let run = trigger(begin(tab.state), tab, FARAMIR, "01014:action:1");
    run = send(run, { type: "Choose", optionId: "seat:1" }, tab.ctx);
    const bump = (code: string, seat: number) => {
      const id = idsOf(tab, code);
      expect(modifiedStat(run.state, run.state.cards[id] ?? ({} as never), "willpower", tab.ctx.cards), `${code} for seat ${seat}`).toBe((tab.ctx.cards.get(code)?.willpower ?? 0) + (seat === 1 ? 1 : 0));
    };
    bump(MERRY, 1);
    bump(BOROMIR, 1);
    bump(SAM, 0);
    bump(FARAMIR, 0);
  });
});

describe("Wandering Took (01043:A:1)", () => {
  it("needs another player, lowers your threat by 3, gives control, raises theirs by 3, and is limited to once per round", () => {
    const alone = table({ allies: [{ code: "01043", seat: 0 }] });
    expect(refusal(alone.state, { type: "Trigger", cardId: idsOf(alone, "01043"), effectId: "01043:action:1" }, alone.ctx)).toBe("That effect cannot be triggered");
    const tab = table({ seats: 2, heroes: [{ code: SAM, seat: 0 }, { code: MERRY, seat: 1 }], allies: [{ code: "01043", seat: 0 }] });
    const took = idsOf(tab, "01043");
    const run = trigger(begin(tab.state), tab, "01043", "01043:action:1");
    expect(run.state.seats[0]?.threat).toBe(5);
    expect(run.state.seats[1]?.threat).toBe(9);
    expect(run.state.cards[took]?.controller).toBe(1);
    expect(run.state.seats[1]?.play).toContain(took);
    expect(run.state.seats[0]?.play).not.toContain(took);
    expect(run.steps.filter((step) => step.kind === "threat").map((step) => (step.kind === "threat" ? [step.seat, step.amount] : []))).toEqual([[0, -3], [1, 3]]);
    // The limit: once per round for this card.
    expect(run.state.uses.some((use) => use.effectId === "01043:action:1" && use.sourceId === took)).toBe(true);
  });
});

describe("The Galadhrim's Greeting (01046:A:1)", () => {
  it("reduces one player's threat by 6, or each player's by 2", () => {
    const setup = () => {
      const tab = table({ seats: 2, heroes: [{ code: "01007", seat: 0 }, { code: MERRY, seat: 1 }], hand: [{ code: "01046", seat: 0 }] });
      return { tab, state: withThreat(withThreat(tab.state, 0, 20), 1, 30) };
    };
    const one = setup();
    let run = play(one.tab, begin(one.state), "01046");
    expect(choices(run, one.tab).sort()).toEqual(["each", "one"]);
    run = send(run, { type: "Choose", optionId: "one" }, one.tab.ctx);
    run = send(run, { type: "Choose", optionId: "seat:1" }, one.tab.ctx);
    expect([run.state.seats[0]?.threat, run.state.seats[1]?.threat]).toEqual([20, 24]);
    const each = setup();
    let second = play(each.tab, begin(each.state), "01046");
    second = send(second, { type: "Choose", optionId: "each" }, each.tab.ctx);
    expect([second.state.seats[0]?.threat, second.state.seats[1]?.threat]).toEqual([18, 28]);
    expect(second.state.cards[idsOf(each.tab, "01046")]?.zone).toBe("discard");
  });
});

describe("Valiant Sacrifice (01024:A:1)", () => {
  it("Response from the hand: after an ally leaves play, its controller draws 2 cards", () => {
    const tab = table({ heroes: [{ code: SAM, seat: 0 }], allies: [{ code: AXEHAND, seat: 0 }], hand: [{ code: "01024", seat: 0 }], playerDeck: [{ code: BOROMIR, seat: 0 }, { code: BOROMIR, seat: 0 }, { code: BOROMIR, seat: 0 }] });
    const hit = placeDamage(tab.state, idsOf(tab, AXEHAND), 9, tab.ctx.cards, [], "framework", ruleCause("rr.damage"));
    let run = send(begin(hit), { type: "Pass" }, tab.ctx);
    expect(run.state.window).toEqual({ kind: "response", seat: 0 });
    const event = idsOf(tab, "01024");
    expect(legalIntents(run.state, tab.ctx)).toContainEqual({ type: "Trigger", cardId: event, effectId: "01024:response:1" });
    run = send(run, { type: "Trigger", cardId: event, effectId: "01024:response:1", payments: payFor(run.state, tab.ctx, event) }, tab.ctx);
    expect(run.state.seats[0]?.hand.filter((id) => run.state.cards[id]?.code === BOROMIR)).toHaveLength(2);
    expect(run.state.cards[event]?.zone).toBe("discard");
    expect(run.state.window?.kind).not.toBe("response");
  });

  it("is paid for, and cannot be used when the hero cannot pay", () => {
    const tab = table({ heroes: [{ code: SAM, seat: 0 }], allies: [{ code: AXEHAND, seat: 0 }], hand: [{ code: "01024", seat: 0 }] }, 0);
    const hit = placeDamage(tab.state, idsOf(tab, AXEHAND), 9, tab.ctx.cards, [], "framework", ruleCause("rr.damage"));
    const run = send(begin(hit), { type: "Pass" }, tab.ctx);
    expect(run.state.window?.kind).not.toBe("response");
  });
});

describe("Boromir (142004:A:2)", () => {
  it("Response: after he takes damage, ready him", () => {
    const tab = table({ heroes: [{ code: SAM, seat: 0 }], allies: [{ code: BOROMIR, seat: 0 }] });
    const boromir = idsOf(tab, BOROMIR);
    const marked = exhaust(tab, boromir);
    const hit = placeDamage(marked.state, boromir, 1, tab.ctx.cards, [], "framework", ruleCause("rr.damage"));
    let run = send(begin(hit), { type: "Pass" }, tab.ctx);
    expect(run.state.window).toEqual({ kind: "response", seat: 0 });
    run = send(run, { type: "Trigger", cardId: boromir, effectId: "142004:response:1" }, tab.ctx);
    expect(run.state.cards[boromir]?.exhausted).toBe(false);
  });

  it("hears nothing when the damage destroys him", () => {
    const tab = table({ heroes: [{ code: SAM, seat: 0 }], allies: [{ code: BOROMIR, seat: 0 }] });
    const boromir = idsOf(tab, BOROMIR);
    const hit = placeDamage(tab.state, boromir, 9, tab.ctx.cards, [], "framework", ruleCause("rr.damage"));
    const run = send(begin(hit), { type: "Pass" }, tab.ctx);
    expect(run.state.window?.kind).not.toBe("response");
    expect(run.state.cards[boromir]?.zone).toBe("discard");
  });
});

describe("Snowbourn Scout (01016:A:1), Northern Tracker (01045:A:1)", () => {
  it("Snowbourn Scout: after it enters play, place a progress token on a chosen location", () => {
    const tab = table({ staging: ["141036", "141037"], hand: [{ code: "01016", seat: 0 }] });
    let run = play(tab, begin(tab.state), "01016");
    expect(run.state.window).toEqual({ kind: "response", seat: 0 });
    run = send(run, { type: "Trigger", cardId: idsOf(tab, "01016"), effectId: "01016:response:1" }, tab.ctx);
    expect(run.state.window?.kind).toBe("choose");
    run = send(run, { type: "Choose", optionId: idsOf(tab, "141036") }, tab.ctx);
    expect(run.state.cards[idsOf(tab, "141036")]?.progress).toBe(1);
    expect(run.state.cards[idsOf(tab, "141037")]?.progress).toBe(0);
    // The planning window comes back after the response.
    expect(run.state.window).toEqual({ kind: "pass" });
    expect(run.state.stack).toEqual([]);
  });

  it("Northern Tracker: after it commits, place a progress token on each location in the staging area", () => {
    const tab = table({ start: "quest", heroes: [{ code: SAM, seat: 0 }], allies: [{ code: "01045", seat: 0 }], staging: ["141036", "141037"] });
    let run = send(begin(tab.state), { type: "Commit", cardIds: [idsOf(tab, "01045")] }, tab.ctx);
    expect(run.state.window).toEqual({ kind: "response", seat: 0 });
    run = send(run, { type: "Trigger", cardId: idsOf(tab, "01045"), effectId: "01045:response:1" }, tab.ctx);
    expect(run.state.cards[idsOf(tab, "141036")]?.progress).toBe(1);
    expect(run.state.cards[idsOf(tab, "141037")]?.progress).toBe(1);
    expect(run.state.window).toEqual({ kind: "pass" });
  });
});

describe("Gandalf, the ally (01073)", () => {
  it("Response: after he enters play, choose 1: draw 3 cards, deal 4 damage to an enemy, or reduce your threat by 5", () => {
    const setup = () => {
      const tab = table({ heroes: [{ code: SAM, seat: 0 }], engaged: [{ code: CHEAP, seat: 0 }], hand: [{ code: "01073", seat: 0 }], playerDeck: [{ code: AXEHAND, seat: 0 }, { code: AXEHAND, seat: 0 }, { code: AXEHAND, seat: 0 }, { code: AXEHAND, seat: 0 }] }, 6);
      return tab;
    };
    const effect = { type: "Trigger" as const, effectId: "01073:response:1" };
    const answer = (tab: Table, optionId: string): Run => {
      let run = play(tab, begin(tab.state), "01073");
      run = send(run, { ...effect, cardId: idsOf(tab, "01073") }, tab.ctx);
      expect(choices(run, tab).sort()).toEqual(["damage", "draw", "threat"]);
      return send(run, { type: "Choose", optionId }, tab.ctx);
    };
    const drawn = answer(setup(), "draw");
    expect(drawn.state.seats[0]?.hand).toHaveLength(3);
    const hurt = setup();
    const damaged = answer(hurt, "damage");
    expect(damaged.state.cards[idsOf(hurt, CHEAP)]?.damage).toBe(4);
    const calm = answer(setup(), "threat");
    expect(calm.state.seats[0]?.threat).toBe(3);
  });

  it("At the end of the round, he is discarded from play (01073:A:1)", () => {
    const tab = table({ heroes: [{ code: SAM, seat: 0 }], allies: [{ code: "01073", seat: 0 }] });
    const gandalf = idsOf(tab, "01073");
    // Walk the table to the end of the round: the ally leaves play and the player's discard pile holds it.
    const state = settle({ ...withMode(tab.state, "endRound"), window: null }, tab.ctx, []);
    expect(state.cards[gandalf]?.zone).toBe("discard");
  });
});
