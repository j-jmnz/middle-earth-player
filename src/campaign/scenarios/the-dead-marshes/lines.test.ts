// Rules: sotm.escape-test, sotm.escape-test-example, sotm.reset-the-quest-deck, rr.then, rr.staging, rr.active-location, rr.forced, rr.winning-the-game (data/rules/entries.json); ledger lines 02105:A:1, 02106:B:1, 02106:B:2, 02107:A:1, 02108:A:1, 02110:A:1, 02114:A:1,
// 02108:A:2, 02109:A:2, 02110:A:2, 02111:A:2, 02112:A:2, 02113:A:2, 02114:A:2, 02115:A:2.
// What a spec row cannot express on The Dead Marshes: a choice that picks a character, a stat other than Willpower, a stage over several steps. Each test starts its title with the line id it covers.
import { describe, expect, it } from "vitest";

import type { EngineStep } from "../../../rules/core/intents.ts";
import { first, idsOf, resolveRecords, revealFromTop, send, start, type Layout, type Run } from "../../../../test/harness/scene-kit.ts";
import { definePrinted } from "../../../rules/core/printed.ts";
import { escapeValueOf } from "../../../rules/families/escape/value.ts";
import { settle } from "../../../rules/engine/machine.ts";
import { syncConstants } from "../../../rules/interpret/constants.ts";
import { updateCard, type ScenarioState } from "../../../rules/core/state.ts";
import { placeQuestProgress } from "../../../rules/quest/quest.ts";
import { fireForced } from "../../../rules/windows/triggers.ts";
import { afterProgress } from "../../../rules/quest/stage-reveal.ts";
import { table, zoneOf, tokens, threat, withHero, playTest, revealAndPlay, type Made } from "./kit.ts";

describe("02105:A:1 Setup", () => {
  it("02105:A:1 searches the encounter deck for Gollum and adds him to the staging area, then each player reveals a card", () => {
    const made = table({ stage: "02105", seats: 2, deck: ["f0", "02107", "f0", "f0"] });
    const done = resolveRecords(made.state, made.ctx, "02105", "setup", first(made.state, "02105"));
    expect(zoneOf(done.state, "02107")).toBe("staging");
    // The two cards revealed are two of the three enemies; one stays in the deck.
    expect(idsOf(done.state, "f0").filter((id) => done.state.cards[id]?.zone === "staging")).toHaveLength(2);
    expect(done.state.encounterDeck).toHaveLength(1);
  });
});

describe("02106:B:1 The Capture", () => {
  // The stage has 3 quest points: the progress that fills it defeats it, and the stage's Forced effect asks the first player which player makes the test.
  const defeated = (layout: Layout, commits: readonly (readonly string[])[] = [], pick = (state: ScenarioState) => (state.window?.kind === "choose" ? (state.window.options[0] ?? "") : "")) => {
    const made = table({ stage: "02106", progress: 0, ...layout });
    const before = made.state;
    const placed = [] as EngineStep[];
    const after = afterProgress(placeQuestProgress(before, 3, made.ctx.cards, placed, () => true), 0, made.ctx, placed);
    let run = playTest(made, settle({ ...after, window: null }, made.ctx, placed), commits);
    for (let step = 0; step < 6 && run.state.window?.kind === "choose"; step += 1) run = playTest(made, send(run, { type: "Choose", optionId: pick(run.state) }, made.ctx).state, commits);
    return { made, run };
  };

  it("02106:B:1 the first player picks a player, who makes an escape test dealing a card for each token on Gollum, and a failed test resets the quest deck to stage 1B", () => {
    const { made, run } = defeated({ stage: "02106", staging: [{ code: "02107", resources: 2 }], deck: ["02111", "02111", "02111"] });
    // Nothing committed: the test fails, so the quest is back at stage 1 with no progress, and two cards were dealt.
    expect(zoneOf(run.state, "02105")).toBe("questStage");
    expect(run.state.cards[first(run.state, "02105")]?.progress).toBe(0);
    expect(run.state.encounterDiscard).toHaveLength(2);
    expect(run.state.stageCleared).toBeFalsy();
    expect(made.state.encounterDeck).toHaveLength(3);
  });

  it("02106:B:1 with Gollum out of play nobody is captured: no test is made and the quest deck is reset", () => {
    const { run } = defeated({ staging: [], deck: ["f0"] });
    expect(zoneOf(run.state, "02105")).toBe("questStage");
    expect(run.state.encounterDeck).toHaveLength(1);
  });
});

