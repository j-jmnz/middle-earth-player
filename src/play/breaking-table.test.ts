// Rules: mec109.multiple-staging-areas, mec109.saga-staging-rules, rr.active-location, rr.travel, rr.step-3-4, rr.first-player (data/rules/entries.json).
// Breaking of the Fellowship on the phase 16 table, in whole games (the goldens' seeds, scripts/breaking-game.ts). Once stage 2B splits the table the canvas, the web list
// and the pile list draw the staging area, quest stage and active location of the shown seat (`shownSeat`: the acting seat, or the seat peeked at) and never a second active
// location of a shared quest; the quest numbers and every pick stay on the acting seat. In every window of the games each option a sheet offers is an intent the reducer
// accepts. True solo has one staging area and one stage; a fallen hero is an enemy drawn with the hero's own picture.
import { beforeAll, describe, expect, it } from "vitest";

import { expectOk } from "../rules/core/test-fixture.ts";
import { stageOf, stagingOf, activeOf, sharedStaging } from "../rules/families/breaking/areas.ts";
import { FALLEN_SUFFIX } from "../rules/core/printed.ts";
import { stagingThreat } from "../rules/quest/quest.ts";
import { legalIntents, reduce, startScenario, type ReduceContext, type ScenarioState } from "../rules/engine/reduce.ts";
import { BREAKING_GOLDENS, breakingCampaignStart, breakingGameWorld, breakingIntent, type BreakingGolden } from "../../scripts/breaking-game.ts";
import { intentsOf } from "../../scripts/sheet-intents.ts";

import { areaWords } from "./area-words.ts";
import { threatRows } from "./foresight.ts";
import { actionsSheet, commitSheet } from "./bar-sheets.ts";
import { pictureCode, pictureKey } from "./picture-key.ts";
import { prefetchCodes } from "./prefetch.ts";
import { questScaleOf } from "./quest-scale.ts";
import { railFor } from "./rail.ts";
import { actingSeat, onTableFor, questSeat, shownSeat, tickKeySelector, zoneSelector, type ZoneId } from "./selectors.ts";
import type { Sheet, SheetNames } from "./sheet-types.ts";
import { isStepWindow, sheetFor } from "./sheets.ts";
import { stagesKey } from "./quest-advance.ts";

// The context of the game being played: the deck set decides the heroes (scripts/breaking-game.ts).
let ctx: ReduceContext;
let strong: ReduceContext;
let slow: ReduceContext;

beforeAll(async () => {
  strong = (await breakingGameWorld("strong")).ctx;
  slow = (await breakingGameWorld("slow")).ctx;
}, 60_000);

function namesFor(state: ScenarioState): SheetNames {
  return { card: (id) => (ctx.cards.get(state.cards[id]?.code ?? "") ?? ctx.cards.get(pictureCode(state.cards[id]?.code ?? "")))?.name ?? id, line: () => null };
}

const ids = (state: ScenarioState, zone: ZoneId, seat: number): string[] => zoneSelector(zone, seat)(state).entries.map((entry) => entry.card.id);

type Seen = { separate: boolean; twoStages: boolean; windows: Set<string>; branches: Set<string>; fallen: boolean; quest: boolean; travel: boolean; foreign: boolean };

