// Rules: emce.guarded-x, rr.guarded, rr.encounter-phase, rr.travel, rr.quest-advancement, rr.cancel, rr.shadow-effects, rr.lasting-effects, rr.ready, rr.refresh-phase, rr.surge, rr.threat-threat-dial, rr.in-play-and-out-of-play
// (data/rules/entries.json); ledger lines 18029:A:1, 18031:A:1, 18031:A:3, 18033:A:1, 18033:A:2, 18034:A:1, 18034:A:2, 18036:A:1, 18037:A:1, 18038:A:1, 18039:A:1, 18040:A:3, 18041:A:1, 18071:B:1, 18072:B:2.
// Lost in Mirkwood's card lines that need more than one card-spec row: a link between two cards, a false case, a duration, a player card played against the line. Each test that a missing record would break
// runs the same table again without the records of its line (`withoutLine`) and checks that the result changes. The stand-ins are those of card-lines.test.ts.
import { describe, expect, it } from "vitest";

import { EFFECTS } from "../../../effects/index.ts";
import type { Effect } from "../../../catalog/boundary.ts";
import { modifiedStat } from "../../../rules/core/keywords.ts";
import { flagged, updateCard, type ScenarioState } from "../../../rules/core/state.ts";
import type { EngineStep } from "../../../rules/core/intents.ts";
import { attachTo } from "../../../rules/core/zones.ts";
import { play } from "../../../../test/harness/card-spec-play.ts";
import { attack, defend, endPhase, endRound, quest, reveal, travel, withoutLine, type Act, type Row } from "../../../../test/harness/card-spec.ts";
import { finish, idOf, legalIntents, legalTargets, revealFromTop, send, start, tableFromLayout, type Layout, type LayoutTable, type Run } from "../../../../test/harness/scene-kit.ts";

const SCENARIO = "lost-in-mirkwood";
const without = (line: string): readonly Effect[] => withoutLine(EFFECTS, line);
const played = (layout: Layout, act: Act | readonly Act[], effects: readonly Effect[] = EFFECTS): ScenarioState => play(SCENARIO, { line: "", layout, act, expect: [] } satisfies Row, effects, false).run.state;
const card = (state: ScenarioState, code: string) => state.cards[idOf(state, code)];
const threatOf = (state: ScenarioState, code: string, cards: LayoutTable["cards"]): number => modifiedStat(state, card(state, code)!, "threat", cards);

describe("18029 to 18032 Guarded (location) and Guarded (enemy)", () => {
  // "attach the guarded (X) card to it as a guarded objective" (emce.guarded-x): the card found guards the objective.
  it.each([
    ["18029:A:1", "18029", "place", ["f0", "place", "f3"]],
    ["18031:A:1", "18031", "f3", ["place", "f3", "f0"]],
  ] as const)("%s attaches the objective to the card found, which guards it", (line, objective, found, deck) => {
    const layout: Layout = { deck };
    const state = played(layout, reveal(objective));
    expect(card(state, found)).toMatchObject({ zone: "staging", host: idOf(state, objective), guard: true });
    expect(card(played(layout, reveal(objective), without(line)), found)?.guard).not.toBe(true);
  });
});

describe("18031 Bare Hilltop: advance to the next stage A, if able (18031:A:3)", () => {
  it("18031:A:3 at the last level there is no stage to advance to: the quest stays", () => {
    const state = played({ stage: "18077", phase: "Travel", staging: ["18031"], deck: ["f0", "f0"] }, travel("18031"));
    expect(card(state, "18077")?.zone).toBe("questStage");
  });
});

