// Rules: rr.step-6-4-4, rr.hit-points, rr.player-elimination, rr.threat-elimination-level, rr.travel, rr.step-3-3,
// rr.multiple-defenders, mec109.setting-up-the-game (data/rules/entries.json). What a choice would do, said before it is
// confirmed: the damage on each possible defender (pooled, with several), whether it destroys the card and loses the game,
// the commit's cost, and why travel waits.
import { beforeAll, describe, expect, it } from "vitest";

import { expectOk } from "../../rules/core/test-fixture.ts";
import { defenseAsDefender, modifiedStat } from "../../rules/core/keywords.ts";
import { settle } from "../../rules/engine/machine.ts";
import { definePrinted } from "../../rules/core/printed.ts";
import { legalIntents, reduce, startScenario, type ReduceContext, type ScenarioState } from "../../rules/engine/reduce.ts";
import { withMode, withThreat } from "../../rules/core/state.ts";
import { nextIntent } from "../../../test/harness/auto-player.ts";
import { RING_BEARER, starterStart, starterWorld } from "../../../test/scenarios/a-shadow-of-the-past/game.ts";
import { fund, payFor, starterBase } from "../../../test/scenarios/a-shadow-of-the-past/starter-scene.ts";
import { loadPrinted } from "../../../test/harness/catalog.ts";
import { begin, buildTable, FRODO, idsOf, MERRY, passWindows, RIDER, SAM, sceneCards, send } from "../../../test/harness/scene.ts";

import { noOneQuests, windowSheet } from "../choice/bar-sheets.ts";
import { damageOutcome, lossWords, outcomeWords } from "./foresight.ts";
import { readoutFor } from "../readouts/readout.ts";
import { combatPairs } from "./selectors.ts";
import type { SheetNames } from "../choice/sheet-types.ts";
import { sheetFor } from "../choice/sheets.ts";
import { choiceFor, dockFor } from "../choice/table-choice.ts";

const names: SheetNames = { card: (id) => id, line: () => null };
let base: Awaited<ReturnType<typeof sceneCards>>;

beforeAll(async () => {
  base = await sceneCards();
});

describe("damage foresight", () => {
  it("says when the Ring-bearer's fall loses the game, and how much more a survivor can take", () => {
    const table = buildTable(base, {});
    const frodo = idsOf(table, FRODO);
    const sam = idsOf(table, SAM);
    const lost = damageOutcome(table.state, table.ctx, frodo, 5);
    expect(lost.destroyed).toBe(true);
    expect(lost.loss).toBe("The One Ring left play");
    expect(outcomeWords(lost, "Frodo Baggins", true)).toBe("Frodo Baggins is destroyed: The One Ring leaves play and the game is lost");
    // Sam has 3 hit points: 1 damage leaves him 2 more to take, and the third destroys him.
    const hit = damageOutcome(table.state, table.ctx, sam, 1);
    expect(hit.destroyed).toBe(false);
    expect(hit.spare).toBe(2);
    expect(outcomeWords(hit, "Sam Gamgee", true)).toBe("2 more damage destroys Sam Gamgee");
    expect(outcomeWords(hit, "Sam Gamgee", false)).toBe("");
    expect(table.state.lost).toBe(false);
  });

  it("names a seat eliminated, and the loss when no seat remains", () => {
    const solo = buildTable(base, { heroes: [{ code: SAM, seat: 0 }], ring: "none" });
    expect(damageOutcome(solo.state, solo.ctx, idsOf(solo, SAM), 3).loss).toBe("No seats remain");
    expect(lossWords("No seats remain")).toBe("the game is lost");
    const two = buildTable(base, { seats: 2, heroes: [{ code: FRODO, seat: 0 }, { code: MERRY, seat: 1 }], ring: "none" });
    const merry = damageOutcome(two.state, two.ctx, idsOf(two, MERRY), 10);
    expect(merry.loss).toBeNull();
    expect(merry.eliminated).toEqual([1]);
    expect(outcomeWords(merry, "Merry", false)).toBe("Merry is destroyed: Player 2 is eliminated");
  });
});

