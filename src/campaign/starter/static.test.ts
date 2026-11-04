// Rules: rr.restricted, rr.modifiers, rr.resource-match, rr.destroy, rr.response (data/rules/entries.json).
// Phase 9 batch 1: static modifiers, attach rules and Restricted on the starter attachments and allies.
import { beforeAll, describe, expect, it } from "vitest";

import { modifiedStat, placeDamage } from "../../rules/core/keywords.ts";
import { legalIntents } from "../../rules/engine/reduce.ts";
import { hasTrait } from "../../rules/interpret/conditions.ts";
import { ruleCause } from "../../rules/core/cause.ts";
import { updateCard } from "../../rules/core/state.ts";
import { ARAGORN, CHEAP, DEAR, refusal, starterBase } from "../../../test/scenarios/a-shadow-of-the-past/starter-scene.ts";
import { begin, buildTable, idsOf, send, type Scene, type Table } from "../../../test/harness/scene.ts";

const SAM = "141002";
const MERRY = "141003";
const PIPPIN = "141004";
const BILL = "141006";
const CLOAK = "141013";
const DAGGER = "141014";
const STEWARD = "01026";
const STONE = "01027";
const HORN = "01042";
const FELLOWSHIP = "142010";
const BOROMIR = "142004";
const EOWYN = "01007";

let base: Awaited<ReturnType<typeof starterBase>>;

beforeAll(async () => {
  base = await starterBase();
});

function table(scene: Scene): Table {
  return buildTable(base, { ring: "none", start: "planning", ...scene });
}

function stat(table: Table, id: string, name: "willpower" | "attack" | "defense" | "hitPoints" | "engagementCost", against?: string): number {
  const instance = table.state.cards[id];
  if (!instance) throw new Error(`no card ${id}`);
  return modifiedStat(table.state, instance, name, table.ctx.cards, against);
}

function give(tab: Table, id: string, resources: number): Table {
  return { ...tab, state: updateCard(tab.state, id, { resources }) };
}

describe("Attach to rules (constant AttachesTo records)", () => {
  it("Hobbit Cloak goes on a Hobbit hero, one per hero (141013:A:1)", () => {
    const tab = give(table({ heroes: [{ code: SAM, seat: 0 }, { code: "01001", seat: 0 }], hand: [{ code: CLOAK, seat: 0 }, { code: CLOAK, seat: 0 }] }), "i4", 0);
    const sam = idsOf(tab, SAM);
    const aragorn = idsOf(tab, ARAGORN);
    const [first, second] = tab.ids[CLOAK] ?? [];
    const withResources = give(tab, sam, 2);
    const play = (cardId: string, hostId: string) => ({ type: "PlayCard" as const, cardId, hostId, payments: [{ heroId: sam, amount: 1 }] });
    expect(refusal(withResources.state, play(first ?? "", aragorn), withResources.ctx)).toBe("That host is illegal");
    const run = send(begin(withResources.state), play(first ?? "", sam), withResources.ctx);
    expect(run.state.cards[sam]?.attachments).toEqual([first]);
    expect(refusal(run.state, play(second ?? "", sam), withResources.ctx)).toBe("That host is illegal");
  });

  it("Gandalf's Staff goes on Gandalf and nothing else (142008:A:1)", () => {
    const tab = table({ heroes: [{ code: SAM, seat: 0 }, { code: "142002", seat: 0 }], hand: [{ code: "142008", seat: 0 }] });
    const staff = idsOf(tab, "142008");
    const spend = { type: "PlayCard" as const, cardId: staff, payments: [] };
    expect(refusal(tab.state, { ...spend, hostId: idsOf(tab, SAM) }, tab.ctx)).toBe("That host is illegal");
  });

  it("Bill the Pony cannot have attachments (141006:A:1)", () => {
    const tab = table({ heroes: [{ code: SAM, seat: 0 }], allies: [{ code: BILL, seat: 0 }], hand: [{ code: CLOAK, seat: 0 }] });
    const sam = idsOf(tab, SAM);
    const withResources = give(tab, sam, 1);
    const reason = refusal(withResources.state, { type: "PlayCard", cardId: idsOf(tab, CLOAK), hostId: idsOf(tab, BILL), payments: [{ heroId: sam, amount: 1 }] }, tab.ctx);
    expect(reason).not.toBeNull();
  });
});

