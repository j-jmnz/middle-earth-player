// Rules: ats.ally-objectives, rr.current-quest, hon.battle, hon.siege, hon.archery, rr.quest-advancement, rr.ownership-and-control, rr.damage (data/rules/entries.json); ledger lines 05025:A:1, 05026:A:1, 05052:A:1, 05068:B:2, 05069:B:4, 05070:B:1.
// The engine reads Into Ithilien adds in the pelargir family and the shared reads that join them: the commitment of an ally objective from the staging area (quest total, "committed" filter, archery, leaving play), the stage that bypasses the next one and
// the first player's taking of the Ranger objectives. A card that holds none of the new flags reads as before (the last tests).
import { describe, expect, it } from "vitest";

import type { PickSpec } from "../../../catalog/boundary.ts";
import { archeryRecipients } from "../../combat/combat.ts";
import type { EngineStep } from "../../core/intents.ts";
import { destroyCard, placeDamage } from "../../core/keywords.ts";
import { flagged } from "../../core/state.ts";
import { settle } from "../../engine/machine.ts";
import { syncConstants } from "../../interpret/constants.ts";
import { runInstruction } from "../../interpret/interpret.ts";
import { pickCandidates } from "../../interpret/pick.ts";
import { advanceStage, committedWillpower } from "../../quest/quest.ts";
import { UNATTRIBUTED } from "../../core/cause.ts";
import { idOf, tableFromLayout, type Layout, type LayoutTable } from "../../../../test/harness/scene-kit.ts";

const SCENARIO = "into-ithilien";
const CELADOR = "05025";
const GUARDIAN = "05026";
const BATTLE = "05068";
const SIEGE = "05069";
const HIDDEN_WAY = "05070";
const APPROACHING = "05071";

const table = (layout: Layout): LayoutTable => tableFromLayout(SCENARIO, layout);
const COMMITTED: PickSpec = { type: "character", control: "any", committed: true };
const UNCOMMITTED: PickSpec = { type: "character", control: "any", committed: false };
const codesOf = (t: LayoutTable, spec: PickSpec, seat = 0): string[] => pickCandidates(t.state, spec, seat, [], null, t.ctx).map((id) => t.state.cards[id]?.code ?? id);

describe("committedInStaging in the quest total (05025:A:1, 05026:A:1)", () => {
  it("an ally objective in the staging area adds the stat the quest uses: Willpower, Attack under Battle, Defense under Siege", () => {
    const layout = { staging: [CELADOR, GUARDIAN], committed: ["dh1"] } as const;
    const willpower = table({ ...layout, stage: APPROACHING });
    expect(flagged(willpower.state, idOf(willpower.state, CELADOR), "committedInStaging")).toBe(true);
    expect(committedWillpower(willpower.state, willpower.ctx.cards)).toBe(2 + 2 + 2);
    const battle = table({ ...layout, stage: BATTLE });
    expect(committedWillpower(battle.state, battle.ctx.cards)).toBe(2 + 2 + 2);
    const siege = table({ ...layout, stage: SIEGE });
    expect(committedWillpower(siege.state, siege.ctx.cards)).toBe(2 + 2 + 1);
  });

  it("a card with no such flag, or out of the staging area, adds nothing", () => {
    const none = table({ staging: ["05029"], committed: ["dh1"], stage: APPROACHING });
    expect(committedWillpower(none.state, none.ctx.cards)).toBe(2);
    const held = table({ play: [CELADOR], committed: ["dh1"], stage: APPROACHING });
    expect(flagged(held.state, idOf(held.state, CELADOR), "committedInStaging")).toBe(false);
    expect(committedWillpower(held.state, held.ctx.cards)).toBe(2);
  });
});

describe("committedInStaging in a pick (05029:A:2, 05049:A:1, 05051:A:1)", () => {
  it("is a character committed to the quest for any player's filter, and not for a filter of the player's own, a hero filter or an uncommitted one", () => {
    const t = table({ staging: [CELADOR], committed: ["dh1"], stage: BATTLE });
    expect(codesOf(t, COMMITTED)).toEqual(["dh1", CELADOR]);
    expect(codesOf(t, { ...COMMITTED, control: "you" })).toEqual(["dh1"]);
    expect(codesOf(t, { type: "hero", control: "any", committed: true })).toEqual(["dh1"]);
    expect(codesOf(t, UNCOMMITTED)).not.toContain(CELADOR);
  });

  it("an objective that is not an ally, or an ally objective in play under a player, is read as before", () => {
    const t = table({ play: [CELADOR], stage: BATTLE });
    expect(codesOf(t, { type: "character", control: "any" })).toContain(CELADOR);
    expect(codesOf(t, UNCOMMITTED)).toContain(CELADOR);
    expect(codesOf(t, { type: "objective", control: "any", stagingOnly: true })).toEqual([]);
  });
});