// What the table draws for each seat, checked against the engine's own areas at one state.
function checkTable(state: ScenarioState, seen: Seen): void {
  if (!state.separate) return;
  seen.separate = true;
  const acting = actingSeat(state);
  const stages = new Set<string>();
  for (let seat = 0; seat < state.seatCount; seat += 1) {
    const own = stagingOf(state, seat);
    // The seat's own area (and the cards in no area while stage 2B deals them out), in the engine's order apart from a guard's place.
    expect([...ids(state, "staging", seat)].sort()).toEqual([...own, ...sharedStaging(state)].sort());
    // A shared quest has one stage; here each seat's own (a seat that has not chosen yet sees the shared one), and no second active location.
    expect(ids(state, "secondActiveLocation", seat)).toEqual([]);
    const stage = stageOf(state, seat);
    expect(ids(state, "questStage", seat)).toEqual(stage ? [stage] : state.questStage ? [state.questStage] : []);
    expect(ids(state, "activeLocation", seat)).toEqual(activeOf(state, seat) ? [activeOf(state, seat)] : []);
    if (stage) stages.add(state.cards[stage]?.code ?? "");
    // The threat panel and the dial's ticks read this area, not the union.
    expect(threatRows(state, ctx, seat).every((row) => own.includes(row.id))).toBe(true);
    // Another seat's cards are not on the table this seat sees, so a pick among them opens the tray.
    const onTable = onTableFor(state, seat);
    for (const other of state.seats.slice(0, state.seatCount).keys()) {
      if (other === seat) continue;
      for (const id of stagingOf(state, other)) {
        expect(onTable(id)).toBe(false);
        seen.foreign = true;
      }
    }
    for (const id of own) expect(onTable(id)).toBe(true);
    // The peek at a seat draws that seat's area, and the line a screen reader hears names it.
    expect(shownSeat(state, seat)).toBe(seat);
    const words = areaWords(state, seat, (code) => ctx.cards.get(code)?.name ?? code);
    const count = ids(state, "staging", seat).length;
    expect(words).toContain(`${count} ${count === 1 ? "card" : "cards"}`);
    expect(words?.startsWith(state.seatCount > 1 ? `Player ${seat + 1}'s staging area` : "Staging area")).toBe(true);
    if (stage) expect(words).toContain(`Stage ${ctx.cards.get(state.cards[stage]?.code ?? "")?.name}`);
  }
  if (state.seatCount > 1 && stages.size === 2) seen.twoStages = true;
  // The quest numbers are the acting seat's.
  if (state.phase === "Quest" && state.mode !== "planning") {
    const scale = questScaleOf(state, ctx, null);
    expect(scale.threat).toBe(stagingThreat(state, ctx.cards, acting));
    expect(questSeat(state)).toBe(acting);
    seen.quest = true;
  }
  expect(tickKeySelector(ctx, acting)(state)).toBe(
    threatRows(state, ctx, acting)
      .filter((row) => !row.blocked)
      .map((row) => row.cost)
      .join(","),
  );
  // The advance screen holds when any seat's stage is the one that was reached.
  expect(stagesKey(state).split("|").filter((id) => id !== "")).toEqual(state.seats.slice(0, state.seatCount).flatMap((seat) => (seat.stage ? [seat.stage] : [])));
  // A fallen hero is drawn with the hero's picture.
  for (const card of Object.values(state.cards)) {
    if (!card.code.endsWith(FALLEN_SUFFIX)) continue;
    seen.fallen = true;
    expect(pictureKey(card)).toBe(card.code.slice(0, -FALLEN_SUFFIX.length));
    expect(pictureCode(card.code)).toBe(card.code.slice(0, -FALLEN_SUFFIX.length));
    // The image queue asks for the hero's file, not for one that does not exist.
    if (card.face !== "down" && (card.zone === "staging" || card.zone === "engaged")) expect(prefetchCodes(state, acting).some((code) => code.endsWith(FALLEN_SUFFIX))).toBe(false);
  }
}