describe("Restricted (rr.restricted)", () => {
  it("a third restricted attachment makes its controller discard one of them to its owner's discard pile", () => {
    const tab = give(
      table({ heroes: [{ code: MERRY, seat: 0 }], attached: [{ code: DAGGER, host: MERRY }, { code: DAGGER, host: MERRY }, { code: STONE, host: MERRY }], hand: [{ code: HORN, seat: 0 }] }),
      "i4",
      0,
    );
    const merry = idsOf(tab, MERRY);
    expect(tab.state.cards[merry]?.attachments).toHaveLength(3);
    // The scene attaches without the rule; Horn is the fourth, so playing it makes the host hold four and one must go.
    const withResources = give(tab, merry, 1);
    let run = send(begin(withResources.state), { type: "PlayCard", cardId: idsOf(tab, HORN), hostId: merry, payments: [{ heroId: merry, amount: 1 }] }, tab.ctx);
    expect(run.state.window?.kind).toBe("choose");
    const options = legalIntents(run.state, tab.ctx).flatMap((intent) => (intent.type === "Choose" ? [intent.optionId] : []));
    expect(options.length).toBeGreaterThan(1);
    run = send(run, { type: "Choose", optionId: options[0] ?? "" }, tab.ctx);
    expect(run.state.cards[merry]?.attachments).toHaveLength(3);
    expect(run.state.seats[0]?.discard).toHaveLength(1);
    // The planning window comes back.
    expect(run.state.window).toEqual({ kind: "pass" });
  });

  it("two restricted attachments are fine", () => {
    const tab = give(table({ heroes: [{ code: MERRY, seat: 0 }], attached: [{ code: DAGGER, host: MERRY }], hand: [{ code: DAGGER, seat: 0 }] }), "i4", 0);
    const merry = idsOf(tab, MERRY);
    const withResources = give(tab, merry, 1);
    const run = send(begin(withResources.state), { type: "PlayCard", cardId: tab.ids[DAGGER]?.[1] ?? "", hostId: merry, payments: [{ heroId: merry, amount: 1 }] }, tab.ctx);
    expect(run.state.window).toEqual({ kind: "pass" });
    expect(run.state.cards[merry]?.attachments).toHaveLength(2);
  });
});

