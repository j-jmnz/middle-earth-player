// Rules: rr.response, rr.cost, rr.damage, rr.engaged, rr.play-and-put-into-play, rr.unique-cards, rr.lasting-effects,
// rr.event-cards, mec109.immune-to-player-card-effects (data/rules/entries.json).
// The core-set Learn to Play Leadership deck (core-leadership), brought into scope on request (user request, 2026-10-26):
// Aragorn, Glóin, Son of Arnor, Longbeard Orc Slayer, Brok Ironfist and For Gondor!
import { beforeAll, describe, expect, it } from "vitest";

import { destroyCard, modifiedStat } from "../rules/core/keywords.ts";
import { settle } from "../rules/engine/machine.ts";
import { definePrinted } from "../rules/core/printed.ts";
import { legalIntents } from "../rules/engine/reduce.ts";
import { withMode, type ScenarioState } from "../rules/core/state.ts";
import { fund, payFor, starterBase } from "../../scripts/starter-scene.ts";
import { loadPrinted } from "../../scripts/test-catalog.ts";
import { begin, buildTable, idsOf, passWindows, send, type Run, type Scene, type Table } from "../../scripts/test-scene.ts";

const ARAGORN = "01001";
const THEODRED = "01002";
const GLOIN = "01003";
const ELEANOR = "01008";
const SON = "01015";
const SLAYER = "01018";
const BROK = "01019";
const FOR_GONDOR = "01022";
const SPEARMAN = "01029";
const ORC = "orc";
const GOBLIN = "goblin";
const BRUTE = "brute";

let base: Awaited<ReturnType<typeof starterBase>>;

beforeAll(async () => {
  const starter = await starterBase();
  const cards = new Map([...starter.cards, ...(await loadPrinted([GLOIN, ELEANOR, SON, SLAYER, BROK, FOR_GONDOR, SPEARMAN]))]);
  cards.set(ORC, definePrinted({ code: ORC, name: "Orc", type: "enemy", traits: ["Orc"], threat: 1, engagementCost: 40, attack: 2, defense: 1, health: 3 }));
  cards.set(GOBLIN, definePrinted({ code: GOBLIN, name: "Goblin", type: "enemy", traits: ["Goblin"], threat: 1, engagementCost: 40, attack: 2, defense: 1, health: 3 }));
  cards.set(BRUTE, definePrinted({ code: BRUTE, name: "Brute", type: "enemy", threat: 1, engagementCost: 40, attack: 9, defense: 1, health: 9 }));
  base = { ...starter, cards };
});

function table(scene: Scene = {}, resources = 6): Table {
  const tab = buildTable(base, { ring: "none", start: "planning", ...scene });
  let state = tab.state;
  for (let seat = 0; seat < (scene.seats ?? 1); seat += 1) state = fund(state, seat, resources);
  return { ...tab, state };
}

function offered(state: ScenarioState, tab: Table): string[] {
  return legalIntents(state, tab.ctx).flatMap((intent) => (intent.type === "Trigger" ? [intent.effectId] : []));
}

function play(tab: Table, code: string, run: Run = begin(tab.state)): Run {
  const card = idsOf(tab, code);
  return send(run, { type: "PlayCard", cardId: card, payments: payFor(run.state, tab.ctx, card) }, tab.ctx);
}

// The combat phase from its start: archery and the action windows pass, up to the first defense window.
function combat(state: ScenarioState, tab: Table): Run {
  return passWindows(begin(settle({ ...withMode(state, "combatStart"), window: null }, tab.ctx, [])), tab.ctx);
}

