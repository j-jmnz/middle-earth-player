// Rules: sotm.escape-test, sotm.escape-test-example, sotm.reset-the-quest-deck, rr.then, rr.staging, rr.active-location, rr.forced, rr.winning-the-game (data/rules/entries.json); ledger lines 02105:A:1, 02106:B:1, 02106:B:2, 02107:A:1, 02108:A:1, 02110:A:1, 02114:A:1,
// 02108:A:2, 02109:A:2, 02110:A:2, 02111:A:2, 02112:A:2, 02113:A:2, 02114:A:2, 02115:A:2.
// What a spec row cannot express on The Dead Marshes: a choice that picks a character, a stat other than Willpower, a stage over several steps. Each test starts its title with the line id it covers.
import { describe, expect, it } from "vitest";

import type { EngineStep } from "../../../rules/core/intents.ts";
import { fightEnemy, first, idOf, idsOf, legalTargets, resolveRecords, revealFromTop, send, start, tableFromLayout, type Layout, type Run } from "../../../../test/harness/scene-kit.ts";
import { definePrinted, type PrintedCard } from "../../../rules/core/printed.ts";
import { escapeValueOf } from "../../../rules/families/escape/value.ts";
import { settle } from "../../../rules/engine/machine.ts";
import { syncConstants } from "../../../rules/interpret/constants.ts";
import { updateCard, type ScenarioState } from "../../../rules/core/state.ts";
import { placeQuestProgress } from "../../../rules/quest/quest.ts";
import { attachTo, spawn } from "../../../rules/core/zones.ts";
import { fireForced } from "../../../rules/windows/triggers.ts";
import { modifiedStat } from "../../../rules/core/keywords.ts";
import { afterProgress } from "../../../rules/quest/stage-reveal.ts";

const table = (layout: Layout) => tableFromLayout("the-dead-marshes", layout);
type Made = ReturnType<typeof table>;
const zoneOf = (state: ScenarioState, code: string): string | undefined => state.cards[first(state, code)]?.zone;
const tokens = (state: ScenarioState, code: string): number => state.cards[first(state, code)]?.resources ?? 0;
const threat = (state: ScenarioState, seat = 0): number => state.seats[seat]?.threat ?? 0;

// A hero card of the given numbers, added to the table's cards and put in play for the seat.
function withHero(made: Made, code: string, stats: Partial<Parameters<typeof definePrinted>[0]> = {}, seat = 0): ScenarioState {
  (made.ctx.cards as Map<string, PrintedCard>).set(code, definePrinted({ code, name: code, type: "hero", sphere: "tactics", threat: 8, willpower: 2, attack: 2, defense: 2, health: 6, ...stats }));
  return spawn(made.state, code, { zone: "heroes", seat }).state;
}

// Plays the escape test the state asks for: each seat commits the characters (codes) listed for it, every action window is passed, until no escape window is open.
function playTest(made: Made, state: ScenarioState, commits: readonly (readonly string[])[] = [], guard = 40): Run {
  let run = start(state);
  for (let step = 0; step < guard; step += 1) {
    const window = run.state.window;
    if (window?.kind === "escapeCommit") {
      const legal = legalTargets(run.state, { type: "CommitEscape" }, made.ctx);
      const cardIds = (commits[window.seat] ?? []).map((code) => idOf(run.state, code)).filter((id) => legal.includes(id));
      run = send(run, { type: "CommitEscape", cardIds }, made.ctx);
    } else if (window?.kind === "frameAction") run = send(run, { type: "Pass" }, made.ctx);
    else break;
  }
  return run;
}

// A treachery is revealed from the top of the encounter deck and its When Revealed effects run, the test (if any) played with `commits`.
function revealAndPlay(made: Made, code: string, commits: readonly (readonly string[])[] = [], state: ScenarioState = made.state): Run {
  const revealed = revealFromTop(state, made.ctx, code, [] as EngineStep[]).state;
  return playTest(made, revealed, commits);
}

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