describe("committedInStaging and archery (05052:A:1)", () => {
  it("the ally objectives in the staging area are among the characters archery damage may go to", () => {
    const t = table({ staging: [CELADOR, GUARDIAN], stage: BATTLE });
    const ids = archeryRecipients(t.state, t.ctx.cards).map((id) => t.state.cards[id]?.code);
    expect(ids).toEqual(["dh1", "dh2", CELADOR, GUARDIAN]);
    const none = table({ staging: ["05029"], stage: BATTLE });
    expect(archeryRecipients(none.state, none.ctx.cards).map((id) => none.state.cards[id]?.code)).toEqual(["dh1", "dh2"]);
  });
});

describe("a staged ally objective that leaves play (05025:A:3)", () => {
  it("is announced as a character leaving play: destroyed in the staging area it is removed from the game", () => {
    const t = table({ staging: [CELADOR], stage: BATTLE });
    const celador = idOf(t.state, CELADOR);
    const steps: EngineStep[] = [];
    const hurt = placeDamage({ ...t.state, window: null }, celador, 3, t.ctx.cards, steps, "framework", UNATTRIBUTED);
    const settled = settle(hurt, t.ctx, steps);
    expect(settled.cards[celador]?.zone).toBe("removed");
    expect(settled.removed).toContain(celador);
  });

  it("a Guardian that leaves play deals 1 damage to Celador, in the staging area or under a player", () => {
    const t = table({ staging: [CELADOR, GUARDIAN], stage: BATTLE });
    const celador = idOf(t.state, CELADOR);
    const steps: EngineStep[] = [];
    const gone = destroyCard({ ...t.state, window: null }, idOf(t.state, GUARDIAN), t.ctx.cards, steps);
    expect(settle(gone, t.ctx, steps).cards[celador]?.damage).toBe(1);
    const held = table({ staging: [CELADOR], play: [GUARDIAN], stage: BATTLE });
    const heldSteps: EngineStep[] = [];
    const heldGone = destroyCard({ ...held.state, window: null }, idOf(held.state, GUARDIAN), held.ctx.cards, heldSteps);
    expect(settle(heldGone, held.ctx, heldSteps).cards[idOf(held.state, CELADOR)]?.damage).toBe(1);
  });
});

describe("skipsNextStage (05068:B:2, 05069:B:4)", () => {
  const next = (t: LayoutTable): string | undefined => {
    const advanced = advanceStage(t.state, t.ctx.cards, [], () => false);
    return advanced.questStage ? advanced.cards[advanced.questStage]?.code : undefined;
  };

  it("stage 1 completed with Celador in the staging area goes to stage 3, and to stage 2 when he is not there", () => {
    expect(next(table({ staging: [CELADOR], stage: BATTLE }))).toBe(HIDDEN_WAY);
    expect(next(table({ play: [CELADOR], stage: BATTLE }))).toBe(SIEGE);
    expect(next(table({ stage: BATTLE }))).toBe(SIEGE);
  });

  it("stage 2 always goes to stage 4, whatever lies in the staging area", () => {
    expect(next(table({ staging: [CELADOR], stage: SIEGE }))).toBe(APPROACHING);
    expect(next(table({ stage: SIEGE }))).toBe(APPROACHING);
  });
});

describe("TakeControlOfStagedObjectives (05070:B:1)", () => {
  it("every Ranger objective in the staging area comes into the first player's play area, ready and committed to nothing", () => {
    const t = table({ seats: 2, firstPlayer: 1, staging: [CELADOR, GUARDIAN], stage: HIDDEN_WAY });
    const state = runInstruction({ ...t.state, window: null }, { verb: "TakeControlOfStagedObjectives", trait: "Ranger" }, { seat: 0, sourceId: null }, t.ctx, []);
    for (const code of [CELADOR, GUARDIAN]) {
      const card = state.cards[idOf(state, code)];
      expect(card?.zone).toBe("play");
      expect(card?.controller).toBe(1);
      expect(card?.committed).toBe(false);
      expect(card?.exhausted).toBe(false);
    }
    expect(flagged(syncConstants(state, t.ctx), idOf(state, CELADOR), "committedInStaging")).toBe(false);
    expect(committedWillpower(state, t.ctx.cards)).toBe(0);
  });

  it("an objective without the Trait stays, and with none in the staging area nothing happens", () => {
    const t = table({ staging: [CELADOR], stage: HIDDEN_WAY });
    const state = runInstruction({ ...t.state, window: null }, { verb: "TakeControlOfStagedObjectives", trait: "Hobbit" }, { seat: 0, sourceId: null }, t.ctx, []);
    expect(state.staging).toEqual(t.state.staging);
  });
});