describe("Aragorn (01001:A:2; line 1 is Sentinel)", () => {
  it("after he commits to a quest, spends 1 resource from his own pool to ready him", () => {
    const tab = table({ start: "quest", heroes: [{ code: ARAGORN, seat: 0 }, { code: THEODRED, seat: 0 }] }, 1);
    const aragorn = idsOf(tab, ARAGORN);
    let run = send(begin(tab.state), { type: "Commit", cardIds: [aragorn] }, tab.ctx);
    expect(offered(run.state, tab)).toEqual(["01001:response:1"]);
    run = send(run, { type: "Trigger", cardId: aragorn, effectId: "01001:response:1", payments: [{ heroId: aragorn, amount: 1 }] }, tab.ctx);
    expect(run.state.cards[aragorn]?.exhausted).toBe(false);
    expect(run.state.cards[aragorn]?.committed).toBe(true);
    expect(run.state.cards[aragorn]?.resources).toBe(0);
    expect(run.state.cards[idsOf(tab, THEODRED)]?.resources).toBe(1);
  });

  it("is not offered when his own pool is empty, whatever the other heroes hold", () => {
    const tab = table({ start: "quest", heroes: [{ code: ARAGORN, seat: 0 }, { code: THEODRED, seat: 0 }] }, 0);
    const run = send(begin({ ...tab.state, cards: { ...tab.state.cards, [idsOf(tab, THEODRED)]: { ...tab.state.cards[idsOf(tab, THEODRED)]!, resources: 3 } } }), { type: "Commit", cardIds: [idsOf(tab, ARAGORN)] }, tab.ctx);
    expect(offered(run.state, tab)).toEqual([]);
  });
});

describe("Glóin (01003:A:1)", () => {
  it("adds 1 resource to his pool for each point of damage he just suffered", () => {
    const tab = table({ heroes: [{ code: GLOIN, seat: 0 }, { code: THEODRED, seat: 0 }], engaged: [{ code: ORC, seat: 0 }] }, 0);
    const gloin = idsOf(tab, GLOIN);
    let run = combat(tab.state, tab);
    expect(run.state.window?.kind).toBe("defense");
    run = passWindows(send(run, { type: "Undefended", heroId: gloin }, tab.ctx), tab.ctx);
    expect(run.state.cards[gloin]?.damage).toBe(2);
    expect(offered(run.state, tab)).toEqual(["01003:response:1"]);
    run = send(run, { type: "Trigger", cardId: gloin, effectId: "01003:response:1" }, tab.ctx);
    expect(run.state.cards[gloin]?.resources).toBe(2);
    expect(run.steps.filter((step) => step.kind === "gainResource" && step.heroId === gloin)).toHaveLength(2);
  });
});

describe("Son of Arnor (01015:A:1)", () => {
  it("engages an enemy in the staging area after he enters play", () => {
    const tab = table({ heroes: [{ code: ARAGORN, seat: 0 }], hand: [{ code: SON, seat: 0 }], staging: [ORC] });
    let run = play(tab, SON);
    expect(offered(run.state, tab)).toEqual(["01015:response:1"]);
    run = send(run, { type: "Trigger", cardId: idsOf(tab, SON), effectId: "01015:response:1" }, tab.ctx);
    expect(run.state.cards[idsOf(tab, ORC)]?.zone).toBe("engaged");
    expect(run.state.cards[idsOf(tab, ORC)]?.controller).toBe(0);
  });

  it("takes an enemy engaged with another player, never one already engaged with you", () => {
    const tab = table({ seats: 2, heroes: [{ code: ARAGORN, seat: 0 }, { code: THEODRED, seat: 1 }], hand: [{ code: SON, seat: 0 }], engaged: [{ code: ORC, seat: 1 }, { code: GOBLIN, seat: 0 }] });
    let run = play(tab, SON);
    run = send(run, { type: "Trigger", cardId: idsOf(tab, SON), effectId: "01015:response:1" }, tab.ctx);
    // The only enemy that is not yours is chosen without asking.
    expect(run.state.cards[idsOf(tab, ORC)]?.controller).toBe(0);
    expect(run.state.seats[1]?.engaged).toEqual([]);
    expect(run.state.cards[idsOf(tab, GOBLIN)]?.controller).toBe(0);
  });

  it("is not offered when no enemy is in the staging area or engaged with another player", () => {
    const tab = table({ heroes: [{ code: ARAGORN, seat: 0 }], hand: [{ code: SON, seat: 0 }], engaged: [{ code: GOBLIN, seat: 0 }] });
    const run = play(tab, SON);
    expect(offered(run.state, tab)).toEqual([]);
  });
});

