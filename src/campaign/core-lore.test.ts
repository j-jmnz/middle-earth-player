// Rules: rr.action, rr.response, rr.limits, rr.cost, rr.damage, rr.staging-area, rr.the-letter-x, rr.search, rr.attachment-cards,
// rr.shadow-effects, rr.step-6-2, rr.drawing-cards (data/rules/entries.json).
// The core-set Learn to Play Lore deck (core-lore), brought into scope on request (user request, 2026-10-26): Denethor,
// Glorfindel, Beravor, Daughter of the Nimrodel, Miner of the Iron Hills, Lore of Imladris, Lórien's Wealth, Radagast's Cunning,
// Secret Paths, Gandalf's Search, Beorn's Hospitality, Forest Snare, Protector of Lórien, Dark Knowledge and Self Preservation.
import { beforeAll, describe, expect, it } from "vitest";

import { attackBarred, syncConstants } from "../rules/constants.ts";
import { modifiedStat } from "../rules/keywords.ts";
import { pushEffectFrame } from "../rules/effect-frames.ts";
import { settle } from "../rules/machine.ts";
import { stagingThreat } from "../rules/quest.ts";
import { legalIntents } from "../rules/reduce.ts";
import { updateCard, withMode, type ScenarioState } from "../rules/state.ts";
import { attachTo, spawn } from "../rules/zones.ts";
import { fund, payFor, refusal, starterBase } from "../../scripts/starter-scene.ts";
import { loadPrinted } from "../../scripts/test-catalog.ts";
import { begin, buildTable, idsOf, send, type Run, type Scene, type Table } from "../../scripts/test-scene.ts";

const DENETHOR = "01010";
const GLORFINDEL = "01011";
const BERAVOR = "01012";
const DAUGHTER = "01058";
const MINER = "01061";
const IMLADRIS = "01063";
const WEALTH = "01064";
const RADAGAST = "01065";
const SECRET = "01066";
const SEARCH = "01067";
const HOSPITALITY = "01068";
const SNARE = "01069";
const PROTECTOR = "01070";
const DARK = "01071";
const PRESERVATION = "01072";
const FAVOR = "01055";
const BLACK_BREATH = "141055";
const LURE = "141076";
const BAMFURLONG = "141034";
const AXEHAND = "01028";
const GANDALF = "01073";

let base: Awaited<ReturnType<typeof starterBase>>;

beforeAll(async () => {
  const starter = await starterBase();
  const codes = [DENETHOR, GLORFINDEL, BERAVOR, DAUGHTER, MINER, IMLADRIS, WEALTH, RADAGAST, SECRET, SEARCH, HOSPITALITY, SNARE, PROTECTOR, DARK, PRESERVATION, FAVOR, BLACK_BREATH];
  base = { ...starter, cards: new Map([...starter.cards, ...(await loadPrinted(codes))]) };
});

function table(scene: Scene = {}, resources = 6): Table {
  const tab = buildTable(base, { ring: "none", start: "planning", ...scene });
  let state = tab.state;
  for (let seat = 0; seat < (scene.seats ?? 1); seat += 1) state = fund(state, seat, resources);
  return { ...tab, state: syncConstants(state, tab.ctx) };
}

function offered(state: ScenarioState, tab: Table): string[] {
  return legalIntents(state, tab.ctx).flatMap((intent) => (intent.type === "Trigger" ? [intent.effectId] : []));
}

function choices(run: Run, tab: Table): string[] {
  return legalIntents(run.state, tab.ctx).flatMap((intent) => (intent.type === "Choose" ? [intent.optionId] : []));
}

function play(tab: Table, code: string, run: Run = begin(tab.state), hostId?: string): Run {
  const card = idsOf(tab, code);
  return send(run, { type: "PlayCard", cardId: card, payments: payFor(run.state, tab.ctx, card), ...(hostId ? { hostId } : {}) }, tab.ctx);
}

const hurt = (tab: Table, damage: Record<string, number>): Table => ({
  ...tab,
  state: Object.entries(damage).reduce((state, [code, amount]) => updateCard(state, idsOf(tab, code), { damage: amount }), tab.state),
});

