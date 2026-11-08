// Rules: mec112.pursuit, mec112.setup-the-uruk-hai, rr.in-play-and-out-of-play, rr.ownership-and-control, rr.player-elimination, rr.destroy, rr.blank (data/rules/entries.json); ledger lines 143069:A:1, 143069:B:1, 143022:A:1,
// 143022:A:2, 143024:A:1, 143027:A:1, 143016:A:3. The uruk family's verbs, filters and amount on a table of The Uruk-hai.
import { beforeAll, describe, expect, it } from "vitest";

import type { Instruction } from "../../../catalog/boundary.ts";
import { modifiedStat } from "../../core/keywords.ts";
import type { EngineStep } from "../../core/intents.ts";
import { flagged, updateCard, type ScenarioState } from "../../core/state.ts";
import { attachTo, spawn } from "../../core/zones.ts";
import { settle } from "../../engine/machine.ts";
import { holds } from "../../interpret/conditions.ts";
import { syncConstants } from "../../interpret/constants.ts";
import { runInstruction } from "../../interpret/interpret.ts";
import { pickCandidates } from "../../interpret/pick.ts";
import { resolveAmount } from "../../interpret/amounts.ts";
import { textBlank } from "../attachments/hold.ts";
import { CODES, haiTable, idOf, loadHaiWorld, resolveRecords, type HaiWorld } from "../../../../test/scenarios/the-uruk-hai/scene.ts";
import { causeProblems } from "../../../../test/harness/cause-check.ts";

let world: HaiWorld;
beforeAll(async () => {
  world = await loadHaiWorld();
}, 120_000);

// One instruction run for seat 0 with the source card `sourceId`.
function run(state: ScenarioState, ctx: ReturnType<typeof haiTable>["ctx"], instruction: Instruction, sourceId: string | null = null, seat = 0): { state: ScenarioState; steps: EngineStep[] } {
  const steps: EngineStep[] = [];
  const next = runInstruction(state, instruction, { seat, sourceId }, ctx, steps);
  return { state: settle(next, ctx, steps), steps };
}

describe("the pursuit value (mec112.pursuit)", () => {
  it("SetPursuit sets the tracker, RaisePursuit and LowerPursuit move it, and it stops at 0", () => {
    const t = haiTable(world);
    expect(t.state.pursuit).toBeUndefined();
    let state = run(t.state, t.ctx, { verb: "SetPursuit", value: 10 }).state;
    expect(state.pursuit).toBe(10);
    state = run(state, t.ctx, { verb: "RaisePursuit", amount: 3 }).state;
    expect(state.pursuit).toBe(13);
    state = run(state, t.ctx, { verb: "LowerPursuit", amount: 1 }).state;
    expect(state.pursuit).toBe(12);
    expect(run(state, t.ctx, { verb: "LowerPursuit", amount: 20 }).state.pursuit).toBe(0);
  });

  it("an amount reads the tracker and a condition tests it between a minimum and a maximum", () => {
    const t = haiTable(world, { pursuit: 27 });
    expect(resolveAmount(t.state, { pursuit: true }, { actor: 0, sourceId: null }, t.ctx)).toBe(27);
    expect(resolveAmount(haiTable(world).state, { pursuit: true }, { actor: 0, sourceId: null }, t.ctx)).toBe(0);
    const scope = { actor: 0, sourceId: null, returned: 0 };
    expect(holds(t.state, { kind: "pursuit", min: 30 }, scope, t.ctx)).toBe(false);
    expect(holds(t.state, { kind: "pursuit", max: 25 }, scope, t.ctx)).toBe(false);
    expect(holds(t.state, { kind: "pursuit", min: 25, max: 30 }, scope, t.ctx)).toBe(true);
    expect(holds(run(t.state, t.ctx, { verb: "RaisePursuit", amount: 3 }).state, { kind: "pursuit", min: 30 }, scope, t.ctx)).toBe(true);
    // No tracker: neither bound holds.
    expect(holds(haiTable(world).state, { kind: "pursuit", max: 25 }, scope, t.ctx)).toBe(false);
  });

  it("the stages' quest points are X, the pursuit value (143069:B:1, 143070:B:1)", () => {
    for (const stage of [CODES.stage1, CODES.stage2] as const) {
      const t = haiTable(world, { stage, pursuit: 10 });
      const card = t.state.cards[idOf(t.state, stage)]!;
      expect(modifiedStat(t.state, card, "questPoints", world.cards)).toBe(10);
      const raised = syncConstants(run(t.state, t.ctx, { verb: "RaisePursuit", amount: 4 }).state, t.ctx);
      expect(modifiedStat(raised, raised.cards[card.id]!, "questPoints", world.cards)).toBe(14);
    }
  });
});

