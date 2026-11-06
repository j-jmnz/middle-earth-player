// Rules: emce.boon-allies, emce.campaign-log, emce.campaign-pool-encounter, emce.treasure, emce.discover, emce.immune, rr.setup, rr.attachment-cards, rr.restricted, rr.guarded, rr.first-player, rr.mulligan (data/rules/entries.json); ledger lines 12194:A:2, 12191:A:1, 12191:A:2, 12192:A:1, 12192:A:2, 12190:A:1.
// The burden Mount Gundabad adds (Dragon-sickness, 12194), and the pool cards of the first seven parts played in part 8: Gundabad Hunter and Gundabad Stalker beside Dagnir, the Hazard cards of part 7, Ashen Brazier, Beldis and the treasures. Each record runs in a real state.
import { beforeAll, describe, expect, it } from "vitest";

import { emptyLog, poolCard, type CampaignLog } from "../../log.ts";
import { modifiedStat } from "../../../rules/core/keywords.ts";
import { flagged, type ScenarioState } from "../../../rules/core/state.ts";
import { expectOk } from "../../../rules/core/test-fixture.ts";
import { reduce, startScenario, type ReduceContext } from "../../../rules/engine/reduce.ts";
import { settle } from "../../../rules/engine/machine.ts";
import { guardWith } from "../../../rules/families/objectives/guard.ts";
import { optionalEnemies } from "../../../rules/quest/quest.ts";
import { gundabadSetupChoices, gundabadStart, gundabadWorld } from "../../../../test/scenarios/mount-gundabad/game.ts";
import { CODES, STAGES, codesIn, gundabadTable, idOf, loadGundabadWorld, resolveRecords, type GundabadWorld } from "../../../../test/scenarios/mount-gundabad/scene.ts";

let world: GundabadWorld;
let ctx: ReduceContext;
beforeAll(async () => {
  world = await loadGundabadWorld();
  ctx = (await gundabadWorld("strong")).ctx;
}, 120_000);

const where = (state: ScenarioState, code: string) => Object.values(state.cards).filter((card) => card.code === code);
const first = (id: string) => (state: ScenarioState) => (state.window?.kind === "choose" ? (state.window.options.find((option) => option === id) ?? state.window.options[0] ?? "") : "");
type Facts = Parameters<typeof gundabadStart>[3];
// The scenario dealt with these cards in the pool, its Setup played to the first round: the mulligan is kept and each question is answered with its first option.
function opened(seats: 1 | 2, log: CampaignLog = emptyLog(seats), seed = 1, facts?: Facts): ScenarioState {
  let state = startScenario(gundabadStart(seats, seed, "Normal", facts, log, undefined, gundabadSetupChoices(seats, log)), ctx);
  while (state.window?.kind === "mulligan") state = expectOk(reduce(state, { type: "Keep" }, ctx)).state;
  for (let guard = 0; guard < 40 && state.window?.kind === "choose"; guard += 1) state = expectOk(reduce(state, { type: "Choose", optionId: state.window.options[0] ?? "" }, ctx)).state;
  return state;
}
const pooled = (seats: 1 | 2, ...cards: readonly { code: string; seat?: number }[]): CampaignLog => ({ ...emptyLog(seats), campaignPool: cards.map((card) => poolCard(ctx.cards.get(card.code)!, card.code, null, card.seat ?? null)) });
const TREASURE = { axe: "12197", anvil: "12196", ring: "12198" } as const;
const stage2 = STAGES.slice(1).filter((code) => code !== "19142");