describe("02106:B:2 The final test", () => {
  const won = (commits: readonly (readonly string[])[], layout: Layout): ScenarioState => {
    const made = table({ stage: "02106", progress: 0, ...layout });
    const placed = [] as EngineStep[];
    const after = afterProgress(placeQuestProgress(made.state, 3, made.ctx.cards, placed, () => true), 0, made.ctx, placed);
    return playTest(made, settle({ ...after, window: null }, made.ctx, placed), commits).state;
  };

  it("02106:B:2 the game is not won when the stage is defeated, only when the escape test is passed", () => {
    const made = table({ stage: "02106", staging: [{ code: "02107", resources: 1 }], deck: ["f0"] });
    const placed = [] as EngineStep[];
    const defeated = settle(afterProgress(placeQuestProgress(made.state, 3, made.ctx.cards, placed, () => true), 0, made.ctx, placed), made.ctx, placed);
    expect(defeated.stageCleared).toBeFalsy();
    expect(defeated.window?.kind).toBe("escapeCommit");
  });

  it("02106:B:2 passing the test wins the game", () => {
    const state = won([["dh1"]], { staging: [{ code: "02107", resources: 1 }], deck: ["f0"] });
    expect(state.stageCleared).toBe(true);
    expect(state.lost).toBeFalsy();
  });

  it("02106:B:2 a test passed that this stage's own effect did not make (a treachery's, Gollum's) does not win while the stage is current", () => {
    const made = table({ stage: "02106", staging: [{ code: "02107", resources: 1 }], deck: ["f0", "f0", "f0"] });
    const nightfall = revealAndPlay(made, "02109", [["dh1"]]);
    // The test was passed (no token on Gollum, threat unchanged) and the game goes on.
    expect(tokens(nightfall.state, "02107")).toBe(1);
    expect(nightfall.state.stageCleared).toBeFalsy();
    expect(nightfall.state.lost).toBeFalsy();
    // Gollum's own end-of-phase test is a party test, passed the same way.
    const questing = table({ stage: "02106", phase: "Quest", staging: [{ code: "02107", resources: 1 }], deck: ["f0", "f0", "f0"] });
    const quest = start(settle(fireForced({ ...questing.state, window: null }, { trigger: "endOfPhase", seat: 0, phase: "Quest" }, questing.ctx, []), questing.ctx, []));
    expect(quest.state.window?.kind).toBe("escapeCommit");
    const gollum = playTest(questing, quest.state, [["dh1"]]);
    expect(gollum.state.stageCleared).toBeFalsy();
    // Then the stage's own test, passed, wins.
    expect(won([["dh1"]], { staging: [{ code: "02107", resources: 1 }], deck: ["f0"] }).stageCleared).toBe(true);
  });

  it("02106:B:2 a test that is tied or lost does not win", () => {
    const state = won([["dh1"]], { staging: [{ code: "02107", resources: 1 }], deck: ["02109"] });
    expect(state.stageCleared).toBeFalsy();
  });
});

describe("02107:A:1 Gollum at 8 tokens", () => {
  it("02107:A:1 shuffles Gollum into the encounter deck when he holds 8 resource tokens, his tokens gone with him", () => {
    const made = table({ stage: "02105", staging: [{ code: "02107", resources: 8 }], deck: ["f0"] });
    const done = settle({ ...made.state, window: null }, made.ctx, []);
    expect(zoneOf(done, "02107")).toBe("encounterDeck");
    expect(tokens(done, "02107")).toBe(0);
  });

  it("02107:A:1 leaves Gollum in play at 7 tokens", () => {
    const made = table({ stage: "02105", staging: [{ code: "02107", resources: 7 }], deck: ["f0"] });
    expect(zoneOf(settle({ ...made.state, window: null }, made.ctx, []), "02107")).toBe("staging");
  });
});

describe("02108:A:1 A Wisp of Pale Sheen", () => {
  const wisp = (layout: Layout, lore: readonly string[], seatTwo: readonly string[] = []) => {
    const made = table({ stage: "02105", staging: [{ code: "02107" }], deck: ["f0"], ...layout });
    let state = made.state;
    for (const code of lore) state = withHero({ ...made, state }, code, { sphere: "lore" });
    for (const code of seatTwo) state = withHero({ ...made, state }, code, { sphere: "lore" }, 1);
    return { made, state };
  };
  const reveal = (made: Made, state: ScenarioState): Run => start(revealFromTop(state, made.ctx, "02108", [] as EngineStep[]).state);

  it("02108:A:1 places 2 resource tokens on Gollum when no player has a ready Lore hero", () => {
    const { made, state } = wisp({}, []);
    expect(tokens(reveal(made, state).state, "02107")).toBe(2);
  });

  it("02108:A:1 a player may exhaust a Lore hero they control to reduce the tokens to 1", () => {
    const { made, state } = wisp({}, ["lore1"]);
    const asked = reveal(made, state);
    expect(asked.state.window).toMatchObject({ kind: "choose", seat: 0 });
    const done = send(asked, { type: "Choose", optionId: "reduce" }, made.ctx);
    expect(tokens(done.state, "02107")).toBe(1);
    expect(done.state.cards[first(done.state, "lore1")]?.exhausted).toBe(true);
  });

  it("02108:A:1 declining keeps the 2 tokens and the hero ready", () => {
    const { made, state } = wisp({}, ["lore1"]);
    const done = send(reveal(made, state), { type: "Choose", optionId: "keep" }, made.ctx);
    expect(tokens(done.state, "02107")).toBe(2);
    expect(done.state.cards[first(done.state, "lore1")]?.exhausted).toBe(false);
  });

  it("02108:A:1 asks each player in turn, once: after the first reduces, the second is not asked", () => {
    const { made, state } = wisp({ seats: 2 }, ["lore1"], ["lore2"]);
    const done = send(reveal(made, state), { type: "Choose", optionId: "reduce" }, made.ctx);
    expect(tokens(done.state, "02107")).toBe(1);
    expect(done.state.window?.kind).not.toBe("choose");
    expect(done.state.cards[first(done.state, "lore2")]?.exhausted).toBe(false);
  });

  it("02108:A:1 offers the second player the reduction when the first declines, and an exhausted Lore hero is not offered", () => {
    const { made, state } = wisp({ seats: 2 }, ["lore1"], ["lore2"]);
    const tired = updateCard(state, first(state, "lore1"), { exhausted: true });
    const asked = reveal(made, tired);
    // The first player's only choice is "keep", so it is made without asking: the second player is asked.
    expect(asked.state.window).toMatchObject({ kind: "choose", seat: 1 });
  });

  it("02108:A:1 on Nightmare with Gollum out of play and the Mere in staging, the reduction is offered and the tokens land on the Mere", () => {
    const { made, state } = wisp({ staging: ["900802"] }, ["lore1"]);
    const asked = reveal(made, state);
    expect(asked.state.window).toMatchObject({ kind: "choose", seat: 0 });
    const done = send(asked, { type: "Choose", optionId: "reduce" }, made.ctx);
    expect(tokens(done.state, "900802")).toBe(1);
    expect(done.state.cards[first(done.state, "lore1")]?.exhausted).toBe(true);
    const kept = send(reveal(made, state), { type: "Choose", optionId: "keep" }, made.ctx);
    expect(tokens(kept.state, "900802")).toBe(2);
  });

  it("02108:A:1 offers no reduction while Gollum is out of play, and places no token", () => {
    const { made, state } = wisp({ staging: [] }, ["lore1"]);
    const done = reveal(made, state);
    expect(done.state.window?.kind).not.toBe("choose");
  });
});

