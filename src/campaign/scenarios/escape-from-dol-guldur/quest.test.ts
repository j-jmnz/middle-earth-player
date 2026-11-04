// Rules: rr.quest-advancement, rr.winning-the-game, rr.objective-cards, rr.staging (data/rules/entries.json). The three quest cards of Escape
// from Dol Guldur (01123, 01124, 01125) on a table of plain-number heroes (test/scenarios/escape-from-dol-guldur/scene.ts): what keeps a stage from advancing.
import { beforeAll, describe, expect, it } from "vitest";

import { syncConstants } from "../../../rules/interpret/constants.ts";
import { runInstruction } from "../../../rules/interpret/interpret.ts";
import { destroyCard } from "../../../rules/core/keywords.ts";
import { settle } from "../../../rules/engine/machine.ts";
import { updateCard, type ScenarioState } from "../../../rules/core/state.ts";
import { attachTo, spawn } from "../../../rules/core/zones.ts";
import { dolGuldurTable, loadDolGuldurWorld, type DolGuldurLayout, type DolGuldurWorld } from "../../../../test/scenarios/escape-from-dol-guldur/scene.ts";
import { first } from "../../../../test/scenarios/a-shadow-of-the-past/scene.ts";

let world: DolGuldurWorld;

beforeAll(async () => {
  world = await loadDolGuldurWorld();
});

function make(layout: DolGuldurLayout = {}) {
  const made = dolGuldurTable(world, layout);
  return { ...made, state: syncConstants(made.state, made.ctx) };
}

type Table = ReturnType<typeof make>;

// `amount` progress placed on the quest, as questing does: the stage advances when it is full and nothing holds it back.
function progress(state: ScenarioState, amount: number, ctx: Table["ctx"]): ScenarioState {
  return settle(syncConstants(runInstruction({ ...state, window: null }, { verb: "ProgressQuest", amount }, { seat: 0, sourceId: state.questStage }, ctx, []), ctx), ctx, []);
}

const stageOf = (state: ScenarioState) => state.cards[state.questStage ?? ""]?.code;

describe("The Necromancer's Tower, stage 1B (01123:B:3)", () => {
  it("cannot advance without an objective card, however much progress is on it", () => {
    const { state, ctx } = make({});
    const full = progress(state, 12, ctx);
    expect(stageOf(full)).toBe("01123");
    expect(full.cards[full.questStage ?? ""]?.progress).toBe(12);
  });

  it("advances to stage 2 once a player has claimed an objective, and not for an objective still in the staging area", () => {
    const loose = make({ staging: ["01108"] });
    expect(stageOf(progress(loose.state, 9, loose.ctx))).toBe("01123");
    const claimed = make({ claimed: ["01108"] });
    const advanced = progress(claimed.state, 9, claimed.ctx);
    expect(stageOf(advanced)).toBe("01124");
    expect(advanced.cards[advanced.questStage ?? ""]?.progress).toBe(0);
  });
});

describe("Through the Caverns, stage 2B (01124:B:3)", () => {
  const prisoner = (made: Table): ScenarioState => settle(syncConstants(runInstruction({ ...made.state, window: null }, { verb: "TakePrisoner" }, { seat: 0, sourceId: made.state.questStage }, made.ctx, []), made.ctx), made.ctx, []);

  // The 3 objectives claimed by a hero still in play: a prisoner's attachments are no longer claimed, so they go on another hero.
  const claimAll = (state: ScenarioState, hero: string, ctx: Table["ctx"]): ScenarioState => {
    let next = state;
    for (const code of ["01108", "01109", "01110"]) {
      const objective = spawn(next, code, { zone: "attached" });
      next = updateCard(attachTo(objective.state, objective.id, hero), objective.id, { controller: 0, claimed: true });
    }
    return syncConstants(next, ctx);
  };

  it("cannot advance while a hero is the prisoner, even with all 3 objective cards held", () => {
    const base = make({ stage: "01124", seats: 2 });
    const taken = prisoner(base);
    const free = [base.hero, base.hero2].find((id) => taken.cards[id]?.zone === "heroes") ?? "";
    expect(stageOf(progress(claimAll(base.state, free, base.ctx), 15, base.ctx))).toBe("01125");
    const full = progress(claimAll(taken, free, base.ctx), 15, base.ctx);
    expect(stageOf(full)).toBe("01124");
    expect(full.cards[full.questStage ?? ""]?.progress).toBe(15);
  });

  it("cannot advance while an objective card is still in the staging area", () => {
    const held = make({ stage: "01124", claimed: ["01108", "01109"], guarded: [["01110", ""]] });
    expect(held.state.cards[first(held.state, "01110")]?.zone).toBe("staging");
    expect(stageOf(progress(held.state, 15, held.ctx))).toBe("01124");
  });

  it("advances once the prisoner is rescued and the players hold all 3 objective cards", () => {
    const two = make({ stage: "01124", claimed: ["01108", "01109"] });
    expect(stageOf(progress(two.state, 15, two.ctx))).toBe("01124");
    const three = make({ stage: "01124", claimed: ["01108", "01109", "01110"] });
    // Restricted: one hero holds two, so the third objective is on the other hero.
    const second = first(three.state, "01110");
    expect(three.state.cards[second]?.host).not.toBeNull();
    expect(stageOf(progress(three.state, 15, three.ctx))).toBe("01125");
  });
});

describe("Out of the Dungeons, stage 3B (01125:B:2)", () => {
  it("cannot be defeated while Nazgûl of Dol Guldur is in play, and the players win when it is defeated with none", () => {
    const withNazgul = make({ stage: "01125", staging: ["01102"], seats: 2 });
    const held = progress(withNazgul.state, 9, withNazgul.ctx);
    expect(held.stageCleared).toBe(false);
    expect(stageOf(held)).toBe("01125");
    expect(held.cards[held.questStage ?? ""]?.progress).toBe(9);
    // The Nazgûl is defeated: the full stage is defeated at the next progress, and the players have won.
    const nazgul = first(held, "01102");
    const gone = settle(syncConstants(destroyCard(held, nazgul, withNazgul.ctx.cards, []), withNazgul.ctx), withNazgul.ctx, []);
    const won = progress(gone, 1, withNazgul.ctx);
    expect(won.stageCleared).toBe(true);
    expect(won.lost).toBe(false);
  });

  it("is won with no Nazgûl in play once its quest points are met", () => {
    const { state, ctx } = make({ stage: "01125" });
    const won = progress(state, 7, ctx);
    expect(won.stageCleared).toBe(true);
  });
});
