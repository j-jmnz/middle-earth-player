// Rules: rr.action, rr.response, rr.triggered-ability, rr.resource-match, rr.attachment-cards, rr.lasting-effects, rr.step-3-2,
// rr.step-6-4-1, rr.step-6-8a, rr.framework-steps, rr.damage, wor.guarded-x (data/rules/entries.json).
// The Fate of Wilderland heroes, allies and attachments, each printed line tested from the words on the card (data/cards/TFoW.json:
// data/printed holds no ledger entry for these cards, so the lines are the text of data/cards): Radagast 19145:A:1 and A:2, Messenger
// Raven 19146:A:1 and A:2, Loyal Hound 19148:A:1, Bywater Shirriff 19150:A:1, Mithril Shirt 19152:A:1 to A:3, Radagast's Staff
// 19154:A:1 and A:2. The events are in the-fate-of-wilderland-events.test.ts.
import { beforeAll, describe, expect, it } from "vitest";

import type { Effect } from "../../catalog/boundary.ts";
import { EFFECTS } from "../../effects/index.ts";
import { destroyCard } from "../../rules/core/keywords.ts";
import { definePrinted } from "../../rules/core/printed.ts";
import { updateCard } from "../../rules/core/state.ts";
import { playCost } from "../../rules/player/attach.ts";
import { refusal, starterBase } from "../../../test/scenarios/a-shadow-of-the-past/starter-scene.ts";
import { loadPrinted } from "../../../test/harness/catalog.ts";
import { lineSpec } from "../../../test/harness/line-spec.ts";
import { begin, idsOf, type Run, type Scene, type Table } from "../../../test/harness/scene.ts";
import { attacking, choices, combat, enter, hosts, play, playerTableFor, printed, questing, sendUnledgered, stat, triggers } from "../../../test/harness/player-table.ts";

const ARAGORN = "01001";
const GIMLI = "01004";
const EOWYN = "01007";
// A treachery and a location of scenario 1's encounter deck, for the Mithril Shirt's guard.
const CRAWLING = "141041";
const GREEN_HILL = "141036";
const RADAGAST = "19145";
const RAVEN = "19146";
const HOUND = "19148";
const SHIRRIFF = "19150";
const SHIRT = "19152";
const STAFF = "19154";
// Stand-ins with no text: a Tactics Creature Eagle ally, Creature enemies (non-unique and unique) and an enemy that hits hard.
const HAWK = "hawk";
const WARG = "warg";
const BEAST = "beast";
const BRUTE = "brute";
const CHEAP = "cheap";
const DEAR = "dear";
const ALLY = "ally";
const PLAIN = "plain";
const PAL = "pal";

let base: Awaited<ReturnType<typeof starterBase>>;

const table = playerTableFor(() => base);

beforeAll(async () => {
  const starter = await starterBase();
  const cards = new Map([...starter.cards, ...(await loadPrinted([ARAGORN, GIMLI, EOWYN, CRAWLING, GREEN_HILL, RADAGAST, RAVEN, HOUND, SHIRRIFF, SHIRT, STAFF]))]);
  cards.set(HAWK, definePrinted({ code: HAWK, name: "Hawk", type: "ally", traits: ["Creature", "Eagle"], sphere: "tactics", cost: 2, willpower: 1, attack: 1, defense: 1, health: 1 }));
  cards.set(WARG, definePrinted({ code: WARG, name: "Warg", type: "enemy", traits: ["Creature"], threat: 1, engagementCost: 40, attack: 1, defense: 1, health: 3 }));
  cards.set(BEAST, definePrinted({ code: BEAST, name: "Beast", type: "enemy", traits: ["Creature"], isUnique: true, threat: 1, engagementCost: 40, attack: 1, defense: 1, health: 3 }));
  cards.set(BRUTE, definePrinted({ code: BRUTE, name: "Brute", type: "enemy", threat: 1, engagementCost: 40, attack: 3, defense: 1, health: 9 }));
  base = { ...starter, cards };
});