describe("static stat modifiers (141013:A:2, 141014:A:2, 01027:A:2, 142004:A:1, 142010:A:2)", () => {
  it("Hobbit Cloak: +2 Defense only while defending against an enemy that costs more than your threat", () => {
    const tab = table({ heroes: [{ code: SAM, seat: 0 }], attached: [{ code: CLOAK, host: SAM }], engaged: [{ code: DEAR, seat: 0 }, { code: CHEAP, seat: 0 }] });
    const sam = idsOf(tab, SAM);
    const synced = { ...tab, state: tab.state };
    const printed = tab.ctx.cards.get(SAM)?.defense ?? 0;
    expect(stat(synced, sam, "defense")).toBe(printed);
    const against = (enemy: string) => ({ ...tab.state, pendingAttack: { enemyId: idsOf(tab, enemy), seat: 0, defenderId: sam } });
    const sync = (state: typeof tab.state) => send(begin(state), { type: "Pass" }, tab.ctx).state;
    expect(stat({ ...tab, state: against(DEAR) }, sam, "defense")).toBe(printed);
    // Constants are brought up to date by the reducer, so ask the table after an intent.
    const settled = sync(tab.state);
    const dear = { ...settled, pendingAttack: { enemyId: idsOf(tab, DEAR), seat: 0, defenderId: sam } };
    const cheap = { ...settled, pendingAttack: { enemyId: idsOf(tab, CHEAP), seat: 0, defenderId: sam } };
    expect(stat({ ...tab, state: dear }, sam, "defense")).toBe(printed + 2);
    expect(stat({ ...tab, state: cheap }, sam, "defense")).toBe(printed);
  });

  it("Dagger of Westernesse: +1 Attack, +2 instead against an enemy that costs more than your threat (stacks per Dagger)", () => {
    const tab = table({ heroes: [{ code: MERRY, seat: 0 }], attached: [{ code: DAGGER, host: MERRY }, { code: DAGGER, host: MERRY }], engaged: [{ code: DEAR, seat: 0 }, { code: CHEAP, seat: 0 }] });
    const merry = idsOf(tab, MERRY);
    const settled = send(begin(tab.state), { type: "Pass" }, tab.ctx);
    const printed = tab.ctx.cards.get(MERRY)?.attack ?? 0;
    const onTable = { ...tab, state: settled.state };
    // Merry's own line adds +1 for the one Hobbit hero he controls.
    expect(stat(onTable, merry, "attack")).toBe(printed + 1 + 2);
    expect(stat(onTable, merry, "attack", idsOf(tab, CHEAP))).toBe(printed + 1 + 2);
    expect(stat(onTable, merry, "attack", idsOf(tab, DEAR))).toBe(printed + 1 + 4);
  });

  it("Celebrían's Stone: +2 Willpower for the host; Aragorn also pays with a Spirit icon", () => {
    const tab = give(table({ heroes: [{ code: ARAGORN, seat: 0 }], attached: [{ code: STONE, host: ARAGORN }], hand: [{ code: "01043", seat: 0 }] }), "i4", 0);
    const aragorn = idsOf(tab, ARAGORN);
    const settled = send(begin(give(tab, aragorn, 1).state), { type: "Pass" }, tab.ctx);
    const onTable = { ...tab, state: settled.state };
    expect(stat(onTable, aragorn, "willpower")).toBe((tab.ctx.cards.get(ARAGORN)?.willpower ?? 0) + 2);
    // Wandering Took is a Spirit ally of cost 2: Aragorn is a Leadership hero and pays it only through the Stone.
    const took = idsOf(tab, "01043");
    const withIcon = refusal(give(tab, aragorn, 2).state, { type: "PlayCard", cardId: took, payments: [{ heroId: aragorn, amount: 2 }] }, tab.ctx);
    expect(withIcon).toBeNull();
    const bare = table({ heroes: [{ code: ARAGORN, seat: 0 }], hand: [{ code: "01043", seat: 0 }] });
    const without = refusal(give(bare, idsOf(bare, ARAGORN), 2).state, { type: "PlayCard", cardId: idsOf(bare, "01043"), payments: [{ heroId: idsOf(bare, ARAGORN), amount: 2 }] }, bare.ctx);
    expect(without).toBe("No hero matches that card's sphere");
  });

  it("Boromir: +2 Defense only while defending against an enemy that costs more than your threat", () => {
    const tab = table({ heroes: [{ code: SAM, seat: 0 }], allies: [{ code: BOROMIR, seat: 0 }], engaged: [{ code: DEAR, seat: 0 }] });
    const boromir = idsOf(tab, BOROMIR);
    const settled = send(begin(tab.state), { type: "Pass" }, tab.ctx).state;
    const printed = tab.ctx.cards.get(BOROMIR)?.defense ?? 0;
    expect(stat({ ...tab, state: settled }, boromir, "defense")).toBe(printed);
    const defending = { ...settled, pendingAttack: { enemyId: idsOf(tab, DEAR), seat: 0, defenderId: boromir } };
    expect(stat({ ...tab, state: defending }, boromir, "defense")).toBe(printed + 2);
  });

  it("Fellowship of the Ring: each hero gets +1 Willpower; Forced: it is discarded after a character is destroyed", () => {
    const tab = table({ heroes: [{ code: SAM, seat: 0 }, { code: MERRY, seat: 0 }], attached: [{ code: FELLOWSHIP, host: SAM }], allies: [{ code: "01028", seat: 0 }] });
    const settled = send(begin(tab.state), { type: "Pass" }, tab.ctx).state;
    const onTable = { ...tab, state: settled };
    expect(stat(onTable, idsOf(tab, SAM), "willpower")).toBe((tab.ctx.cards.get(SAM)?.willpower ?? 0) + 1);
    expect(stat(onTable, idsOf(tab, MERRY), "willpower")).toBe((tab.ctx.cards.get(MERRY)?.willpower ?? 0) + 1);
    expect(stat(onTable, idsOf(tab, "01028"), "willpower")).toBe(tab.ctx.cards.get("01028")?.willpower ?? 0);
    // A hero or ally destroyed by damage announces itself; settle then resolves the Forced effect.
    const axehand = idsOf(tab, "01028");
    const steps: Parameters<typeof placeDamage>[4] = [];
    const hit = placeDamage(settled, axehand, 9, tab.ctx.cards, steps, "framework", ruleCause("rr.damage"));
    expect(hit.pendingEvents).toEqual([
      { trigger: "damageDealt", seat: 0, cardId: axehand, subject: axehand, amount: 9 },
      { trigger: "leftPlay", seat: 0, cardId: axehand },
      { trigger: "allyLeftPlay", seat: 0, subject: axehand },
      { trigger: "characterDestroyed", seat: 0, subject: axehand },
    ]);
    const after = send(begin(hit), { type: "Pass" }, tab.ctx).state;
    const fellowship = idsOf(tab, FELLOWSHIP);
    expect(after.cards[fellowship]?.zone).toBe("discard");
    expect(after.pendingEvents).toBeUndefined();
  });
});