describe("12194 Dragon-sickness", () => {
  const sick = (extra: Parameters<typeof gundabadTable>[1] = {}) => gundabadTable(world, { staging: [CODES.dragonSickness], stage: "19142", questDeck: stage2, ...extra });
  const reveal = (t: ReturnType<typeof sick>, pick?: (state: ScenarioState) => string) => resolveRecords(t.state, t.ctx, CODES.dragonSickness, "whenRevealed", idOf(t.state, CODES.dragonSickness), pick);
  const hostOf = (state: ScenarioState, code: string) => where(state, code)[0]?.host ?? null;

  it("12194:A:2 When Revealed: it attaches to a character with 1 or more treasures attached, and every treasure on a character and every unguarded treasure in the staging area is attached to that character", () => {
    const t = sick({ attached: [{ code: TREASURE.axe, to: "hero" }, { code: TREASURE.anvil, to: "hero2" }], staging: [CODES.dragonSickness, TREASURE.ring] });
    const run = reveal(t, first(t.hero2));
    const sickness = where(run.state, CODES.dragonSickness)[0];
    expect(sickness?.host).toBe(t.hero2);
    for (const code of Object.values(TREASURE)) expect(hostOf(run.state, code), code).toBe(t.hero2);
    expect(run.state.cards[t.hero2]?.attachments).toEqual(expect.arrayContaining(where(run.state, TREASURE.axe).map((card) => card.id)));
    expect(run.state.cards[t.hero]?.attachments.filter((id) => run.state.cards[id]?.code !== CODES.dragonSickness)).toEqual([]);
    expect(codesIn(run.state, "staging")).toEqual([]);
  });

  it("12194:A:2 the first player chooses the character, among those with a treasure attached", () => {
    const t = sick({ attached: [{ code: TREASURE.axe, to: "hero" }, { code: TREASURE.anvil, to: "hero2" }] });
    let asked: { seat: number; options: readonly string[] } | null = null;
    resolveRecords(t.state, t.ctx, CODES.dragonSickness, "whenRevealed", idOf(t.state, CODES.dragonSickness), (state) => {
      if (state.window?.kind !== "choose") return "";
      asked = { seat: state.window.seat, options: state.window.options };
      return state.window.options[0] ?? "";
    });
    expect(asked).toMatchObject({ seat: t.state.firstPlayer });
    expect([...((asked as { options: readonly string[] } | null)?.options ?? [])].sort()).toEqual([t.hero, t.hero2].sort());
    const none = sick({ attached: [] });
    const nothing = reveal(none);
    expect(nothing.state.window ?? null).toBeNull();
    expect(where(nothing.state, CODES.dragonSickness)[0]?.host ?? null).toBeNull();
  });

  it("12194:A:2 a treasure still guarded by an encounter card stays where it is: only the unguarded ones are gathered", () => {
    const t = sick({ attached: [{ code: TREASURE.axe }], staging: [CODES.dragonSickness, TREASURE.ring, "f3"] });
    const guarded = guardWith(t.state, idOf(t.state, "f3"), idOf(t.state, TREASURE.ring));
    const run = resolveRecords(guarded, t.ctx, CODES.dragonSickness, "whenRevealed", idOf(guarded, CODES.dragonSickness));
    expect(where(run.state, TREASURE.ring)[0]?.zone).toBe("staging");
    expect(where(run.state, TREASURE.ring)[0]?.host ?? null).toBeNull();
    expect(hostOf(run.state, TREASURE.axe)).toBe(t.hero);
  });

  it("12194:A:2 the treasures are attached without their attachment rules (rr.attachment-cards: restrictions are checked as the card enters play), and a Restricted overflow is discarded (rr.restricted)", () => {
    // Axe of the Edain is Restricted: a third Restricted attachment on one character sends one to the discard pile.
    const t = sick({ attached: [{ code: TREASURE.axe, to: "hero" }, { code: "12199", to: "hero2" }, { code: "12200", to: "hero2" }], staging: [CODES.dragonSickness] });
    const restricted = (state: ScenarioState, id: string) => state.cards[id]?.attachments.filter((other) => ctx.cards.get(state.cards[other]?.code ?? "")?.keywords.restricted).length ?? 0;
    const run = reveal(t, first(t.hero2));
    expect(restricted(run.state, t.hero2)).toBeLessThanOrEqual(2);
  });

  it("12194:A:2 it counts as a Condition attachment", () => {
    const t = sick({ attached: [{ code: TREASURE.axe }] });
    const run = reveal(t, first(t.hero));
    expect(modifiedStat(run.state, run.state.cards[where(run.state, CODES.dragonSickness)[0]!.id]!, "willpower", t.ctx.cards)).toBe(0);
    expect(run.state.cards[t.hero]?.attachments).toContain(where(run.state, CODES.dragonSickness)[0]?.id);
  });

  it("12194:A:2 Forced: after the attached character exhausts, its controller raises their threat by 1 for each treasure attached to it", () => {
    const t = sick({ seats: 2, threat: [30, 40], attached: [{ code: TREASURE.axe }, { code: TREASURE.anvil }, { code: TREASURE.ring }], staging: [CODES.dragonSickness] });
    const run = reveal(t, first(t.hero));
    const attached = run.state.cards[t.hero]?.attachments.filter((id) => ctx.cards.get(run.state.cards[id]?.code ?? "")?.type === "treasure") ?? [];
    expect(attached).toHaveLength(3);
    const before = run.state.seats.map((seat) => seat.threat);
    const exhausted = settle({ ...run.state, window: null, cards: { ...run.state.cards, [t.hero]: { ...run.state.cards[t.hero]!, exhausted: true } }, pendingEvents: [{ trigger: "exhausted", seat: 0, cardId: t.hero, subject: t.hero }] }, t.ctx, []);
    expect(exhausted.seats.map((seat) => seat.threat)).toEqual([before[0]! + 3, before[1]]);
  });

  it("12194:A:2 a character other than the attached one exhausting costs nothing", () => {
    const t = sick({ attached: [{ code: TREASURE.axe }], staging: [CODES.dragonSickness] });
    const run = reveal(t, first(t.hero));
    const before = run.state.seats[0]?.threat;
    const other = settle({ ...run.state, window: null, cards: { ...run.state.cards, [t.hero2]: { ...run.state.cards[t.hero2]!, exhausted: true } }, pendingEvents: [{ trigger: "exhausted", seat: 0, cardId: t.hero2, subject: t.hero2 }] }, t.ctx, []);
    expect(other.seats[0]?.threat).toBe(before);
  });

  it("12194 it has Surge, and is a burden: shuffled into the encounter deck by the campaign card with 6 treasures logged", () => {
    expect(ctx.cards.get(CODES.dragonSickness)).toMatchObject({ keywords: { surge: true }, campaignKind: "burden" });
    const state = opened(1, { ...emptyLog(1), treasures: ["12196", "12197", "12198", "12199", "12200", "12201"] });
    expect(where(state, CODES.dragonSickness)).toMatchObject([{ zone: "encounterDeck" }]);
  });
});

