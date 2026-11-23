// Rules: rr.triggered-ability, rr.cost, rr.the-word-choose, rr.resource-match, rr.effects (data/rules/entries.json).
// The researched readings of player cards that docs/brief.md (Player card readings) states, each as a test: what the engine offers, or refuses, on a
// table built from the card's text (data/cards; the packs have no ledger, so every intent goes through sendUnledgered). Gained icons are in
// gained-icons.test.ts.
import { beforeAll, describe, expect, it } from "vitest";

import { EFFECTS } from "../../effects/index.ts";
import { ruleCause } from "../../rules/core/cause.ts";
import { raiseThreat } from "../../rules/core/keywords.ts";
import { definePrinted } from "../../rules/core/printed.ts";
import { updateCard, withThreat } from "../../rules/core/state.ts";
import type { EngineStep } from "../../rules/core/intents.ts";
import { settle } from "../../rules/engine/machine.ts";
import { legalIntents } from "../../rules/engine/reduce.ts";
import { starterBase } from "../../../test/scenarios/a-shadow-of-the-past/starter-scene.ts";
import { loadPrinted } from "../../../test/harness/catalog.ts";
import { attacking, attach, choices, combat, enter, fillers, passAll, play, playCode, playerTable, sendUnledgered, stat, triggers } from "../../../test/harness/player-table.ts";
import { begin, idsOf, type Scene, type Table } from "../../../test/harness/scene.ts";

const RING = "19093";
const GIMLI_CORE = "01004";
const BERAVOR = "01012";
const PLATE = "01040";
const GIMLI = "16001";
const LEGOLAS = "16002";
const ARAGORN = "01001";
const STARGAZER = "04106";
const SOLDIER = "19085";
const TREEBEARD = "08146";
const ENTMOOT = "143011";
const BOOMING = "08141";
const PIT = "06064";
const DENETHOR = "01010";
const SWORD = "22083";
const ELROND = "08032";
const FAVOR = "10124";
const WIGLAF = "19027";
const MINSTREL = "08063";
const DESCENDANTS = "10030";
const SMOKE_RINGS = "141010";
const PIPE = "141015";
const FATTY = "141005";
const SAM = "141002";
const CARD = "card";
const PAL = "pal";
const ALLY = "ally";
const WEAK = "f0";
// A Noble hero for Valiant Sword, and an enemy with no defense that no attack here destroys.
const NOBLE = "noble";
const SOFT = "soft";

let base: Awaited<ReturnType<typeof starterBase>>;

const table = (scene: Scene = {}, resources = 6): Table => playerTable(base, EFFECTS, scene, resources);
const exhaust = (tab: Table, ...codes: string[]): Table => ({ ...tab, state: codes.reduce((state, code) => updateCard(state, idsOf(tab, code), { exhausted: true }), tab.state) });
const playable = (tab: Table, state = tab.state): string[] => legalIntents(state, tab.ctx).flatMap((intent) => (intent.type === "PlayCard" ? [intent.cardId] : []));

beforeAll(async () => {
  const starter = await starterBase();
  base = { ...starter, cards: new Map([...starter.cards, ...(await loadPrinted([RING, GIMLI_CORE, BERAVOR, PLATE, GIMLI, LEGOLAS, ARAGORN, STARGAZER, SOLDIER, TREEBEARD, ENTMOOT, BOOMING, PIT, DENETHOR, SWORD, ELROND, FAVOR, WIGLAF, MINSTREL, DESCENDANTS, SMOKE_RINGS, PIPE, FATTY, SAM]))]) };
  base.cards.set(NOBLE, definePrinted({ code: NOBLE, name: "Noble", type: "hero", sphere: "leadership", threat: 9, willpower: 1, attack: 1, defense: 1, health: 3, traits: ["Noble"] }));
  base.cards.set(SOFT, definePrinted({ code: SOFT, name: "Soft", type: "enemy", threat: 1, engagementCost: 50, attack: 1, defense: 0, health: 9 }));
});

describe("Ring of Thrór 19093:A:3 on a ready hero", () => {
  // "Exhaust Thrór's Ring and discard the top card of your deck to ready attached hero. If the discarded card is an attachment, put it into play."
  // The effect the cost does not decide is the ready: on a ready hero it changes nothing, so the Action is not offered, whatever the top card is
  // (rr.triggered-ability, rr.cost; AEP 3.253).
  const ringed = (top: string) => table({ heroes: [{ code: GIMLI_CORE, seat: 0 }, { code: BERAVOR, seat: 0 }], attached: [{ code: RING, host: GIMLI_CORE }], playerDeck: [{ code: top, seat: 0 }, { code: CARD, seat: 0 }] });

  it("is not offered while the hero is ready, with an attachment on top of the deck", () => {
    expect(triggers(ringed(PLATE).state, ringed(PLATE))).not.toContain("19093:action:1");
  });

  it("is offered once the hero is exhausted", () => {
    const tab = ringed(PLATE);
    expect(triggers(exhaust(tab, GIMLI_CORE).state, tab)).toContain("19093:action:1");
  });
});