describe("Denethor (01010:A:1)", () => {
  it("exhausts to look at the top card of the encounter deck, and may move it to the bottom", () => {
    const tab = table({ heroes: [{ code: DENETHOR, seat: 0 }], deck: [LURE, "f0"] });
    const denethor = idsOf(tab, DENETHOR);
    let run = send(begin(tab.state), { type: "Trigger", cardId: denethor, effectId: "01010:action:1" }, tab.ctx);
    expect(run.state.window).toEqual({ kind: "look", seat: 0, cardIds: [idsOf(tab, LURE)] });
    run = send(run, { type: "Pass" }, tab.ctx);
    expect(choices(run, tab)).toEqual(["bottom", "leave"]);
    run = send(run, { type: "Choose", optionId: "bottom" }, tab.ctx);
    expect(run.state.encounterDeck).toEqual([idsOf(tab, "f0"), idsOf(tab, LURE)]);
    expect(run.state.cards[denethor]?.exhausted).toBe(true);
  });
});

describe("Glorfindel (01011:A:1)", () => {
  it("pays 1 resource from his own pool to heal 1 damage on any character, once a round", () => {
    const tab = hurt(table({ heroes: [{ code: GLORFINDEL, seat: 0 }, { code: DENETHOR, seat: 0 }] }, 2), { [DENETHOR]: 2 });
    const glorfindel = idsOf(tab, GLORFINDEL);
    const effect = { type: "Trigger" as const, cardId: glorfindel, effectId: "01011:action:1", payments: [{ heroId: glorfindel, amount: 1 }] };
    const run = send(begin(tab.state), effect, tab.ctx);
    expect(run.state.cards[idsOf(tab, DENETHOR)]?.damage).toBe(1);
    expect(run.state.cards[glorfindel]?.resources).toBe(1);
    expect(run.state.cards[idsOf(tab, DENETHOR)]?.resources).toBe(2);
    expect(refusal(run.state, effect, tab.ctx)).toBe("That effect has already been used");
  });

  it("is not offered when no character is damaged, or his own pool is empty", () => {
    const tab = table({ heroes: [{ code: GLORFINDEL, seat: 0 }, { code: DENETHOR, seat: 0 }] }, 2);
    expect(offered(tab.state, tab)).not.toContain("01011:action:1");
    const empty = hurt(table({ heroes: [{ code: GLORFINDEL, seat: 0 }, { code: DENETHOR, seat: 0 }] }, 0), { [DENETHOR]: 2 });
    expect(offered(empty.state, empty)).not.toContain("01011:action:1");
  });
});

describe("Beravor (01012:A:1), from a template", () => {
  it("exhausts to have the chosen player draw 2 cards, once a round", () => {
    const tab = table({ heroes: [{ code: BERAVOR, seat: 0 }], playerDeck: [{ code: AXEHAND, seat: 0 }, { code: AXEHAND, seat: 0 }, { code: AXEHAND, seat: 0 }] });
    const beravor = idsOf(tab, BERAVOR);
    const effect = { type: "Trigger" as const, cardId: beravor, effectId: "01012:action:1" };
    const run = send(begin(tab.state), effect, tab.ctx);
    expect(run.state.seats[0]?.hand).toHaveLength(2);
    expect(refusal(updateCard(run.state, beravor, { exhausted: false }), effect, tab.ctx)).toBe("That effect has already been used");
  });
});

