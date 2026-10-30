// Rules: rr.framework-steps, rr.attack-resolution-chart (data/rules/entries.json). Every action window of whole starter
// games is named by what comes next, never the bare "Action window".
import { describe, expect, it } from "vitest";

import { expectOk } from "../rules/fixture.ts";
import { legalIntents, reduce, startScenario, type ScenarioState } from "../rules/reduce.ts";
import { nextIntent } from "../../scripts/auto-player.ts";
import { RING_BEARER, starterStart, starterWorld } from "../../scripts/starter-game.ts";

import { windowSheet } from "./bar-sheets.ts";
import { phaseCarousel, startIndex, STOPS_TEXT, stopAheadOf } from "./carousel.ts";
import { phaseIndex, railFor, ROUND_PHASES, windowPoint } from "./rail.ts";
import { turnReference } from "./reference.ts";
import { isStepWindow, sheetFor } from "./sheets.ts";

describe("window names", () => {
  it("names every step window of whole games by its next step", async () => {
    const titles = new Set<string>();
    for (const deckId of ["stealth-and-steadfastness", "wisdom-and-wizardry"]) {
      const { ctx } = await starterWorld(deckId);
      for (const seed of [1, 2, 9]) {
        let state: ScenarioState = expectOk(reduce(startScenario(starterStart(deckId, seed), ctx), { type: "Keep" }, ctx)).state;
        const memory = new Set<string>();
        const policy = { scout: "", prefer: "141035", protect: RING_BEARER, play: true, act: true };
        for (let turn = 0; turn < 3000 && !state.lost && !(state.stageCleared && state.window == null); turn += 1) {
          const legal = legalIntents(state, ctx);
          if (isStepWindow(state) && sheetFor(state, ctx, legal, { card: (id) => id, line: () => null }) == null) {
            const point = windowPoint(state);
            expect(point, `${state.mode} ${state.stepWindows.join(",")}`).not.toBeNull();
            const sheet = windowSheet(state, ctx, legal, { card: (id) => id, line: () => null });
            expect(sheet.title).not.toBe("Action window");
            titles.add(sheet.title);
          }
          state = expectOk(reduce(state, nextIntent(state, ctx, policy, memory), ctx)).state;
        }
      }
    }
    expect(titles.has("Before the quest resolves")).toBe(true);
  }, 120_000);
});

// A game parked in a phase and step: the rail and the carousel read the engine's phase, mode and window, nothing else.
async function parked(phase: ScenarioState["phase"], mode: ScenarioState["mode"], round = 3): Promise<ScenarioState> {
  const { ctx } = await starterWorld("stealth-and-steadfastness");
  const state = expectOk(reduce(startScenario(starterStart("stealth-and-steadfastness", 1), ctx), { type: "Keep" }, ctx)).state;
  return { ...state, phase, mode, round };
}

const noTitle = () => null;
const on = (...stops: string[]) => ({ stopsOn: true, stops });

