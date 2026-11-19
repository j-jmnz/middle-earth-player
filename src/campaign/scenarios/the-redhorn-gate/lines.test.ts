// Rules: rr.forced, rr.shadow-effects, rr.travel, rr.victory, rr.quest-phase, rr.first-player, dwd.caradhras, dwd.ally-objective-arwen, faq.lasting-effects, faq.progress-without-advancing, faq.first-player-elimination (data/rules/entries.json); ledger lines 04012:B:2, 04013:B:2, 04013:B:3, 04013:B:4,
// 04014:A:1, 04016:A:1, 04018:A:1, 04019:A:1, 04021:A:1, 04022:A:1, 04022:A:2, 04027:A:1, 901304:A:1, 901305:A:2, 901306:A:1, 901307:A:2,
// The Redhorn Gate's records that need more than one row: Arwen's control with the first player token, the Snowstorm's lasting -1 reaching a character that commits later, the zero-Willpower discard of stage 3B (Caradhras' -1, a Willpower-1 character committing),
// the 3B bar and the Nightmare setup card's flag, Fanuidhol's question at the quest total, The Dimrill Stair's Freezing Cold, Rocky Crags for each player, Fallen Stones' side quests, Snow Warg's allies, Snow-Giant's attack in a played combat phase, Icy Cavern's travel
// found and unpayable, Frozen Silverlode's flag and Blinding Blizzard's fifth progress in a played quest phase.
import { describe, expect, it } from "vitest";

import { EFFECTS } from "../../../effects/index.ts";
import { definePrinted } from "../../../rules/core/printed.ts";
import { updateCard, type ScenarioState } from "../../../rules/core/state.ts";
import { spawn } from "../../../rules/core/zones.ts";
import { modifiedStat } from "../../../rules/core/keywords.ts";
import { victoryPointsOf } from "../../../rules/core/printed-stat.ts";
import { legalIntents, type PlayerIntent } from "../../../rules/engine/reduce.ts";
import { play } from "../../../../test/harness/card-spec-play.ts";
import { announce, answer, attack, endRound, reveal, travel, type Act, type Row } from "../../../../test/harness/card-spec.ts";
import { finish, idOf, idsOf, opening, resolveRecords, revealFromTop, send, start, tableFromLayout, type Layout, type Run } from "../../../../test/harness/scene-kit.ts";

const SCENARIO = "the-redhorn-gate";
const table = (layout: Layout) => tableFromLayout(SCENARIO, layout);
const played = (layout: Layout, act: Act | readonly Act[]) => play(SCENARIO, { line: "", layout, act, expect: [] } satisfies Row, EFFECTS, false);
const codesOf = (state: ScenarioState, ids: readonly string[]) => ids.map((id) => state.cards[id]?.code);

// A Freezing Cold the layout attached lies in the play zone; one a reveal attached lies in the attached zone, which is what the records read.
function attachedCold(state: ScenarioState, host: string): ScenarioState {
  return Object.values(state.cards).filter((card) => card.code === "04023" && card.host === host).reduce((next, card) => updateCard(next, card.id, { zone: "attached" }), state);
}

describe("04014:A:1 Arwen's control", () => {
  it("04014:A:1 passes with the first player token at the end of the round", () => {
    const made = table({ seats: 2, play: [{ code: "04014", seat: 0 }] });
    const arwen = idOf(made.state, "04014");
    expect(made.state.cards[arwen]?.controller).toBe(0);
    const done = played({ seats: 2, firstPlayer: 0, play: [{ code: "04014", seat: 0 }] }, endRound);
    expect(done.run.state.firstPlayer).toBe(1);
    expect(done.run.state.cards[arwen]?.controller).toBe(1);
  });
});

