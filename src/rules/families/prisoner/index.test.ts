// Rules: rr.in-play-and-out-of-play, rr.ownership-and-control, rr.attachment-cards, rr.blank (data/rules/entries.json); ledger lines 01123:B:1,
// 01124:B:1, 01131:A:3, 01131:B:1, 01102:A:2. The prisoner family's verbs on a table of Escape from Dol Guldur.
import { beforeAll, describe, expect, it } from "vitest";

import { syncConstants } from "../../constants.ts";
import type { EngineStep } from "../../intents.ts";
import { legalIntents } from "../../legal.ts";
import { settle } from "../../machine.ts";
import { runInstruction } from "../../interpret.ts";
import { pushCardEffects } from "../../effect-frames.ts";
import { pickCandidates } from "../../pick.ts";
import { reduce, startScenario } from "../../reduce.ts";
import { expectOk } from "../../fixture.ts";
import { textBlank } from "../attachments/hold.ts";
import { prisonerHero } from "./index.ts";
import type { ScenarioState } from "../../state.ts";
import { dolGuldurTable, loadDolGuldurWorld, MENDOR, type DolGuldurLayout, type DolGuldurWorld } from "../../../../scripts/dol-guldur-scene.ts";
import { dolGuldurWorld, dolGuldurStart, LOGGED_PRISONER, STRONG_HEROES } from "../../../../scripts/dol-guldur-game.ts";
import { send, start, type Run } from "../../../../scripts/past-scene.ts";
import { causeProblems } from "../../../../scripts/cause-check.ts";

let world: DolGuldurWorld;

beforeAll(async () => {
  world = await loadDolGuldurWorld();
});

// Stage 1B is revealed: its When Revealed effect resolves (the Forced effects and choices it opens settle, the first option taken).
function revealStage(layout: DolGuldurLayout = {}): { run: Run; ctx: ReturnType<typeof dolGuldurTable>["ctx"]; hero: string; hero2: string; seat1Hero: string | null } {
  const made = dolGuldurTable(world, layout);
  const state = syncConstants(made.state, made.ctx);
  const stage = state.questStage ?? "";
  const effects = made.ctx.effects.filter((effect) => effect.cardCode === "01123" && effect.timing === "whenRevealed");
  const steps: EngineStep[] = [];
  const pushed = pushCardEffects(state, "whenRevealed", stage, state.firstPlayer, false, effects, made.ctx, steps);
  let run: Run = { state: settle({ ...pushed, window: null }, made.ctx, steps), steps };
  for (let guard = 0; guard < 10 && run.state.window?.kind === "choose"; guard += 1) run = send(run, { type: "Choose", optionId: run.state.window.options[0] ?? "" }, made.ctx);
  return { run, ctx: made.ctx, hero: made.hero, hero2: made.hero2, seat1Hero: made.seat1Hero };
}

describe("TakePrisoner (01123:B:1)", () => {
  it("turns one hero of the players facedown, takes it out of its player's heroes and keeps it in play, controlled by nobody", () => {
    const { run, ctx, hero, hero2 } = revealStage({ seed: 3 });
    const prisoner = prisonerHero(run.state);
    expect(prisoner === hero || prisoner === hero2).toBe(true);
    const card = run.state.cards[prisoner ?? ""];
    expect(card?.zone).toBe("captive");
    expect(card?.face).toBe("down");
    expect(card?.controller).toBeNull();
    expect(card?.host).toBeNull();
    expect(card?.owner).toBe(0);
    expect(run.state.seats[0].heroes).not.toContain(prisoner);
    expect(run.state.seats[0].heroes.length).toBe(1);
    expect(textBlank(run.state, prisoner ?? "")).toBe(true);
    // It cannot be picked, so nothing can damage or use it, and it collects no resources.
    expect(pickCandidates(run.state, { type: "hero", control: "any" }, 0, [], null, ctx)).not.toContain(prisoner);
    expect(causeProblems(run.steps)).toEqual([]);
  });

  it("chooses with the game's seed: the same seed takes the same hero, other seeds take others", () => {
    const seen = new Set<string | null>();
    for (let seed = 1; seed <= 12; seed += 1) {
      const a = revealStage({ seed, seats: 2 });
      const b = revealStage({ seed, seats: 2 });
      expect(prisonerHero(a.run.state)).toBe(prisonerHero(b.run.state));
      seen.add(a.run.state.cards[prisonerHero(a.run.state) ?? ""]?.code ?? null);
    }
    expect(seen.size).toBe(3);
  });
});