describe("18033 Twilight Hall", () => {
  const travelOffered = (resources: number, effects: readonly Effect[]): boolean => {
    const made = tableFromLayout(SCENARIO, { phase: "Travel", staging: [{ code: "18033", resources }] }, { effects });
    const hall = idOf(made.state, "18033");
    return legalTargets(made.state, { type: "Travel" }, made.ctx).includes(hall);
  };

  // "If there are no resources on Twilight Hall, the players cannot travel here." The record that holds it names 18033:A:1.
  it("18033:A:3 with no resource on it the players cannot travel there; with 1 they can", () => {
    expect(travelOffered(0, EFFECTS)).toBe(false);
    expect(travelOffered(1, EFFECTS)).toBe(true);
    expect(travelOffered(0, without("18033:A:1"))).toBe(true);
  });

  it("18033:A:1 with no resource it keeps its printed Threat 2", () => {
    const made = tableFromLayout(SCENARIO, { staging: ["18033"] });
    expect(threatOf(made.state, "18033", made.cards)).toBe(2);
  });

  // "After a Forest location is explored": "place" has no trait, so its exploration places nothing.
  it("18033:A:2 a location without the Forest trait explored places no resource", () => {
    const state = played({ staging: ["18033"], active: { code: "place", progress: 1 }, deck: ["f0"] }, quest("success"));
    expect(card(state, "place")?.zone).toBe("encounterDiscard");
    expect(card(state, "18033")?.resources ?? 0).toBe(0);
  });
});

describe("18034 Mirkwood Patrol", () => {
  // "Forced: At the end of the encounter phase, if Mirkwood Patrol is in the staging area with an unguarded objective-location, attach that objective-location to Mirkwood Patrol, guarding it."
  // Engagement cost 40 against a threat of 28: it stays in the staging area through the engagement checks.
  const patrolled = (layout: Layout, effects: readonly Effect[] = EFFECTS) => played({ phase: "Encounter", deck: ["f0", "f0", "f0"], ...layout }, endPhase, effects);

  it("18034:A:1 at the end of the encounter phase it guards the unguarded objective-location in the staging area", () => {
    const state = patrolled({ staging: ["18034", "18029"] });
    expect(state.phase).not.toBe("Encounter");
    expect(card(state, "18034")).toMatchObject({ zone: "staging", host: idOf(state, "18029"), guard: true });
    expect(card(patrolled({ staging: ["18034", "18029"] }, without("18034:A:1")), "18034")?.guard).not.toBe(true);
  });

  it("18034:A:1 an objective-location another card already guards is left as it is", () => {
    const made = tableFromLayout(SCENARIO, { phase: "Encounter", staging: ["18034", "18029", "place"], deck: ["f0", "f0", "f0"] });
    const guarded = updateCard(attachTo(made.state, idOf(made.state, "place"), idOf(made.state, "18029")), idOf(made.state, "place"), { guard: true });
    const state = runToCombat(guarded, made);
    expect(card(state, "18034")?.host ?? null).toBeNull();
    expect(card(state, "place")).toMatchObject({ host: idOf(state, "18029"), guard: true });
  });

  it("18034:A:1 an engaged Mirkwood Patrol guards nothing", () => {
    const state = patrolled({ staging: ["18029"], engaged: ["18034"] });
    expect(card(state, "18034")?.host ?? null).toBeNull();
  });

  // Shadow: "The defender cannot ready this round." The next round's refresh phase readies it.
  it("18034:A:2 the defender readies in the refresh phase of the next round", () => {
    const state = played({}, [attack("f0", { shadow: "18034" }), defend("dh1"), endRound, endRound]);
    expect(card(state, "dh1")?.exhausted ?? false).toBe(false);
  });
});

// The encounter phase played out from a state already built (a guard placed by hand), every window passed, until it is over.
function runToCombat(state: ScenarioState, made: LayoutTable): ScenarioState {
  let run: Run = start(state);
  for (let guard = 0; guard < 40 && run.state.phase === "Encounter"; guard += 1) {
    const next = legalIntents(run.state, made.ctx).find((intent) => intent.type === "Pass" || intent.type === "DeclineEngage");
    if (!next) break;
    run = finish(send(run, next, made.ctx), made.ctx);
  }
  return run.state;
}

