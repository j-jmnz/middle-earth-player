// Rules: dwd.ambush, dwd.setup-road-to-rivendell, dwd.ally-objective-arwen-road-to-rivendell, rr.engagement-check, rr.engaged, rr.guarded, rr.explored, rr.search, rr.reveal, rr.travel, rr.first-player, rr.cancel, faq.first-player-elimination (data/rules/entries.json); ledger lines 04038:A:1, 04040:B:3, 04041:A:1, 04042:A:1,
// 04043:A:1, 04045:A:1, 04048:A:2, 04050:A:2, 04051:A:2, 04047:A:1, 901402:B:1, 901402:B:3, 901405:A:2, 901406:A:2, 901409:A:1.
// Road to Rivendell's records that need more than one row: Arwen's control with the first player token, the win at the last stage, Ruined Road's Response, Ambush at Setup, Goblin Gate's attack in the combat phase, Barren Hills, Orc Ambush's order,
// Orc Raiders' attachments, Raiding Party's chain, Vicious Trackers, Tumultuous Assault's passes, Followed by Night, Crebain and the Nightmare stage 901402 (Arwen under Goblin Gate).
import { describe, expect, it } from "vitest";

import { EFFECTS } from "../../../effects/index.ts";
import { updateCard, type ScenarioState } from "../../../rules/core/state.ts";
import { encounterUncancelable } from "../../../rules/families/encounter/cancel.ts";
import { legalIntents, type PlayerIntent } from "../../../rules/engine/reduce.ts";
import { play } from "../../../../test/harness/card-spec-play.ts";
import { answer, quest, resolve, reveal, travel, type Act, type Row } from "../../../../test/harness/card-spec.ts";
import type { EngineStep } from "../../../rules/core/intents.ts";
import { finish, idOf, idsOf, opening, revealFromTop, send, start, tableFromLayout, type Layout, type Run } from "../../../../test/harness/scene-kit.ts";

const SCENARIO = "road-to-rivendell";
const table = (layout: Layout) => tableFromLayout(SCENARIO, layout);
const played = (layout: Layout, act: Act | readonly Act[]) => play(SCENARIO, { line: "", layout, act, expect: [] } satisfies Row, EFFECTS, false);
const zonesOf = (state: ScenarioState, code: string) => idsOf(state, code).map((id) => state.cards[id]?.zone);
const offered = (run: Run, ctx: ReturnType<typeof table>["ctx"], type: PlayerIntent["type"], code: string, state: ScenarioState = run.state) => legalIntents(state, ctx).some((intent) => intent.type === type && "cardId" in intent && intent.cardId === idOf(state, code));

type Driven = { run: Run; defenses: { phase: string; enemy: string }[] };

// Plays the round on from where the table stands: every attack is undefended (the damage goes to the first hero), a choice takes the answer `pick` gives (the first option by default), travel and engagement are declined, until `until` holds.
function drive(run: Run, ctx: ReturnType<typeof table>["ctx"], until: (state: ScenarioState) => boolean, pick: (state: ScenarioState) => string = (state) => (state.window?.kind === "choose" ? (state.window.options[0] ?? "") : "")): Driven {
  const defenses: Driven["defenses"] = [];
  let current = run;
  for (let guard = 0; guard < 120 && !until(current.state) && !current.state.lost; guard += 1) {
    const state = current.state;
    if (state.window?.kind === "defense") {
      defenses.push({ phase: state.phase, enemy: state.cards[state.window.enemyId ?? ""]?.code ?? "" });
      current = send(current, { type: "Undefended", heroId: state.seats[state.window.seat]?.heroes[0] ?? "" } as PlayerIntent, ctx);
    } else if (state.window?.kind === "choose") current = send(current, { type: "Choose", optionId: pick(state) }, ctx);
    else if (!state.window && state.mode === "stopped") current = { ...current, state: { ...state, ...opening(state.phase as Parameters<typeof opening>[0]) } };
    else {
      const next = legalIntents(state, ctx).find((intent) => intent.type === "Pass" || intent.type === "DeclineTravel" || intent.type === "DeclineEngage" || intent.type === "DeclineAttack");
      if (!next) break;
      current = send(current, next, ctx);
    }
  }
  return { run: current, defenses };
}

describe("04041:A:1 Arwen's control", () => {
  it("04041:A:1 passes with the first player token at the end of the round", () => {
    const made = table({ seats: 2, play: [{ code: "04041", seat: 0 }] });
    const arwen = idOf(made.state, "04041");
    expect(made.state.cards[arwen]?.controller).toBe(0);
    const done = played({ seats: 2, firstPlayer: 0, play: [{ code: "04041", seat: 0 }] }, [{ act: "endRound" }]);
    expect(done.run.state.firstPlayer).toBe(1);
    expect(done.run.state.cards[arwen]?.controller).toBe(1);
  });
});

