// Rules: rr.search, rr.reveal, rr.guarded, rr.engaged, rr.quest-advancement, rr.surge, rr.cancel, rr.travel (data/rules/entries.json); ledger lines 51201:B:2, 51201:B:3, 51203:B:1, 51205:B:1, 51211:A:3, 51240:A:1, 51241:A:1 (docs/scenarios/standalone-scenarios/the-mines-of-moria.md, The Mines of Moria, readings 7 to 11 and 13).
// The pieces The Mines of Moria adds, on the scenario's own cards: the Watcher's flip and the stage that advances after it, Hidden Threat's facedown card and its reveal, A Presence in the Dark's ranking of the top two cards, Narrow Paths' guarded attachments, Stairs of Náin's surge and the bar to travel to Chamber of Mazarbul.
import { describe, expect, it } from "vitest";

import { currentCause, UNATTRIBUTED } from "../../core/cause.ts";
import { modifiedStat, placeDamage } from "../../core/keywords.ts";
import { updateCard, type ScenarioState } from "../../core/state.ts";
import { settle } from "../../engine/machine.ts";
import type { EngineStep } from "../../core/intents.ts";
import { legalTargets } from "../../engine/reduce.ts";
import { restricted } from "../../interpret/restrictions.ts";
import { fireForced } from "../../windows/triggers.ts";
import { finish, idOf, idsOf, opening, resolveRecords, revealFromTop, send, start, tableFromLayout, type Layout } from "../../../../test/harness/scene-kit.ts";
import { titleHeld } from "./held.ts";
import { arrangeTopByChallenge } from "./hidden.ts";

// The quest cards a Quick-build game keeps: 1A, one stage 2 and one stage 3 (the Setup of 51201), so a stage number is the printed one.
const STAGES_2 = ["51203", "51204", "51205"];
const realStages = (stage: string | undefined): string[] => (stage != null && ["51207", "51208", "51209"].includes(stage) ? ["51201", "51203", stage] : ["51201", STAGES_2.includes(stage ?? "") ? (stage as string) : "51203", "51207"]);
const table = (layout: Layout) => tableFromLayout("the-mines-of-moria", { stages: realStages(layout.stage), ...layout });
const codesOf = (state: ScenarioState, ids: readonly string[]): string[] => ids.map((id) => state.cards[id]?.code ?? "");

describe("The Watcher and stage 1B (reading 7)", () => {
  // Damage the Watcher cannot survive (8 hit points with one player), settled; the combat phase's pass window is still open.
  const slain = (progress: number) => {
    const made = table({ stage: "51201", progress, staging: ["51210"], phase: "Combat" });
    const watcher = idOf(made.state, "51210");
    const steps: EngineStep[] = [];
    const hit = placeDamage(made.state, watcher, 8, made.cards, steps, "framework", currentCause(steps, UNATTRIBUTED));
    return { made, watcher, run: finish({ state: settle(hit, made.ctx, steps), steps }, made.ctx) };
  };

  it("51201:B:2 the defeated Watcher is not discarded: the one card turns over into Chamber of Mazarbul in the staging area, with no tokens", () => {
    const { run, watcher } = slain(5);
    expect(run.state.cards[watcher]).toMatchObject({ code: "51211", zone: "staging", damage: 0, other: "51210" });
    expect(run.state.encounterDiscard).not.toContain(watcher);
  });

  it("51201:B:3 the stage holding 5 progress advances once the Watcher is gone, at the next step of the round", () => {
    const { run, made } = slain(5);
    expect(run.state.cards[run.state.questStage ?? ""]?.code).toBe("51201");
    const next = send(run, { type: "Pass" }, made.ctx);
    expect(next.state.cards[next.state.questStage ?? ""]?.code).toBe("51203");
  });

  it("51201:B:3 the stage cannot be defeated while the Watcher is in play", () => {
    const made = table({ stage: "51201", progress: 5, staging: ["51210"] });
    expect(restricted(made.state, made.ctx, "advance")).toHaveLength(1);
    expect(restricted(table({ stage: "51201", progress: 5 }).state, made.ctx, "advance")).toHaveLength(0);
  });
});