describe("the campaign card's Forced effect (01131:A:3)", () => {
  async function started(seatCount: 1 | 2, seed: number, facts?: typeof LOGGED_PRISONER) {
    const { ctx } = await dolGuldurWorld();
    let state = startScenario(dolGuldurStart(seatCount, seed, "Normal", facts), ctx);
    while (state.window?.kind === "mulligan") state = expectOk(reduce(state, { type: "Keep" }, ctx)).state;
    for (let guard = 0; guard < 6 && state.window?.kind === "choose"; guard += 1) state = expectOk(reduce(state, { type: "Choose", optionId: state.window.options[0] ?? "" }, ctx)).state;
    return { state, ctx };
  }
  const byCode = (state: ScenarioState, code: string) => Object.values(state.cards).filter((card) => card.code === code);

  it("selects the prisoner from the Campaign Log instead, captures Mendor and Appointed by Fate's hero's cards with it and flips the card", async () => {
    for (const seatCount of [1, 2] as const) {
      for (let seed = 1; seed <= 6; seed += 1) {
        const { state } = await started(seatCount, seed, LOGGED_PRISONER);
        const prisoner = state.cards[prisonerHero(state) ?? ""];
        expect(prisoner?.code, `${seatCount} seats, seed ${seed}`).toBe("q2");
        const mendor = byCode(state, MENDOR)[0];
        expect(mendor?.zone).toBe("captive");
        expect(mendor?.host).toBe(prisoner?.id);
        expect(mendor?.face).toBe("down");
        expect(textBlank(state, mendor?.id ?? "")).toBe(true);
        const campaignCard = byCode(state, "01131")[0];
        expect(campaignCard?.face).toBe("B");
        // The hero the log named is out of the heroes, every other hero is where it was (the one chosen at random came back to its own place).
        expect(state.seats.flatMap((seat) => seat.heroes).map((id) => state.cards[id]?.code)).toEqual(STRONG_HEROES.slice(0, seatCount * 3).filter((code) => code !== "q2"));
      }
    }
  });

  it("keeps the hero selected at random when the log names none, or names a hero the players do not control", async () => {
    const none = await started(1, 4);
    const stranger = await started(1, 4, { prisoner: "nobody", usedOnce: [], counters: {} });
    expect(prisonerHero(none.state)).toBe(prisonerHero(stranger.state));
    expect(none.state.cards[prisonerHero(none.state) ?? ""]).toBeDefined();
    expect(byCode(none.state, "01131")[0]?.face).toBe("B");
  });

  it("holds the cards attached to the prisoner facedown and blank until the rescue (Appointed by Fate on the first player's hero q1)", async () => {
    const { state } = await started(1, 4, { prisoner: "q1", usedOnce: [], counters: {} });
    const appointed = byCode(state, "01134")[0];
    expect(appointed?.face).toBe("down");
    expect(appointed?.prisoner).toBe(true);
    expect(textBlank(state, appointed?.id ?? "")).toBe(true);
    expect(appointed?.host).toBe(prisonerHero(state));
  });
});