describe("04040 Approaching Rivendell", () => {
  it("04040:B:3 wins the game when the stage is defeated, the players not losing", () => {
    const done = played({ stage: "04040", progress: 12 }, [quest("success")]);
    expect(done.run.state.lost).not.toBe(true);
    expect(done.run.state.stageCleared).toBe(true);
  });
});

describe("04042 Ruined Road", () => {
  it("04042:A:1 hears only the travel to itself", () => {
    const done = played({ phase: "Travel", staging: ["04042", "place"] }, travel("place"));
    expect(done.run.state.window?.kind).not.toBe("choose");
    expect(offered(done.run, done.table.ctx, "Trigger", "04042")).toBe(false);
    expect(done.run.state.cards[idOf(done.run.state, "04042")]?.progress ?? 0).toBe(0);
  });

  it("04042:A:1 lets the first player choose to ready a hero he controls instead", () => {
    const made = table({ phase: "Travel", staging: ["04042"] });
    const hero = idOf(made.state, "dh1");
    const tired = updateCard(made.state, hero, { exhausted: true });
    let run: Run = send(start(tired), { type: "Travel", locationId: idOf(tired, "04042") }, made.ctx);
    const trigger = legalIntents(run.state, made.ctx).find((intent) => intent.type === "Trigger" && intent.cardId === idOf(run.state, "04042"));
    expect(trigger).toBeTruthy();
    run = send(run, trigger as PlayerIntent, made.ctx);
    expect(run.state.window?.kind).toBe("choose");
    run = finish(send(run, { type: "Choose", optionId: "ready" }, made.ctx), made.ctx);
    expect(run.state.cards[hero]?.exhausted).toBe(false);
    expect(run.state.cards[idOf(run.state, "04042")]?.progress ?? 0).toBe(0);
  });
});

describe("Ambush", () => {
  it("04038:A:1 makes the ambush check of an enemy a Setup reveal brings, an enemy it cannot engage staying in the staging area", () => {
    const engaged = played({ stage: "04038", side: "A", setAside: ["04041"], deck: ["f0", "04049"], threat: [40, 0] }, resolve("04038", "setup"));
    expect(zonesOf(engaged.run.state, "04049")).toEqual(["engaged"]);
    expect(zonesOf(engaged.run.state, "04041")).toEqual(["play"]);
    const staying = played({ stage: "04038", side: "A", setAside: ["04041"], deck: ["f0", "04049"], threat: [0, 0] }, resolve("04038", "setup"));
    expect(zonesOf(staying.run.state, "04049")).toEqual(["staging"]);
  });

  it("04043:A:1 gives the engaged first enemy an immediate attack, and the enemy attacks again in the combat phase", () => {
    const done = played({ active: "04043", deck: ["f0"], threat: [40, 0] }, reveal("04049"));
    expect(done.run.state.window?.kind).toBe("defense");
    const round = drive(done.run, done.table.ctx, (state) => state.phase === "Combat" && state.window?.kind === "playerAttack");
    expect(round.defenses.map((item) => `${item.phase}:${item.enemy}`)).toEqual(["Quest:04049", "Combat:04049"]);
  });

  it("04045:A:1 makes no ambush check and gives no attack while Barren Hills is the active location and Goblin Gate waits in the staging area", () => {
    const done = played({ active: "04045", staging: ["04043"], deck: ["f0"], threat: [40, 0] }, reveal("04049"));
    expect(zonesOf(done.run.state, "04049")).toEqual(["staging"]);
    expect(done.run.state.window?.kind).not.toBe("defense");
    expect(done.run.state.cards[done.table.hero]?.damage).toBe(0);
  });

  it("04048:A:2 engages the Orcs of the staging area in the order the first player picks, each Forced engagement line firing in that order", () => {
    const layout: Layout = { staging: ["04049", "04050"], deck: ["f0"], threat: [0, 0], attached: [{ code: "attachment", to: "dh1" }] };
    const choose = (code: string) => (state: ScenarioState) => (state.window?.kind === "choose" ? (state.window.options.find((option) => state.cards[option]?.code === code) ?? state.window.options[0] ?? "") : "");
    for (const order of [["04050", "04049"], ["04049", "04050"]]) {
      const made = table(layout);
      const steps: EngineStep[] = [];
      const revealed = revealFromTop(start(made.state).state, made.ctx, "04048", steps);
      expect(revealed.state.window?.kind, order.join()).toBe("choose");
      const picked = finish({ state: revealed.state, steps }, made.ctx, (state) => (state.window?.kind === "choose" && state.cards[state.window.options[0] ?? ""]?.zone === "staging" ? choose(order[0] ?? "")(state) : (state.window?.kind === "choose" ? choose(order[1] ?? "")(state) : "")));
      const engages = picked.steps.filter((step) => step.kind === "engage").map((step) => (step.kind === "engage" ? picked.state.cards[step.enemyId]?.code : ""));
      expect(engages, order.join()).toEqual(order);
      expect(zonesOf(picked.state, "04049").concat(zonesOf(picked.state, "04050")), order.join()).toEqual(["engaged", "engaged"]);
      // Goblin Taskmaster's 2 damage and Orc Raiders' discard both happen, whatever the order.
      expect(zonesOf(picked.state, "attachment"), order.join()).toEqual(["discard"]);
      expect(picked.state.cards[made.hero]?.damage, order.join()).toBe(2);
    }
  });
});