describe("Chamber of Mazarbul (reading 8)", () => {
  const travelTargets = (stage: string): string[] => {
    const made = table({ stage, phase: "Travel", staging: ["51211", "51213"], hand: ["filler"] });
    return legalTargets(made.state, { type: "Travel" }, made.ctx).map((id) => made.state.cards[id]?.code ?? "");
  };

  it("51211:A:3 the players cannot travel to it before stage 3, and can at stage 3", () => {
    expect(travelTargets("51203")).toEqual(["51213"]);
    expect(travelTargets("51207").sort()).toEqual(["51211", "51213"]);
  });

  it("51211:A:1 its Threat is 1 more than the stage number", () => {
    const threatAt = (stage: string): number => {
      const made = table({ stage, staging: ["51211"] });
      const card = made.state.cards[idOf(made.state, "51211")];
      return card ? modifiedStat(made.state, card, "threat", made.cards) : -1;
    };
    expect(threatAt("51203")).toBe(3);
    expect(threatAt("51207")).toBe(4);
  });
});

describe("Hidden Threat (51241:A:1, reading 11)", () => {
  const hidden = (extra: Layout = {}) => {
    const made = table({ stage: "51203", phase: "Quest", deck: ["51213", "51212", "f0", "f0", "f0", "f0"], ...extra });
    const revealed = finish({ state: revealFromTop(made.state, made.ctx, "51241", []).state, steps: [] }, made.ctx).state;
    return { made, revealed };
  };
  const questAndFind = (extra: Layout): string | undefined => {
    const { made, revealed } = hidden(extra);
    let run = start({ ...revealed, ...opening("Quest") });
    run = send(run, { type: "Commit", cardIds: [...idsOf(revealed, "dh1"), ...idsOf(revealed, "dh2")] }, made.ctx);
    run = send(run, { type: "Pass" }, made.ctx);
    return Object.values(run.state.cards).find((card) => card.code === "51213")?.zone;
  };

  it("lays the card nearest the top with cost no more than the stage number facedown under the main quest, and shuffles the deck", () => {
    const { revealed } = hidden();
    const under = Object.values(revealed.cards).filter((card) => card.zone === "under");
    expect(under.map((card) => card.code)).toEqual(["51213"]);
    expect(under[0]).toMatchObject({ face: "down", host: revealed.questStage, hiddenAt: 1 });
    expect(revealed.encounterDeck.map((id) => revealed.cards[id]?.code)).not.toContain("51213");
  });

  it("reveals the card after the next successful quest: a location joins the staging area", () => {
    expect(questAndFind({})).toBe("staging");
  });

  it("keeps the card hidden after a quest that fails", () => {
    expect(questAndFind({ staging: ["f3", "f3"] })).toBe("under");
  });

  it("changes nothing but the shuffle when no card of the top 5 costs that little", () => {
    const made = table({ stage: "51203", deck: ["51242", "51233", "f0", "f0", "f0"] });
    const done = resolveRecords(made.state, made.ctx, "51241", "whenRevealed");
    expect(Object.values(done.state.cards).some((card) => card.zone === "under")).toBe(false);
  });
});

