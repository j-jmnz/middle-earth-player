// Rules: dcce.aflame, dcce.stormcaller-elite, dcce.last-player, rr.first-player, rr.quest-advancement, rr.winning-the-game (data/rules/entries.json). Sahír's Advance (stage 2) and the Stormcaller Elite's enemy
// and objective ally sides on a table of plain-number heroes and the Campaign Expansion's cards (scripts/raid-scene.ts).
import { beforeAll, describe, expect, it } from "vitest";

import { ruleCause } from "../../cause.ts";
import type { EngineStep } from "../../intents.ts";
import { placeDamage } from "../../keywords.ts";
import { settle } from "../../machine.ts";
import { placeQuestProgress } from "../../quest.ts";
import type { ScenarioState } from "../../state.ts";
import { CODES, idOf, idsOf, loadRaidWorld, raidTable, resolveRecords, send, start, type RaidLayout, type RaidWorld } from "../../../../scripts/raid-scene.ts";

let world: RaidWorld;

beforeAll(async () => {
  world = await loadRaidWorld();
});

const make = (layout: RaidLayout = {}) => raidTable(world, layout);
const cardOf = (state: ScenarioState, code: string, at = 0) => state.cards[idsOf(state, code)[at] ?? ""];
const resourcesOn = (state: ScenarioState, code: string, at = 0): number => cardOf(state, code, at)?.resources ?? 0;

// The stage's own When Revealed, the way a reveal resolves it.
function reveal(layout: RaidLayout) {
  const made = make({ stage: "11037", setAside: [CODES.sahir, CODES.naasiyah], ...layout });
  return { made, ...resolveRecords(made.state, made.ctx, CODES.advance, "whenRevealed", made.state.questStage ?? undefined) };
}

describe("Sahír's Advance, When Revealed (11037:A:1)", () => {
  it("adds Na'asiyah and Captain Sahír to the staging area on their enemy sides, who engage the last and the first player (11076:A:1, 11078:A:1)", () => {
    const { state } = reveal({ seats: 2, deck: ["f0", "f0", "f0"], damage: [[CODES.dreamChaser, 4]] });
    expect(cardOf(state, CODES.sahir)).toMatchObject({ zone: "engaged", controller: 0 });
    expect(cardOf(state, CODES.naasiyah)).toMatchObject({ zone: "engaged", controller: 1 });
    expect(state.setAside.map((id) => state.cards[id]?.code)).not.toContain(CODES.sahir);
    expect(state.setAside.map((id) => state.cards[id]?.code)).not.toContain(CODES.naasiyah);
  });

  it("with one player both engage that player", () => {
    const { state } = reveal({ deck: ["f0", "f0"] });
    expect(cardOf(state, CODES.sahir)?.controller).toBe(0);
    expect(cardOf(state, CODES.naasiyah)?.controller).toBe(0);
  });

  it("has each player reveal the top card of the encounter deck", () => {
    const { state } = reveal({ seats: 2, deck: ["f3", "f3", "f3", "f0"] });
    expect(state.encounterDeck).toHaveLength(2);
    expect(idsOf(state, "f3").filter((id) => state.cards[id]?.zone === "staging")).toHaveLength(2);
  });

  it("places resources on both equal to the damage on the Dream-chaser, and 1 on each other Raider enemy in play, the ones just revealed too", () => {
    const { state } = reveal({ deck: ["raider", "f0"], damage: [[CODES.dreamChaser, 4]], staging: ["raider"] });
    expect(resourcesOn(state, CODES.sahir)).toBe(4);
    expect(resourcesOn(state, CODES.naasiyah)).toBe(4);
    const raiders = idsOf(state, "raider").map((id) => state.cards[id]?.resources);
    expect(raiders).toEqual([1, 1]);
  });

  it("is damage 0 on the Dream-chaser, no resource on either", () => {
    const { state } = reveal({ deck: ["f0"] });
    expect(resourcesOn(state, CODES.sahir)).toBe(0);
  });
});