describe("phase carousel", () => {
  it("lists the seven phases of the round in order, each with the steps the turn reference gives it", async () => {
    const game = await parked("Quest", "staging");
    const carousel = phaseCarousel(game, on(), noTitle);
    expect(carousel.round).toBe(3);
    expect(carousel.phases.map((phase) => phase.name)).toEqual(["Resource", "Planning", "Quest", "Travel", "Encounter", "Combat", "Refresh"]);
    expect(carousel.phases.map((phase) => phase.id)).toEqual(["resource", "planning", "quest", "travel", "encounter", "combat", "refresh"]);
    expect(ROUND_PHASES).toEqual(carousel.phases.map((phase) => phase.name));
    expect(turnReference(game, noTitle).map((phase) => phase.phase)).toEqual(["Beginning", ...ROUND_PHASES]);
  });

  it("marks the phases before the game's as past, its own as current, and the rest as next", async () => {
    const quest = phaseCarousel(await parked("Quest", "staging"), on(), noTitle);
    expect(quest.phases.map((phase) => phase.state)).toEqual(["past", "past", "current", "next", "next", "next", "next"]);
    const combat = phaseCarousel(await parked("Combat", "enemyAttacks"), on(), noTitle);
    expect(combat.phases.map((phase) => phase.state)).toEqual(["past", "past", "past", "past", "past", "current", "next"]);
    const before = phaseCarousel(await parked("Beginning of round", "beginRound"), on(), noTitle);
    expect(before.phases.every((phase) => phase.state === "next")).toBe(true);
    const after = phaseCarousel(await parked("End of round", "endRound"), on(), noTitle);
    expect(after.phases.every((phase) => phase.state === "past")).toBe(true);
  });

  it("gives each step and decision exactly as the turn reference does, and the current step once", async () => {
    for (const [phase, mode] of [["Quest", "staging"], ["Combat", "playerAttacks"]] as const) {
      const game = await parked(phase, mode);
      const reference = turnReference(game, noTitle).filter((entry) => entry.phase !== "Beginning");
      const carousel = phaseCarousel(game, on("3.3"), noTitle);
      expect(carousel.phases.map((entry) => entry.steps.map((step) => [step.id, step.words, step.decision, step.current]))).toEqual(
        reference.map((entry) => entry.steps.map((step) => [step.id, step.titles.join(" · "), step.decision, step.current])),
      );
      expect(carousel.phases.flatMap((entry) => entry.steps).filter((step) => step.current)).toHaveLength(1);
      expect(carousel.phases.find((entry) => entry.state === "current")?.steps.some((step) => step.current)).toBe(true);
      for (const step of carousel.phases.flatMap((entry) => entry.steps)) {
        const windows = reference.flatMap((entry) => entry.steps).find((item) => item.id === step.id)?.windows ?? [];
        expect(step.windows.map((window) => [window.id, window.title, window.note])).toEqual(windows.map((window) => [window.id, window.title, window.note]));
        expect(step.window).toBe(windows.length > 0);
        expect(step.stop).toBe(step.windows.some((window) => window.stop));
      }
    }
  });

  it("marks the player's stops on their windows", async () => {
    const carousel = phaseCarousel(await parked("Quest", "staging"), on("3.3", "shadow"), noTitle);
    const windows = carousel.phases.flatMap((entry) => entry.steps.flatMap((step) => step.windows));
    expect(windows.filter((window) => window.stop).map((window) => window.id)).toEqual(["3.3", "shadow"]);
  });

  it("says a stop is ahead when one lies later in this phase and Stops are on, and not when it was earlier", async () => {
    const staging = await parked("Quest", "staging");
    expect(phaseCarousel(staging, on("3.3"), noTitle).stopAhead).toBe(true);
    expect(phaseCarousel(staging, on("3.4"), noTitle).stopAhead).toBe(true);
    // Resolution is step 3.4: the 3.3 window is behind.
    const resolution = await parked("Quest", "resolution");
    expect(phaseCarousel(resolution, on("3.3"), noTitle).stopAhead).toBe(false);
    expect(phaseCarousel(resolution, on("3.3", "3.4"), noTitle).stopAhead).toBe(true);
    // A stop in another phase is not ahead in this one.
    expect(phaseCarousel(staging, on("4.2", "defense"), noTitle).stopAhead).toBe(false);
    // Combat: the attacks come before the player attacks' strike window.
    const attacks = await parked("Combat", "enemyAttacks");
    expect(phaseCarousel(attacks, on("strike"), noTitle).stopAhead).toBe(true);
    expect(phaseCarousel(attacks, on("6.2"), noTitle).stopAhead).toBe(false);
    const strikes = await parked("Combat", "playerAttacks");
    expect(phaseCarousel(strikes, on("defense", "6.2"), noTitle).stopAhead).toBe(false);
    expect(phaseCarousel(strikes, on("strike"), noTitle).stopAhead).toBe(true);
    // Stops off: nothing is ahead, whatever is set.
    expect(phaseCarousel(staging, { stopsOn: false, stops: ["3.3"] }, noTitle).stopAhead).toBe(false);
  });

  it("reads the stop ahead without laying out the strip, with the same answer", async () => {
    const games = [await parked("Quest", "staging"), await parked("Quest", "resolution"), await parked("Combat", "enemyAttacks"), await parked("Combat", "playerAttacks"), await parked("Beginning of round", "beginRound"), await parked("End of round", "endRound")];
    const settings = [on("3.3"), on("3.3", "3.4"), on("strike"), on("4.2", "defense"), on(), { stopsOn: false, stops: ["3.3"] }];
    for (const game of games) for (const stops of settings) expect(stopAheadOf(game, stops), `${game.phase} ${game.mode} ${stops.stops.join(",")}`).toBe(phaseCarousel(game, stops, noTitle).stopAhead);
  });
});

describe("the rail's words", () => {
  it("names the round, the phase over the step, and the phases beside it", async () => {
    const quest = railFor(await parked("Quest", "staging"));
    expect(quest).toMatchObject({ round: 3, phase: "Quest", current: "Staging", previousPhase: "Planning", nextPhase: "Travel" });
    const resource = railFor(await parked("Resource", "resourceGrant"));
    expect(resource).toMatchObject({ phase: "Resource", previousPhase: "Refresh", nextPhase: "Planning" });
    const refresh = railFor(await parked("Refresh", "refresh"));
    expect(refresh).toMatchObject({ previousPhase: "Combat", nextPhase: "Resource" });
  });

  it("keeps the phase beside the first and the last, and names the phases outside the round by steps.json's words", async () => {
    expect(railFor(await parked("Beginning of round", "beginRound"))).toMatchObject({ phase: "Beginning", previousPhase: "", nextPhase: "Resource" });
    expect(railFor(await parked("End of round", "endRound"))).toMatchObject({ phase: "End", previousPhase: "Refresh", nextPhase: "Resource" });
    expect(railFor(await parked("Setup", "afterOpening", 0))).toMatchObject({ phase: "", round: 0, previousPhase: "", nextPhase: "Resource" });
    expect(phaseIndex(await parked("Setup", "afterOpening", 0))).toBe(-1);
  });
});

describe("the carousel's placement", () => {
  it("starts on the current phase, the first before Resource and the last after Refresh", async () => {
    expect(startIndex(phaseCarousel(await parked("Quest", "staging"), on(), noTitle))).toBe(2);
    expect(startIndex(phaseCarousel(await parked("Combat", "enemyAttacks"), on(), noTitle))).toBe(5);
    expect(startIndex(phaseCarousel(await parked("Beginning of round", "beginRound"), on(), noTitle))).toBe(0);
    expect(startIndex(phaseCarousel(await parked("Setup", "afterOpening", 0), on(), noTitle))).toBe(0);
    expect(startIndex(phaseCarousel(await parked("End of round", "endRound"), on(), noTitle))).toBe(6);
  });

  it("keeps the Stops sentence in one place", () => {
    expect(STOPS_TEXT.startsWith("Pass the action windows that are not stops")).toBe(true);
  });
});