describe("A Presence in the Dark (51203:B:1, reading 9)", () => {
  const top = (deck: string[]): string[] => {
    const made = table({ stage: "51203", deck });
    const arranged = arrangeTopByChallenge(made.state, made.ctx);
    return codesOf(arranged, arranged.encounterDeck);
  };

  it("puts the weaker of the top two cards on the bottom and keeps the stronger on top: an enemy before a treachery before a location", () => {
    expect(top(["51213", "51212", "51214", "51216"])).toEqual(["51212", "51214", "51216", "51213"]);
    expect(top(["51214", "51213", "51216"])).toEqual(["51214", "51216", "51213"]);
    expect(top(["51213", "51214", "f0"]).at(0)).toBe("51214");
  });

  it("with two enemies the higher Threat is stronger, and level cards leave the top card on top", () => {
    expect(top(["51221", "51212", "51216"])[0]).toBe("51212");
    expect(top(["51216", "51219", "51222"])[0]).toBe("51219");
    expect(top(["51213", "51213", "51216"])[0]).toBe("51213");
  });

  it("a deck of one card is left as it is", () => {
    expect(top(["51214"])).toEqual(["51214"]);
  });

  it("is a Forced effect at the beginning of the staging step", () => {
    const made = table({ stage: "51203", deck: ["51213", "51212", "51214"] });
    const steps: EngineStep[] = [];
    const done = settle(fireForced({ ...made.state, window: null }, { trigger: "stagingStepBegins", seat: 0 }, made.ctx, steps), made.ctx, steps);
    expect(codesOf(done, done.encounterDeck)).toEqual(["51212", "51214", "51213"]);
  });
});

describe("Narrow Paths (51205:B:1, reading 10)", () => {
  const held = (extra: Layout = {}) => {
    const made = table({ stage: "51205", deck: ["f0", "f0"], hand: ["attachment"], attached: [{ code: "attachment", to: "dh1" }, { code: "attachment", to: "dh2" }], ...extra });
    const done = resolveRecords(made.state, made.ctx, "51205", "whenRevealed", idOf(made.state, "51205"));
    return { made, state: done.state };
  };

  it("lays the attachment each player controls faceup under the stage, still its owner's", () => {
    const { state } = held();
    const under = Object.values(state.cards).filter((card) => card.zone === "under");
    expect(under).toHaveLength(1);
    expect(under[0]).toMatchObject({ face: "up", host: idOf(state, "51205"), heldTitle: true, heldPutting: true });
  });

  it("bars playing and putting into play a copy of its title, while copies in play stay", () => {
    const { made, state } = held();
    const copy = idsOf(state, "attachment").find((id) => state.cards[id]?.zone === "hand") ?? "";
    expect(titleHeld(state, copy, made.ctx, false)).toBe(true);
    expect(titleHeld(state, copy, made.ctx, true)).toBe(true);
    const inPlay = idsOf(state, "attachment").filter((id) => state.cards[id]?.zone !== "under" && state.cards[id]?.zone !== "hand");
    expect(inPlay).toHaveLength(1);
  });

  it("returns each guarded attachment to its owner's hand once the stage has left the quest", () => {
    const { made, state } = held();
    const stage = idOf(state, "51205");
    const gone = settle(updateCard(state, stage, { zone: "setAside" }), made.ctx, []);
    expect(Object.values(gone.cards).filter((card) => card.zone === "under")).toHaveLength(0);
    expect(gone.seats[0]?.hand.length).toBe(2);
  });
});

describe("Stairs of Náin (51240:A:1, reading 13)", () => {
  it("the first treachery revealed each round gains surge, a second does not", () => {
    const made = table({ stage: "51203", staging: ["51240"], deck: ["f0", "f0", "f0", "f0"] });
    const first = finish({ state: revealFromTop(made.state, made.ctx, "51244", []).state, steps: [] }, made.ctx).state;
    const second = finish({ state: revealFromTop(first, made.ctx, "51244", []).state, steps: [] }, made.ctx).state;
    const staged = (state: ScenarioState): number => state.staging.filter((id) => state.cards[id]?.code === "f0").length;
    // The first treachery reveals the next card too (surge); the second reveals none.
    expect(staged(first)).toBe(1);
    expect(staged(second)).toBe(1);
  });
});

describe("Goblin Warlord (51242:A:2)", () => {
  it("after it enters play the opposing team finds a 0 cost Goblin enemy and adds it to the staging area", () => {
    const made = table({ stage: "51203", deck: ["51213", "51251", "f0"] });
    const done = finish({ state: revealFromTop(made.state, made.ctx, "51242", []).state, steps: [] }, made.ctx).state;
    expect(done.staging.map((id) => done.cards[id]?.code).sort()).toEqual(["51242", "51251"]);
  });
});