describe("18036 Unseen Danger", () => {
  // FAULT: the card prints "If the discarded card's printed Threat is greater than the removed character's Willpower, discard that character"; the engine discards the encounter card it just discarded (the
  // discard step makes it the picked card) and the removed hero stays in play.
  it.fails("18036:A:1 a discarded Threat 3 is greater than the removed hero's Willpower 2: the hero is discarded", () => {
    const state = played({ committed: ["dh1"], deck: ["f3", "f0"] }, reveal("18036"));
    expect(card(state, "f3")?.zone).toBe("encounterDiscard");
    expect(card(state, "dh1")?.zone).toBe("discard");
  });
});

describe("18037 Vastness of Mirkwood", () => {
  // "Until the end of the phase": the +1 Threat is gone once the quest phase is over. The active location is not in the staging area and gets nothing.
  it("18037:A:1 the +1 Threat ends with the phase, and the active location gets none", () => {
    const made = tableFromLayout(SCENARIO, { staging: ["place"], active: "01100" });
    const revealed = played({ staging: ["place"], active: "01100", deck: ["f0", "f0"] }, reveal("18037"));
    expect(threatOf(revealed, "place", made.cards)).toBe(3);
    expect(threatOf(revealed, "01100", made.cards)).toBe(2);
    const after = played({ staging: ["place"], active: "01100", deck: ["f0", "f0"] }, [reveal("18037"), endPhase]);
    expect(after.phase).not.toBe("Quest");
    expect(threatOf(after, "place", made.cards)).toBe(2);
  });
});

describe("18038 Accursed Forest", () => {
  it("18038:A:1 as the active location it lets a when revealed effect be canceled", () => {
    expect(flagged(played({ active: "18038" }, []), "table", "encounterUncancelable")).toBe(false);
  });

  // Hasty Stroke (01048, Spirit, cost 1): "Response: Cancel a shadow effect just triggered during combat." The first hero is made a Spirit hero with 3 resources to pay for it.
  const strokeOffered = (staging: readonly string[]): boolean => {
    const made = tableFromLayout(SCENARIO, { phase: "Encounter", staging, engaged: ["f0"], hand: ["01048"], heroResources: 3, deck: ["18034", "f0", "f0"] }, { extra: ["01048"] });
    const hero = made.cards.get("dh1");
    if (hero) made.cards.set("dh1", { ...hero, sphere: "spirit" });
    let run: Run = send(start(made.state), { type: "DeclineEngage" }, made.ctx);
    for (let guard = 0; guard < 60 && run.state.window?.kind !== "defense"; guard += 1) {
      const pass = legalIntents(run.state, made.ctx).find((intent) => intent.type === "Pass" || intent.type === "DeclineAttack" || intent.type === "DeclineEngage");
      if (!pass) break;
      run = send(run, pass, made.ctx);
    }
    run = send(run, { type: "Undefended", heroId: made.hero }, made.ctx);
    return legalIntents(run.state, made.ctx).some((intent) => intent.type === "Trigger" && intent.effectId === "01048:response:1");
  };

  it("18038:A:1 a shadow effect can be canceled while no Accursed Forest is in play (the control)", () => {
    expect(strokeOffered([])).toBe(true);
  });

  // FAULT: the card prints "'when revealed' effects cannot be canceled"; the record sets the table's encounterUncancelable, which also bars the cancel of a Shadow effect, so Hasty Stroke is not offered.
  it.fails("18038:A:1 while it is in the staging area a shadow effect can still be canceled", () => {
    expect(strokeOffered(["18038"])).toBe(true);
  });
});

describe("18039 Dark Black Woods", () => {
  it("18039:A:1 as the active location it caps no progress", () => {
    const made = tableFromLayout(SCENARIO, { active: "18039", staging: ["01099"] });
    expect(modifiedStat(made.state, card(made.state, "01099")!, "progressCap", made.cards)).toBe(0);
  });
});

describe("18040 Gathering Gloom", () => {
  it("18040:A:3 an attack that destroys no character discards no ally", () => {
    const state = played({ play: ["ally", "ally"] }, attack("f0", { shadow: "18040", undefended: true }));
    expect(card(state, "dh1")?.damage).toBe(2);
    expect(Object.values(state.cards).filter((one) => one.code === "ally" && one.zone === "play")).toHaveLength(2);
  });
});

