// Rules: dcce.scalable-upgradable, dcce.campaign-setup-the-drowned-ruins, rr.the-word-choose, rr.play-and-put-into-play, rr.in-play-and-out-of-play, rr.victory (data/rules/entries.json).
// The Command events of The Drowned Ruins, read from the printed lines (data/printed/dream-chaser.json): 11201:A:1 to 11201:A:5, 11202:A:1 to 11202:A:5, 11203:A:1 to 11203:A:5. "Action: Add Command to the victory
// display to choose up to X options, where X is its level", and "For this game, X is plus 1 for each of those copies" (11200:A:2). One record holds all five lines of a card, so `lineSpec` runs each check again without it,
// where Command cannot be played at all. The table is `tableFromLayout` in the combat phase's action window, Command in the first seat's hand.
import { describe, expect } from "vitest";

import type { Effect } from "../../../catalog/boundary.ts";
import { modifiedStat } from "../../../rules/core/keywords.ts";
import { updateCard, type ScenarioState } from "../../../rules/core/state.ts";
import { attachTo, spawn } from "../../../rules/core/zones.ts";
import { syncConstants } from "../../../rules/interpret/constants.ts";
import { lineSpec } from "../../../../test/harness/line-spec.ts";
import { idOf, idsOf, send, start, tableFromLayout, type Layout, type Run } from "../../../../test/harness/scene-kit.ts";
import { payFor } from "../../../../test/scenarios/a-shadow-of-the-past/starter-scene.ts";

const SCENARIO = "the-drowned-ruins";
const BLESSING = "11205";
const SPYGLASS = "11180";
const SEA_SCORPION = "12096";
const REVENANT = "11181"; // a unique enemy

// Command `code` in hand, its level in the Campaign Log `level`, and the codes the campaign card's Setup let the players choose.
function commandTable(code: string, effects: readonly Effect[], level: number, layout: Layout = {}, chosen: readonly string[] = []) {
  const made = tableFromLayout(SCENARIO, { phase: "Combat", hand: [code], heroResources: 2, ...layout }, { effects, extra: [SPYGLASS] });
  const state: ScenarioState = { ...made.state, campaignFacts: { prisoner: null, usedOnce: [], counters: {}, levels: { [code]: level } }, ...(chosen.length > 0 ? { chosenAtSetup: chosen.map((one) => ({ code: one, seat: 0 })) } : {}) };
  return { ...made, state: syncConstants(state, made.ctx), card: idOf(state, code) };
}
type Made = ReturnType<typeof commandTable>;
const withState = (made: Made, change: (state: ScenarioState) => ScenarioState): Made => ({ ...made, state: syncConstants(change(made.state), made.ctx) });
// A Círdan's Blessing attached to the first card of the code `host`.
const blessed = (host: string) => (state: ScenarioState): ScenarioState => {
  const spawned = spawn(state, BLESSING, { zone: "play", seat: 0 });
  return attachTo(spawned.state, spawned.id, idOf(state, host));
};

const options = (run: Run): readonly string[] => (run.state.window?.kind === "choose" ? run.state.window.options : []);
const play = (made: Made): Run => send(start(made.state), { type: "PlayCard", cardId: made.card, payments: payFor(made.state, made.ctx, made.card) }, made.ctx);
// Each answer in turn: an option id or a card id the open choice offers.
function answer(made: Made, run: Run, ...answers: readonly string[]): Run {
  let current = run;
  for (const id of answers) {
    expect(options(current)).toContain(id);
    current = send(current, { type: "Choose", optionId: id }, made.ctx);
  }
  return current;
}
const stat = (made: Made, run: Run, id: string, which: "defense" | "willpower") => modifiedStat(run.state, run.state.cards[id]!, which, made.ctx.cards);

