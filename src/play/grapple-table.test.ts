// Rules: dcce.grapple (data/rules/entries.json); docs/design-system-table.md, Cards, "Grapple". The enemies grappled with a location on the phone table: facedown under their location as one peek with a count,
// the location's Threat with the 2 each adds, the line the round summary and the log tell, and the detached enemy turning over as it joins the staging area. The geometry on every screen down to 667 x 375.
import { beforeAll, describe, expect, it } from "vitest";

import { modifiedStat } from "../rules/core/keywords.ts";
import { settle } from "../rules/engine/machine.ts";
import type { EngineStep } from "../rules/core/intents.ts";
import type { ScenarioState } from "../rules/core/state.ts";
import { CODES, depthsTable, idOf, idsOf, loadDepthsWorld, send, start, type DepthsLayout, type DepthsWorld } from "../../scripts/depths-scene.ts";

import { logLines } from "./log.ts";
import { hitBounds, slotBounds, tableLayout, type CardSlot, type LayoutViews, type PileViews } from "./layout.ts";
import { motionsBetween } from "./motion.ts";
import { momentOf } from "./outcome.ts";
import { PILES, TABLE_ZONES, pileSelector, secondPilesOf, zoneSelector } from "./selectors.ts";
import { UI_SCALES, touch } from "./ui-scale.ts";
import { zoneFactsOf } from "./zone-facts.ts";

let world: DepthsWorld;

beforeAll(async () => {
  world = await loadDepthsWorld();
});

function table(layout: DepthsLayout = {}): { state: ScenarioState; views: LayoutViews; piles: PileViews; ctx: ReturnType<typeof depthsTable>["ctx"] } {
  const made = depthsTable(world, layout);
  const state = settle(made.state, made.ctx, []);
  const facts = zoneFactsOf(made.ctx.cards);
  const views = Object.fromEntries(TABLE_ZONES.map((zone) => [zone, zoneSelector(zone, 0, facts)(state)])) as unknown as LayoutViews;
  const piles = Object.fromEntries([...PILES, ...secondPilesOf(state)].map((pile) => [pile, pileSelector(pile, 0)(state)])) as unknown as PileViews;
  return { state, views, piles, ctx: made.ctx };
}

const ONE: DepthsLayout = { staging: [CODES.cargoHold, CODES.weatherDeck], grappled: [[CODES.thrashing, CODES.cargoHold]] };
const TWO: DepthsLayout = { staging: [CODES.cargoHold, CODES.weatherDeck], grappled: [[CODES.thrashing, CODES.cargoHold], [CODES.crushing, CODES.cargoHold]] };
const names = (id: string) => world.cards.get(id)?.name ?? id;

describe("a location with enemies grappled with it", () => {
  it("is listed with its grappled enemies as the cards under it, facedown, and the location's Threat counts 2 for each", () => {
    const { state, views } = table(TWO);
    const cargo = views.staging.entries.find((entry) => entry.card.code === CODES.cargoHold);
    expect(cargo?.attached.map((card) => card.zone)).toEqual(["grappled", "grappled"]);
    expect(cargo?.attached.every((card) => card.face === "down")).toBe(true);
    expect(modifiedStat(state, cargo!.card, "threat", world.cards)).toBe(2 + 4);
    expect(views.staging.entries.find((entry) => entry.card.code === CODES.weatherDeck)?.attached).toEqual([]);
    // The enemies are not cards of the staging row.
    expect(views.staging.entries.map((entry) => entry.card.code)).toEqual([CODES.cargoHold, CODES.weatherDeck]);
  });

  it("draws one peek of the facedown enemy under its location, and with two or more one peek and the count", () => {
    const one = tableLayout(667, 375, table(ONE).views, table(ONE).piles, { stacks: true });
    const peeks = one.slots.filter((slot) => slot.zone === "staging" && slot.kind === "attachment");
    expect(peeks).toHaveLength(1);
    expect(peeks[0]).toMatchObject({ faceDown: true });
    expect(peeks[0]?.stack).toBeUndefined();
    const two = table(TWO);
    const stacked = tableLayout(667, 375, two.views, two.piles, { stacks: true }).slots.filter((slot) => slot.zone === "staging" && slot.kind === "attachment");
    expect(stacked).toHaveLength(1);
    expect(stacked[0]).toMatchObject({ faceDown: true, stack: 2 });
    // Nothing facedown is named on the canvas: the slot is drawn as a back.
    expect(stacked[0]?.faceDown).toBe(true);
  });

  it("fits the peek and its count inside the card at every screen down to 667 x 375 at the three UI scales, and the location stays a target the size of a finger", () => {
    const two = table(TWO);
    for (const [width, height] of [[667, 375], [591, 338], [844, 390], [932, 430]] as const) {
      for (const scale of Object.values(UI_SCALES)) {
        const layout = tableLayout(width, height, two.views, two.piles, { stacks: true, scale });
        const host = layout.slots.find((slot): slot is CardSlot => slot.kind === "card" && slot.zone === "staging" && slot.code === CODES.cargoHold);
        const peek = layout.slots.find((slot) => slot.kind === "attachment" && slot.zone === "staging");
        expect(host, `${width}x${height}@${scale}`).toBeDefined();
        expect(peek, `${width}x${height}@${scale}`).toBeDefined();
        if (!host || !peek) continue;
        const minimum = touch(scale, 44);
        expect(Math.max(host.w, hitBounds(host).w)).toBeGreaterThanOrEqual(Math.min(minimum, host.w));
        // The peek lies under the host, inside the card's width, and the host's own tap target is its card.
        expect(slotBounds(peek).x).toBeGreaterThanOrEqual(host.x - 0.5);
        expect(slotBounds(peek).x + slotBounds(peek).w).toBeLessThanOrEqual(host.x + host.w + 0.5);
      }
    }
  });
});