describe("the Captives (143022:A:1)", () => {
  it("TakeCaptive holds the picked hero faceup under To Isengard!, in play and controlled by no player, keeping its tokens and attachments", () => {
    const t = haiTable(world, { staging: [CODES.toIsengard], hand: [CODES.beyondAllHope] });
    let state = updateCard(t.state, t.hero2, { damage: 2, resources: 3, exhausted: true });
    const boon = spawn(state, CODES.beyondAllHope, { zone: "play", seat: 0 });
    state = attachTo(boon.state, boon.id, t.hero2);
    // The hero is picked first, as the Setup record's Pick does.
    const taken = run(withPicked(state, t.hero2), t.ctx, { verb: "TakeCaptive", under: CODES.toIsengard }).state;
    const captive = taken.cards[t.hero2]!;
    const isengard = idOf(taken, CODES.toIsengard);
    expect(captive).toMatchObject({ zone: "captive", host: isengard, face: "up", controller: null, owner: 0, captive: true, damage: 2, resources: 3, exhausted: true });
    expect(taken.seats[0].heroes).toEqual([t.hero]);
    // The boon stays attached to it, no longer a card of the player's play area.
    expect(taken.cards[boon.id]).toMatchObject({ host: t.hero2, zone: "attached", face: "up", owner: 0 });
    expect(taken.cards[t.hero2]?.attachments).toContain(boon.id);
  });

  it("a player whose only hero is held is not eliminated: the Captive stays theirs while it is held", () => {
    const t = haiTable(world, { seats: 2, captives: ["seat1"] });
    expect(t.state.seats[1].heroes).toEqual([]);
    expect(t.state.seats[1].eliminated).not.toBe(true);
    const settled = settle(t.state, t.ctx, []);
    expect(settled.seats[1].eliminated).not.toBe(true);
    expect(settled.lost).not.toBe(true);
  });

  it("a Captive is blank while To Isengard! is in play, and it is not a card a player can choose or a seat's hero", () => {
    const t = haiTable(world, { seats: 2, captives: ["hero2"] });
    expect(textBlank(t.state, t.hero2)).toBe(true);
    expect(textBlank(t.state, t.hero)).toBe(false);
    expect(flagged(t.state, t.hero2, "blankText")).toBe(true);
    // A seat's own filter does not offer it; the Captives filters do.
    expect(pickCandidates(t.state, { type: "hero", control: "you" }, 0, [], null, t.ctx)).toEqual([t.hero]);
    expect(pickCandidates(t.state, { type: "hero", control: "any" }, 0, [], null, t.ctx)).toEqual([t.hero, t.seat1Hero]);
    expect(pickCandidates(t.state, { type: "hero", control: "any", captives: "also" }, 0, [], null, t.ctx).sort()).toEqual([t.hero, t.hero2, t.seat1Hero].sort());
    expect(pickCandidates(t.state, { type: "hero", control: "any", captives: "only" }, 0, [], null, t.ctx)).toEqual([t.hero2]);
  });

  it("the players lose when no Captive is in play (143022:A:1), and not while one is", () => {
    const held = haiTable(world, { captives: ["hero2"] });
    expect(settle(held.state, held.ctx, []).lost).not.toBe(true);
    const none = haiTable(world, { staging: [CODES.toIsengard] });
    const lost = settle(none.state, none.ctx, []);
    expect(lost.lost).toBe(true);
  });

  it("a Captive destroyed by damage goes to its owner's discard pile, and the players lose with no Captive left", () => {
    const t = haiTable(world, { captives: ["hero2"] });
    const hurt = updateCard(t.state, t.hero2, { damage: 6 });
    const after = settle(hurt, t.ctx, []);
    expect(after.cards[t.hero2]?.zone).toBe("discard");
    expect(after.seats[0].discard).toContain(t.hero2);
    expect(after.lost).toBe(true);
  });

  it("AddResources reaches a Captive through its owner's seat (143027:A:1)", () => {
    const t = haiTable(world, { captives: ["hero2"], staging: [CODES.eastemnet] });
    // Eastemnet's Response, resolved as the exploring of the active location offers it.
    const added = resolveRecords(t.state, t.ctx, CODES.eastemnet, "response", idOf(t.state, CODES.eastemnet));
    expect(added.state.cards[t.hero2]?.resources).toBe(1);
    expect(added.state.cards[t.hero]?.resources).toBe(1);
    expect(causeProblems(added.steps)).toEqual([]);
  });

  it("the loggedCaptive filter offers the hero the Campaign Log names as the seat's captive, and none without a log", () => {
    const t = haiTable(world);
    const logged = { ...t.state, campaignFacts: { prisoner: null, usedOnce: [], counters: {}, heroLog: { heroes: [["dh1", "dh2"]], fallen: [[]], fellowship: [], captives: [{ seat: 0, hero: "dh2" }] } } };
    expect(pickCandidates(logged, { type: "hero", control: "you", loggedCaptive: true }, 0, [], null, t.ctx)).toEqual([t.hero2]);
    expect(pickCandidates(t.state, { type: "hero", control: "you", loggedCaptive: true }, 0, [], null, t.ctx)).toEqual([]);
    // A captive logged for another seat is not this seat's.
    const other = { ...logged, campaignFacts: { ...logged.campaignFacts, heroLog: { ...logged.campaignFacts.heroLog, captives: [{ seat: 1, hero: "dh2" }] } } };
    expect(pickCandidates(other, { type: "hero", control: "you", loggedCaptive: true }, 0, [], null, t.ctx)).toEqual([]);
  });
});