describe("Command: up to X options, X its level plus the copies chosen at Setup (11201:A:1, 11202:A:1, 11203:A:1)", () => {
  lineSpec("11201:A:1", "at level 1 one option is chosen, then Command is added to the victory display", (effects) => {
    const made = commandTable("11201", effects, 1);
    const run = answer(made, play(made), "defense", made.hero);
    expect(run.state.window?.kind).not.toBe("choose");
    expect(run.state.cards[made.card]?.zone).toBe("victory");
  });
  lineSpec("11202:A:1", "at level 0 with its copy chosen at Setup X is 1: one option is offered with Done", (effects) => {
    const made = commandTable("11202", effects, 0, { deckOf: ["f0", "f3"] }, ["11202"]);
    const asked = play(made);
    expect(options(asked)).toContain("done");
    const run = answer(made, asked, "bottom");
    expect(run.state.window?.kind).not.toBe("choose");
    expect(run.state.cards[made.card]?.zone).toBe("victory");
  });
  lineSpec("11203:A:1", "at level 2 two options are chosen", (effects) => {
    const made = commandTable("11203", effects, 2, { staging: ["place"] });
    const run = answer(made, play(made), "willpower", made.hero, "progress");
    expect(stat(made, run, made.hero, "willpower")).toBe(4);
    expect(run.state.cards[idOf(run.state, "place")]?.progress).toBe(2);
    expect(run.state.cards[made.card]?.zone).toBe("victory");
  });
});

describe("Command (Leadership) 11201", () => {
  lineSpec("11201:A:2", "a hero gets +2 Defense until the end of the round: it outlasts the planning phase and is gone in the next round", (effects) => {
    // Played in the planning phase: once its window is passed the quest phase begins, in the same round.
    const planning = commandTable("11201", effects, 1, { phase: "Planning" });
    let run = answer(planning, play(planning), "defense", planning.hero2);
    expect(stat(planning, run, planning.hero2, "defense")).toBe(4);
    run = send(run, { type: "Pass" }, planning.ctx);
    expect(run.state.phase).toBe("Quest");
    expect(stat(planning, run, planning.hero2, "defense")).toBe(4);
    // Played in the combat phase: passing its last window ends the round, and the next round begins.
    const combat = commandTable("11201", effects, 1, { deck: ["f0", "f0", "f0"] });
    let late = answer(combat, play(combat), "defense", combat.hero2);
    for (let guard = 0; guard < 40 && late.state.round === combat.state.round; guard += 1) late = send(late, { type: "Pass" }, combat.ctx);
    expect(late.state.round).toBe(combat.state.round + 1);
    expect(stat(combat, late, combat.hero2, "defense")).toBe(2);
  });
  // "An enemy": an enemy in the staging area is in play (rr.in-play-and-out-of-play) and is offered with the engaged one.
  lineSpec("11201:A:3", "an enemy in the staging area or engaged gets -2 Defense", (effects) => {
    const made = commandTable("11201", effects, 1, { staging: [SEA_SCORPION], engaged: ["f3"] });
    const enemy = idOf(made.state, SEA_SCORPION);
    const asked = answer(made, play(made), "enemyDefense");
    expect(options(asked)).toEqual(expect.arrayContaining([enemy, idOf(made.state, "f3")]));
    const before = modifiedStat(made.state, made.state.cards[enemy]!, "defense", made.ctx.cards);
    const run = answer(made, asked, enemy);
    expect(modifiedStat(run.state, run.state.cards[enemy]!, "defense", made.ctx.cards)).toBe(Math.max(0, before - 2));
  });
  lineSpec("11201:A:4", "readies the exhausted character with Círdan's Blessing on it, not another", (effects) => {
    const made = withState(commandTable("11201", effects, 1), (state) => blessed("dh2")(updateCard(updateCard(state, idOf(state, "dh1"), { exhausted: true }), idOf(state, "dh2"), { exhausted: true })));
    const run = answer(made, play(made), "ready");
    expect(run.state.cards[made.hero2]?.exhausted).toBe(false);
    expect(run.state.cards[made.hero]?.exhausted).toBe(true);
  });
  lineSpec("11201:A:5", "puts an ally of cost X or less from the discard pile into play, not a dearer one, and discards it at the end of the phase", (effects) => {
    const made = withState(commandTable("11201", effects, 1, { deck: ["f0", "f0"] }), (state) => spawn(spawn(state, "c3", { zone: "discard", seat: 0 }).state, "ally", { zone: "discard", seat: 0 }).state);
    const run = answer(made, play(made), "ally");
    const ally = idOf(run.state, "ally");
    expect(run.state.cards[ally]?.zone).toBe("play");
    expect(run.state.cards[idOf(run.state, "c3")]?.zone).toBe("discard");
    // The combat phase ends: every window is passed until the refresh phase.
    let after = run;
    for (let guard = 0; guard < 40 && after.state.phase === "Combat"; guard += 1) after = send(after, { type: "Pass" }, made.ctx);
    expect(after.state.cards[ally]?.zone).toBe("discard");
  });
});