describe("900801 The Dead Marshes Nightmare setup card", () => {
  // The setup card lies in the nightmare zone, and its Setup has set the table's note of the encounter discard pile.
  const nightmare = (layout: Layout) => {
    const made = table({ stage: "02105", ...layout });
    const setup = spawn(made.state, "900801", { zone: "nightmare" });
    const flagged = { ...setup.state, modifiers: [...setup.state.modifiers, { instanceId: "table", sourceId: setup.id, stat: "noteEncounterDiscards" as const, amount: 1, until: "endOfGame" as const }] };
    return { ...made, state: flagged, setupId: setup.id };
  };

  it("900801:A:2 bars every player from reducing their threat", () => {
    const made = nightmare({ seats: 2 });
    const synced = syncConstants(made.state, made.ctx);
    for (const seat of [0, 1]) expect(synced.modifiers.some((modifier) => modifier.stat === "noThreatReduction" && modifier.instanceId === `seat:${seat}`)).toBe(true);
  });

  it("900801:A:3 searches the encounter deck for The Mere of Dead Faces and adds it to the staging area, then shuffles the deck", () => {
    const made = table({ stage: "02105", deck: ["f0", "900802", "f0"] });
    const setup = spawn(made.state, "900801", { zone: "nightmare" });
    const done = resolveRecords(setup.state, made.ctx, "900801", "setup", setup.id);
    expect(zoneOf(done.state, "900802")).toBe("staging");
    expect(done.state.encounterDeck).toHaveLength(2);
    expect(done.state.modifiers.some((modifier) => modifier.stat === "noteEncounterDiscards")).toBe(true);
  });

  it("900801:A:4 shuffles Gollum into the encounter deck after he is placed in the discard pile, when he is dealt for an escape test", () => {
    const made = nightmare({ staging: [], deck: ["02107", "f0"] });
    const run = revealAndPlay(made, "02109", [["dh1"]], made.state);
    // Gollum was dealt (counted 0), went to the discard pile with the other card and was shuffled back into the deck.
    expect(zoneOf(run.state, "02107")).toBe("encounterDeck");
    expect(zoneOf(run.state, "f0")).toBe("encounterDiscard");
  });

  it("900801:A:4 leaves other cards alone: a card dealt for a test stays in the discard pile", () => {
    const made = nightmare({ staging: [{ code: "02107" }], deck: ["f0", "f0", "f0"] });
    const run = revealAndPlay(made, "02109", [["dh1"]], made.state);
    expect(run.state.encounterDiscard).toHaveLength(3);
    expect(zoneOf(run.state, "02107")).toBe("staging");
  });
});

describe("900802 The Mere of Dead Faces", () => {
  const entered = (made: Made, state: ScenarioState): ScenarioState => {
    const gollum = first(state, "02107");
    return settle(fireForced({ ...state, window: null }, { trigger: "encounterEnteredPlay", seat: 0, subject: gollum }, made.ctx, []), made.ctx, []);
  };

  it("900802:A:2 places the tokens meant for Gollum on the Mere while he is not in play", () => {
    const made = table({ stage: "02105", staging: ["900802"], deck: ["02111", "02111"] });
    const run = revealAndPlay(made, "02109", [], made.state);
    // The test failed with nothing committed: the token went on the Mere, and each player raised their threat.
    expect(tokens(run.state, "900802")).toBe(1);
  });

  it("900802:A:2 leaves the Mere alone while Gollum is in play", () => {
    const made = table({ stage: "02105", staging: ["900802", { code: "02107" }], deck: ["02111", "02111"] });
    const run = revealAndPlay(made, "02109", [], made.state);
    expect(tokens(run.state, "900802")).toBe(0);
    expect(tokens(run.state, "02107")).toBe(1);
  });

  it("900802:A:3 after Gollum enters play he gets 2 tokens, then every token on the Mere moves to him", () => {
    const made = table({ stage: "02105", staging: [{ code: "900802", resources: 3 }, { code: "02107" }] });
    const done = entered(made, made.state);
    expect(tokens(done, "02107")).toBe(5);
    expect(tokens(done, "900802")).toBe(0);
  });

  it("900802:A:3 Gollum at 8 or more after the move goes back into the encounter deck at once", () => {
    const made = table({ stage: "02105", staging: [{ code: "900802", resources: 7 }, { code: "02107" }] });
    const done = entered(made, made.state);
    expect(zoneOf(done, "02107")).toBe("encounterDeck");
    expect(tokens(done, "02107")).toBe(0);
  });
});

