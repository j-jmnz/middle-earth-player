// Rules: emce.bypassing, emce.gundabad-quest-deck, emce.caves-deck-gundabad, emce.setup-mount-gundabad, rr.first-player, rr.travel, rr.restricted, rr.attachment-cards (data/rules/entries.json); ledger lines 19137:B:3, 19138:B:3, 19139:B:3, 19140:B:3, 19141:B:3, 19130:A:1, 19131:A:1, 19143:A:1, 19144:A:1.
// The bypass at the end of the combat phase on the stage 2Bs 19137 to 19141, Deep on Narrow Stair and Desecrated Ruins, and Wormsbane's "Attach to a hero. Restricted." Each test of a record runs a second time on the records less its line and shows that the result differs.
import { beforeAll, describe, expect, it } from "vitest";

import { withoutLine } from "../../../../test/harness/card-spec.ts";
import type { EngineStep } from "../../../rules/core/intents.ts";
import type { ScenarioState } from "../../../rules/core/state.ts";
import { settle } from "../../../rules/engine/machine.ts";
import { pushEffectFrame } from "../../../rules/interpret/effect-frames.ts";
import { CODES, SCENE_EFFECTS, STAGE_TWOS, codesIn, finish, gundabadTable, idOf, legalIntents, loadGundabadWorld, resolveRecords, send, start, type GundabadLayout, type GundabadWorld, type PlayerIntent, type Run } from "../../../../test/scenarios/mount-gundabad/scene.ts";

let world: GundabadWorld;
beforeAll(async () => {
  world = await loadGundabadWorld();
}, 120_000);

type Stage = (typeof STAGE_TWOS)[number];
const table = (layout: GundabadLayout, line?: string) => gundabadTable(world, line ? { ...layout, effects: withoutLine(SCENE_EFFECTS, line) } : layout);
const quest = (state: ScenarioState): string | undefined => state.cards[state.questStage ?? ""]?.code;
const deckCodes = (state: ScenarioState): (string | undefined)[] => state.questDeck.map((id) => state.cards[id]?.code);
const one = (state: ScenarioState, code: string) => Object.values(state.cards).find((card) => card.code === code);

// The combat phase runs to its end with `code` the current stage, 2 progress on it: the run stops at the first choice, or once the refresh phase has begun.
function endOfCombat(code: Stage, layout: GundabadLayout = {}, line?: string, firstPlayer = 0) {
  const t = table({ phase: "Combat", stage: code, progress: 2, questDeck: STAGE_TWOS.filter((other) => other !== code && other !== "19142"), ...layout }, line);
  let run: Run = start({ ...t.state, firstPlayer });
  for (let guard = 0; guard < 60 && run.state.phase !== "Refresh" && run.state.window?.kind !== "choose"; guard += 1) {
    const pass = legalIntents(run.state, t.ctx).find((intent) => intent.type === "Pass" || intent.type === "DeclineAttack" || intent.type === "DeclineEngage");
    if (!pass) break;
    run = send(run, pass, t.ctx);
  }
  return { t, run };
}

// "At the end of the combat phase, the players may bypass this stage.": the first player is asked, and a bypass sends the stage to the bottom of the quest deck with its progress lost and side A up and reveals the next stage; it is not defeated.
function mayBypass(code: Stage, layout: GundabadLayout, notDefeated: (state: ScenarioState) => void): void {
  const { t, run } = endOfCombat(code, layout);
  expect(run.state.window).toMatchObject({ kind: "choose", seat: run.state.firstPlayer, options: ["bypass", "stay"] });
  const next = deckCodes(t.state)[0];
  const done = finish(send(run, { type: "Choose", optionId: "bypass" }, t.ctx), t.ctx);
  expect(quest(done.state)).toBe(next);
  expect(done.state.cards[done.state.questStage ?? ""]?.face).toBe("A");
  expect(deckCodes(done.state).at(-1)).toBe(code);
  expect(one(done.state, code)).toMatchObject({ zone: "questDeck", progress: 0, face: "A" });
  expect(codesIn(done.state, "victory")).not.toContain(code);
  notDefeated(done.state);
  // Staying keeps the stage and its progress.
  const stayed = finish(send(run, { type: "Choose", optionId: "stay" }, t.ctx), t.ctx);
  expect(quest(stayed.state)).toBe(code);
  expect(one(stayed.state, code)?.progress).toBe(2);
  // Without the line nobody is asked: the combat phase ends with the stage still current.
  const without = endOfCombat(code, layout, `${code}:B:3`).run;
  expect(without.state.window?.kind).not.toBe("choose");
  expect(quest(without.state)).toBe(code);
}