describe("Forced and Shadow lines of the Road to Rivendell enemies", () => {
  it("04050:A:2 discards 2 attachments of the 3 the engaged player controls, 1 of 1 and none of none", () => {
    for (const [count, gone] of [[0, 0], [1, 1], [3, 2]] as const) {
      const done = played({ engaged: [{ code: "04050", seat: 0 }], attached: Array.from({ length: count }, () => ({ code: "attachment", to: "dh1" })) }, [{ act: "announce", trigger: "engaged", code: "04050" }]);
      const zones = zonesOf(done.run.state, "attachment");
      expect(zones.filter((zone) => zone === "discard").length, `${count} attachments`).toBe(gone);
      expect(zones.length, `${count} attachments`).toBe(count);
    }
  });

  it("901405:A:2 chains: a Raiding Party discarded from the deck engages from the discard pile and fires its own Forced line", () => {
    const done = played({ engaged: [{ code: "901405", seat: 0 }], deck: ["901405", "04049", "f0"], threat: [40, 0] }, [{ act: "announce", trigger: "engaged", code: "901405" }]);
    const parties = zonesOf(done.run.state, "901405");
    expect(parties).toEqual(["engaged", "engaged"]);
    // The second Raiding Party's line discarded the Goblin Taskmaster, which engaged too and made the engaged player deal 2 damage.
    expect(zonesOf(done.run.state, "04049")).toEqual(["engaged"]);
    expect(zonesOf(done.run.state, "f0")).toEqual(["encounterDeck"]);
    expect(done.run.state.seats[0]?.engaged.length).toBe(3);
  });

  it("901406:A:2 counts 20 more Threat for each Vicious Trackers engaged with the player in an engagement check: 1 copy is not enough at Threat 0, 2 copies are", () => {
    const one = played({ engaged: [{ code: "901406", seat: 0 }], deck: ["f0"], threat: [0, 0] }, reveal("04049"));
    expect(zonesOf(one.run.state, "04049")).toEqual(["staging"]);
    const two = played({ engaged: [{ code: "901406", seat: 0 }, { code: "901406", seat: 0 }], deck: ["f0"], threat: [0, 0] }, reveal("04049"));
    expect(zonesOf(two.run.state, "04049")).toEqual(["engaged"]);
  });

  it("901406:A:2 counts in the encounter phase's engagement check too, not only an ambush check", () => {
    const made = table({ phase: "Encounter", engaged: [{ code: "901406", seat: 0 }], staging: ["04049"], threat: [10, 0] });
    const done = drive(start({ ...made.state, ...opening("Encounter") }), made.ctx, (state) => state.phase === "Combat" || state.round > made.state.round);
    expect(zonesOf(done.run.state, "04049")).toEqual(["engaged"]);
    const without = table({ phase: "Encounter", staging: ["04049"], threat: [10, 0] });
    expect(zonesOf(drive(start({ ...without.state, ...opening("Encounter") }), without.ctx, (state) => state.phase === "Combat" || state.round > without.state.round).run.state, "04049")).toEqual(["staging"]);
  });

  it("901409:A:1 makes pass after pass of engagement checks, and gains surge only with no enemy with ambush in play", () => {
    const passes = played({ engaged: ["04049"], staging: ["04050"], deck: ["f0"], threat: [30, 0] }, reveal("901409"));
    expect(zonesOf(passes.run.state, "04049")).toEqual(["engaged"]);
    expect(zonesOf(passes.run.state, "04050")).toEqual(["engaged"]);
    expect(zonesOf(passes.run.state, "f0")).toEqual(["encounterDeck"]);
    const surge = played({ deck: ["f0"], threat: [30, 0] }, reveal("901409"));
    expect(zonesOf(surge.run.state, "f0")).toEqual(["staging"]);
  });

  it("04047:A:1 lets the first player choose an immediate attack for each engaged enemy instead", () => {
    const done = played({ engaged: ["04049"], deck: ["f0", "f0"] }, [reveal("04047"), answer("attack")]);
    expect(done.run.state.window?.kind).toBe("defense");
    expect(done.run.state.cards[done.run.state.window?.kind === "defense" ? (done.run.state.window.enemyId ?? "") : ""]?.code).toBe("04049");
    expect(zonesOf(done.run.state, "f0")).toEqual(["shadow", "encounterDeck"]);
  });

  it("04051:A:2 holds no encounter card cancelable while Crebain is in the staging area, and does not once it is engaged", () => {
    expect(encounterUncancelable(played({ staging: ["04051"] }, []).run.state)).toBe(true);
    expect(encounterUncancelable(played({ engaged: ["04051"] }, []).run.state)).toBe(false);
  });
});