describe("the rescue (01124:B:1) and the cards that hear it (01102:A:2, 01131:B:1)", () => {
  async function atStageTwo(seed = 4) {
    const { ctx } = await dolGuldurWorld();
    let state = startScenario(dolGuldurStart(1, seed, "Normal", { prisoner: "q1", usedOnce: [], counters: {} }), ctx);
    while (state.window?.kind === "mulligan") state = expectOk(reduce(state, { type: "Keep" }, ctx)).state;
    for (let guard = 0; guard < 6 && state.window?.kind === "choose"; guard += 1) state = expectOk(reduce(state, { type: "Choose", optionId: state.window.options[0] ?? "" }, ctx)).state;
    // The quest advances to stage 2B (progress placed on it later).
    const steps: EngineStep[] = [];
    const advanced = settle(syncConstants(runInstruction(state, { verb: "AdvanceStage" }, { seat: 0, sourceId: state.questStage }, ctx, steps), ctx), ctx, steps);
    return { state: { ...advanced, window: { kind: "pass" as const }, phase: "Quest" as const, mode: "questCommit" as const }, ctx, steps };
  }
  const code = (state: ScenarioState, id: string | null | undefined) => state.cards[id ?? ""]?.code;

  it("flips the prisoner faceup with 1 damage on it, back among its player's heroes, when progress is placed on stage 2B, and announces it", async () => {
    const { state, ctx, steps } = await atStageTwo();
    expect(code(state, state.questStage)).toBe("01124");
    const prisoner = prisonerHero(state) ?? "";
    expect(state.cards[prisoner]?.code).toBe("q1");
    const steps2: EngineStep[] = [...steps];
    const placed = runInstruction(state, { verb: "ProgressQuest", amount: 2 }, { seat: 0, sourceId: state.questStage }, ctx, steps2);
    let run: Run = { state: settle(syncConstants(placed, ctx), ctx, steps2), steps: steps2 };
    // The Response is offered to the players; it is taken.
    const offered = legalIntents(run.state, ctx).find((intent) => intent.type === "Trigger" && intent.effectId === "01124:response:1");
    expect(offered).toBeDefined();
    run = send(run, offered as never, ctx);
    const hero = run.state.cards[prisoner];
    expect(hero?.zone).toBe("heroes");
    expect(hero?.face).toBe("up");
    expect(hero?.damage).toBe(1);
    expect(hero?.controller).toBe(0);
    expect(hero?.prisoner).toBeUndefined();
    expect(run.state.seats[0].heroes).toContain(prisoner);
    expect(prisonerHero(run.state)).toBeNull();
    // Appointed by Fate (attached to q1) is faceup and in its controller's play area again, and works.
    const appointed = Object.values(run.state.cards).find((card) => card.code === "01134");
    expect(appointed?.face).toBe("up");
    expect(appointed?.host).toBe(prisoner);
    expect(appointed?.prisoner).toBeUndefined();
    expect(textBlank(run.state, appointed?.id ?? "")).toBe(false);
    // The Nazgûl of Dol Guldur, set aside faceup, came into the staging area when the prisoner was rescued.
    const nazgul = Object.values(run.state.cards).find((card) => card.code === "01102");
    expect(nazgul?.zone).toBe("staging");
    expect(nazgul?.face).toBe("up");
    expect(causeProblems(run.steps)).toEqual([]);
  });

  it("is offered only while a hero is the prisoner", async () => {
    const { state, ctx } = await atStageTwo();
    const rescued = runInstruction(state, { verb: "RescuePrisoner", damage: 1 }, { seat: 0, sourceId: state.questStage }, ctx, []);
    expect(prisonerHero(rescued)).toBeNull();
    const again = settle(syncConstants(runInstruction(rescued, { verb: "ProgressQuest", amount: 1 }, { seat: 0, sourceId: rescued.questStage }, ctx, []), ctx), ctx, []);
    expect(legalIntents(again, ctx).some((intent) => intent.type === "Trigger" && intent.effectId === "01124:response:1")).toBe(false);
  });

  it("frees Mendor faceup with 1 damage under the first player after the first objective is claimed, and only then (01131:B:1)", async () => {
    const { state, ctx } = await atStageTwo();
    const mendor = Object.values(state.cards).find((card) => card.code === MENDOR);
    expect(mendor?.zone).toBe("captive");
    // Nothing else frees him: a rescued prisoner leaves him captive.
    const rescued = runInstruction(state, { verb: "RescuePrisoner", damage: 1 }, { seat: 0, sourceId: state.questStage }, ctx, []);
    expect(rescued.cards[mendor?.id ?? ""]?.zone).toBe("captive");
    // The first objective is claimed.
    const objective = Object.values(rescued.cards).find((card) => card.code === "01108");
    expect(objective?.zone).toBe("staging");
    const free = settle({ ...rescued, cards: { ...rescued.cards, [objective?.id ?? ""]: { ...rescued.cards[objective?.id ?? ""]!, attachments: [] } } }, ctx, []);
    for (const id of free.cards[objective?.id ?? ""]?.attachments ?? []) expect(id).toBeUndefined();
    let run: Run = start({ ...free, window: { kind: "pass" } });
    run = send(run, { type: "Trigger", cardId: objective?.id ?? "", effectId: "01108:action:1" }, ctx);
    run = send(run, { type: "Choose", optionId: run.state.window?.kind === "choose" ? (run.state.window.options[0] ?? "") : "" }, ctx);
    // The Response to "after the first objective is claimed" is offered.
    const response = legalIntents(run.state, ctx).find((intent) => intent.type === "Trigger" && intent.effectId === "01131:response:1");
    expect(response).toBeDefined();
    run = send(run, response as never, ctx);
    const freed = run.state.cards[mendor?.id ?? ""];
    expect(freed?.zone).toBe("play");
    expect(freed?.face).toBe("up");
    expect(freed?.damage).toBe(1);
    expect(freed?.controller).toBe(0);
    expect(freed?.prisoner).toBeUndefined();
  });
});
