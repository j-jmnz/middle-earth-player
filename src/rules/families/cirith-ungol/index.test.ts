import { describe, expect, it } from "vitest";

import type { Effect } from "../../../catalog/boundary.ts";
import { syncConstants } from "../../interpret/constants.ts";
import { runInstruction } from "../../interpret/interpret.ts";
import { holds } from "../../interpret/conditions.ts";
import { attachBlocked } from "../../interpret/restrictions.ts";
import { pickCandidates } from "../../interpret/pick.ts";
import { heroPays } from "../../player/payments.ts";
import { modifiedStat, placeDamage } from "../../core/keywords.ts";
import { definePrinted } from "../../core/printed.ts";
import { moveCard, spawn } from "../../core/zones.ts";
import { enemy, hero, table } from "../defense/table.ts";

// Rules: mec113.setup-the-tower-of-cirith-ungol, mec113.the-fellowship-sphere, rr.lasting-effects, rr.victory-display, rr.traits, faq.lasting-effects (data/rules/entries.json); ledger lines 146068:A:1, 146023:A:1, 146019:A:1, 146067:B:1, 146020:A:1, 146014:A:1.
// The Tower of Cirith Ungol's small pieces: a card back from the victory display as its other side, the Threat that follows an enemy's damage, the copy of a picked enemy, the boons a card may carry and the Fellowship sphere a hero is granted.

const focus = { seat: 0, sourceId: null };
const watchersLocation = definePrinted({ code: "watchers-l", name: "The Two Watchers", type: "location", traits: ["Mordor"], isUnique: true });
const watchersEnemy = definePrinted({ code: "watchers-e", name: "The Two Watchers", type: "enemy", traits: ["Mordor"], isUnique: true, attack: 5, defense: 2, health: 4, threat: 2, engagementCost: 50 });
const orc = (code: string, extra = {}) => enemy(code, { name: "Orc of Mordor", traits: ["Orc"], ...extra } as never);

describe("ReturnFromVictory (146068:A:1)", () => {
  function inVictory() {
    const base = table({ cards: [hero("a"), watchersLocation, watchersEnemy], effects: [], heroes: [{ code: "a" }] });
    const spawned = spawn(base.state, "watchers-e", { zone: "staging" });
    const defeated = moveCard(spawned.state, spawned.id, { zone: "victory" });
    return { ...base, state: { ...defeated, cards: { ...defeated.cards, [spawned.id]: { ...defeated.cards[spawned.id]!, damage: 4, exhausted: true } } }, id: spawned.id };
  }

  it("returns the card of the victory display to the staging area as its other side, faceup, ready and undamaged", () => {
    const { state, ctx, id } = inVictory();
    const next = runInstruction(state, { verb: "ReturnFromVictory", code: "watchers-e", into: "watchers-l" }, focus, ctx, []);
    const card = next.cards[id]!;
    expect([card.code, card.other, card.zone, card.face, card.damage, card.exhausted, card.controller]).toEqual(["watchers-l", "watchers-e", "staging", "up", 0, false, null]);
    expect(next.victory).not.toContain(id);
    expect(next.staging).toContain(id);
  });

  it("does nothing when the card is not in the victory display", () => {
    const base = table({ cards: [hero("a"), watchersLocation, watchersEnemy], effects: [], heroes: [{ code: "a" }], staging: [{ code: "watchers-e" }] });
    expect(runInstruction(base.state, { verb: "ReturnFromVictory", code: "watchers-e", into: "watchers-l" }, focus, base.ctx, [])).toBe(base.state);
  });
});

describe("threatPerDamage (146023:A:1)", () => {
  const howls = (code: string): Effect => ({ id: `${code}:whenRevealed:1`, cardCode: code, lines: [`${code}:A:1`], timing: "whenRevealed", instructions: [{ verb: "ModifyStat", stat: "threatPerDamage", amount: 1, until: "endOfPhase", target: "enemies" }] });

  it("adds Threat for each damage on an enemy, read live and for an enemy that arrives later", () => {
    const base = table({ cards: [hero("a"), orc("o1"), orc("o2"), definePrinted({ code: "howls", name: "Orcish Howls", type: "treachery" })], effects: [howls("howls")], heroes: [{ code: "a" }], staging: [{ code: "o1" }] });
    const source = spawn(base.state, "howls", { zone: "encounterDiscard" });
    const laid = runInstruction(source.state, { verb: "ModifyStat", stat: "threatPerDamage", amount: 1, until: "endOfPhase", target: "enemies" }, { seat: 0, sourceId: source.id }, base.ctx, []);
    const o1 = base.ids.o1!;
    expect(modifiedStat(laid, laid.cards[o1]!, "threat", base.ctx.cards)).toBe(1);
    const hit = placeDamage(laid, o1, 3, base.ctx.cards, [], "framework", { kind: "rule", ruleId: "test" } as never);
    expect(modifiedStat(hit, hit.cards[o1]!, "threat", base.ctx.cards)).toBe(4);
    const later = spawn(hit, "o2", { zone: "staging" });
    const harmed = placeDamage(later.state, later.id, 2, base.ctx.cards, [], "framework", { kind: "rule", ruleId: "test" } as never);
    expect(modifiedStat(harmed, harmed.cards[later.id]!, "threat", base.ctx.cards)).toBe(3);
  });

  it("changes no enemy's Threat when the flag is not held", () => {
    const base = table({ cards: [hero("a"), orc("o1")], effects: [], heroes: [{ code: "a" }], staging: [{ code: "o1" }] });
    const hit = placeDamage(base.state, base.ids.o1!, 3, base.ctx.cards, [], "framework", { kind: "rule", ruleId: "test" } as never);
    expect(modifiedStat(hit, hit.cards[base.ids.o1!]!, "threat", base.ctx.cards)).toBe(1);
  });
});