describe("04022 Snowstorm", () => {
  it("04022:A:1 reaches a character that commits later in the phase", () => {
    const done = played({ committed: ["dh1"], deck: ["f0"] }, reveal("04022"));
    const later = updateCard(done.run.state, idOf(done.run.state, "dh2"), { committed: true });
    expect(modifiedStat(later, later.cards[idOf(later, "dh2")]!, "willpower", done.table.cards)).toBe(1);
    expect(modifiedStat(later, later.cards[idOf(later, "dh1")]!, "willpower", done.table.cards)).toBe(1);
  });

  it("04022:A:2 discards a defender whose Willpower falls to 0, one with Willpower 1 at the start of the attack", () => {
    const done = played({ play: ["ally"] }, [attack("f0", { shadow: "04022" }), { act: "defend", with: "ally" }]);
    expect(done.run.state.cards[idOf(done.run.state, "ally")]?.zone).toBe("discard");
  });

  it("04022:A:2 does not discard a defender whose Willpower stays above 0", () => {
    const done = played({}, [attack("f0", { shadow: "04022" }), { act: "defend", with: "dh1" }]);
    expect(done.run.state.cards[done.table.hero]?.zone).toBe("heroes");
  });
});

describe("04013 The Mountains' Peaks", () => {
  it("04013:B:2 discards a Willpower-1 character that commits to the quest under Caradhras' -1, and no one else", () => {
    const made = table({ stage: "04013", active: "04015", play: ["ally"] });
    const ally = idOf(made.state, "ally");
    const run: Run = send(start(made.state), { type: "Commit", cardIds: [ally, made.hero] }, made.ctx);
    expect(run.state.cards[ally]?.zone).toBe("discard");
    expect(run.state.cards[made.hero]?.zone).toBe("heroes");
    expect(run.state.cards[made.hero2]?.zone).toBe("heroes");
  });

  it("04013:B:2 discards the characters that Caradhras' -1 brings to 0 as Snowdrifts becomes stage 3B, Freezing Cold's -2 as well", () => {
    const made = table({ stage: "04012", progress: 9, staging: ["04015"], play: ["ally"], deck: ["f0"] });
    const ally = idOf(made.state, "ally");
    // Snowdrifts' When Revealed has resolved (it holds the commitments through the stage's defeat); the round then goes on in the quest phase.
    const revealed = resolveRecords(made.state, made.ctx, "04012", "whenRevealed", idOf(made.state, "04012"));
    const run0: Run = send(start({ ...revealed.state, ...opening("Quest") }), { type: "Commit", cardIds: [made.hero, made.hero2, ally] }, made.ctx);
    let run = send(run0, { type: "Pass" }, made.ctx);
    for (let guard = 0; guard < 20 && run.state.questStage != null && run.state.cards[run.state.questStage]?.code === "04012" && !run.state.lost; guard += 1) {
      const pass = legalIntents(run.state, made.ctx).find((intent) => intent.type === "Pass");
      if (!pass) break;
      run = send(run, pass as PlayerIntent, made.ctx);
    }
    expect(run.state.cards[run.state.questStage ?? ""]?.code).toBe("04013");
    expect(run.state.activeLocation != null && run.state.cards[run.state.activeLocation]?.code).toBe("04015");
    expect(run.state.cards[ally]?.zone).toBe("discard");
    expect(run.state.cards[made.hero]?.zone).toBe("heroes");
  });

  it("04013:B:2 discards a hero with Freezing Cold whose Willpower is 0, not one that keeps 1 or more", () => {
    const swept = played({ stage: "04013", attached: [{ code: "04023", to: "dh1" }], deck: ["f0"] }, reveal("f0"));
    expect(swept.run.state.cards[idOf(swept.run.state, "dh1")]?.zone).toBe("discard");
    expect(swept.run.state.cards[idOf(swept.run.state, "dh2")]?.zone).toBe("heroes");
  });

  const victoryOf = (state: ScenarioState, ctx: ReturnType<typeof table>["ctx"]) => state.victory.reduce((sum, id) => sum + victoryPointsOf(state, id, ctx.cards), 0);
  it("04013:B:3 bars the advance while the victory display holds fewer than 5 points: the progress stays on the stage", () => {
    const made = table({ stage: "04013", progress: 12, victory: ["04015", "04018"] });
    expect(victoryOf(made.state, made.ctx)).toBe(4);
    const done = played({ stage: "04013", progress: 12, victory: ["04015", "04018"] }, [{ act: "quest", outcome: "success" }]);
    expect(done.run.state.stageCleared).not.toBe(true);
    expect(done.run.state.cards[idOf(done.run.state, "04013")]?.progress).toBe(16);
  });

  it("04013:B:3 lets the stage be defeated with 5 victory points in the display", () => {
    const done = played({ stage: "04013", progress: 12, victory: ["04015", "04017"] }, [{ act: "quest", outcome: "success" }]);
    expect(done.run.state.stageCleared).toBe(true);
  });

  it("04013:B:4 wins the game when the stage is defeated, the players not losing", () => {
    const done = played({ stage: "04013", progress: 12, victory: ["04015", "04017"] }, [{ act: "quest", outcome: "success" }]);
    expect(done.run.state.lost).not.toBe(true);
    expect(done.run.state.stageCleared).toBe(true);
  });

  it("04013:B:3 counts no player card for the bar under the Nightmare setup card (901301:A:2), and counts it without", () => {
    const layout: Layout = { stage: "04013", progress: 12, victory: ["04015", "04018"], nightmare: "901301" };
    const questOn = (state: ScenarioState, made: ReturnType<typeof table>): ScenarioState => {
      let run: Run = send(start({ ...state, ...opening("Quest") }), { type: "Commit", cardIds: [made.hero, made.hero2] }, made.ctx);
      run = send(run, { type: "Pass" }, made.ctx);
      for (let guard = 0; guard < 20 && run.state.phase === "Quest" && !run.state.lost && !run.state.stageCleared; guard += 1) {
        const pass = legalIntents(run.state, made.ctx).find((intent) => intent.type === "Pass");
        if (!pass || run.state.mode === "travel") break;
        run = send(run, pass as PlayerIntent, made.ctx);
      }
      return run.state;
    };
    const made = table(layout);
    made.cards.set("arrow", definePrinted({ code: "arrow", name: "Arrow", type: "attachment", sphere: "neutral", cost: 0, victory: 2 }));
    const withArrow = spawn(made.state, "arrow", { zone: "victory" }).state;
    expect(victoryOf(withArrow, made.ctx)).toBe(6);
    expect(questOn(withArrow, made).stageCleared).toBe(true);
    const setUp = resolveRecords(withArrow, made.ctx, "901301", "setup", idOf(withArrow, "901301"));
    expect(victoryOf(setUp.state, made.ctx)).toBe(4);
    const held = questOn(setUp.state, made);
    expect(held.stageCleared).not.toBe(true);
    expect(held.cards[idOf(held, "04013")]?.progress).toBe(16);
  });
});