describe("Bill the Pony (141006)", () => {
  it("costs 2 less with Sam Gamgee in play (141006:A:1) and gives each Hobbit character +1 hit point (141006:A:2)", () => {
    const withSam = table({ heroes: [{ code: SAM, seat: 0 }, { code: PIPPIN, seat: 0 }], hand: [{ code: BILL, seat: 0 }], allies: [] });
    const sam = idsOf(withSam, SAM);
    const bill = idsOf(withSam, BILL);
    const printedCost = withSam.ctx.cards.get(BILL)?.cost ?? 0;
    // Bill is a Leadership ally printed at cost 2: with Sam in play it is free.
    const cheap = give(withSam, sam, printedCost);
    expect(refusal(cheap.state, { type: "PlayCard", cardId: bill, payments: [{ heroId: sam, amount: printedCost - 2 }] }, cheap.ctx)).toBeNull();
    expect(refusal(cheap.state, { type: "PlayCard", cardId: bill, payments: [{ heroId: sam, amount: printedCost }] }, cheap.ctx)).toBe("Overpay");
    const alone = table({ heroes: [{ code: PIPPIN, seat: 0 }, { code: "01014", seat: 0 }], hand: [{ code: BILL, seat: 0 }] });
    const faramir = idsOf(alone, "01014");
    const full = give(alone, faramir, printedCost);
    expect(refusal(full.state, { type: "PlayCard", cardId: idsOf(alone, BILL), payments: [{ heroId: faramir, amount: printedCost }] }, full.ctx)).toBeNull();
    expect(refusal(full.state, { type: "PlayCard", cardId: idsOf(alone, BILL), payments: [{ heroId: faramir, amount: printedCost - 2 }] }, full.ctx)).toBe("Underpay");

    const played = send(begin(cheap.state), { type: "PlayCard", cardId: bill, payments: [{ heroId: sam, amount: printedCost - 2 }] }, cheap.ctx);
    const settled = send(played, { type: "Pass" }, cheap.ctx).state;
    const onTable = { ...cheap, state: settled };
    expect(stat(onTable, sam, "hitPoints")).toBe((cheap.ctx.cards.get(SAM)?.health ?? 0) + 1);
    expect(stat(onTable, idsOf(cheap, PIPPIN), "hitPoints")).toBe((cheap.ctx.cards.get(PIPPIN)?.health ?? 0) + 1);
    // Bill is a Pony, not a Hobbit.
    expect(stat(onTable, bill, "hitPoints")).toBe(cheap.ctx.cards.get(BILL)?.health ?? 0);
  });
});