function play(golden: BreakingGolden, seen: Seen): ScenarioState {
  ctx = golden.decks === "slow" ? slow : strong;
  const { start } = breakingCampaignStart(golden.seatCount, golden.seed, golden.difficulty, ctx.cards);
  let state = expectOk(reduce(startScenario(start, ctx), { type: "Keep" }, ctx)).state;
  const memory = new Set<string>();
  for (let turn = 0; turn < 8000 && !state.lost && !(state.stageCleared && state.window == null); turn += 1) {
    const legal = legalIntents(state, ctx);
    const names = namesFor(state);
    const sheet: Sheet | null = sheetFor(state, ctx, legal, names);
    expect(railFor(state).current).not.toBe("");
    checkTable(state, seen);
    if (sheet) {
      seen.windows.add(sheet.kind === "outcome" ? sheet.result : `${state.window?.kind}:${sheet.kind}`);
      if (state.window?.kind === "choose" && sheet.kind === "pick") {
        for (const option of sheet.options) {
          // A branch is told in words, never by its record's id or a card code.
          expect(option.label).not.toBe(option.id);
          expect(option.label).not.toMatch(/\d{6}/);
          if (state.stack[state.stack.length - 1]?.data.kind === "effect" && option.label.startsWith("Advance to ")) seen.branches.add(option.label);
        }
      }
      for (const intent of intentsOf(state, sheet)) expect(reduce(state, intent, ctx).ok, `${state.window?.kind} ${JSON.stringify(intent)}`).toBe(true);
    } else {
      expect(state.window?.kind === "pass" || isStepWindow(state), state.window?.kind).toBe(true);
      if (state.mode === "questCommit" && legal.some((intent) => intent.type === "Commit")) {
        for (const intent of intentsOf(state, commitSheet(state, ctx, names))) expect(reduce(state, intent, ctx).ok).toBe(true);
      }
      for (const intent of intentsOf(state, actionsSheet(state, ctx, legal, names))) expect(reduce(state, intent, ctx).ok).toBe(true);
    }
    if (state.window?.kind === "travel") seen.travel = true;
    state = expectOk(reduce(state, breakingIntent(state, ctx, memory, golden.stages), ctx)).state;
  }
  return state;
}

const pick = (name: string): BreakingGolden => BREAKING_GOLDENS.find((golden) => golden.name === name)!;

describe("Breaking of the Fellowship on the table", () => {
  it("two-handed, the table draws each seat's own staging area, stage and active location, and every window's options are accepted", () => {
    const seen: Seen = { separate: false, twoStages: false, windows: new Set(), branches: new Set(), fallen: false, quest: false, travel: false, foreign: false };
    const end = play(pick("two-handed, strong, won with a hero fallen into evil"), seen);
    expect(end.stageCleared).toBe(true);
    expect(seen.separate).toBe(true);
    expect(seen.twoStages).toBe(true);
    expect(seen.foreign).toBe(true);
    expect(seen.quest).toBe(true);
    expect(seen.travel).toBe(true);
    expect(seen.fallen).toBe(true);
    // Both players choose a stage 3A in words: four titles to the first, three to the second.
    expect(seen.branches.size).toBeGreaterThanOrEqual(4);
  }, 240_000);

  it("true solo has one staging area and one stage: the seat's, and the second seat's view is empty", () => {
    const seen: Seen = { separate: false, twoStages: false, windows: new Set(), branches: new Set(), fallen: false, quest: false, travel: false, foreign: false };
    const end = play(pick("true solo, strong, won on The Seat of Amon Hen"), seen);
    expect(end.stageCleared).toBe(true);
    expect(seen.separate).toBe(true);
    expect(seen.twoStages).toBe(false);
    expect(end.seatCount).toBe(1);
    // All four titles are offered at stage 2B.
    expect(seen.branches.size).toBe(4);
    // The union of the staging areas is the one seat's.
    expect([...ids(end, "staging", 0)].sort()).toEqual([...end.staging].sort());
  }, 240_000);

  it("says nothing about areas while the table is one", () => {
    const { start } = breakingCampaignStart(2, 5, "Normal", strong.cards);
    const kept = expectOk(reduce(startScenario(start, strong), { type: "Keep" }, strong)).state;
    expect(kept.separate).toBeUndefined();
    expect(areaWords(kept, 0, (code) => code)).toBeNull();
    // Before the split the staging area, the stage and the active location are the shared ones, whichever seat is shown.
    expect(ids(kept, "staging", 1)).toEqual(ids(kept, "staging", 0));
    expect(ids(kept, "questStage", 1)).toEqual(ids(kept, "questStage", 0));
  });

  it("a loss at the separate stages ends on Defeat with the areas drawn to the end", () => {
    const seen: Seen = { separate: false, twoStages: false, windows: new Set(), branches: new Set(), fallen: false, quest: false, travel: false, foreign: false };
    const end = play(pick("two-handed, slow, lost on threat at the separate stages"), seen);
    expect(end.lost).toBe(true);
    expect(seen.separate).toBe(true);
    expect(seen.windows.size).toBeGreaterThan(3);
  }, 240_000);
});