describe("04012:B:2 Snowdrifts and the encounter deck", () => {
  it("04012:B:2 leaves the deck order Fell Voices gave it when Caradhras comes back from the victory display", () => {
    const layout: Layout = { stage: "04012", active: "place", victory: ["04015"], deck: ["04027", "04022", "f3", "f0"] };
    const before = table(layout);
    const done = played(layout, announce("questCardDefeated", "04012"));
    expect(codesOf(done.run.state, done.run.state.encounterDeck)).toEqual(codesOf(before.state, before.state.encounterDeck));
    expect(done.run.state.cards[idOf(done.run.state, "04015")]?.zone).toBe("activeLocation");
  });

  it("04012:B:2 leaves the deck order alone when Caradhras is in the staging area", () => {
    const layout: Layout = { stage: "04012", active: "place", staging: ["04015"], deck: ["04027", "04022", "f3", "f0"] };
    const before = table(layout);
    const done = played(layout, announce("questCardDefeated", "04012"));
    expect(codesOf(done.run.state, done.run.state.encounterDeck)).toEqual(codesOf(before.state, before.state.encounterDeck));
  });
});

describe("04016:A:1 Fanuidhol", () => {
  it("04016:A:1 asks each committed hero's controller when the quest total is counted, after the window that follows the staging step, and counts the Willpower of the heroes that paid", () => {
    const made = table({ stage: "04011", active: "04016", heroResources: 1, staging: ["f3"] });
    let run: Run = send(start(made.state), { type: "Commit", cardIds: [made.hero, made.hero2] }, made.ctx);
    const seen: string[] = [];
    run = send(run, { type: "Pass" }, made.ctx);
    for (let guard = 0; guard < 30 && run.state.phase === "Quest" && !run.state.lost; guard += 1) {
      const window = run.state.window;
      seen.push(`${window?.kind ?? "none"}:${run.state.mode}`);
      if (window?.kind === "choose") {
        run = send(run, { type: "Choose", optionId: "pay" }, made.ctx);
        continue;
      }
      const pass = legalIntents(run.state, made.ctx).find((intent) => intent.type === "Pass");
      if (!pass || run.state.mode === "travel") break;
      run = send(run, pass as PlayerIntent, made.ctx);
    }
    const compared = run.steps.find((step) => step.kind === "quest");
    expect(compared?.kind === "quest" && compared.willpower).toBe(4);
    expect(seen.indexOf("choose:resolution")).toBeGreaterThan(seen.findIndex((one) => one.startsWith("pass:resolution")));
    expect(run.state.cards[made.hero]?.resources).toBe(0);
    expect(run.state.cards[made.hero2]?.resources).toBe(0);
  });

  it("04016:A:1 counts 0 for a hero that keeps its resource, and asks nothing of a hero with none", () => {
    const made = table({ stage: "04011", active: "04016", staging: ["f3"] });
    let run: Run = send(start(made.state), { type: "Commit", cardIds: [made.hero, made.hero2] }, made.ctx);
    run = send(run, { type: "Pass" }, made.ctx);
    for (let guard = 0; guard < 30 && run.state.phase === "Quest" && !run.state.lost; guard += 1) {
      expect(run.state.window?.kind).not.toBe("choose");
      const pass = legalIntents(run.state, made.ctx).find((intent) => intent.type === "Pass");
      if (!pass || run.state.mode === "travel") break;
      run = send(run, pass as PlayerIntent, made.ctx);
    }
    const compared = run.steps.find((step) => step.kind === "quest");
    expect(compared?.kind === "quest" && compared.willpower).toBe(0);
  });
});