describe("Longbeard Orc Slayer (01018:A:1)", () => {
  it("deals 1 damage to each Orc enemy in play, in the staging area and engaged, and to no other enemy", () => {
    const tab = table({ seats: 2, heroes: [{ code: ARAGORN, seat: 0 }, { code: THEODRED, seat: 1 }], hand: [{ code: SLAYER, seat: 0 }], staging: [ORC, GOBLIN], engaged: [{ code: ORC, seat: 1 }] });
    let run = play(tab, SLAYER);
    run = send(run, { type: "Trigger", cardId: idsOf(tab, SLAYER), effectId: "01018:response:1" }, tab.ctx);
    for (const id of tab.ids[ORC] ?? []) expect(run.state.cards[id]?.damage).toBe(1);
    expect(run.state.cards[idsOf(tab, GOBLIN)]?.damage).toBe(0);
  });
});

describe("Brok Ironfist (01019:A:1)", () => {
  const scene = (heroes: readonly string[]): Table => table({ heroes: heroes.map((code) => ({ code, seat: 0 })), hand: [{ code: BROK, seat: 0 }] }, 0);
  const lose = (tab: Table, code: string): Run => {
    const steps: Parameters<typeof settle>[2] = [];
    const state = settle(destroyCard(tab.state, idsOf(tab, code), tab.ctx.cards, steps), tab.ctx, steps);
    return { state, steps };
  };

  it("after a Dwarf hero you control leaves play, is put into play from your hand at no cost", () => {
    const tab = scene([GLOIN, ARAGORN]);
    let run = lose(tab, GLOIN);
    expect(run.state.window).toEqual({ kind: "response", seat: 0 });
    expect(offered(run.state, tab)).toEqual(["01019:response:1"]);
    run = send(run, { type: "Trigger", cardId: idsOf(tab, BROK), effectId: "01019:response:1" }, tab.ctx);
    expect(run.state.cards[idsOf(tab, BROK)]?.zone).toBe("play");
    expect(run.state.cards[idsOf(tab, ARAGORN)]?.resources).toBe(0);
  });

  it("is not offered when the hero is not a Dwarf", () => {
    const tab = scene([GLOIN, ARAGORN]);
    const run = lose(tab, ARAGORN);
    expect(offered(run.state, tab)).toEqual([]);
    expect(run.state.cards[idsOf(tab, BROK)]?.zone).toBe("hand");
  });

  it("is not offered while a Brok Ironfist is in play: it could not change the game state (rr.triggered-ability, rr.unique-cards)", () => {
    const tab = table({ heroes: [{ code: GLOIN, seat: 0 }, { code: ARAGORN, seat: 0 }], allies: [{ code: BROK, seat: 0 }], hand: [{ code: BROK, seat: 0 }] }, 0);
    const run = lose(tab, GLOIN);
    expect(offered(run.state, tab)).toEqual([]);
    expect((tab.ids[BROK] ?? []).map((id) => run.state.cards[id]?.zone).sort()).toEqual(["hand", "play"]);
  });
});

describe("For Gondor! (01022:A:1)", () => {
  it("gives each character in play +1 Attack and each Gondor character +1 Defense until the end of the phase", () => {
    const tab = table({ heroes: [{ code: ARAGORN, seat: 0 }, { code: ELEANOR, seat: 0 }], allies: [{ code: SPEARMAN, seat: 0 }], hand: [{ code: FOR_GONDOR, seat: 0 }] });
    const stat = (state: ScenarioState, code: string, which: "attack" | "defense"): number => modifiedStat(state, state.cards[idsOf(tab, code)]!, which, tab.ctx.cards);
    const run = play(tab, FOR_GONDOR);
    for (const code of [ARAGORN, ELEANOR, SPEARMAN]) expect(stat(run.state, code, "attack"), code).toBe(stat(tab.state, code, "attack") + 1);
    expect(stat(run.state, ARAGORN, "defense")).toBe(stat(tab.state, ARAGORN, "defense"));
    expect(stat(run.state, ELEANOR, "defense")).toBe(stat(tab.state, ELEANOR, "defense") + 1);
    expect(stat(run.state, SPEARMAN, "defense")).toBe(stat(tab.state, SPEARMAN, "defense") + 1);
    expect(run.state.cards[idsOf(tab, FOR_GONDOR)]?.zone).toBe("discard");
    const later = withMode(run.state, "questCommit");
    expect(stat(later, ARAGORN, "attack")).toBe(stat(tab.state, ARAGORN, "attack"));
  });
});