describe("Daughter of the Nimrodel (01058:A:1), Lore of Imladris (01063:A:1), Beorn's Hospitality (01068:A:1)", () => {
  it("Daughter of the Nimrodel exhausts to heal up to 2 damage on a hero", () => {
    const tab = hurt(table({ heroes: [{ code: GLORFINDEL, seat: 0 }], allies: [{ code: DAUGHTER, seat: 0 }] }), { [GLORFINDEL]: 3 });
    const run = send(begin(tab.state), { type: "Trigger", cardId: idsOf(tab, DAUGHTER), effectId: "01058:action:1" }, tab.ctx);
    expect(run.state.cards[idsOf(tab, GLORFINDEL)]?.damage).toBe(1);
    expect(run.state.cards[idsOf(tab, DAUGHTER)]?.exhausted).toBe(true);
    expect(run.steps.some((step) => step.kind === "damage" && step.amount === -2)).toBe(true);
  });

  it("Lore of Imladris heals all damage from a character, and needs a damaged one", () => {
    const tab = hurt(table({ heroes: [{ code: DENETHOR, seat: 0 }], hand: [{ code: IMLADRIS, seat: 0 }] }), { [DENETHOR]: 2 });
    const run = play(tab, IMLADRIS);
    expect(run.state.cards[idsOf(tab, DENETHOR)]?.damage).toBe(0);
    const whole = table({ heroes: [{ code: DENETHOR, seat: 0 }], hand: [{ code: IMLADRIS, seat: 0 }] });
    expect(refusal(whole.state, { type: "PlayCard", cardId: idsOf(whole, IMLADRIS), payments: payFor(whole.state, whole.ctx, idsOf(whole, IMLADRIS)) }, whole.ctx)).toBe("That card has no legal target");
  });

  it("Beorn's Hospitality heals all damage on each hero of the chosen player", () => {
    const tab = hurt(table({ heroes: [{ code: DENETHOR, seat: 0 }, { code: GLORFINDEL, seat: 0 }], hand: [{ code: HOSPITALITY, seat: 0 }] }), { [DENETHOR]: 2, [GLORFINDEL]: 4 });
    const run = play(tab, HOSPITALITY);
    expect(run.state.cards[idsOf(tab, DENETHOR)]?.damage).toBe(0);
    expect(run.state.cards[idsOf(tab, GLORFINDEL)]?.damage).toBe(0);
  });
});

describe("Miner of the Iron Hills (01061:A:1)", () => {
  it("discards a Condition attachment from play, an encounter card that counts as one included (141055:A:2)", () => {
    const tab = table({ heroes: [{ code: DENETHOR, seat: 0 }, { code: GLORFINDEL, seat: 0 }], attached: [{ code: FAVOR, host: GLORFINDEL }], hand: [{ code: MINER, seat: 0 }] });
    const breath = spawn(tab.state, BLACK_BREATH, { zone: "attached" });
    const state = syncConstants(attachTo(breath.state, breath.id, idsOf(tab, DENETHOR)), tab.ctx);
    expect(modifiedStat(state, state.cards[idsOf(tab, DENETHOR)]!, "defense", tab.ctx.cards)).toBe(0);
    let run = play({ ...tab, state }, MINER, begin(state));
    expect(offered(run.state, tab)).toEqual(["01061:response:1"]);
    run = send(run, { type: "Trigger", cardId: idsOf(tab, MINER), effectId: "01061:response:1" }, tab.ctx);
    expect(choices(run, tab).sort()).toEqual([breath.id, idsOf(tab, FAVOR)].sort());
    run = send(run, { type: "Choose", optionId: breath.id }, tab.ctx);
    expect(run.state.cards[breath.id]?.zone).toBe("encounterDiscard");
    expect(modifiedStat(syncConstants(run.state, tab.ctx), run.state.cards[idsOf(tab, DENETHOR)]!, "defense", tab.ctx.cards)).toBe(3);
  });

  it("is not offered with no Condition attachment in play", () => {
    const tab = table({ heroes: [{ code: DENETHOR, seat: 0 }], hand: [{ code: MINER, seat: 0 }] });
    expect(offered(play(tab, MINER).state, tab)).not.toContain("01061:response:1");
  });
});

describe("Lórien's Wealth (01064:A:1), from a template", () => {
  it("the chosen player draws 3 cards", () => {
    const tab = table({ heroes: [{ code: DENETHOR, seat: 0 }], hand: [{ code: WEALTH, seat: 0 }], playerDeck: [{ code: AXEHAND, seat: 0 }, { code: AXEHAND, seat: 0 }, { code: AXEHAND, seat: 0 }, { code: AXEHAND, seat: 0 }] });
    const run = play(tab, WEALTH);
    expect(run.state.seats[0]?.hand).toHaveLength(3);
  });
});