describe("04018:A:1 The Dimrill Stair and Freezing Cold", () => {
  const stair = (more: Layout) => {
    const made = table({ phase: "Travel", staging: ["04018"], deck: ["f0"], ...more });
    const revealed = revealFromTop({ ...made.state, window: null }, made.ctx, "04023", []);
    const attached = finish({ state: attachedCold(revealed.state, made.hero), steps: [] }, made.ctx, (state) => (state.window?.kind === "choose" ? (state.window.options.find((option) => state.cards[option]?.code === "dh1") ?? state.window.options[0] ?? "") : ""));
    return { made, state: { ...attached.state, ...opening("Travel") } };
  };

  it("04018:A:1 discards the Freezing Cold attached to a hero and cuts 11 threat with 2 locations reshuffled", () => {
    const { made, state } = stair({ discard: ["place"], victory: ["04017"] });
    const run = finish(send(start(state), { type: "Travel", locationId: idOf(state, "04018") }, made.ctx), made.ctx);
    expect(run.state.cards[idOf(run.state, "04023")]?.zone).toBe("encounterDiscard");
    expect(run.state.seats[0]?.threat).toBe(18);
    expect(run.state.cards[idOf(run.state, "04017")]?.zone).toBe("encounterDeck");
  });

  it("04018:A:1 does nothing to the threat or Freezing Cold with 1 location reshuffled", () => {
    const { made, state } = stair({ discard: ["place"] });
    expect(state.cards[idOf(state, "04023")]?.zone).toBe("attached");
    const run = finish(send(start(state), { type: "Travel", locationId: idOf(state, "04018") }, made.ctx), made.ctx);
    expect(run.state.cards[idOf(run.state, "04023")]?.zone).toBe("attached");
    expect(run.state.seats[0]?.threat).toBe(29);
  });
});

describe("04023:A:1 Freezing Cold's second copy", () => {
  it("04023:A:1 discards the hero, with its attachments, when a second copy attaches to it", () => {
    const made = table({ deck: ["f0"] });
    const answerDh1 = (state: ScenarioState) => (state.window?.kind === "choose" ? (state.window.options.find((option) => state.cards[option]?.code === "dh1") ?? state.window.options[0] ?? "") : "");
    const steps: never[] = [];
    const first = finish({ state: revealFromTop({ ...made.state, window: null }, made.ctx, "04023", steps).state, steps }, made.ctx, answerDh1);
    expect(first.state.cards[made.hero]?.zone).toBe("heroes");
    const next = finish({ state: revealFromTop({ ...first.state, window: null }, made.ctx, "04023", steps).state, steps }, made.ctx, answerDh1);
    expect(next.state.cards[made.hero]?.zone).toBe("discard");
    expect(next.state.cards[made.hero2]?.zone).toBe("heroes");
    expect(idsOf(next.state, "04023").map((id) => next.state.cards[id]?.zone)).not.toContain("attached");
  });
});