describe("02110:A:1 Through the Mist", () => {
  const mist = (hero: Partial<Parameters<typeof definePrinted>[0]>) => {
    const made = table({ stage: "02105", staging: [{ code: "02107" }], deck: ["02113", "f0"] });
    const state = withHero(made, "tester", hero);
    return { made, run: revealAndPlay(made, "02110", [["tester"]], state) };
  };

  it("02110:A:1 counts Attack instead of Willpower: Attack 5 passes against Escape 2", () => {
    const { run } = mist({ willpower: 0, attack: 5 });
    expect(tokens(run.state, "02107")).toBe(0);
    expect(threat(run.state)).toBe(28);
  });

  it("02110:A:1 fails with a Willpower that does not count: 1 token and each player raises threat by 1", () => {
    const { run } = mist({ willpower: 5, attack: 1 });
    expect(tokens(run.state, "02107")).toBe(1);
    expect(threat(run.state)).toBe(29);
  });
});

describe("02114:A:1 The Heart of the Marshes", () => {
  const nightfall = (layout: Layout) => {
    const made = table({ stage: "02105", staging: [{ code: "02107" }], deck: ["f0", "f0"], ...layout });
    return revealAndPlay(made, "02109", [["dh1"]], made.state);
  };

  it("02114:A:1 while it is the active location each card dealt counts 1 more Escape, a card with no value too: 2 against 1 + 1 fails", () => {
    expect(tokens(nightfall({ active: "02114" }).state, "02107")).toBe(1);
  });

  it("02114:A:1 adds nothing while it is in the staging area: 2 against 0 passes", () => {
    expect(tokens(nightfall({ staging: [{ code: "02107" }, "02114"] }).state, "02107")).toBe(0);
  });
});

describe("Escape values", () => {
  const value = (code: string): number => {
    const made = table({ stage: "02105", staging: [code] });
    return escapeValueOf(made.state, first(made.state, code), made.ctx);
  };
  it("02108:A:2 A Wisp of Pale Sheen counts Escape 4 when dealt", () => expect(value("02108")).toBe(4));
  it("02109:A:2 Nightfall counts Escape 2 when dealt", () => expect(value("02109")).toBe(2));
  it("02110:A:2 Through the Mist counts Escape 3 when dealt", () => expect(value("02110")).toBe(3));
  it("02111:A:2 The Lights of the Dead counts Escape 5 when dealt", () => expect(value("02111")).toBe(5));
  it("02112:A:2 Giant Marsh Worm counts Escape 2 when dealt", () => expect(value("02112")).toBe(2));
  it("02113:A:2 Impassable Bog counts Escape 2 when dealt", () => expect(value("02113")).toBe(2));
  it("02114:A:2 The Heart of the Marshes counts Escape 1 when dealt", () => expect(value("02114")).toBe(1));
  it("02115:A:2 Fens and Mires counts Escape 2 when dealt", () => expect(value("02115")).toBe(2));
  it("02108:A:2 has no other effect while in play: a treachery with an Escape value only counts when dealt", () => {
    const made = table({ stage: "02105", staging: [{ code: "02107" }, "02115"] });
    expect(syncConstants(made.state, made.ctx).modifiers.filter((modifier) => modifier.sourceId === first(made.state, "02115"))).toEqual([]);
  });
});