describe("Radagast (19145)", () => {
  // "While playing a Creature ally, Radagast gains the printed Leadership, Spirit, and Tactics icons.": Radagast (Lore) alone pays for
  // the Messenger Raven (Leadership Creature ally) and the Hawk (Tactics Creature ally), but not for a Leadership ally that is not a
  // Creature.
  lineSpec("19145:A:1", "Radagast: pays for a Creature ally of any of the four spheres", (effects) => {
    const tab = table(effects, { heroes: [{ code: RADAGAST, seat: 0 }], hand: [{ code: RAVEN, seat: 0 }, { code: HAWK, seat: 0 }, { code: ALLY, seat: 0 }] });
    const radagast = idsOf(tab, RADAGAST);
    const pay = (id: string, amount: number) => ({ type: "PlayCard" as const, cardId: id, payments: [{ heroId: radagast, amount }] });
    expect(refusal(tab.state, pay(idsOf(tab, RAVEN), 1), tab.ctx)).toBeNull();
    expect(refusal(tab.state, pay(idsOf(tab, HAWK), 2), tab.ctx)).toBeNull();
    expect(refusal(tab.state, pay(idsOf(tab, ALLY), 1), tab.ctx)).not.toBeNull();
    const run = sendUnledgered(begin(tab.state), pay(idsOf(tab, HAWK), 2), tab.ctx);
    expect(run.state.cards[idsOf(tab, HAWK)]?.zone).toBe("play");
  });

  // "Response: After you play a Creature card, Radagast does not exhaust to quest this round.": after the Raven is played, Radagast
  // commits and stays ready.
  lineSpec("19145:A:2", "Radagast: after you play a Creature card, he does not exhaust to quest this round", (effects) => {
    const tab = table(effects, { heroes: [{ code: RADAGAST, seat: 0 }, { code: ARAGORN, seat: 0 }], hand: [{ code: RAVEN, seat: 0 }] });
    const radagast = idsOf(tab, RADAGAST);
    let run = play(begin(tab.state), tab, idsOf(tab, RAVEN));
    expect(triggers(run.state, tab)).toContain("19145:response:1");
    run = sendUnledgered(run, { type: "Trigger", cardId: radagast, effectId: "19145:response:1" }, tab.ctx);
    run = sendUnledgered(begin(questing(run.state)), { type: "Commit", cardIds: [radagast] }, tab.ctx);
    expect(run.state.cards[radagast]).toMatchObject({ committed: true, exhausted: false });
  });

  it("19145:A:2 Radagast: no Response after an ally that is not a Creature", () => {
    const tab = table(EFFECTS, { heroes: [{ code: RADAGAST, seat: 0 }, { code: ARAGORN, seat: 0 }], hand: [{ code: ALLY, seat: 0 }] });
    expect(triggers(play(begin(tab.state), tab, idsOf(tab, ALLY)).state, tab)).not.toContain("19145:response:1");
  });
});

