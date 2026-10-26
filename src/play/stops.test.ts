// Rules: rr.action-windows, rr.framework-steps, rr.response (data/rules/entries.json). The table passes a step window for
// the player only where the player's own settings say so, never a pick, the commit or planning; it asks again where Undo
// went back; and "Pass to next stop" runs to the next stop. Over whole starter games, the default stops save most passes.
import { describe, expect, it } from "vitest";

import { EFFECTS } from "../effects/index.ts";
import { expectOk } from "../rules/fixture.ts";
import { legalIntents, reduce, startScenario, type ScenarioState } from "../rules/reduce.ts";
import { nextIntent } from "../../scripts/auto-player.ts";
import { RING_BEARER, starterStart, starterWorld } from "../../scripts/starter-game.ts";

import { windowSheet } from "./bar-sheets.ts";
import { cardSize } from "./layout.ts";
import { pointTitle, windowPoint } from "./rail.ts";
import { turnReference } from "./reference.ts";
import type { SheetNames } from "./sheet-types.ts";
import { sheetFor } from "./sheets.ts";
import { isFreeResponse, nextStopTitle, passableWindow, stopDecision } from "./stops.ts";
import { DEFAULT_SETTINGS, parseSettings, STOP_POINTS, toggleAlways, toggleStop } from "./table-settings.ts";

const names: SheetNames = { card: (id) => id, line: () => null };

describe("table settings", () => {
  it("parses what is stored, defaulting anything missing or of the wrong type", () => {
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings({ stopsOn: true, stops: ["3.3", "nonsense"], largeCards: "yes", guideSeen: { "3.3": 2, x: "1" } })).toEqual({
      ...DEFAULT_SETTINGS,
      stopsOn: true,
      stops: ["3.3"],
      guideSeen: { "3.3": 2 },
    });
    expect(DEFAULT_SETTINGS.stops).toEqual(["3.3", "shadow"]);
  });

  it("keeps stops in round order, and toggles a Response to Always and back", () => {
    expect(toggleStop(["shadow"], "3.3")).toEqual(["3.3", "shadow"]);
    expect(toggleStop(["3.3", "shadow"], "3.3")).toEqual(["shadow"]);
    expect(toggleAlways([], "141004:response:1")).toEqual(["141004:response:1"]);
    expect(toggleAlways(["141004:response:1"], "141004:response:1")).toEqual([]);
    expect(STOP_POINTS.every((point) => pointTitle(point) != null)).toBe(true);
  });
});

describe("free Responses", () => {
  it("are those with no cost and nothing to choose", () => {
    const byId = (id: string) => EFFECTS.find((effect) => effect.id === id);
    // Sam Gamgee readies and gains stats; Pippin draws; Glóin gains resources for damage.
    expect(isFreeResponse(byId("141002:response:1"))).toBe(true);
    expect(isFreeResponse(byId("141004:response:1"))).toBe(true);
    expect(isFreeResponse(byId("01003:response:1"))).toBe(true);
    // Théodred picks a hero; Merry picks a character; Aragorn pays a resource.
    expect(isFreeResponse(byId("01002:response:1"))).toBe(false);
    expect(isFreeResponse(byId("141003:response:1"))).toBe(false);
    expect(isFreeResponse(byId("01001:response:1"))).toBe(false);
  });
});