describe("the stage 2Bs: the bypass at the end of the combat phase", () => {
  it("19137:B:3 the first player may bypass The Lower Deeps; it is not defeated, so the Caves deck is not searched", () =>
    mayBypass("19137", { caves: [CODES.crumblingCavern, CODES.frightfulDen], active: CODES.minesOfGundabad }, (state) => {
      expect(codesIn(state, "cavesDeck").sort()).toEqual([CODES.crumblingCavern, CODES.frightfulDen].sort());
      expect(one(state, CODES.minesOfGundabad)?.zone).toBe("activeLocation");
    }));

  it("19138:B:3 the first player may bypass Frenzied Warrens; it is not defeated, so no threat is reduced", () =>
    mayBypass("19138", { seats: 2, threat: [30, 31] }, (state) => {
      // The refresh phase that follows raises each threat by 1; a defeat would have reduced each by 5.
      expect(state.seats.map((seat) => seat.threat)).toEqual([31, 32]);
    }));

  it("19139:B:3 the first player may bypass Dagnir's Wrath; it is not defeated, so Dagnir takes no damage", () =>
    mayBypass("19139", { staging: [CODES.dagnir] }, (state) => {
      expect(one(state, CODES.dagnir)).toMatchObject({ zone: "staging", damage: 0 });
    }));

  it("19140:B:3 the first player may bypass Foreboding Darkness; it is not defeated, so nobody looks at the top 2 stages", () =>
    mayBypass("19140", {}, (state) => {
      expect(state.window?.kind).not.toBe("choose");
    }));

  it("19141:B:3 the first player may bypass Imminent Pursuit; it is not defeated, so no enemy is discarded", () =>
    mayBypass("19141", { staging: ["f0", "f3"] }, (state) => {
      expect(codesIn(state, "staging").filter((code) => code === "f0" || code === "f3").sort()).toEqual(["f0", "f3"]);
    }));

  it("19138:B:3 with two players the first player answers for the group, the second seat when it holds the first-player token", () => {
    for (const firstPlayer of [0, 1]) {
      const { run } = endOfCombat("19138", { seats: 2 }, undefined, firstPlayer);
      expect(run.state.window, `first player ${firstPlayer}`).toMatchObject({ kind: "choose", seat: firstPlayer });
    }
  });

  it("19141:B:3 with no other stage in the quest deck there is nothing to bypass to: nobody is asked", () => {
    const { run } = endOfCombat("19141", { questDeck: [] });
    expect(run.state.window?.kind).not.toBe("choose");
    expect(quest(run.state)).toBe("19141");
  });
});

// The players travel to `code` in the travel phase with the Caves deck `caves`, top first.
function travelTo(code: string, caves: readonly string[], line?: string): ScenarioState {
  const t = table({ phase: "Travel", staging: [code], caves }, line);
  return finish(send(start(t.state), { type: "Travel", locationId: idOf(t.state, code) }, t.ctx), t.ctx).state;
}

// "Deep.": after the players travel to it they discard it and the top card of the Caves deck becomes the active location.
function deep(code: string): void {
  const after = travelTo(code, [CODES.crumblingCavern, CODES.undergroundLake]);
  expect(one(after, code)?.zone).toBe("encounterDiscard");
  expect(after.cards[after.activeLocation ?? ""]?.code).toBe(CODES.crumblingCavern);
  expect(codesIn(after, "cavesDeck")).toEqual([CODES.undergroundLake]);
  // With the Caves deck empty nothing replaces it: it stays the active location.
  const empty = travelTo(code, []);
  expect(empty.cards[empty.activeLocation ?? ""]?.code).toBe(code);
  const without = travelTo(code, [CODES.crumblingCavern, CODES.undergroundLake], `${code}:A:1`);
  expect(without.cards[without.activeLocation ?? ""]?.code).toBe(code);
  expect(codesIn(without, "cavesDeck")).toHaveLength(2);
}