describe("Messenger Raven (19146)", () => {
  // "Cannot attack, defend, of have attachments."
  lineSpec("19146:A:1", "Messenger Raven: cannot attack, defend, or have attachments", (effects) => {
    const tab = table(effects, { heroes: [{ code: ARAGORN, seat: 0 }], allies: [{ code: RAVEN, seat: 0 }, { code: ALLY, seat: 0 }], engaged: [{ code: BRUTE, seat: 0 }], hand: [{ code: PLAIN, seat: 0 }] });
    const [raven, ally, brute] = [idsOf(tab, RAVEN), idsOf(tab, ALLY), idsOf(tab, BRUTE)];
    expect(hosts(tab, idsOf(tab, PLAIN))).not.toContain(raven);
    expect(hosts(tab, idsOf(tab, PLAIN))).toContain(ally);
    const attack = attacking(tab.state);
    expect(refusal(attack, { type: "DeclareAttackers", enemyId: brute, attackerIds: [raven] }, tab.ctx)).not.toBeNull();
    expect(refusal(attack, { type: "DeclareAttackers", enemyId: brute, attackerIds: [ally] }, tab.ctx)).toBeNull();
    let run = combat(tab.state, tab);
    for (let guard = 0; guard < 10 && run.state.window?.kind !== "defense"; guard += 1) run = sendUnledgered(run, { type: "Pass" }, tab.ctx);
    expect(refusal(run.state, { type: "DeclareDefender", defenderId: raven }, tab.ctx)).not.toBeNull();
    expect(refusal(run.state, { type: "DeclareDefender", defenderId: ally }, tab.ctx)).toBeNull();
  });

  // "Refresh Action: Return Messenger Raven to it's owner's hand and name a card type. Choose a player to look at the top card of his
  // deck. If that card is the named type, add it to its owner's hand. If it is not, discard it."
  // The table in the refresh phase's action window (rr.framework-steps: after 7.4 Pass first player token, before 7.5); the other
  // player's deck holds `top` over a filler.
  function ravenTable(effects: readonly Effect[], top: string): Table {
    const tab = table(effects, { seats: 2, heroes: [{ code: ARAGORN, seat: 0 }, { code: PAL, seat: 1 }], allies: [{ code: RAVEN, seat: 0 }], playerDeck: [{ code: top, seat: 1 }, { code: "card", seat: 1 }] });
    return { ...tab, state: { ...tab.state, phase: "Refresh", boundaryPhase: "Refresh", mode: "refresh", window: { kind: "frameAction" } } };
  }

  function raven(effects: readonly Effect[], top: string): { tab: Table; run: Run } {
    const tab = ravenTable(effects, top);
    let run = sendUnledgered(begin(tab.state), { type: "Trigger", cardId: idsOf(tab, RAVEN), effectId: "19146:action:1" }, tab.ctx);
    expect(run.state.seats[0]?.hand).toEqual([idsOf(tab, RAVEN)]);
    expect(choices(run.state, tab).sort()).toEqual(["ally", "attachment", "event"]);
    run = sendUnledgered(run, { type: "Choose", optionId: "ally" }, tab.ctx);
    run = sendUnledgered(run, { type: "Choose", optionId: "seat:1" }, tab.ctx);
    // The chosen player looks at the card, then closes the look.
    expect(run.state.window).toMatchObject({ kind: "look", seat: 1, cardIds: [tab.ids[ALLY]?.[0] ?? tab.ids[PLAIN]?.[0]] });
    run = sendUnledgered(run, { type: "Pass" }, tab.ctx);
    return { tab, run };
  }

  // rr.framework-steps: the refresh phase's action window comes after 7.4 Pass first player token; played into, it offers the Action.
  it("19146:A:2 Messenger Raven: offered in the refresh phase's action window", () => {
    const tab = table(EFFECTS, { heroes: [{ code: ARAGORN, seat: 0 }], allies: [{ code: RAVEN, seat: 0 }], playerDeck: [{ code: ALLY, seat: 0 }] });
    const run = enter(tab.state, tab, "refresh");
    expect(run.state.window?.kind).toBe("frameAction");
    expect(triggers(run.state, tab)).toContain("19146:action:1");
  });

  lineSpec("19146:A:2", "Messenger Raven: the named type goes to its owner's hand", (effects) => {
    const { tab, run } = raven(effects, ALLY);
    expect(run.state.seats[1]?.hand).toEqual([idsOf(tab, ALLY)]);
    expect(run.state.seats[1]?.deck).toHaveLength(1);
  });

  lineSpec("19146:A:2", "Messenger Raven: a card of another type is discarded", (effects) => {
    const { tab, run } = raven(effects, PLAIN);
    expect(run.state.cards[idsOf(tab, PLAIN)]?.zone).toBe("discard");
    expect(run.state.seats[1]?.discard).toEqual([idsOf(tab, PLAIN)]);
    expect(run.state.seats[1]?.hand).toEqual([]);
  });

  it("19146:A:2 Messenger Raven: not offered outside the refresh phase", () => {
    const tab = table(EFFECTS, { heroes: [{ code: ARAGORN, seat: 0 }], allies: [{ code: RAVEN, seat: 0 }], playerDeck: [{ code: ALLY, seat: 0 }] });
    expect(triggers(tab.state, tab)).not.toContain("19146:action:1");
  });
});