describe("Radagast's Cunning (01065:A:1) and Secret Paths (01066:A:1)", () => {
  it("in the quest phase, the chosen card in the staging area contributes no threat until the end of the phase", () => {
    const tab = table({ start: "quest", heroes: [{ code: DENETHOR, seat: 0 }], hand: [{ code: RADAGAST, seat: 0 }, { code: SECRET, seat: 0 }], staging: ["f3", BAMFURLONG] });
    expect(stagingThreat(tab.state, tab.ctx.cards)).toBe(5);
    let run = play(tab, RADAGAST);
    expect(stagingThreat(run.state, tab.ctx.cards)).toBe(2);
    run = play(tab, SECRET, run);
    expect(stagingThreat(run.state, tab.ctx.cards)).toBe(0);
    expect(stagingThreat(withMode(run.state, "travel"), tab.ctx.cards)).toBe(5);
  });

  it("are Quest Actions: not played in another phase", () => {
    const tab = table({ heroes: [{ code: DENETHOR, seat: 0 }], hand: [{ code: RADAGAST, seat: 0 }], staging: ["f3"] });
    expect(refusal(tab.state, { type: "PlayCard", cardId: idsOf(tab, RADAGAST), payments: payFor(tab.state, tab.ctx, idsOf(tab, RADAGAST)) }, tab.ctx)).toBe("That card cannot be played now");
  });
});

describe("Gandalf's Search (01067:A:1)", () => {
  it("looks at the top X cards of a player's deck, adds 1 to its owner's hand, and leaves the rest on top", () => {
    const tab = table({ heroes: [{ code: DENETHOR, seat: 0 }], hand: [{ code: SEARCH, seat: 0 }], playerDeck: [{ code: AXEHAND, seat: 0 }, { code: GANDALF, seat: 0 }, { code: WEALTH, seat: 0 }] });
    const search = idsOf(tab, SEARCH);
    let run = send(begin(tab.state), { type: "PlayCard", cardId: search, payments: [{ heroId: idsOf(tab, DENETHOR), amount: 2 }] }, tab.ctx);
    // X is 2: the Axehand and Gandalf are looked at, not Lórien's Wealth.
    expect(run.state.window).toEqual({ kind: "look", seat: 0, cardIds: [idsOf(tab, AXEHAND), idsOf(tab, GANDALF)] });
    run = send(run, { type: "Pass" }, tab.ctx);
    expect(choices(run, tab).sort()).toEqual([idsOf(tab, AXEHAND), idsOf(tab, GANDALF)].sort());
    run = send(run, { type: "Choose", optionId: idsOf(tab, GANDALF) }, tab.ctx);
    expect(run.state.seats[0]?.hand).toEqual([idsOf(tab, GANDALF)]);
    expect(run.state.seats[0]?.deck).toEqual([idsOf(tab, AXEHAND), idsOf(tab, WEALTH)]);
    expect(run.state.cards[search]?.zone).toBe("discard");
  });
});

describe("Forest Snare (01069), from the templates", () => {
  it("attaches to an enemy engaged with a player, which cannot attack", () => {
    const tab = table({ heroes: [{ code: DENETHOR, seat: 0 }], hand: [{ code: SNARE, seat: 0 }], engaged: [{ code: "f3", seat: 0 }], staging: ["f0"] });
    const enemy = idsOf(tab, "f3");
    const run = play(tab, SNARE, begin(tab.state), enemy);
    expect(run.state.cards[idsOf(tab, SNARE)]?.host).toBe(enemy);
    expect(attackBarred(syncConstants(run.state, tab.ctx), enemy, 0)).toBe(true);
    expect(refusal(tab.state, { type: "PlayCard", cardId: idsOf(tab, SNARE), payments: payFor(tab.state, tab.ctx, idsOf(tab, SNARE)), hostId: idsOf(tab, "f0") }, tab.ctx)).toBe("That host is illegal");
  });
});