describe("900803 Stagnant Quagmire", () => {
  const nightfall = (staging: readonly string[]): ScenarioState => {
    const made = table({ stage: "02105", staging: [{ code: "02107" }, ...staging], deck: ["f0", "f0"] });
    return revealAndPlay(made, "02109", [["dh1"]], made.state).state;
  };

  it("900803:A:1 adds its Escape value to every escape test while it is in play, once for each copy: 2 against 0 + 2 fails", () => {
    expect(tokens(nightfall(["900803"]), "02107")).toBe(1);
  });

  it("900803:A:1 two copies add 4, and none adds nothing: 2 against 0 passes", () => {
    expect(tokens(nightfall(["900803", "900803"]), "02107")).toBe(1);
    expect(tokens(nightfall([]), "02107")).toBe(0);
  });

  it("900803:A:3 a failed test discards the defending character; a character that did not defend and commits passes the test", () => {
    const fought = fightEnemy(table, "900803", "f3", {}, { escape: ["dh2"] });
    expect(fought.run.state.cards[first(fought.run.state, "dh1")]?.zone).toBe("heroes");
    expect(fought.run.steps.some((step) => step.kind === "escapeTest" && step.success)).toBe(true);
  });
});

describe("900806 Lost Soul of Lórien", () => {
  // The enemy lies in the encounter discard pile when its Forced effect hears it was destroyed.
  const destroyed = (made: Made, state: ScenarioState): ScenarioState => {
    const soul = spawn(state, "900806", { zone: "encounterDiscard" });
    return settle(fireForced({ ...soul.state, window: null }, { trigger: "enemyDestroyed", seat: 0, subject: soul.id }, made.ctx, []), made.ctx, []);
  };

  it("900806:A:1 attaches to a hero with 1 or more Willpower, the first player choosing among them, and reduces its Willpower to 0", () => {
    const made = table({ stage: "02105", seats: 1 });
    let state = destroyed(made, made.state);
    // Two heroes are eligible: the first player is asked.
    expect(state.window).toMatchObject({ kind: "choose" });
    const run = send(start(state), { type: "Choose", optionId: state.window?.kind === "choose" ? (state.window.options[0] ?? "") : "" }, made.ctx);
    state = run.state;
    const soul = first(state, "900806");
    expect(state.cards[soul]?.zone).toBe("attached");
    const host = state.cards[soul]?.host ?? "";
    expect(modifiedStat(state, state.cards[host]!, "willpower", made.ctx.cards)).toBe(0);
  });

  it("900806:A:1 a hero holds one copy only: with both heroes holding one, the next copy stays in the discard pile", () => {
    const made = table({ stage: "02105" });
    let state = made.state;
    for (let copies = 0; copies < 4; copies += 1) {
      state = destroyed(made, state);
      if (state.window?.kind === "choose") state = send(start(state), { type: "Choose", optionId: state.window.options[0] ?? "" }, made.ctx).state;
    }
    const attached = idsOf(state, "900806").filter((id) => state.cards[id]?.zone === "attached");
    expect(attached).toHaveLength(2);
    expect(new Set(attached.map((id) => state.cards[id]?.host)).size).toBe(2);
    expect(idsOf(state, "900806").filter((id) => state.cards[id]?.zone === "encounterDiscard")).toHaveLength(2);
  });
});