describe("Command (Lore) 11202", () => {
  // "Remove X resources from a non-unique enemy." X is 2 at level 2.
  lineSpec("11202:A:2", "removes X resources from a non-unique enemy", (effects) => {
    const made = commandTable("11202", effects, 2, { staging: [{ code: SEA_SCORPION, resources: 5 }] });
    const enemy = idOf(made.state, SEA_SCORPION);
    // The one enemy with resources is taken without a question.
    const run = answer(made, play(made), "resources");
    expect(run.state.cards[enemy]?.resources).toBe(3);
  });
  lineSpec("11202:A:3", "adds 2 resources to each Círdan's Blessing", (effects) => {
    const made = withState(commandTable("11202", effects, 1), (state) => blessed("dh2")(blessed("dh1")(state)));
    const run = answer(made, play(made), "blessings");
    expect(idsOf(run.state, BLESSING).map((id) => run.state.cards[id]?.resources)).toEqual([2, 2]);
  });
  lineSpec("11202:A:4", "adds the bottom card of the player's deck to the hand", (effects) => {
    const made = commandTable("11202", effects, 1, { deckOf: ["f0", "f3"] });
    const bottom = made.state.seats[0]!.deck.at(-1)!;
    const run = answer(made, play(made), "bottom");
    expect(run.state.seats[0]?.hand).toContain(bottom);
  });
  lineSpec("11202:A:5", "looks at the top 10 cards of the encounter deck and discards the ones chosen", (effects) => {
    const made = commandTable("11202", effects, 1, { deck: ["f0", "f3", "treachery", "place"] });
    let run = answer(made, play(made), "encounter");
    if (run.state.window?.kind === "look") run = send(run, { type: "Pass" }, made.ctx);
    const discarded = options(run).find((id) => id !== "done") ?? "";
    run = answer(made, run, discarded, "done");
    expect(run.state.cards[discarded]?.zone).toBe("encounterDiscard");
    expect(run.state.encounterDeck).toHaveLength(3);
  });
});

describe("Command (Spirit) 11203", () => {
  lineSpec("11203:A:2", "a hero gets +2 Willpower", (effects) => {
    const made = commandTable("11203", effects, 1);
    expect(stat(made, answer(made, play(made), "willpower", made.hero2), made.hero2, "willpower")).toBe(4);
  });
  lineSpec("11203:A:3", "each character with Círdan's Blessing on it does not exhaust to commit to the quest this round, another does", (effects) => {
    const made = withState(commandTable("11203", effects, 1), blessed("dh2"));
    const played = answer(made, play(made), "noExhaust");
    const questing = { ...played.state, phase: "Quest" as const, boundaryPhase: "Quest" as const, mode: "questCommit" as const, window: { kind: "pass" as const }, activeSeat: 0 };
    const run = send(start(questing), { type: "Commit", cardIds: [made.hero, made.hero2] }, made.ctx);
    expect(run.state.cards[made.hero2]?.exhausted).toBe(false);
    expect(run.state.cards[made.hero]?.exhausted).toBe(true);
  });
  lineSpec("11203:A:4", "places 2 progress on a non-unique location", (effects) => {
    const made = commandTable("11203", effects, 1, { staging: ["place"] });
    const place = idOf(made.state, "place");
    // The one non-unique location is taken without a question.
    expect(answer(made, play(made), "progress").state.cards[place]?.progress).toBe(2);
  });
  lineSpec("11203:A:5", "puts Spyglass from the hand into play attached to a hero", (effects) => {
    const made = withState(commandTable("11203", effects, 1), (state) => spawn(state, SPYGLASS, { zone: "hand", seat: 0 }).state);
    const run = answer(made, play(made), "spyglass", made.hero2);
    expect(run.state.cards[idOf(run.state, SPYGLASS)]).toMatchObject({ zone: "play", host: made.hero2 });
  });
});

describe("a non-unique enemy (11202:A:2)", () => {
  // With resources only on the unique Revenant the option has no enemy to take them from, so it is not offered; the other options are.
  lineSpec("11202:A:2", "a unique enemy with resources is not a choice: the option is not offered", (effects) => {
    const made = commandTable("11202", effects, 2, { staging: [{ code: REVENANT, resources: 3 }, SEA_SCORPION], deckOf: ["f0"] });
    const asked = play(made);
    expect(options(asked)).toContain("bottom");
    expect(options(asked)).not.toContain("resources");
  });
});