describe("04019:A:1 Rocky Crags", () => {
  it("04019:A:1 makes each player deal 2 damage to a character he controls to travel", () => {
    const done = played({ phase: "Travel", seats: 2, staging: ["04019"] }, [travel("04019"), answer("dh1")]);
    expect(done.run.state.cards[done.table.hero]?.damage).toBe(2);
    expect(done.run.state.cards[done.table.seat1Hero ?? ""]?.damage).toBe(2);
    expect(done.run.state.cards[idOf(done.run.state, "04019")]?.zone).toBe("activeLocation");
  });
});

describe("04021:A:1 Fallen Stones", () => {
  it("04021:A:1 removes the progress on a side quest in play, a player's and an encounter side quest", () => {
    const made = table({ stage: "04012", progress: 3 });
    made.cards.set("sq", definePrinted({ code: "sq", name: "sq", type: "encounter-side-quest", questPoints: 6 }));
    made.cards.set("psq", definePrinted({ code: "psq", name: "psq", type: "player-side-quest", sphere: "neutral", cost: 0, questPoints: 6 }));
    let state = spawn(made.state, "sq", { zone: "staging" }).state;
    state = spawn(state, "psq", { zone: "staging" }).state;
    state = updateCard(state, idOf(state, "sq"), { progress: 2 });
    state = updateCard(state, idOf(state, "psq"), { progress: 1 });
    const done = resolveRecords(state, made.ctx, "04021", "whenRevealed", undefined, () => "remove");
    expect(done.state.cards[idOf(done.state, "sq")]?.progress).toBe(0);
    expect(done.state.cards[idOf(done.state, "psq")]?.progress).toBe(0);
    expect(done.state.cards[idOf(done.state, "04012")]?.progress).toBe(0);
  });
});

describe("04027:A:1 Snow Warg", () => {
  it("04027:A:1 is not offered an ally as a defender, only the heroes", () => {
    const made = table({ phase: "Encounter", play: ["ally"], engaged: [{ code: "04027", seat: 0 }], deck: ["f0", "f0"] });
    let run: Run = send(start(made.state), { type: "DeclineEngage" }, made.ctx);
    for (let guard = 0; guard < 20 && run.state.window?.kind !== "defense"; guard += 1) {
      const pass = legalIntents(run.state, made.ctx).find((intent) => intent.type === "Pass" || intent.type === "DeclineAttack" || intent.type === "DeclineEngage");
      if (!pass) break;
      run = send(run, pass as PlayerIntent, made.ctx);
    }
    expect(run.state.window?.kind).toBe("defense");
    const defenders = legalIntents(run.state, made.ctx).filter((intent): intent is Extract<PlayerIntent, { type: "DeclareDefender" }> => intent.type === "DeclareDefender");
    expect(defenders.length).toBeGreaterThan(0);
    expect(defenders.map((intent) => run.state.cards[intent.defenderId]?.code)).not.toContain("ally");
  });
});

describe("901304:A:1 Snow-Giant", () => {
  it("901304:A:1 attacks the first player from the staging area at the beginning of the combat phase and stays there", () => {
    const made = table({ phase: "Encounter", staging: ["901304"], deck: ["f0", "f0", "f0"] });
    let run: Run = send(start(made.state), { type: "DeclineEngage" }, made.ctx);
    let attacker: string | undefined;
    for (let guard = 0; guard < 40 && !run.state.lost; guard += 1) {
      if (run.state.window?.kind === "defense") {
        attacker = run.state.cards[run.state.pendingAttack?.enemyId ?? ""]?.code;
        run = send(run, { type: "Undefended", heroId: made.hero }, made.ctx);
        break;
      }
      const pass = legalIntents(run.state, made.ctx).find((intent) => intent.type === "Pass" || intent.type === "DeclineAttack" || intent.type === "DeclineEngage");
      if (!pass) break;
      run = send(run, pass as PlayerIntent, made.ctx);
    }
    expect(attacker).toBe("901304");
    expect(run.state.cards[idOf(run.state, "901304")]?.zone).toBe("staging");
    expect(run.state.cards[made.hero]?.damage).toBeGreaterThan(0);
  });
});