describe("Loyal Hound (19148:A:1)", () => {
  // "Cannot have attachments."
  lineSpec("19148:A:1", "Loyal Hound: cannot have attachments", (effects) => {
    const tab = table(effects, { heroes: [{ code: ARAGORN, seat: 0 }], allies: [{ code: HOUND, seat: 0 }, { code: ALLY, seat: 0 }], hand: [{ code: PLAIN, seat: 0 }] });
    expect(hosts(tab, idsOf(tab, PLAIN))).not.toContain(idsOf(tab, HOUND));
    expect(hosts(tab, idsOf(tab, PLAIN))).toContain(idsOf(tab, ALLY));
  });
});

describe("Bywater Shirriff (19150:A:1)", () => {
  // "Bywater Shirriff gets +1 Willpower, +1 Attack, and +1 Defense while you are engaged with an enemy with engagement cost higher than
  // your threat.": with the Dear enemy (50) engaged with you; not with the Cheap one (2), nor with the Dear enemy engaged with the other
  // player.
  lineSpec("19150:A:1", "Bywater Shirriff: +1 Willpower, Attack and Defense while engaged with a dearer enemy", (effects) => {
    const bonus = (engaged: Scene["engaged"], seats: 1 | 2 = 1): number[] => {
      const tab = table(effects, { seats, heroes: [{ code: ARAGORN, seat: 0 }, ...(seats === 2 ? [{ code: PAL, seat: 1 }] : [])], allies: [{ code: SHIRRIFF, seat: 0 }], engaged });
      const id = idsOf(tab, SHIRRIFF);
      return (["willpower", "attack", "defense"] as const).map((which) => stat(tab.state, tab, id, which) - printed(tab, SHIRRIFF, which));
    };
    expect(bonus([{ code: DEAR, seat: 0 }])).toEqual([1, 1, 1]);
    expect(bonus([{ code: CHEAP, seat: 0 }])).toEqual([0, 0, 0]);
    expect(bonus([{ code: DEAR, seat: 1 }], 2)).toEqual([0, 0, 0]);
  });
});

