// Rules: rr.shadow-effects, rr.removing-from-quest, rr.cost, rr.keywords, rr.first-player (data/rules/entries.json).
// The Brooding Forest cards (05046 to 05048, tested for Into Ithilien in src/campaign/scenarios/into-ithilien/) where they act differently in The Drúadan Forest: a Wose as the attacker whose Threat the Drummer raises only in the staging area (05046:A:2, 05047:A:2), the Lost Companion on the
// Siege stage and beside Stars in Sky (05048:A:1), and the Action of the Overgrown Trail while Ancestral Clearing is in play (05046:A:1). Each test builds its moment with the scene kit; its title starts with the line id.
import { describe, expect, it } from "vitest";

import type { ScenarioState } from "../../../rules/core/state.ts";
import { legalIntents, type PlayerIntent } from "../../../rules/engine/reduce.ts";
import { committedWillpower } from "../../../rules/quest/quest.ts";
import { fightEnemy, finish, idOf, resolveRecords, send, start, type Layout } from "../../../../test/harness/scene-kit.ts";
import { CODES, revealPlay, table } from "../../../../test/scenarios/the-druadan-forest/table.ts";

const { passageOut: STAGE_3, drummer: DRUMMER, thief: THIEF, clearing: CLEARING, stars: STARS } = CODES;
const TRAIL = "05046";
const GLADE = "05047";
const COMPANION = "05048";
const ARAGORN = "01001";

const scene = (layout: Layout) => table(layout, undefined, [ARAGORN]);
const progressOf = (state: ScenarioState): number => state.cards[state.questStage ?? ""]?.progress ?? 0;
const committedIn = (state: ScenarioState): string[] => Object.values(state.cards).filter((card) => card.committed && card.zone === "heroes").map((card) => card.code).sort();

// "Shadow: Remove X progress tokens from the current quest, where X is the attacking enemy's Threat" (Overgrown Trail 05046:A:2, Secluded Glade 05047:A:2).
describe("05046:A:2 the shadow with a Wose attacking", () => {
  it("05046:A:2 X is the printed Threat 2 of the engaged Thief, though a Drummer in the staging area gives the Woses there +2: the Siege stage loses 2 of its 5 progress", () => {
    const { run } = fightEnemy(scene, TRAIL, THIEF, { stage: STAGE_3, progress: 5, staging: [DRUMMER] });
    expect(progressOf(run.state)).toBe(3);
  });

  it("05046:A:2 the progress comes off whatever the enemies' progress put on the stage, and no more than the stage holds", () => {
    const { run } = fightEnemy(scene, TRAIL, THIEF, { stage: STAGE_3, progress: 1 });
    expect(progressOf(run.state)).toBe(0);
  });
});

describe("05047:A:2 the shadow with a Wose attacking", () => {
  it("05047:A:2 X is the printed Threat 2 of the engaged Thief, though a Drummer in the staging area gives the Woses there +2: the Siege stage loses 2 of its 5 progress", () => {
    const { run } = fightEnemy(scene, GLADE, THIEF, { stage: STAGE_3, progress: 5, staging: [DRUMMER] });
    expect(progressOf(run.state)).toBe(3);
  });

  it("05047:A:2 the progress comes off whatever the enemies' progress put on the stage, and no more than the stage holds", () => {
    const { run } = fightEnemy(scene, GLADE, THIEF, { stage: STAGE_3, progress: 1 });
    expect(progressOf(run.state)).toBe(0);
  });
});

describe("05048:A:1 Lost Companion on the Siege stage", () => {
  it("05048:A:1 each player removes 1 character he controls from the quest; the stage counts the Defense of those that stay", () => {
    const made = scene({ stage: STAGE_3, committed: ["dh1", "dh2"], deck: ["f0"] });
    const boosted = { ...made.state, modifiers: [...made.state.modifiers, { instanceId: idOf(made.state, "dh2"), sourceId: "dh2", stat: "defense" as const, amount: 3, until: "endOfPhase" as const }] };
    const before = committedWillpower(boosted, made.ctx.cards);
    expect(before).toBe(7);
    const run = resolveRecords(boosted, made.ctx, COMPANION, "whenRevealed", undefined, (state) => (state.window?.kind === "choose" ? (state.window.options.includes(idOf(state, "dh1")) ? idOf(state, "dh1") : (state.window.options[0] ?? "")) : ""));
    expect(committedIn(run.state)).toEqual(["dh2"]);
    expect(committedWillpower(run.state, made.ctx.cards)).toBe(5);
  });

  it("05048:A:1 when any player has none committed all characters are removed: with Stars in Sky in the same round the heroes that paid for it are removed too", () => {
    // Two players, the first with dh1 and dh2 committed, the second with dh3; each hero holds 1 resource, so every hero pays for Stars in Sky and stays.
    const made = scene({ seats: 2, stage: STAGE_3, committed: ["dh1", "dh2", "dh3"], heroResources: 1, deck: ["f0", "f0"] });
    const stars = revealPlay(made, STARS, ["pay", "pay", "pay"]);
    expect(committedIn(stars.run.state)).toEqual(["dh1", "dh2", "dh3"]);
    const run = resolveRecords(stars.run.state, made.ctx, COMPANION, "whenRevealed");
    // The first player removed 1 of his 2, the second player his only one, and the second player has none left: the first player's other character goes too.
    expect(committedIn(run.state)).toEqual([]);
  });

  it("05048:A:1 with a character left for every player nobody else is removed", () => {
    const made = scene({ seats: 2, stage: STAGE_3, committed: ["dh1", "dh2", "dh3"], heroes: [{ code: ARAGORN, seat: 1 }], deck: ["f0"] });
    const state = { ...made.state, cards: { ...made.state.cards, [idOf(made.state, ARAGORN)]: { ...made.state.cards[idOf(made.state, ARAGORN)]!, committed: true } } };
    const run = resolveRecords(state, made.ctx, COMPANION, "whenRevealed");
    expect(committedIn(run.state)).toHaveLength(2);
  });
});

describe("05046:A:1 the Action of Overgrown Trail with Ancestral Clearing in play", () => {
  it("05046:A:1 a Ranger exhausts to place 3 progress on the Trail, whatever the Clearing does to the cost of player cards: an Action costs no resource", () => {
    const made = scene({ phase: "Planning", staging: [TRAIL, CLEARING], heroes: [{ code: ARAGORN, seat: 0 }] });
    const trigger = legalIntents(made.state, made.ctx).find((intent) => intent.type === "Trigger" && intent.cardId === idOf(made.state, TRAIL));
    expect(trigger).toBeDefined();
    const run = finish(send(start(made.state), trigger as PlayerIntent, made.ctx), made.ctx);
    expect(run.state.cards[idOf(run.state, TRAIL)]?.progress).toBe(3);
    expect(run.state.cards[idOf(run.state, ARAGORN)]?.exhausted).toBe(true);
  });
});