describe("the count under a location in front of an engaged enemy", () => {
  const FIGHT: DepthsLayout = { ...TWO, engaged: ["mild"] };

  it("hangs above the engagement row at Large on 667 x 375 and 844 x 390, and every card stays on the canvas", () => {
    const fight = table(FIGHT);
    for (const [width, height] of [[667, 375], [844, 390]] as const) {
      for (const scale of Object.values(UI_SCALES)) {
        const layout = tableLayout(width, height, fight.views, fight.piles, { stacks: true, scale });
        const peek = layout.slots.find((slot) => slot.kind === "attachment" && slot.zone === "staging");
        const enemies = layout.slots.filter((slot) => slot.kind === "card" && slot.zone === "engaged");
        expect(peek, `${width}x${height}@${scale}`).toBeDefined();
        expect(enemies.length, `${width}x${height}@${scale}`).toBeGreaterThan(0);
        // The count pill is drawn at the peek's foot (StackMark): the peek ends where the engagement row begins, never under an enemy.
        for (const enemy of enemies) expect((peek?.y ?? 0) + (peek?.h ?? 0), `${width}x${height}@${scale}`).toBeLessThanOrEqual(enemy.y + 0.01);
        for (const slot of layout.slots) expect(slot.y + slot.h, `${slot.zone} ${width}x${height}@${scale}`).toBeLessThanOrEqual(height + 0.01);
      }
    }
  });

  it("carries no real code on the facedown peek: the canvas draws a back and the card's name is nowhere in the slot", () => {
    const fight = table(FIGHT);
    const layout = tableLayout(667, 375, fight.views, fight.piles, { stacks: true });
    const peek = layout.slots.find((slot) => slot.kind === "attachment" && slot.zone === "staging");
    expect(peek).toMatchObject({ faceDown: true, code: "" });
    expect(JSON.stringify(layout.slots)).not.toContain(CODES.thrashing);
    expect(JSON.stringify(layout.slots)).not.toContain(CODES.crushing);
  });
});

describe("what the table tells of a grapple", () => {
  it("names the enemy, which was faceup as it was revealed, and the location it goes under, in the log and in the round summary", () => {
    const made = depthsTable(world, { staging: [CODES.cargoHold], deck: [CODES.thrashing, "f0"] });
    const run = send(send(start(made.state), { type: "Commit", cardIds: [made.hero] }, made.ctx), { type: "Pass" }, made.ctx);
    const steps = run.steps as readonly EngineStep[];
    const grapples = steps.filter((step) => step.kind === "grapple");
    expect(grapples).toHaveLength(1);
    const label = { card: (id: string) => names(run.state.cards[id]?.code ?? ""), code: names, effectCard: () => null, line: () => null, rule: () => null } as never;
    const lines = logLines(steps, label).map((line) => line.text);
    expect(lines).toContain("Thrashing Arm grapples with Cargo Hold");
    const moment = momentOf(made.state, run.state, steps, { card: (id: string) => names((run.state.cards[id] ?? made.state.cards[id])?.code ?? "") } as never);
    expect(JSON.stringify(moment)).toContain("Thrashing Arm grapples with Cargo Hold");
  });

  it("tells a detached enemy by name once it is faceup, in the round summary of the travel", () => {
    const made = depthsTable(world, { phase: "Travel", staging: [CODES.cargoHold], grappled: [[CODES.thrashing, CODES.cargoHold]] });
    const run = send(start(made.state), { type: "Travel", locationId: idOf(made.state, CODES.cargoHold) }, made.ctx);
    const arm = idsOf(run.state, CODES.thrashing)[0] ?? "";
    expect(made.state.cards[arm]?.zone).toBe("grappled");
    expect(["staging", "engaged"]).toContain(run.state.cards[arm]?.zone);
    expect(run.state.cards[arm]?.face).toBe("up");
    const named = { card: (id: string) => names((run.state.cards[id] ?? made.state.cards[id])?.code ?? "") } as never;
    expect(JSON.stringify(momentOf(made.state, run.state, run.steps, named))).toContain("Thrashing Arm comes out from under Cargo Hold");
  });

  it("moves a detached enemy from under its location, turning over", () => {
    const grappled = table(ONE);
    const arm = idsOf(grappled.state, CODES.thrashing)[0] ?? "";
    const detached = { ...grappled.state, cards: { ...grappled.state.cards, [arm]: { ...grappled.state.cards[arm]!, zone: "staging" as const, face: "up" as const, host: null } }, staging: [...grappled.state.staging, arm] };
    const facts = zoneFactsOf(grappled.ctx.cards);
    const views = Object.fromEntries(TABLE_ZONES.map((zone) => [zone, zoneSelector(zone, 0, facts)(detached)])) as unknown as LayoutViews;
    const piles = Object.fromEntries([...PILES, ...secondPilesOf(detached)].map((pile) => [pile, pileSelector(pile, 0)(detached)])) as unknown as PileViews;
    const before = tableLayout(667, 375, grappled.views, grappled.piles, { stacks: true });
    const after = tableLayout(667, 375, views, piles, { stacks: true });
    const { motions } = motionsBetween(before, after, (id: string) => detached.cards[id]?.zone ?? null, { zoneWas: (id: string) => grappled.state.cards[id]?.zone ?? null, grappledFrom: (id: string) => (grappled.state.cards[id]?.zone === "grappled" ? grappled.state.cards[id]?.host ?? null : null) });
    expect(motions.get(arm)).toMatchObject({ flip: true, land: "pop" });
  });
});