describe("Merry, Pippin (141003:A:1, 141004:A:1)", () => {
  it("Merry gets +1 Attack and Pippin raises each enemy's engagement cost by 1 for each Hobbit hero you control", () => {
    const tab = table({ heroes: [{ code: MERRY, seat: 0 }, { code: PIPPIN, seat: 0 }, { code: SAM, seat: 0 }], engaged: [{ code: DEAR, seat: 0 }] });
    const settled = send(begin(tab.state), { type: "Pass" }, tab.ctx).state;
    const onTable = { ...tab, state: settled };
    expect(stat(onTable, idsOf(tab, MERRY), "attack")).toBe((tab.ctx.cards.get(MERRY)?.attack ?? 0) + 3);
    expect(stat(onTable, idsOf(tab, DEAR), "engagementCost")).toBe((tab.ctx.cards.get(DEAR)?.engagementCost ?? 0) + 3);
  });
});

describe("Steward of Gondor (01026:A:2)", () => {
  it("the attached hero gains the Gondor trait", () => {
    const tab = table({ heroes: [{ code: EOWYN, seat: 0 }], attached: [{ code: STEWARD, host: EOWYN }] });
    const eowyn = idsOf(tab, EOWYN);
    expect(hasTrait(tab.state, eowyn, "Gondor", tab.ctx)).toBe(true);
    expect(hasTrait(tab.state, eowyn, "Rohan", tab.ctx)).toBe(true);
    expect(hasTrait(tab.state, eowyn, "Hobbit", tab.ctx)).toBe(false);
  });
});

describe("Horn of Gondor (01042:A:2)", () => {
  it("Response: after a character is destroyed, add 1 resource to the attached hero's pool", () => {
    const tab = table({ heroes: [{ code: MERRY, seat: 0 }], attached: [{ code: HORN, host: MERRY }], allies: [{ code: "01028", seat: 0 }] });
    const axehand = idsOf(tab, "01028");
    const merry = idsOf(tab, MERRY);
    const horn = idsOf(tab, HORN);
    const hit = placeDamage(tab.state, axehand, 9, tab.ctx.cards, [], "framework", ruleCause("rr.damage"));
    let run = send(begin(hit), { type: "Pass" }, tab.ctx);
    expect(run.state.window).toEqual({ kind: "response", seat: 0 });
    expect(legalIntents(run.state, tab.ctx)).toContainEqual({ type: "Trigger", cardId: horn, effectId: "01042:response:1" });
    run = send(run, { type: "Trigger", cardId: horn, effectId: "01042:response:1" }, tab.ctx);
    expect(run.state.cards[merry]?.resources).toBe(1);
    expect(run.steps).toContainEqual(expect.objectContaining({ kind: "gainResource", heroId: merry }));
  });

  it("can be passed", () => {
    const tab = table({ heroes: [{ code: MERRY, seat: 0 }], attached: [{ code: HORN, host: MERRY }], allies: [{ code: "01028", seat: 0 }] });
    const hit = placeDamage(tab.state, idsOf(tab, "01028"), 9, tab.ctx.cards, [], "framework", ruleCause("rr.damage"));
    let run = send(begin(hit), { type: "Pass" }, tab.ctx);
    run = send(run, { type: "Pass" }, tab.ctx);
    expect(run.state.cards[idsOf(tab, MERRY)]?.resources).toBe(0);
    expect(run.state.stack).toEqual([]);
  });
});