describe("Mithril Shirt (19152)", () => {
  // "Guarded (location).": played, it discards cards from the encounter deck until a location, which goes to the staging area with the
  // Shirt attached (wor.guarded-x); the treachery above it is discarded.
  function guarded(effects: readonly Effect[]): { tab: Table; run: Run } {
    const tab = table(effects, { heroes: [{ code: GIMLI, seat: 0 }, { code: EOWYN, seat: 0 }], allies: [{ code: ALLY, seat: 0 }], hand: [{ code: SHIRT, seat: 0 }], deck: [CRAWLING, GREEN_HILL] });
    const shirt = idsOf(tab, SHIRT);
    const [hostId] = hosts(tab, shirt);
    return { tab, run: play(begin(tab.state), tab, shirt, hostId) };
  }

  lineSpec("19152:A:1", "Mithril Shirt: Guarded (location)", (effects) => {
    const { tab, run } = guarded(effects);
    const [shirt, location] = [idsOf(tab, SHIRT), idsOf(tab, GREEN_HILL)];
    expect(run.state.cards[idsOf(tab, CRAWLING)]?.zone).toBe("encounterDiscard");
    expect(run.state.cards[location]?.zone).toBe("staging");
    expect(run.state.cards[location]?.attachments).toEqual([shirt]);
    expect(run.state.cards[shirt]?.host).toBe(location);
  });

  // "Guarded (location). Attach to a hero.": once the guarding location leaves play, its owner attaches the Shirt to one of their
  // heroes (wor.guarded-x); the ally is no choice.
  lineSpec("19152:A:2", "Mithril Shirt: Attach to a hero, once free of encounters", (effects) => {
    const { tab, run: played } = guarded(effects);
    const [shirt, location, eowyn] = [idsOf(tab, SHIRT), idsOf(tab, GREEN_HILL), idsOf(tab, EOWYN)];
    // The location is explored (it leaves play), and the next intent lets the game resolve what that set off.
    let run = sendUnledgered(begin(destroyCard(played.state, location, tab.ctx.cards, [], true)), { type: "Pass" }, tab.ctx);
    expect(run.state.window?.kind).toBe("choose");
    expect(choices(run.state, tab).sort()).toEqual([idsOf(tab, GIMLI), eowyn].sort());
    run = sendUnledgered(run, { type: "Choose", optionId: eowyn }, tab.ctx);
    expect(run.state.cards[shirt]).toMatchObject({ host: eowyn, zone: "play" });
  });

  // "Response: When attached hero is dealt any amount of damage, reduce that amount by 1.": the Brute's 3 damage, undefended, becomes 2.
  lineSpec("19152:A:3", "Mithril Shirt: the attached hero is dealt 1 damage less", (effects) => {
    const tab = table(effects, { heroes: [{ code: GIMLI, seat: 0 }], attached: [{ code: SHIRT, host: GIMLI }], engaged: [{ code: BRUTE, seat: 0 }] });
    const gimli = idsOf(tab, GIMLI);
    let run = combat(tab.state, tab);
    for (let guard = 0; guard < 10 && run.state.window?.kind !== "defense"; guard += 1) run = sendUnledgered(run, { type: "Pass" }, tab.ctx);
    run = sendUnledgered(run, { type: "Undefended", heroId: gimli }, tab.ctx);
    expect(triggers(run.state, tab)).toContain("19152:response:1");
    run = sendUnledgered(run, { type: "Trigger", cardId: idsOf(tab, SHIRT), effectId: "19152:response:1" }, tab.ctx);
    expect(run.state.cards[gimli]?.damage).toBe(2);
  });

  // Éowyn, who does not wear it, takes the Brute's full 3 and is offered no Response.
  it("19152:A:3 Mithril Shirt: no Response for damage to another hero", () => {
    const tab = table(EFFECTS, { heroes: [{ code: GIMLI, seat: 0 }, { code: EOWYN, seat: 0 }], attached: [{ code: SHIRT, host: GIMLI }], engaged: [{ code: BRUTE, seat: 0 }] });
    let run = combat(tab.state, tab);
    for (let guard = 0; guard < 10 && run.state.window?.kind !== "defense"; guard += 1) run = sendUnledgered(run, { type: "Pass" }, tab.ctx);
    run = sendUnledgered(run, { type: "Undefended", heroId: idsOf(tab, EOWYN) }, tab.ctx);
    expect(triggers(run.state, tab)).not.toContain("19152:response:1");
  });
});