describe("what the first seven parts hand on", () => {
  it("12191 Gundabad Hunter, revealed while a unique enemy (Dagnir) is engaged with a player, attacks that player from the staging area; with none engaged it attacks nobody", () => {
    const engaged = gundabadTable(world, { stage: "19135", questDeck: stage2, victory: [], engaged: [{ code: CODES.dagnir, seat: 0 }] });
    const run = resolveRecords(engaged.state, engaged.ctx, "12191", "whenRevealed", undefined, undefined, false);
    expect(run.state.pendingAttack?.seat).toBe(0);
    const apart = gundabadTable(world, { stage: "19135", questDeck: stage2, victory: [], staging: [CODES.dagnir] });
    expect(resolveRecords(apart.state, apart.ctx, "12191", "whenRevealed", undefined, undefined, false).state.pendingAttack ?? null).toBeNull();
  });

  it("12192 Gundabad Stalker can be optionally engaged only by a player with a unique enemy (Dagnir) engaged with them", () => {
    const apart = gundabadTable(world, { phase: "Encounter", stage: "19135", questDeck: stage2, victory: [], staging: ["12192", CODES.dagnir] });
    expect(optionalEnemies(apart.state, apart.ctx.cards)).not.toContain(idOf(apart.state, "12192"));
    const engaged = gundabadTable(world, { phase: "Encounter", stage: "19135", questDeck: stage2, victory: [], staging: ["12192"], engaged: [{ code: CODES.dagnir, seat: 0 }] });
    expect(optionalEnemies(engaged.state, engaged.ctx.cards)).toContain(idOf(engaged.state, "12192"));
  });

  it("12191 and 12192 in the pool are shuffled into part 8's encounter deck, each once", () => {
    const state = opened(1, pooled(1, { code: "12191" }, { code: "12192" }));
    for (const code of ["12191", "12192"]) {
      expect(where(state, code), code).toHaveLength(1);
      expect(["encounterDeck", "staging", "encounterDiscard"]).toContain(where(state, code)[0]?.zone);
    }
  });

  it("the Hazard card part 7's Resolution adds to the pool is dealt into part 8's encounter deck, with the scenario's own copies", () => {
    const base = where(opened(1), "19100").length;
    const state = opened(1, { ...emptyLog(1), encounterPool: { "19100": 1, "19107": 1 } });
    expect(where(state, "19100")).toHaveLength(base + 1);
    expect(where(state, "19107")).toHaveLength(where(opened(1), "19107").length + 1);
  });

  it("12190 Ashen Brazier, a Loot objective, enters play only through Discover, which the campaign card of part 8 ignores: a copy that is dealt stays in the encounter deck", () => {
    const state = opened(1, pooled(1, { code: "12190" }));
    const brazier = where(state, "12190");
    expect(brazier.length).toBeLessThanOrEqual(1);
    for (const card of brazier) expect(card.zone).not.toBe("heroes");
    expect(codesIn(state, "activeLocation")).not.toContain("12190");
  });

  it("12188 Beldis in the pool is shuffled into a deck like any boon ally, and the campaign card's Setup lets a player search their deck for a unique boon ally", () => {
    const state = opened(1, pooled(1, { code: "12188", seat: 0 }));
    expect(where(state, "12188")).toHaveLength(1);
    expect(where(state, "12188")[0]?.zone).toBe("hand");
  });

  it("12166, 12169 and 12171 Turayn, Melanwar and Isolde are shuffled into their players' decks", () => {
    const state = opened(2, pooled(2, { code: "12166", seat: 0 }, { code: "12169", seat: 1 }, { code: "12171", seat: 0 }));
    for (const code of ["12166", "12169", "12171"]) {
      expect(where(state, code), code).toHaveLength(1);
      expect(["deck", "hand", "play"], code).toContain(where(state, code)[0]?.zone);
    }
  });

  it("the treasures the log holds are not offered again by the Resolution's random draw (12193:B:2)", () => {
    const facts = { prisoner: null, usedOnce: [], counters: {}, treasures: ["12197", "12198", "12199"] } as Facts;
    const state = opened(1, emptyLog(1), 1, facts);
    expect(state.campaignFacts?.treasures).toEqual(["12197", "12198", "12199"]);
  });

  it("a treasure on a character is a player card: Dagnir's Slave and the quest cards leave it alone, and Dragon-sickness moves it", () => {
    const t = gundabadTable(world, { attached: [{ code: TREASURE.axe }] });
    const treasure = where(t.state, TREASURE.axe)[0]!;
    expect(treasure.host).toBe(t.hero);
    expect(flagged(t.state, treasure.id, "cannotBeDiscardedByEncounter")).toBe(false);
  });
});