describe("18041 Swarm of Bats", () => {
  // "If no resources were discarded this way": the whole table counts, so the second player's empty pools do not give it surge.
  it("18041:A:1 two players, only the first with resources: no surge, and only the first raises his threat", () => {
    const revealed = (effects: readonly Effect[]) => {
      const made = tableFromLayout(SCENARIO, { seats: 2, deck: ["f3", "f0"] }, { effects });
      const state = updateCard(made.state, made.hero, { resources: 2 });
      const steps: EngineStep[] = [];
      return finish({ state: revealFromTop(state, made.ctx, "18041", steps).state, steps }, made.ctx).state;
    };
    const state = revealed(EFFECTS);
    expect(state.seats[0]?.threat).toBe(30);
    expect(state.seats[1]?.threat).toBe(28);
    expect(state.encounterDeck).toHaveLength(2);
    expect(revealed(without("18041:A:1")).seats[0]?.threat).toBe(28);
  });
});

// The Greeting's choice: reduce one player's threat by 6; any other choice takes its first option.
const oneOption = (state: ScenarioState): string => {
  const options = state.window?.kind === "choose" ? state.window.options : [];
  return options.includes("one") ? "one" : (options[0] ?? "");
};

describe("18071 Ambushed at Night", () => {
  // "Each player's threat cannot be reduced by player card effects." The Galadhrim's Greeting (01046, Spirit, cost 3): "Action: Reduce one player's threat by 6, or reduce each player's threat by 2."
  const greeted = (stage: string, effects: readonly Effect[]): number => {
    const made = tableFromLayout(SCENARIO, { stage, phase: "Planning", hand: ["01046"], heroResources: 3 }, { effects, extra: ["01046"] });
    const hero = made.cards.get("dh1");
    if (hero) made.cards.set("dh1", { ...hero, sphere: "spirit" });
    const greeting = idOf(made.state, "01046");
    const run = finish(send(start(made.state), { type: "PlayCard", cardId: greeting, payments: [{ heroId: made.hero, amount: 3 }] }, made.ctx), made.ctx, oneOption);
    expect(card(run.state, "01046")?.zone).not.toBe("hand");
    return run.state.seats[0]?.threat ?? 0;
  };

  it("18071:B:1 a player card does not reduce a player's threat", () => {
    expect(greeted("18071", EFFECTS)).toBe(28);
    expect(greeted("18071", without("18071:B:1"))).toBe(22);
  });
});

describe("18072 Spiders of Mirkwood: a Spider that damages a character (18072:B:2)", () => {
  it("18072:B:2 an attacker that is not a Spider leaves the damaged defender free to ready", () => {
    // East Bight Patrol (Goblin, Orc; 3 Attack) against the 2 Defense hero.
    const state = played({ stage: "18072" }, [attack("01097", { shadow: "f0" }), defend("dh1"), endRound]);
    expect(card(state, "dh1")?.damage).toBe(1);
    expect(card(state, "dh1")?.exhausted ?? false).toBe(false);
  });

  it("18072:B:2 a Spider attack that deals no damage leaves the defender free to ready", () => {
    // Forest Spider (Spider; 2 Attack) against the 2 Defense hero.
    const state = played({ stage: "18072" }, [attack("01096", { shadow: "f0" }), defend("dh1"), endRound]);
    expect(card(state, "dh1")?.damage ?? 0).toBe(0);
    expect(card(state, "dh1")?.exhausted ?? false).toBe(false);
  });

  // "Until the end of the round": the bar is gone once the round in which the Spider attacked is over (the hero, still exhausted, could ready again).
  it("18072:B:2 the bar on readying ends with the round", () => {
    const made = tableFromLayout(SCENARIO, { stage: "18072" });
    const state = played({ stage: "18072" }, [attack("01074", { shadow: "f0" }), defend("dh1"), endRound]);
    expect(card(state, "dh1")?.exhausted).toBe(true);
    expect(modifiedStat(state, card(state, "dh1")!, "cannotReady", made.cards)).toBe(0);
  });
});