describe("stops over whole games", () => {
  it("passes only step windows that are not stops, asks at every other moment, and saves most passes", async () => {
    const deckId = "wisdom-and-wizardry";
    const { ctx } = await starterWorld(deckId);
    const settings = { ...DEFAULT_SETTINGS, stopsOn: true };
    let windows = 0;
    let passedForPlayer = 0;
    let titled = "";
    for (const seed of [1, 2, 4]) {
      let state: ScenarioState = expectOk(reduce(startScenario(starterStart(deckId, seed), ctx), { type: "Keep" }, ctx)).state;
      const memory = new Set<string>();
      const seen = new Set<string>();
      for (let turn = 0; turn < 3000 && !state.lost && !(state.stageCleared && state.window == null); turn += 1) {
        const legal = legalIntents(state, ctx);
        const sheet = sheetFor(state, ctx, legal, names) ?? windowSheet(state, ctx, legal, names);
        const decision = stopDecision({ game: state, sheet, legal, settings, running: false, held: false, seen });
        if (decision === "pass") {
          // Only a step window the player has not set as a stop, and never planning, the commit or a pick.
          expect(passableWindow(state, sheet, legal)).toBe(true);
          expect(settings.stops).not.toContain(windowPoint(state)?.id);
          passedForPlayer += 1;
          state = expectOk(reduce(state, { type: "Pass" }, ctx)).state;
          continue;
        }
        if (passableWindow(state, sheet, legal)) {
          windows += 1;
          titled = nextStopTitle(state, settings, pointTitle);
          if (sheet.kind === "window") for (const id of [...sheet.plays, ...sheet.triggers.map((item) => item.cardId)]) seen.add(id);
        }
        state = expectOk(reduce(state, nextIntent(state, ctx, { scout: "", prefer: "141035", protect: RING_BEARER, play: true, act: true }, memory), ctx)).state;
      }
    }
    expect(passedForPlayer).toBeGreaterThan(windows);
    expect(["Before the quest resolves", "Before the shadow card turns"]).toContain(titled);
  }, 120_000);

  it("asks where Undo went back, and runs to the next stop on request", async () => {
    const { ctx } = await starterWorld("wisdom-and-wizardry");
    let state: ScenarioState = expectOk(reduce(startScenario(starterStart("wisdom-and-wizardry", 1), ctx), { type: "Keep" }, ctx)).state;
    const memory = new Set<string>();
    const settings = { ...DEFAULT_SETTINGS, stopsOn: false };
    for (let turn = 0; turn < 3000 && !state.lost; turn += 1) {
      const legal = legalIntents(state, ctx);
      const sheet = sheetFor(state, ctx, legal, names) ?? windowSheet(state, ctx, legal, names);
      if (passableWindow(state, sheet, legal) && !settings.stops.includes(windowPoint(state)?.id ?? "")) {
        // Stops off: the table asks; a run to the next stop passes; Undo's window asks even while running.
        expect(stopDecision({ game: state, sheet, legal, settings, running: false, held: false, seen: new Set() })).toBe("ask");
        expect(stopDecision({ game: state, sheet, legal, settings, running: true, held: false, seen: new Set() })).toBe("pass");
        expect(stopDecision({ game: state, sheet, legal, settings, running: true, held: true, seen: new Set() })).toBe("ask");
        return;
      }
      state = expectOk(reduce(state, nextIntent(state, ctx, { scout: "", prefer: "141035", protect: RING_BEARER, play: true, act: true }, memory), ctx)).state;
    }
    throw new Error("no passable window was reached");
  }, 120_000);
});

describe("the turn reference", () => {
  it("lays out the round with the current step marked and every stop under its step", async () => {
    const { ctx } = await starterWorld("wisdom-and-wizardry");
    const state: ScenarioState = expectOk(reduce(startScenario(starterStart("wisdom-and-wizardry", 1), ctx), { type: "Keep" }, ctx)).state;
    const phases = turnReference(state, () => null);
    expect(phases.map((phase) => phase.phase)).toEqual(["Beginning", "Resource", "Planning", "Quest", "Travel", "Encounter", "Combat", "Refresh"]);
    const windows = phases.flatMap((phase) => phase.steps.flatMap((step) => step.windows.map((window) => window.id)));
    expect([...windows].sort()).toEqual([...STOP_POINTS].sort());
    expect(phases.flatMap((phase) => phase.steps).filter((step) => step.current)).toHaveLength(1);
  });
});

describe("larger cards", () => {
  it("are never smaller, and grow where the screen allows", () => {
    for (const [width, height] of [
      [844, 346],
      [1180, 780],
    ] as const) {
      expect(cardSize(width, height, true).w).toBeGreaterThanOrEqual(cardSize(width, height).w);
    }
    expect(cardSize(1180, 780, true).w).toBeGreaterThan(cardSize(1180, 780).w);
  });
});