describe("the defense sheet", () => {
  let ctx: ReduceContext;
  beforeAll(async () => {
    ctx = (await starterWorld("stealth-and-steadfastness")).ctx;
  });

  it("marks each defender with its damage, and asks twice before the Ring-bearer's fall loses the game", () => {
    let seenDefense = 0;
    for (const seed of [1, 2, 4, 5, 9]) {
      let state: ScenarioState = expectOk(reduce(startScenario(starterStart("stealth-and-steadfastness", seed), ctx), { type: "Keep" }, ctx)).state;
      const memory = new Set<string>();
      for (let turn = 0; turn < 2000 && !state.lost && !state.stageCleared; turn += 1) {
        const legal = legalIntents(state, ctx);
        const sheet = sheetFor(state, ctx, legal, names);
        if (state.window?.kind === "defense" && sheet?.kind === "pick" && state.pendingAttack) {
          const enemy = state.cards[state.pendingAttack.enemyId];
          const attack = enemy ? modifiedStat(state, enemy, "attack", ctx.cards) : 0;
          for (const item of sheet.options) {
            if (!("intent" in item) || item.intent.type !== "DeclareDefender") continue;
            seenDefense += 1;
            const damage = Math.max(0, attack - defenseAsDefender(state, item.id, ctx.cards));
            const outcome = damageOutcome(state, ctx, item.id, damage);
            expect(item.mark).toEqual({ icon: "damage", value: damage, danger: outcome.destroyed });
            expect(item.caution != null).toBe(outcome.loss != null);
            const dock = dockFor(sheet, { key: sheet.key, ids: [item.id], shares: [] }, { game: state, ctx, legal, names }, { overlay: false, passLegal: false, surface: "table" });
            expect(dock.primary?.arm).toBe(outcome.loss != null);
          }
        }
        state = expectOk(reduce(state, nextIntent(state, ctx, { scout: "141003", prefer: "141035", protect: RING_BEARER }, memory), ctx)).state;
      }
    }
    expect(seenDefense).toBeGreaterThan(0);
  }, 120_000);
});

describe("several defenders (Stand Together, 01038:A:1)", () => {
  it("pool their defense in the readout and are all marked against the enemy", async () => {
    const starter = await starterBase();
    const cards = new Map([...starter.cards, ...(await loadPrinted(["01004", "01005", "01006", "01038"]))]);
    cards.set("pounder", definePrinted({ code: "pounder", name: "Pounder", type: "enemy", threat: 1, engagementCost: 40, attack: 6, defense: 1, health: 9 }));
    const tab = buildTable({ ...starter, cards }, { ring: "none", start: "planning", heroes: [{ code: "01004", seat: 0 }, { code: "01005", seat: 0 }, { code: "01006", seat: 0 }], hand: [{ code: "01038", seat: 0 }], engaged: [{ code: "pounder", seat: 0 }] });
    const [gimli, thalin, stand, pounder] = ["01004", "01006", "01038", "pounder"].map((code) => idsOf(tab, code));
    const funded = fund(tab.state, 0, 6);
    let run = begin(settle({ ...withMode(funded, "combatStart"), window: null }, tab.ctx, []));
    run = send(run, { type: "PlayCard", cardId: stand ?? "", payments: payFor(run.state, tab.ctx, stand ?? "") }, tab.ctx);
    run = send(passWindows(run, tab.ctx), { type: "DeclareDefender", defenderId: gimli ?? "" }, tab.ctx);
    // The next defender is asked for at once (families/defense/defenders.ts moreDefenders), with the stop on the sheet's pass.
    const legal = legalIntents(run.state, tab.ctx);
    const sheet = sheetFor(run.state, tab.ctx, legal, names);
    if (sheet?.kind !== "pick") throw new Error("no second defender pick");
    expect(sheet.title).toBe(`${pounder} attacks`);
    expect(sheet.alternative).toMatchObject({ label: "No more defenders", intent: { type: "Choose", optionId: "done" } });
    expect(sheet.options.map((item) => item.id)).not.toContain("done");
    // Gimli is declared; picking Thalin as well pools 2 + 2 Defense against the attack of 6.
    const readout = readoutFor(run.state, tab.ctx, sheet, { key: sheet.key, ids: [thalin ?? ""], shares: [] }, (id) => id);
    expect(readout?.stats.map((stat) => stat.value)).toEqual([6, 4]);
    // The scene's encounter deck is empty, so no shadow card was dealt to the attacker and none is announced.
    expect(readout?.result).toBe("2 damage on one defender you choose");
    // The pick's mark is the pooled damage; nothing is destroyed by declaring, since who takes it is chosen after.
    expect(sheet.options.find((item) => item.id === thalin)?.mark).toEqual({ icon: "damage", value: 2, danger: false });
    // Thalin joins, and the declarations end.
    run = send(run, { type: "Choose", optionId: thalin ?? "" }, tab.ctx);
    run = passWindows(send(run, { type: "Choose", optionId: "done" }, tab.ctx), tab.ctx);
    expect(combatPairs(run.state, 0).get(pounder ?? "")).toEqual({ ids: [gimli, thalin], kind: "defense" });
  });
});