describe("Gimli 16001:A:2 and Legolas 16002:A:2 with every other hero ready", () => {
  // Gimli defends (so he is exhausted); the other heroes are ready.
  function defended(heroes: readonly string[]): { tab: Table; offered: boolean } {
    const scene = table({ heroes: heroes.map((code) => ({ code, seat: 0 })), engaged: [{ code: WEAK, seat: 0 }] });
    const tab = scene;
    const run = passAll(combat(tab.state, tab), tab.ctx);
    const declared = sendUnledgered(run, { type: "DeclareDefender", defenderId: idsOf(tab, GIMLI) }, tab.ctx);
    return { tab, offered: triggers(declared.state, tab).includes("16001:response:1") };
  }

  it("Gimli: a ready Legolas may be chosen for the +1 Attack, which does not depend on the ready", () => {
    expect(defended([GIMLI, LEGOLAS, ARAGORN]).offered).toBe(true);
  });

  it("Gimli: with no Legolas and every other hero ready, the Response is not offered", () => {
    expect(defended([GIMLI, ARAGORN]).offered).toBe(false);
  });

  // Legolas commits to the quest (so he is exhausted); the other heroes are ready.
  function committed(heroes: readonly string[]): boolean {
    const tab = table({ start: "quest", heroes: heroes.map((code) => ({ code, seat: 0 })), hand: [{ code: CARD, seat: 0 }] });
    const run = sendUnledgered(begin(tab.state), { type: "Commit", cardIds: [idsOf(tab, LEGOLAS)] }, tab.ctx);
    return triggers(run.state, tab).includes("16002:response:1");
  }

  it("Legolas: a ready Gimli may be chosen for the +1 Willpower", () => {
    expect(committed([LEGOLAS, GIMLI, ARAGORN])).toBe(true);
  });

  it("Legolas: with no Gimli and every other hero ready, the Response is not offered", () => {
    expect(committed([LEGOLAS, ARAGORN])).toBe(false);
  });
});

describe("Imladris Stargazer 04106:A:1 and a player whose deck is empty", () => {
  // Seat 0's Stargazer; seat 0's deck holds `own` cards and seat 1's `other`.
  function gazing(own: number, other: number): Table {
    return table({ seats: 2, heroes: [{ code: BERAVOR, seat: 0 }, { code: PAL, seat: 1 }], allies: [{ code: STARGAZER, seat: 0 }], playerDeck: [...fillers(CARD, own, 0), ...fillers(CARD, other, 1)] });
  }

  it("cannot choose a player with an empty deck: with the other deck full only that player is offered", () => {
    const tab = gazing(0, 3);
    const stargazer = idsOf(tab, STARGAZER);
    const run = sendUnledgered(begin(tab.state), { type: "Trigger", cardId: stargazer, effectId: "04106:action:1" }, tab.ctx);
    // The only player left to choose is chosen: seat 1 looks at the top cards of its deck.
    expect(run.state.window).toMatchObject({ kind: "look", seat: 1 });
    const two = gazing(2, 3);
    const both = sendUnledgered(begin(two.state), { type: "Trigger", cardId: idsOf(two, STARGAZER), effectId: "04106:action:1" }, two.ctx);
    expect(choices(both.state, two)).toHaveLength(2);
  });

  it("is not offered when every deck is empty", () => {
    expect(triggers(gazing(0, 0).state, gazing(0, 0))).not.toContain("04106:action:1");
    expect(triggers(gazing(0, 2).state, gazing(0, 2))).toContain("04106:action:1");
  });
});

describe("Soldier of Erebor 19085:A:1 with fewer than 3 cards in the deck", () => {
  // "Discard the top 3 cards from your deck to ready Soldier of Erebor": the discard is a cost, paid in full or not at all (rr.cost, rr.effects).
  const soldier = (cards: number) => exhaust(table({ heroes: [{ code: PAL, seat: 0 }], allies: [{ code: SOLDIER, seat: 0 }], playerDeck: fillers(CARD, cards) }), SOLDIER);

  it("is offered with 3 cards and not with 2, 1 or none", () => {
    expect(triggers(soldier(3).state, soldier(3))).toContain("19085:action:1");
    for (const cards of [0, 1, 2]) expect(triggers(soldier(cards).state, soldier(cards))).not.toContain("19085:action:1");
  });
});