describe("Radagast's Staff (19154)", () => {
  // "Attach to Radagast.": Radagast is offered; Aragorn is not.
  lineSpec("19154:A:1", "Radagast's Staff: Attach to Radagast", (effects) => {
    const tab = table(effects, { heroes: [{ code: RADAGAST, seat: 0 }, { code: ARAGORN, seat: 0 }], hand: [{ code: STAFF, seat: 0 }] });
    expect(hosts(tab, idsOf(tab, STAFF))).toEqual([idsOf(tab, RADAGAST)]);
  });

  // "Action: Exhaust Radagast's Staff to choose one: Reduce the cost of the next Creature ally you play this phase by 2, ready a
  // Creature ally, or return a non-unique Creature enemy engaged with you to the staging area."
  function staff(effects: readonly Effect[], scene: Scene): { tab: Table; run: Run } {
    const tab = table(effects, { heroes: [{ code: RADAGAST, seat: 0 }, { code: ARAGORN, seat: 0 }], attached: [{ code: STAFF, host: RADAGAST }], ...scene });
    return { tab, run: sendUnledgered(begin(tab.state), { type: "Trigger", cardId: idsOf(tab, STAFF), effectId: "19154:action:1" }, tab.ctx) };
  }

  // The Hawk costs 2 less (0); a second Hawk played after it, and a plain ally, cost their full price.
  lineSpec("19154:A:2", "Radagast's Staff: the next Creature ally costs 2 less this phase", (effects) => {
    const { tab, run: used } = staff(effects, { hand: [{ code: HAWK, seat: 0 }, { code: HAWK, seat: 0 }, { code: ALLY, seat: 0 }] });
    const [first, second] = tab.ids[HAWK] ?? [];
    expect(used.state.cards[idsOf(tab, STAFF)]?.exhausted).toBe(true);
    let run = used;
    if (choices(run.state, tab).includes("reduce")) {
      expect(choices(run.state, tab)).toEqual(["reduce"]);
      run = sendUnledgered(run, { type: "Choose", optionId: "reduce" }, tab.ctx);
    }
    expect(playCost(run.state, first ?? "", 0, tab.ctx)).toBe(0);
    // An ally that is not a Creature costs its full 1.
    expect(playCost(run.state, idsOf(tab, ALLY), 0, tab.ctx)).toBe(1);
    run = sendUnledgered(run, { type: "PlayCard", cardId: first ?? "", payments: [] }, tab.ctx);
    expect(playCost(run.state, second ?? "", 0, tab.ctx)).toBe(2);
  });

  // The exhausted Raven is readied; the exhausted plain ally is no choice.
  lineSpec("19154:A:2", "Radagast's Staff: ready a Creature ally", (effects) => {
    const scene = table(effects, { heroes: [{ code: RADAGAST, seat: 0 }, { code: ARAGORN, seat: 0 }], attached: [{ code: STAFF, host: RADAGAST }], allies: [{ code: RAVEN, seat: 0 }, { code: ALLY, seat: 0 }] });
    const [raven, ally] = [idsOf(scene, RAVEN), idsOf(scene, ALLY)];
    const tab = { ...scene, state: updateCard(updateCard(scene.state, raven, { exhausted: true }), ally, { exhausted: true }) };
    let run = sendUnledgered(begin(tab.state), { type: "Trigger", cardId: idsOf(tab, STAFF), effectId: "19154:action:1" }, tab.ctx);
    expect(choices(run.state, tab).sort()).toEqual(["ready", "reduce"]);
    run = sendUnledgered(run, { type: "Choose", optionId: "ready" }, tab.ctx);
    expect(run.state.window?.kind).not.toBe("choose");
    expect(run.state.cards[raven]?.exhausted).toBe(false);
    expect(run.state.cards[ally]?.exhausted).toBe(true);
  });

  // The Warg (non-unique Creature) engaged with you goes back to the staging area; the unique Beast is no choice.
  lineSpec("19154:A:2", "Radagast's Staff: return a non-unique Creature enemy engaged with you to the staging area", (effects) => {
    const { tab, run: used } = staff(effects, { engaged: [{ code: WARG, seat: 0 }, { code: BEAST, seat: 0 }] });
    expect(choices(used.state, tab).sort()).toEqual(["reduce", "return"]);
    let run = sendUnledgered(used, { type: "Choose", optionId: "return" }, tab.ctx);
    expect(run.state.window?.kind).not.toBe("choose");
    expect(run.state.cards[idsOf(tab, WARG)]?.zone).toBe("staging");
    expect(run.state.cards[idsOf(tab, BEAST)]?.zone).toBe("engaged");
  });
});