describe("the commit and travel", () => {
  it("says what the commit leaves for combat, and what committing no one costs", () => {
    const table = buildTable(base, { staging: [RIDER], start: "quest" });
    const state = withThreat(table.state, 0, 40);
    const legal = legalIntents(state, table.ctx);
    const sheet = windowSheet(state, table.ctx, legal, names);
    const readout = readoutFor(state, table.ctx, sheet, choiceFor(sheet, null), (id) => id);
    // Frodo and Sam are ready; the Black Rider (engagement cost 35, threat 4) engages at threat 40 with attack 5.
    expect(readout?.result).toBe("Staging reveals 1 card next. Ready after this: 2 · Enemies to face: 1 (5 attack)");
    expect(sheet.kind === "window" ? sheet.armed : "").toBe(noOneQuests(4));
    expect(noOneQuests(5)).toBe("Tap again: no one quests (threat 5+)");
    expect(noOneQuests(0)).toBe("Tap again: no one quests");
  });

  it("says when a failed quest takes the threat to 50, as the engine fails it (rr.threat-elimination-level)", () => {
    const table = buildTable(base, { staging: [RIDER], start: "quest" });
    // Nobody committed against the Black Rider's threat 4: at 48 the threat reaches 50 and the only seat is eliminated.
    const staged: ScenarioState = { ...withThreat(table.state, 0, 48), mode: "staging" };
    expect(readoutFor(staged, table.ctx, null, null, (id) => id)?.result).toBe("Threat +4 if nothing changes; threat reaches 50: the game is lost");
    const safe: ScenarioState = { ...withThreat(table.state, 0, 40), mode: "staging" };
    expect(readoutFor(safe, table.ctx, null, null, (id) => id)?.result).toBe("Threat +4 if nothing changes");
  });

  it("says the level of the seat that goes out: a seat holding The One Ring is out at 45 while the first living seat's level is 50 (21001:A:2)", () => {
    const table = buildTable(base, { seats: 2, staging: ["f3"], start: "quest", ring: "none" });
    const ring = { instanceId: "seat:1", sourceId: "ring", stat: "eliminationReduction" as const, amount: 5, until: "endOfGame" as const };
    const staged: ScenarioState = { ...withThreat(withThreat(table.state, 0, 30), 1, 43), modifiers: [ring], mode: "staging" };
    expect(readoutFor(staged, table.ctx, null, null, (id) => id)?.result).toBe("Threat +3 if nothing changes; threat reaches 45: Player 2 is eliminated");
  });

  it("while a location is active, says what exploring it still takes", () => {
    const table = buildTable(base, { start: "travel", active: "141036", staging: ["141037"] });
    const sheet = sheetFor(table.state, table.ctx, legalIntents(table.state, table.ctx), names);
    expect(sheet?.kind === "pick" ? sheet.title : "").toBe(`Explore ${idsOf(table, "141036")} first`);
    expect(sheet?.kind === "pick" ? sheet.note : "").toBe("3 more progress explores it. Only one location can be active.");
  });

  it("says what a travel changes in staging", () => {
    const table = buildTable(base, { start: "travel", staging: ["141037", "141036"] });
    const legal = legalIntents(table.state, table.ctx);
    const sheet = sheetFor(table.state, table.ctx, legal, names);
    if (sheet?.kind !== "pick") throw new Error("no travel pick");
    const stock = idsOf(table, "141037");
    const readout = readoutFor(table.state, table.ctx, sheet, { key: sheet.key, ids: [stock], shares: [] }, (id) => id);
    expect(readout?.stats.map((stat) => stat.value)).toEqual([5, 2]);
    expect(readout?.join).toBe("then");
    expect(readout?.result).toBe("It takes the next 3 progress before the quest");
  });
});