describe("901402 Ambush in the Night: Arwen under Goblin Gate", () => {
  const ARWEN_LAYOUT = (active: boolean, extra: Layout = {}): Layout => ({ stage: "901402", side: "B", play: ["04041"], deck: ["f0"], ...(active ? { active: "04043" } : { staging: ["04043"] }), ...extra });

  // The quest phase from its start: every hero and ally the first player has commits, the quest resolves.
  function questOn(state: ScenarioState, ctx: ReturnType<typeof table>["ctx"], committing: readonly string[]): ScenarioState {
    let run: Run = send(start({ ...state, ...opening("Quest") }), { type: "Commit", cardIds: [...new Set(committing)].flatMap((code) => idsOf(state, code)) }, ctx);
    run = send(run, { type: "Pass" }, ctx);
    for (let guard = 0; guard < 20 && run.state.phase === "Quest" && !run.state.lost && run.state.mode !== "travel"; guard += 1) {
      const pass = legalIntents(run.state, ctx).find((intent) => intent.type === "Pass");
      if (!pass) break;
      run = send(run, pass as PlayerIntent, ctx);
    }
    return run.state;
  }

  for (const active of [false, true]) {
    it(`901402:B:1 Goblin Gate ${active ? "as the active location" : "in the staging area"} guards Arwen, drawn in the staging area with nobody controlling her`, () => {
      const done = played(ARWEN_LAYOUT(active), resolve("901402", "whenRevealed"));
      const arwen = done.run.state.cards[idOf(done.run.state, "04041")];
      expect(arwen?.zone).toBe("staging");
      expect(arwen?.controller).toBeNull();
      const gate = done.run.state.cards[idOf(done.run.state, "04043")];
      expect(gate?.host).toBe(arwen?.id);
      expect(gate?.zone).toBe(active ? "activeLocation" : "staging");
      expect(done.run.state.seats[0]?.play).not.toContain(arwen?.id);
    });
  }

  it("901402:B:3 places no progress on the stage while a Goblin Gate guards Arwen, and places it while the first player controls her", () => {
    const committing = ["dh1", "dh2", "ally", "ally"];
    const base = ARWEN_LAYOUT(false, { play: ["04041", "ally", "ally"] });
    // The Gate (Threat 5) is in the staging area either way: 6 Willpower commits for 1 progress on the stage.
    const free = table({ ...base, staging: ["04043"] });
    const quested = questOn(free.state, free.ctx, committing);
    expect(quested.cards[quested.questStage ?? ""]?.progress, "Arwen controlled").toBe(1);
    const held = played(base, resolve("901402", "whenRevealed"));
    const heldQuested = questOn(held.run.state, held.table.ctx, committing);
    expect(heldQuested.cards[heldQuested.questStage ?? ""]?.progress ?? 0, "Arwen guarded").toBe(0);
    expect(heldQuested.lost).not.toBe(true);
  });

  it("901402:B:1 gives Arwen back to the first player's play area once Goblin Gate is explored, and progress counts again", () => {
    const base = ARWEN_LAYOUT(true, { play: ["04041", "ally", "ally"], active: { code: "04043", progress: 3 } });
    const held = played(base, resolve("901402", "whenRevealed"));
    const gate = held.run.state.cards[idOf(held.run.state, "04043")];
    expect(gate?.progress).toBe(3);
    const quested = questOn(held.run.state, held.table.ctx, ["dh1", "dh2", "ally", "ally"]);
    expect(quested.cards[idOf(quested, "04043")]?.zone).toBe("encounterDiscard");
    const arwen = quested.cards[idOf(quested, "04041")];
    expect(arwen?.zone).toBe("play");
    expect(arwen?.controller).toBe(0);
    expect(quested.seats[0]?.play).toContain(arwen?.id);
  });
});