describe("901305:A:2 Icy Cavern's travel", () => {
  it("901305:A:2 reveals a Freezing Cold from the encounter deck in full and the first player attaches it", () => {
    const done = played({ phase: "Travel", staging: ["901305"], deck: ["f0", "04023"] }, [travel("901305"), answer("dh1")]);
    expect(done.run.state.cards[idOf(done.run.state, "901305")]?.zone).toBe("activeLocation");
    expect(done.run.state.cards[idOf(done.run.state, "04023")]?.zone).toBe("attached");
  });

  it("901305:A:2 cannot be paid with no Freezing Cold in the deck or the discard pile: the players cannot travel to it", () => {
    const made = table({ phase: "Travel", staging: ["901305"], deck: ["f0"], discard: ["f3"] });
    expect(legalIntents(made.state, made.ctx).some((intent) => intent.type === "Travel")).toBe(false);
    const found = table({ phase: "Travel", staging: ["901305"], deck: ["f0"], discard: ["04023"] });
    expect(legalIntents(found.state, found.ctx).some((intent) => intent.type === "Travel")).toBe(true);
  });
});

describe("901306:A:1 Frozen Silverlode", () => {
  it("901306:A:1 stops a Willpower raise from a player card while it is in the staging area, not a reduction", () => {
    const layout: Layout = { staging: ["901306"], attached: [{ code: "attachment", to: "dh1" }] };
    const made = table(layout);
    const attachment = idOf(made.state, "attachment");
    const raise = (state: ScenarioState, amount: number) => ({ ...state, modifiers: [...state.modifiers, { instanceId: made.hero, sourceId: attachment, stat: "willpower" as const, amount, until: "whileSourceInPlay" as const }] });
    expect(modifiedStat(raise(made.state, 2), raise(made.state, 2).cards[made.hero]!, "willpower", made.cards)).toBe(2);
    expect(modifiedStat(raise(made.state, -1), raise(made.state, -1).cards[made.hero]!, "willpower", made.cards)).toBe(1);
    const without = table({ attached: [{ code: "attachment", to: "dh1" }] });
    const open = { ...without.state, modifiers: [...without.state.modifiers, { instanceId: without.hero, sourceId: idOf(without.state, "attachment"), stat: "willpower" as const, amount: 2, until: "whileSourceInPlay" as const }] };
    expect(modifiedStat(open, open.cards[without.hero]!, "willpower", without.cards)).toBe(4);
  });
});

describe("901307:A:2 Blinding Blizzard's fifth progress", () => {
  it("901307:A:2 takes the progress of a played quest phase, is discarded with the 5th and the rest goes on the stage", () => {
    const made = table({ stage: "04012", deck: ["f0"] });
    const revealed = revealFromTop({ ...made.state, window: null }, made.ctx, "901307", []);
    const blizzard = idOf(revealed.state, "901307");
    const ready = { ...updateCard(revealed.state, blizzard, { progress: 3 }), ...opening("Quest") };
    const run0: Run = send(start(ready), { type: "Commit", cardIds: [made.hero, made.hero2] }, made.ctx);
    let run = send(run0, { type: "Pass" }, made.ctx);
    for (let guard = 0; guard < 20 && run.state.phase === "Quest" && !run.state.lost; guard += 1) {
      const pass = legalIntents(run.state, made.ctx).find((intent) => intent.type === "Pass");
      if (!pass || run.state.mode === "travel") break;
      run = send(run, pass as PlayerIntent, made.ctx);
    }
    expect(run.state.cards[blizzard]?.zone).toBe("encounterDiscard");
    expect(run.state.cards[idOf(run.state, "04012")]?.progress).toBe(2);
  });
});