describe("Ithilien Pit 06064:A:3 on an enemy in the staging area", () => {
  // "Any character may choose attached enemy as the target of an attack.": the attached enemy lies in the staging area, engaged with no one, and the
  // player attacks it in the player attack window of the combat phase (AEP 3.084; community reading, docs/brief.md, Player card readings).
  it("may be attacked by any character, while another staging enemy may not", () => {
    const tab = table({ heroes: [{ code: DENETHOR, seat: 0 }], staging: [SOFT, SOFT, PIT] });
    const [soft, other] = tab.ids[SOFT] ?? [];
    const pitted = attach({ ...tab, state: updateCard(tab.state, idsOf(tab, PIT), { controller: 0, owner: 0 }) }, [[idsOf(tab, PIT), soft ?? ""]]);
    expect(pitted.state.cards[soft ?? ""]?.zone).toBe("staging");
    const state = attacking(pitted.state);
    expect(() => sendUnledgered(begin(state), { type: "DeclareAttackers", enemyId: other ?? "", attackerIds: [idsOf(tab, DENETHOR)] }, tab.ctx)).toThrow();
    const run = sendUnledgered(begin(state), { type: "DeclareAttackers", enemyId: soft ?? "", attackerIds: [idsOf(tab, DENETHOR)] }, tab.ctx);
    expect(run.state.cards[soft ?? ""]?.damage).toBe(1);
  });
});

describe("Valiant Sword 22083:A:2 on another player's hero", () => {
  // "Attached hero gets +1 Attack (+2 Attack if your threat is 40 or higher).": the first player plays it on the second player's Noble hero. The hero's
  // controller controls the Sword, and "your" is its controller (AEP 1.38, 3.297): the second player's threat counts, not the first player's.
  function sworded(secondThreat: number, firstThreat: number): number {
    const scene = table({ seats: 2, heroes: [{ code: PAL, seat: 0 }, { code: NOBLE, seat: 1 }], hand: [{ code: SWORD, seat: 0 }] });
    const tab = { ...scene, state: withThreat(withThreat(scene.state, 1, secondThreat), 0, firstThreat) };
    const noble = idsOf(tab, NOBLE);
    const run = play(begin(tab.state), tab, idsOf(tab, SWORD), noble);
    expect(run.state.cards[idsOf(tab, SWORD)]).toMatchObject({ host: noble, controller: 1 });
    return stat(run.state, tab, noble, "attack") - printed(tab, NOBLE);
  }
  const printed = (tab: Table, code: string): number => tab.ctx.cards.get(code)?.attack ?? 0;

  it("gives +2 when the hero's controller has 40 threat, whatever the first player's threat", () => {
    expect(sworded(45, 10)).toBe(2);
  });

  it("gives +1 when the hero's controller has less than 40 threat, though the first player has 45", () => {
    expect(sworded(10, 45)).toBe(1);
  });
});

describe("Message from Elrond 08032:A:1", () => {
  // "Choose a player. That player may choose 1 card from his hand and add it to another player's hand.": the chosen player gives a card of their own
  // hand, and the player who played the event may choose themself (recommended reading, docs/brief.md, Player card readings).
  it("lets the first player choose themself, who then gives a card of their own hand to the other player", () => {
    const tab = table({ seats: 2, heroes: [{ code: BERAVOR, seat: 0 }, { code: PAL, seat: 1 }], hand: [{ code: ELROND, seat: 0 }, { code: ALLY, seat: 0 }, { code: CARD, seat: 1 }], playerDeck: [...fillers(CARD, 3, 0), ...fillers(CARD, 3, 1)] });
    const own = idsOf(tab, ALLY);
    let run = play(begin(tab.state), tab, idsOf(tab, ELROND));
    expect(choices(run.state, tab)).toContain("seat:0");
    run = sendUnledgered(run, { type: "Choose", optionId: "seat:0" }, tab.ctx);
    expect(choices(run.state, tab)).toContain(own);
    run = sendUnledgered(run, { type: "Choose", optionId: own }, tab.ctx);
    expect(run.state.seats[1]?.hand).toContain(own);
    expect(run.state.seats[0]?.hand).not.toContain(own);
  });
});