describe("Protector of Lórien (01070:A:2)", () => {
  it("discards a card from the hand for +1 Defense or +1 Willpower, 3 times a phase", () => {
    const tab = table({ heroes: [{ code: DENETHOR, seat: 0 }], attached: [{ code: PROTECTOR, host: DENETHOR }], hand: [1, 2, 3, 4].map(() => ({ code: AXEHAND, seat: 0 })) });
    const protector = idsOf(tab, PROTECTOR);
    const denethor = idsOf(tab, DENETHOR);
    const effect = { type: "Trigger" as const, cardId: protector, effectId: "01070:action:1" };
    let run = begin(tab.state);
    for (const option of ["defense", "willpower", "defense"]) {
      run = send(run, effect, tab.ctx);
      expect(choices(run, tab)).toEqual(["defense", "willpower"]);
      run = send(run, { type: "Choose", optionId: option }, tab.ctx);
    }
    expect(modifiedStat(run.state, run.state.cards[denethor]!, "defense", tab.ctx.cards)).toBe(5);
    expect(modifiedStat(run.state, run.state.cards[denethor]!, "willpower", tab.ctx.cards)).toBe(2);
    expect(run.state.seats[0]?.hand).toHaveLength(1);
    expect(refusal(run.state, effect, tab.ctx)).toBe("That effect has already been used");
  });
});

describe("Dark Knowledge (01071)", () => {
  it("gives the attached hero -1 Willpower (a template)", () => {
    const tab = table({ heroes: [{ code: GLORFINDEL, seat: 0 }], attached: [{ code: DARK, host: GLORFINDEL }] });
    expect(modifiedStat(tab.state, tab.state.cards[idsOf(tab, GLORFINDEL)]!, "willpower", tab.ctx.cards)).toBe(2);
  });

  it("exhausts to look at a shadow card just dealt to an enemy attacking you (01071:A:2)", () => {
    const tab = table({ heroes: [{ code: GLORFINDEL, seat: 0 }], attached: [{ code: DARK, host: GLORFINDEL }], engaged: [{ code: "f3", seat: 0 }], deck: [LURE, "f0"] });
    let run = begin(settle({ ...withMode(tab.state, "combatStart"), window: null }, tab.ctx, []));
    expect(offered(run.state, tab)).toEqual(["01071:response:1"]);
    run = send(run, { type: "Trigger", cardId: idsOf(tab, DARK), effectId: "01071:response:1" }, tab.ctx);
    expect(run.state.window).toEqual({ kind: "look", seat: 0, cardIds: [idsOf(tab, LURE)] });
    expect(run.state.cards[idsOf(tab, DARK)]?.exhausted).toBe(true);
  });

  it("is offered for the shadow card of an attack outside the combat phase too (rr.attacks-outside-the-combat-phase)", () => {
    const tab = table({ heroes: [{ code: GLORFINDEL, seat: 0 }], attached: [{ code: DARK, host: GLORFINDEL }], engaged: [{ code: "f3", seat: 0 }], deck: [LURE, "f0"] });
    const enemy = idsOf(tab, "f3");
    const steps: Parameters<typeof settle>[2] = [];
    const attacked = pushEffectFrame({ ...tab.state, window: null }, { frame: "ResolveEffect", sourceId: enemy, actor: 0, peril: false, effectId: "test:immediate", instructions: [{ verb: "ImmediateAttack" }], cancel: null, blockCancel: null }, steps);
    let run = begin(settle(attacked, tab.ctx, steps));
    expect(run.state.pendingAttack).toMatchObject({ enemyId: enemy, immediate: true });
    expect(offered(run.state, tab)).toEqual(["01071:response:1"]);
    run = send(run, { type: "Trigger", cardId: idsOf(tab, DARK), effectId: "01071:response:1" }, tab.ctx);
    expect(run.state.window).toEqual({ kind: "look", seat: 0, cardIds: [idsOf(tab, LURE)] });
  });
});

describe("Self Preservation (01072:A:2)", () => {
  it("exhausts to heal 2 damage from the attached character, and is not offered while it has none", () => {
    const tab = table({ heroes: [{ code: DENETHOR, seat: 0 }], attached: [{ code: PRESERVATION, host: DENETHOR }] });
    expect(offered(tab.state, tab)).not.toContain("01072:action:1");
    const damaged = hurt(tab, { [DENETHOR]: 1 });
    const run = send(begin(damaged.state), { type: "Trigger", cardId: idsOf(tab, PRESERVATION), effectId: "01072:action:1" }, tab.ctx);
    expect(run.state.cards[idsOf(tab, DENETHOR)]?.damage).toBe(0);
    expect(run.state.cards[idsOf(tab, PRESERVATION)]?.exhausted).toBe(true);
  });
});