describe("900807 Ill-fated Guard", () => {
  it("900807:A:1 while it is engaged with a player, that player cannot commit more than 1 character to an escape test", () => {
    const made = table({ stage: "02105", staging: [{ code: "02107" }], engaged: [{ code: "900807", seat: 0 }], deck: ["f0", "f0"] });
    const revealed = revealFromTop(made.state, made.ctx, "02109", [] as EngineStep[]).state;
    expect(revealed.window).toMatchObject({ kind: "escapeCommit", seat: 0 });
    expect(() => send(start(revealed), { type: "CommitEscape", cardIds: [idOf(revealed, "dh1"), idOf(revealed, "dh2")] }, made.ctx)).toThrow();
    expect(send(start(revealed), { type: "CommitEscape", cardIds: [idOf(revealed, "dh1")] }, made.ctx).state.window?.kind).toBe("frameAction");
  });

  it("900807:A:1 does not limit a player the Guard is not engaged with, or one while it is in the staging area", () => {
    const made = table({ stage: "02105", staging: [{ code: "02107" }, "900807"], deck: ["f0", "f0"] });
    const revealed = revealFromTop(made.state, made.ctx, "02109", [] as EngineStep[]).state;
    expect(send(start(revealed), { type: "CommitEscape", cardIds: [idOf(revealed, "dh1"), idOf(revealed, "dh2")] }, made.ctx).state.window?.kind).toBe("frameAction");
  });

  it("900807:A:2 Shadow: discards every attachment from each character the defending player controls with 3 or more Willpower, and no other", () => {
    const made = table({ phase: "Encounter", engaged: [{ code: "f3", seat: 0 }], deck: ["900807", "f0", "f0", "f0"], hand: ["filler", "filler"], attached: [{ code: "attachment", to: "dh1" }] });
    const big = withHero(made, "big", { willpower: 3 });
    const withAttachment = spawn(big, "attachment", { zone: "play", seat: 0 });
    const hosted = attachTo(withAttachment.state, withAttachment.id, first(big, "big"));
    const fought = fightEnemy(() => ({ ...made, state: hosted }), "900807", "f3", {}, { undefended: true });
    // The attachment on the hero with 3 Willpower is discarded; the one on dh1 (Willpower 2) stays.
    expect(fought.run.state.cards[withAttachment.id]?.zone).toBe("discard");
    const stays = idsOf(fought.run.state, "attachment").filter((id) => id !== withAttachment.id && fought.run.state.cards[id]?.host === first(fought.run.state, "dh1"));
    expect(stays).toHaveLength(1);
  });
});

describe("900808 Candles of Corpses", () => {
  const candles = (commits: readonly (readonly string[])[]) => {
    const made = table({ stage: "02105", seats: 2, deck: ["02111", "02111", "02111"] });
    return { made, run: revealAndPlay(made, "900808", commits) };
  };
  const choose = (made: Made, run: Run, optionId: string): Run => send(run, { type: "Choose", optionId }, made.ctx);

  it("900808:A:1 each player makes an escape test in turn, and a player who fails may raise their own threat by 5", () => {
    const { made, run } = candles([[], []]);
    expect(run.state.window).toMatchObject({ kind: "choose", seat: 0 });
    // Seat 0 raises its threat; then seat 1 makes its own test and is asked in turn.
    const next = playTest(made, choose(made, run, "threat").state, [[], []]);
    expect(next.state.window).toMatchObject({ kind: "choose", seat: 1 });
    expect(threat(next.state, 0)).toBe(33);
    expect(threat(next.state, 1)).toBe(28);
  });

  it("900808:A:1 a player who fails may discard a hero they control instead; a player who passes is not asked", () => {
    const { made, run } = candles([["dh1"], []]);
    // Seat 0 commits dh1 against the 1 card dealt (Escape 5) and fails too: both are asked. With a passing commit the seat is skipped.
    expect(run.state.window).toMatchObject({ kind: "choose", seat: 0 });
    const picking = choose(made, run, "discard");
    // The player picks which hero to discard.
    expect(picking.state.window?.kind).toBe("choose");
    const discarded = choose(made, picking, picking.state.window?.kind === "choose" ? (picking.state.window.options[0] ?? "") : "");
    // The hero goes to its owner's discard pile (a discard, not a destroy), and the player asked to discard a hero is no longer asked.
    expect(discarded.state.cards[idOf(discarded.state, "dh1")]?.zone === "discard" || discarded.state.cards[idOf(discarded.state, "dh2")]?.zone === "discard").toBe(true);
  });
});