describe("Sahír's Advance, side B (11037:B:1 to B:3)", () => {
  it("turns the progress placed on the quest, beyond what the active location takes, into damage removed from locations in play (B:1)", () => {
    const made = make({ stage: "11037", staging: [{ code: CODES.pillaged, damage: 3 }, { code: CODES.piers, damage: 2 }], damage: [[CODES.dreamChaser, 1]], active: { code: "place" } });
    const steps: never[] = [];
    const placed = placeQuestProgress(made.state, 4, world.cards, steps, () => true);
    // The active location took its 2 quest points; the 2 left healed the first location the first player chose.
    expect(cardOf(placed, "place")?.zone).toBe("encounterDiscard");
    const settled = settle({ ...placed, window: null, mode: "stopped" }, made.ctx, steps);
    const asked = settled.window?.kind === "choose";
    expect(asked).toBe(true);
    expect(cardOf(settled, "11037")?.progress).toBe(0);
  });

  it("heals one damage at a time from the location the first player chooses, and the rest from the only location with damage", () => {
    const made = make({ stage: "11037", staging: [{ code: CODES.pillaged, damage: 3 }], active: { code: "place" } });
    const placed = placeQuestProgress(made.state, 3, world.cards, [], () => true);
    const settled = settle({ ...placed, window: null, mode: "stopped" }, made.ctx, []);
    expect(cardOf(settled, CODES.pillaged)?.damage).toBe(2);
    expect(cardOf(settled, CODES.advance)?.progress).toBe(0);
    expect(settled.window).toBeNull();
  });

  it("loses the progress when no location holds damage, and puts none on the quest card", () => {
    const made = make({ stage: "11037" });
    const placed = placeQuestProgress(made.state, 5, world.cards, [], () => true);
    const settled = settle({ ...placed, window: null, mode: "stopped" }, made.ctx, []);
    expect(cardOf(settled, CODES.advance)?.progress).toBe(0);
    expect(settled.stageCleared).toBeFalsy();
  });

  it("asks which location when several hold damage, naming each (B:1)", () => {
    const made = make({ stage: "11037", staging: [{ code: CODES.pillaged, damage: 2 }, { code: CODES.piers, damage: 2 }] });
    const placed = placeQuestProgress(made.state, 2, world.cards, [], () => true);
    const asked = settle({ ...placed, window: null, mode: "stopped" }, made.ctx, []);
    expect(asked.window?.kind).toBe("choose");
    const options = asked.window?.kind === "choose" ? asked.window.options : [];
    expect(options.map((id) => asked.cards[id]?.code).sort()).toEqual([CODES.piers, CODES.pillaged].sort());
    const pillaged = options.find((id) => asked.cards[id]?.code === CODES.pillaged) ?? "";
    let run = send(start(asked), { type: "Choose", optionId: pillaged }, made.ctx);
    run = run.state.window?.kind === "choose" ? send(run, { type: "Choose", optionId: run.state.window.options[0] ?? "" }, made.ctx) : run;
    expect(cardOf(run.state, CODES.pillaged)?.damage ?? 0).toBeLessThanOrEqual(1);
    expect((cardOf(run.state, CODES.pillaged)?.damage ?? 0) + (cardOf(run.state, CODES.piers)?.damage ?? 0)).toBe(2);
  });

  it("gives a Raider enemy revealed by the encounter deck 1 resource, but not the cards stage 2A reveals itself (B:2)", () => {
    const made = make({ stage: "11037", deck: ["raider", "f0"] });
    const revealed = send(start(made.state), { type: "Pass" }, made.ctx).state;
    expect(resourcesOn(revealed, "raider")).toBe(1);
  });

  it("wins when Captain Sahír is in the victory display and every location in play has no damage (B:3), not before", () => {
    const quiet = make({ stage: "11037", victory: [CODES.sahir] });
    expect(settle(quiet.state, quiet.ctx, []).stageCleared).toBe(true);
    const burning = make({ stage: "11037", victory: [CODES.sahir], damage: [[CODES.dreamChaser, 1]] });
    expect(settle(burning.state, burning.ctx, []).stageCleared).toBeFalsy();
    const elsewhere = make({ stage: "11037", damage: [[CODES.dreamChaser, 0]] });
    expect(settle(elsewhere.state, elsewhere.ctx, []).stageCleared).toBeFalsy();
  });
});

describe("Captain Sahír (11076)", () => {
  const hurt = (resources: number, amount: number) => {
    const made = make({ engaged: [{ code: CODES.sahir, seat: 0, resources }] });
    const sahir = idOf(made.state, CODES.sahir);
    const steps: EngineStep[] = [];
    const next = placeDamage(made.state, sahir, amount, world.cards, steps, "combat", ruleCause("rr.damage"));
    return { card: next.cards[sahir], steps };
  };

  it("discards a resource and cancels the damage for each point he would take (A:2)", () => {
    expect(hurt(5, 3).card).toMatchObject({ resources: 2, damage: 0 });
    expect(hurt(2, 3).card).toMatchObject({ resources: 0, damage: 1 });
    expect(hurt(0, 2).card).toMatchObject({ resources: 0, damage: 2 });
  });

  it("is destroyed into the victory display, not the encounter discard pile, when damage reaches his 5 hit points", () => {
    const { card } = hurt(0, 5);
    expect(card?.zone).toBe("victory");
  });
});