describe("Favor of the Valar 10124:A:1 on another player's threat dial", () => {
  // "Forced: When you would be eliminated by reaching your threat elimination level, instead discard Favor of the Valar and reduce your threat to 5 less
  // than your threat elimination level.": the first player plays it on the second player's dial. The dial is in that player's play area, so its
  // controller is that player and it saves that player, not the first (AEP 1.38, 3.297; agent recommendation).
  it("saves the player whose dial holds it, and not the player who played it", () => {
    const scene = table({ seats: 2, heroes: [{ code: PAL, seat: 0 }, { code: NOBLE, seat: 1 }], hand: [{ code: FAVOR, seat: 0 }] });
    const favor = idsOf(scene, FAVOR);
    const played = play(begin(scene.state), scene, favor, "seat:1");
    expect(played.state.cards[favor]).toMatchObject({ zone: "play", controller: 1 });
    const raised = (seat: number) => {
      const steps: EngineStep[] = [];
      const state = raiseThreat(withThreat(played.state, seat, 45), seat, 5, steps, ruleCause("rr.threat-elimination-level"));
      return settle(state, scene.ctx, steps);
    };
    const saved = raised(1);
    expect(saved.seats[1]?.eliminated).toBe(false);
    expect(saved.seats[1]?.threat).toBe(45);
    expect(saved.cards[favor]?.zone).toBe("discard");
    expect(raised(0).seats[0]?.eliminated).toBe(true);
  });
});

describe("Galadhrim Minstrel 08063:A:1 when the top five hold no event", () => {
  // The search finds what it finds, and the deck is shuffled after it with or without a card found (AEP 1.21).
  it("still shuffles the deck", () => {
    const tab = table({ heroes: [{ code: BERAVOR, seat: 0 }], hand: [{ code: MINSTREL, seat: 0 }], playerDeck: fillers(ALLY, 7) });
    const order = [...(tab.state.seats[0]?.deck ?? [])];
    let run = play(begin(tab.state), tab, idsOf(tab, MINSTREL));
    run = sendUnledgered(run, { type: "Trigger", cardId: idsOf(tab, MINSTREL), effectId: "08063:response:1" }, tab.ctx);
    const left = run.state.seats[0]?.deck ?? [];
    expect([...left].sort()).toEqual([...order].sort());
    expect(left).not.toEqual(order);
  });
});

describe("Descendants of Kings 10030:A:1 prints no timing word", () => {
  // It is played as an action in any action window: the planning phase, the quest phase and the combat phase (recommended reading, docs/brief.md,
  // Player card readings; data/printed holds no ledger for this pack).
  const hand = (start: "planning" | "quest"): Table => table({ start, heroes: [{ code: ARAGORN, seat: 0 }], hand: [{ code: DESCENDANTS, seat: 0 }], engaged: [{ code: SOFT, seat: 0 }] });
  const offered = (tab: Table, state = tab.state): boolean => playable(tab, state).includes(idsOf(tab, DESCENDANTS));

  it("is offered in the planning and quest windows, once a Dúnedain character is exhausted", () => {
    for (const start of ["planning", "quest"] as const) {
      const tab = hand(start);
      expect(offered(tab, updateCard(tab.state, idsOf(tab, ARAGORN), { exhausted: true }))).toBe(true);
    }
  });

  it("is offered in the combat action window", () => {
    const tab = hand("planning");
    const state = updateCard(tab.state, idsOf(tab, ARAGORN), { exhausted: true });
    expect(offered(tab, combat(state, tab).state)).toBe(true);
  });
});

describe("Hobbit Pipe 141015:A:1 and Smoke Rings 141010:A:1", () => {
  // "Reduce your threat by 1 for each Pipe you control. Each hero with a Pipe attachment gets +1 Willpower until the end of the phase." The Pipe's Response
  // follows the threat reduction at once, before the Willpower sentence resolves (AEP 3.296, rr.response; recommended reading): the window opens with the
  // threat lowered and the Willpower unchanged, and the outcome is the same when it is passed.
  it("opens the Pipe's Response after the threat drops and before the Willpower bonus", () => {
    const scene = table({ heroes: [{ code: FATTY, seat: 0 }, { code: SAM, seat: 0 }], allies: [{ code: PIPE, seat: 0 }], hand: [{ code: SMOKE_RINGS, seat: 0 }], playerDeck: fillers(CARD, 2) });
    const tab = attach(scene, [[idsOf(scene, PIPE), idsOf(scene, FATTY)]]);
    const fatty = idsOf(tab, FATTY);
    const before = stat(tab.state, tab, fatty, "willpower");
    const run = playCode(tab, SMOKE_RINGS);
    expect(run.state.window?.kind).toBe("response");
    expect(triggers(run.state, tab)).toContain("141015:response:1");
    expect(run.state.seats[0]?.threat).toBe((tab.state.seats[0]?.threat ?? 0) - 1);
    expect(stat(run.state, tab, fatty, "willpower")).toBe(before);
    const done = passAll(run, tab.ctx, { responses: true });
    expect(stat(done.state, tab, fatty, "willpower")).toBe(before + 1);
    expect(enter(done.state, tab, "questCommit").state.seats[0]?.threat).toBe(done.state.seats[0]?.threat);
  });
});