describe("Deep", () => {
  it("19130:A:1 Deep: after the players travel to Narrow Stair it is discarded and the top card of the Caves deck becomes the active location", () => deep(CODES.narrowStair));
  it("19131:A:1 Deep: after the players travel to Desecrated Ruins it is discarded and the top card of the Caves deck becomes the active location", () => deep(CODES.desecratedRuins));
});

describe("Wormsbane: Attach to a hero. Restricted.", () => {
  // The Side Door's Setup attaches the Broken side to a hero the first player chooses: the choice's options and the host.
  const setup = (t: ReturnType<typeof table>, host: string) => {
    let options: readonly string[] = [];
    const run = resolveRecords(t.state, t.ctx, CODES.stage1, "setup", t.state.questStage ?? "", (state) => {
      if (state.window?.kind !== "choose") return "";
      if (options.length === 0) options = state.window.options;
      return state.window.options.find((id) => id === host) ?? state.window.options[0] ?? "";
    });
    return { run, options };
  };
  const restricted = (state: ScenarioState, t: ReturnType<typeof table>, hero: string) => state.cards[hero]?.attachments.filter((other) => t.ctx.cards.get(state.cards[other]?.code ?? "")?.keywords.restricted).length ?? 0;

  it("19143:A:1 the Setup offers the first player's heroes as Wormsbane's host, not an ally they control", () => {
    const t = table({ phase: "Planning", play: ["ally"] });
    const { run, options } = setup(t, t.hero2);
    expect([...options].sort()).toEqual([t.hero, t.hero2].sort());
    expect(one(run.state, CODES.wormsbane)?.host).toBe(t.hero2);
  });

  // FAULT: Wormsbane prints Restricted and rr.restricted discards one of three Restricted attachments a character ever has; the Setup's AttachSetAside attaches it beside two others and enforces nothing, so the hero keeps three.
  it.fails("19143:A:1 Restricted: attached at Setup to a hero who carries two Restricted attachments, one of the three is discarded", () => {
    const t = table({ phase: "Planning", attached: [{ code: "12197" }, { code: "12200" }] });
    expect(restricted(t.state, t, t.hero)).toBe(2);
    const { run } = setup(t, t.hero);
    expect(one(run.state, CODES.wormsbane)?.host).toBe(t.hero);
    expect(restricted(run.state, t, t.hero)).toBe(2);
  });

  it("19144:A:1 the Reforged side goes on a hero: The First Forge explored, the first player attaches it to the hero they choose, and no ally is offered", () => {
    const t = table({ phase: "Quest", staging: [], active: CODES.theFirstForge, attached: [{ code: CODES.wormsbane }], play: ["ally"] });
    // The quest card places the progress that explores The First Forge (it is immune to player card effects).
    const steps: EngineStep[] = [];
    const pushed = pushEffectFrame(t.state, { frame: "ResolveEffect", sourceId: t.state.questStage ?? "", actor: 0, peril: false, effectId: "test", instructions: [{ verb: "PlaceProgressOn", amount: 99, target: "activeLocation" }], cancel: null, blockCancel: null }, steps);
    const explored = settle({ ...pushed, window: null }, t.ctx, steps);
    const offer = legalIntents(explored, t.ctx).find((intent) => intent.type === "Trigger" && intent.cardId === idOf(t.state, CODES.theFirstForge));
    expect(offer).toBeDefined();
    const pending = send({ state: explored, steps: [] }, offer as PlayerIntent, t.ctx);
    const options = pending.state.window?.kind === "choose" ? pending.state.window.options : [];
    expect([...options].sort()).toEqual([t.hero, t.hero2].sort());
    const done = finish(send(pending, { type: "Choose", optionId: t.hero2 }, t.ctx), t.ctx);
    expect(one(done.state, "19144")?.host).toBe(t.hero2);
  });
});