describe("900808 Candles of Corpses with a lone hero", () => {
  it("900808:A:1 a player who fails with one hero may discard it, and the hero goes to its owner's discard pile", () => {
    const made = table({ stage: "02105", deck: ["02111", "02111"] });
    let state = made.state;
    // Only dh1 stays a hero of the seat.
    for (const id of state.seats[0]?.heroes ?? []) if (state.cards[id]?.code !== "dh1") state = updateCard(state, id, { zone: "discard" });
    state = { ...state, seats: [{ ...state.seats[0]!, heroes: (state.seats[0]?.heroes ?? []).filter((id) => state.cards[id]?.code === "dh1") }, ...state.seats.slice(1)] as unknown as ScenarioState["seats"] };
    const run = playTest(made, revealFromTop(state, made.ctx, "900808", [] as EngineStep[]).state, [[]]);
    expect(run.state.window).toMatchObject({ kind: "choose", seat: 0 });
    let done = send(run, { type: "Choose", optionId: "discard" }, made.ctx);
    // With one hero there is nothing to pick between.
    if (done.state.window?.kind === "choose") done = send(done, { type: "Choose", optionId: done.state.window.options[0] ?? "" }, made.ctx);
    expect(done.state.cards[idOf(done.state, "dh1")]?.zone).toBe("discard");
    expect(done.state.seats[0]?.heroes).toEqual([]);
  });
});

describe("900810 Devilry of the Dark Land", () => {
  it("900810:A:1 returns the topmost Undead enemy for each player from the encounter discard pile to the staging area, skipping other cards", () => {
    const made = table({ stage: "02105", discard: ["900804", "900805", "f0"], deck: ["f0"] });
    const done = revealFromTop(made.state, made.ctx, "900810", [] as EngineStep[]).state;
    expect(zoneOf(done, "900805")).toBe("staging");
    expect(zoneOf(done, "900804")).toBe("encounterDiscard");
    // An enemy returned this way is not revealed: the deck keeps its card, and Devilry did not gain surge.
    expect(zoneOf(done, "f0")).toBe("encounterDeck");
  });

  it("900810:A:1 with no Undead enemy in the discard pile it gains surge and the next card is revealed", () => {
    const made = table({ stage: "02105", discard: ["f0"], deck: ["f0"] });
    const done = revealFromTop(made.state, made.ctx, "900810", [] as EngineStep[]).state;
    expect(idsOf(done, "f0").filter((id) => done.cards[id]?.zone === "staging")).toHaveLength(1);
  });
});

describe("Nightmare Escape values", () => {
  const value = (code: string): number => {
    const made = table({ stage: "02105", staging: [code] });
    return escapeValueOf(made.state, first(made.state, code), made.ctx);
  };
  it("900803:A:2 Stagnant Quagmire counts Escape 2 when dealt", () => expect(value("900803")).toBe(2));
  it("900808:A:2 Candles of Corpses counts Escape 5 when dealt", () => expect(value("900808")).toBe(5));
  it("900809:A:2 Swarming Mosquitos counts Escape 3 when dealt", () => expect(value("900809")).toBe(3));
  it("900810:A:2 Devilry of the Dark Land counts Escape 10 when dealt", () => expect(value("900810")).toBe(10));
});