describe("sameTitleAs picked (146019:A:1, 146067:B:1)", () => {
  const copy = { type: "enemy", control: "any", stagingOnly: true, sameTitleAs: "picked" } as const;

  it("finds the copy of the last picked enemy in the staging area, never that card itself", () => {
    const base = table({ cards: [hero("a"), orc("o1"), orc("o2"), enemy("troll", { name: "Troll" } as never)], effects: [], heroes: [{ code: "a" }], staging: [{ code: "o1" }, { code: "troll" }] });
    const discarded = spawn(base.state, "o2", { zone: "encounterDiscard" });
    expect(pickCandidates(discarded.state, copy, 0, [discarded.id], null, base.ctx)).toEqual([base.ids.o1]);
    expect(pickCandidates(discarded.state, copy, 0, [base.ids.o1!], null, base.ctx)).toEqual([]);
    expect(pickCandidates(discarded.state, copy, 0, [base.ids.troll!], null, base.ctx)).toEqual([]);
  });

  it("holds as a condition while a copy is there", () => {
    const base = table({ cards: [hero("a"), orc("o1"), orc("o2")], effects: [], heroes: [{ code: "a" }], staging: [{ code: "o1" }] });
    const discarded = spawn(base.state, "o2", { zone: "encounterDiscard" });
    expect(holds(discarded.state, { kind: "canPick", pick: copy }, { actor: 0, sourceId: null, returned: 0, picked: [discarded.id] }, base.ctx)).toBe(true);
    expect(holds(base.state, { kind: "canPick", pick: copy }, { actor: 0, sourceId: null, returned: 0, picked: [] }, base.ctx)).toBe(false);
  });
});

describe("Restrict attach exceptBoon (146020:A:1)", () => {
  const boon = definePrinted({ code: "sting", name: "Sting", type: "attachment", traits: ["Item"], campaignKind: "boon" });
  const gift = definePrinted({ code: "gift", name: "Gift", type: "attachment", traits: ["Item"] });
  const shagrat: Effect = { id: "shagrat:constant:1", cardCode: "shagrat", lines: ["shagrat:A:1"], timing: "constant", instructions: [{ verb: "Restrict", what: "attach", exceptBoon: true }] };

  it("lets a boon attach and bars every other attachment", () => {
    const base = table({ cards: [hero("a"), enemy("shagrat"), boon, gift], effects: [shagrat], heroes: [{ code: "a" }], staging: [{ code: "shagrat" }] });
    const state = syncConstants(base.state, base.ctx);
    expect(attachBlocked(state, base.ctx, base.ids.shagrat!, "sting")).toBe(false);
    expect(attachBlocked(state, base.ctx, base.ids.shagrat!, "gift")).toBe(true);
  });
});

describe("GrantIcon fellowship (146014:A:1)", () => {
  const company: Effect = { id: "company:constant:1", cardCode: "company", lines: ["company:A:1"], timing: "constant", instructions: [{ verb: "GrantIcon", sphere: "fellowship" }] };

  it("lets the attached hero pay for Fellowship cards", () => {
    const base = table({
      cards: [hero("sam", { sphere: "lore" }), definePrinted({ code: "company", name: "Last of the Company", type: "objective" })],
      effects: [company],
      heroes: [{ code: "sam" }],
      attachments: [{ code: "company", host: "sam" }],
    });
    expect(heroPays(base.state, base.ids.sam!, "fellowship", base.ctx)).toBe(true);
    const bare = table({ cards: [hero("sam", { sphere: "lore" })], effects: [company], heroes: [{ code: "sam" }] });
    expect(heroPays(bare.state, bare.ids.sam!, "fellowship", bare.ctx)).toBe(false);
  });
});