describe("Grishnákh's hold (143024:A:1)", () => {
  it("AttachCaptive moves the picked Captive from under To Isengard! to the enemy, ReturnCaptive puts it back, faceup", () => {
    const t = haiTable(world, { captives: ["hero2"], staging: [CODES.grishnakh] });
    const grishnakh = idOf(t.state, CODES.grishnakh);
    const attached = run(withPicked(t.state, t.hero2), t.ctx, { verb: "AttachCaptive" }, grishnakh).state;
    expect(attached.cards[t.hero2]).toMatchObject({ zone: "captive", host: grishnakh, face: "up", captive: true });
    expect(pickCandidates(attached, { type: "hero", control: "any", captives: "held" }, 0, [], grishnakh, t.ctx)).toEqual([t.hero2]);
    expect(pickCandidates(attached, { type: "hero", control: "any", captives: "held" }, 0, [], idOf(attached, CODES.toIsengard), t.ctx)).toEqual([]);
    const back = run(attached, t.ctx, { verb: "ReturnCaptive", under: CODES.toIsengard }, grishnakh).state;
    expect(back.cards[t.hero2]).toMatchObject({ zone: "captive", host: idOf(back, CODES.toIsengard), face: "up" });
  });
});

// A state whose top frame holds the card as the effect's picked card: what the Pick of a Setup record leaves for the verb after it.
function withPicked(state: ScenarioState, id: string): ScenarioState {
  return { ...state, stack: [{ frame: "setup", cardId: null, seat: 0, peril: false, step: 0, data: { kind: "effect", picked: [id], queue: [], returned: 0 } } as unknown as ScenarioState["stack"][number]] };
}
