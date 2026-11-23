// Rules: hob.riddle-area, hob.riddles, hob.riddles-steps-2-and-3, hob.setup-dungeons-deep-and-caverns-dim, rr.quest-advancement, faq.progress-without-advancing, rr.forced, rr.first-player, rr.immune, rr.cancel, rr.surge, mec112.gollum-smeagol (data/rules/entries.json); docs/scenarios/the-hobbit/dungeons-deep-and-caverns-dim.md (Dungeons Deep and Caverns Dim).
import { chai, describe, expect, it } from "vitest";

import type { Effect } from "../../../catalog/boundary.ts";
import { EFFECTS } from "../../../effects/index.ts";
import { settle } from "../../../rules/engine/machine.ts";
import { legalIntents, legalTargets, type PlayerIntent } from "../../../rules/engine/reduce.ts";
import type { EngineStep } from "../../../rules/core/intents.ts";
import { flagged, updateCard, type ScenarioState } from "../../../rules/core/state.ts";
import { modifiedStat } from "../../../rules/core/keywords.ts";
import { takeProgressOff } from "../../../rules/core/progress.ts";
import { spawn } from "../../../rules/core/zones.ts";
import { placeProgress } from "../../../rules/interpret/effect-verbs.ts";
import { constantInstructions } from "../../../rules/interpret/constant-records.ts";
import { restricted } from "../../../rules/interpret/restrictions.ts";
import { pickCandidates } from "../../../rules/interpret/pick.ts";
import { fireForced } from "../../../rules/windows/triggers.ts";
import { pushDue } from "../../../rules/windows/delayed.ts";
import { dealOneShadow } from "../../../rules/interpret/interpret.ts";
import { inDiscard, progressOf, revealAnswering, riddleTable, stacked } from "../../../rules/families/riddles/fixture.ts";
import { codesIn, idOf, resolveRecords, revealFromTop, send } from "../../../../test/harness/scene-kit.ts";
import { IntentRefused } from "../../../../test/harness/scene.ts";
import { withoutLine } from "../../../../test/harness/card-spec.ts";

// A printed line as a test that proves it tests the line (test/harness/line-spec.ts does the same, with two tests): `check` passes on every record and fails on the records without those of `line`. It is one test with the line id in its
// title, so scripts/checks/spec-coverage.test.ts finds the line.
function proves(line: string, check: (effects: readonly Effect[]) => void): void {
  check(EFFECTS);
  let thrown: unknown = null;
  try {
    check(withoutLine(EFFECTS, line));
  } catch (error) {
    thrown = error;
  }
  if (thrown == null) throw new Error(`${line}: the check passes without its records, so it tests nothing`);
  if (!(thrown instanceof chai.AssertionError) && !(thrown instanceof IntentRefused)) throw new Error(`${line}: the check threw something other than a failed expectation or a refused intent`, { cause: thrown });
}

// The lines that need the riddle area (a table with Bilbo Baggins and the area stage 1A's Setup makes, the riddles family's fixture) and the answering of a riddle: a line spec for each, which runs once on every record and once without
// the records of its line and must fail there (test/harness/line-spec.ts). The riddles family's own tests (src/rules/families/riddles/) cover the engine; these are the printed lines.
const ALLIES = ["01013", "01013", "01013", "01013"];
const stage3 = (made: ReturnType<typeof riddleTable>): ScenarioState => settle({ ...updateCard(updateCard(made.state, idOf(made.state, "131029"), { progress: 14 }), idOf(made.state, "131030"), { progress: 9 }), window: null, mode: "stopped" }, made.ctx, []);
const zoneOf = (state: ScenarioState, code: string): string | undefined => state.cards[idOf(state, code)]?.zone;

describe("131029:A:1 to B:2 Out of the Frying Pan", () => {
  it("131029:A:1 Setup creates the riddle area: stage 2 lies in it and leaves the quest deck", () =>
    proves("131029:A:1", (effects) => {
      const made = riddleTable({}, effects);
      expect(codesIn(made.state, "riddleArea")).toContain("131030");
      expect(made.state.questDeck.map((id) => made.state.cards[id]?.code)).toEqual(["131031"]);
    }));

  // 131030:B:1 prints the same bar; each is read alone, so a line that did nothing would let the quest advance.
  it("131029:B:1 stage 1 stays the current stage, full, until stage 2 is complete too", () =>
    proves("131029:B:1", (effects) => {
      const made = riddleTable({}, withoutLine(effects, "131030:B:1"));
      const full = settle({ ...updateCard(made.state, idOf(made.state, "131029"), { progress: 17 }), window: null, mode: "stopped" }, made.ctx, []);
      expect(full.questStage).toBe(idOf(full, "131029"));
      expect(full.cards[idOf(full, "131029")]?.progress).toBe(17);
      expect(restricted(full, made.ctx, "advance").length).toBeGreaterThan(0);
    }));

  it("131029:B:2 the staging step reveals 1 more encounter card for each player", () =>
    proves("131029:B:2", (effects) => {
      const two = riddleTable({ seats: 2 }, effects);
      const run = resolveRecords(two.state, two.ctx, "131029", "forced", idOf(two.state, "131029"));
      expect(run.state.modifiers.find((modifier) => modifier.stat === "revealMore")?.amount).toBe(2);
      const one = riddleTable({}, effects);
      expect(resolveRecords(one.state, one.ctx, "131029", "forced", idOf(one.state, "131029")).state.modifiers.find((modifier) => modifier.stat === "revealMore")?.amount).toBe(1);
    }));
});

describe("131030:A:1 to B:3 Riddles in the Dark", () => {
  it("131030:A:1 Setup puts Gollum in the area and the Ring on Bilbo Baggins, and the encounter deck is left without them", () =>
    proves("131030:A:1", (effects) => {
      const made = riddleTable({}, effects);
      expect(zoneOf(made.state, "131074")).toBe("riddleArea");
      expect(made.state.cards[idOf(made.state, "131079")]?.host).toBe(made.bilbo);
      expect(made.state.encounterDeck.map((id) => made.state.cards[id]?.code)).toEqual(["f0", "f0"]);
    }));

  it("131030:B:1 stage 2 is complete first: the quest waits for stage 1, then advances at once", () =>
    proves("131030:B:1", (effects) => {
      const made = riddleTable({}, withoutLine(effects, "131029:B:1"));
      const quiet = (state: ScenarioState) => settle({ ...state, window: null, mode: "stopped" }, made.ctx, []);
      const first = quiet(updateCard(made.state, idOf(made.state, "131029"), { progress: 14 }));
      expect(first.questStage).toBe(idOf(first, "131029"));
      const both = quiet(updateCard(first, idOf(first, "131030"), { progress: 9 }));
      expect(both.questStage).toBe(idOf(both, "131031"));
    }));

  it("131030:B:2 no card effect places progress on stage 2", () =>
    proves("131030:B:2", (effects) => {
      const made = riddleTable({}, effects);
      const stage = idOf(made.state, "131030");
      expect(placeProgress(made.state, stage, 3, made.ctx, []).cards[stage]?.progress).toBe(0);
    }));

  it("131030:B:2 no card effect takes progress off stage 2", () =>
    proves("131030:B:2", (effects) => {
      const made = riddleTable({}, effects);
      const stage = idOf(made.state, "131030");
      expect(takeProgressOff(updateCard(made.state, stage, { progress: 4 }), stage, 3, []).cards[stage]?.progress).toBe(4);
    }));

  it("131030:B:2 answering a riddle puts progress on it and Not Fair! Not Fair! takes none off (rr.cannot: the bar is absolute)", () =>
    proves("131030:B:2", (effects) => {
      const made = riddleTable({ deck: ["131074", "131079", "f0", "f0", "treachery", "f0", "f0"], deckOf: ["01013", "01013"] }, effects);
      const answered = revealAnswering(made.state, made.ctx, "131076", ["answer", "ally"]);
      expect(progressOf(answered.state)).toBe(2);
      expect(progressOf(revealAnswering(stacked(answered.state, ["f0", "f0", "treachery"]), made.ctx, "131084", ["enemy"]).state)).toBe(2);
      const stage = idOf(answered.state, "131030");
      expect(placeProgress(answered.state, stage, 3, made.ctx, []).cards[stage]?.progress).toBe(2);
    }));

  it("131030:B:3 the cards of the area are immune to player card effects, and Bilbo Baggins cannot quest, attack or take attachments", () =>
    proves("131030:B:3", (effects) => {
      const made = riddleTable({}, effects);
      const spec = { type: "card", control: "any", riddleArea: true } as const;
      for (const code of ["131030", "131074", "131001", "131079"]) expect(flagged(made.state, idOf(made.state, code), "immuneToPlayerCards"), code).toBe(true);
      for (const stat of ["cannotQuest", "cannotAttack", "noPlayerAttachments"] as const) expect(flagged(made.state, made.bilbo, stat), stat).toBe(true);
      const played = spawn(made.state, "event", { zone: "hand", seat: 0 });
      expect(pickCandidates(played.state, spec, 0, [], played.id, made.ctx)).toEqual([]);
    }));

  // Nothing in the engine has a way out of the area but stage 3's own effects: an encounter effect that returns, engages or discards every enemy leaves Gollum, and the stage's records are the only ones that move the three.
  it("131030:B:3 no encounter effect moves Gollum out of the area; stage 3's quest effects do (the area holds by its structure: no record decides it)", () => {
    const made = riddleTable({ engaged: [{ code: "f0", seat: 0 }] });
    const mover: Effect = { id: "f0:whenRevealed:9", cardCode: "f0", lines: ["f0:A:9"], timing: "whenRevealed", instructions: [{ verb: "ReturnToStaging", target: { kind: "engagedEnemies", who: "each", pick: "all" } }, { verb: "EngageAll", who: "firstPlayer", inPlay: true }] };
    const moved = { ...made, ctx: { ...made.ctx, effects: [...made.ctx.effects, mover] } };
    const source = spawn(moved.state, "f0", { zone: "staging" });
    const run = resolveRecords(source.state, moved.ctx, "f0", "whenRevealed", source.id);
    expect(zoneOf(run.state, "131074")).toBe("riddleArea");
    expect(zoneOf(stage3(made), "131074")).toBe("engaged");
  });
});

describe("131031:B:1 to B:4 Into the Fire", () => {
  it("131031:B:1 When Revealed: stage 2 leaves the game and the first player keeps Bilbo Baggins; each player reveals 1 encounter card", () =>
    proves("131031:B:1", (effects) => {
      const made = riddleTable({ seats: 2, deck: ["131074", "131079", "f3", "f3", "f3"] }, effects);
      const run = resolveRecords(made.state, made.ctx, "131031", "whenRevealed", idOf(made.state, "131031"));
      expect(zoneOf(run.state, "131030")).toBe("removed");
      expect(run.state.cards[made.bilbo]?.zone).toBe("heroes");
      expect(run.state.staging.filter((id) => run.state.cards[id]?.code === "f3")).toHaveLength(2);
    }));

  it("131031:B:2 Gollum engages the first player, and when the first player token passes he engages the next", () =>
    proves("131031:B:2", (effects) => {
      const made = riddleTable({ seats: 2 }, effects);
      const state = stage3(made);
      const gollum = idOf(state, "131074");
      expect(state.cards[gollum]).toMatchObject({ zone: "engaged", controller: 0 });
      const steps: EngineStep[] = [];
      const passed = settle(fireForced({ ...state, firstPlayer: 1 }, { trigger: "firstPlayerTokenPassed", seat: 1 }, made.ctx, steps), made.ctx, steps);
      expect(passed.cards[gollum]).toMatchObject({ zone: "engaged", controller: 1 });
    }));

  it("131031:B:2 damage from an undefended attack by Gollum goes on Bilbo Baggins", () =>
    proves("131031:B:2", (effects) => {
      const made = riddleTable({}, effects);
      expect(flagged(stage3(made), "table", "gollumDamageToBilbo")).toBe(true);
    }));

  it("131031:B:3 riddles are ignored and treachery cards gain surge", () =>
    proves("131031:B:3", (effects) => {
      const made = riddleTable({ deck: ["131074", "131079", "f3", "f3", "f3"] }, effects);
      const state = stage3(made);
      const verbs = constantInstructions(state, made.ctx).map(({ instruction }) => instruction.verb);
      expect(verbs).toEqual(expect.arrayContaining(["IgnoreRiddles", "TreacheriesGainSurge"]));
      const revealed = revealAnswering(state, made.ctx, "131076", []);
      expect(revealed.state.window?.kind).not.toBe("choose");
      const staged = (current: ScenarioState): number => current.staging.filter((id) => current.cards[id]?.code === "f3").length;
      expect(staged(revealAnswering(stacked(state, ["treachery", "f3"]), made.ctx, "treachery", []).state)).toBe(staged(state) + 1);
    }));

  // The line restates the rule that defeating the final stage wins the game (its record has no instruction): the stage is final, and defeating it wins.
  it("131031:B:4 defeating the stage wins the game", () => {
    const made = riddleTable();
    const final = stage3(made);
    const won = settle({ ...updateCard(final, final.questStage ?? "", { progress: 99 }), window: null, mode: "stopped" }, made.ctx, []);
    expect(final.questStage).toBe(idOf(final, "131031"));
    expect(won.stageCleared).toBe(true);
  });
});

describe("131074:A:1 Gollum", () => {
  it("131074:A:1 after a riddle with no match Gollum attacks Bilbo Baggins, with no shadow card", () =>
    proves("131074:A:1", (effects) => {
      const made = riddleTable({ deckOf: ["01040", "01040"] }, effects);
      const run = revealAnswering(made.state, made.ctx, "131076", ["answer", "ally"]);
      expect(run.state.pendingAttack?.enemyId).toBe(idOf(run.state, "131074"));
      expect(run.state.pendingAttack?.onlyHeroes).toEqual([made.bilbo]);
      expect(run.state.cards[idOf(run.state, "131074")]?.shadowId).toBeNull();
    }));

  it("131074:A:1 does not attack after a riddle with a match", () => {
    const made = riddleTable({ deckOf: ["01013", "01013"] });
    expect(revealAnswering(made.state, made.ctx, "131076", ["answer", "ally"]).state.pendingAttack).toBeNull();
  });
});

// A riddle card as it is revealed: the choice (the cards that print one), the names it asks and the cards it discards, 1 progress for each discarded card that matches every name.
describe("the riddles the encounter cards print", () => {
  it("131075:A:2 Great Gray Wolf: the first player names a type, a sphere and a cost, and 3 cards come off his deck", () =>
    proves("131075:A:2", (effects) => {
      const made = riddleTable({ deckOf: ALLIES }, effects);
      const run = revealAnswering(made.state, made.ctx, "131075", ["answer", "ally", "leadership", "2"]);
      expect(inDiscard(run.state, "01013")).toBe(3);
      expect(progressOf(run.state)).toBe(3);
    }));

  it("131076:A:2 Wild Wargs: a type, 2 cards", () =>
    proves("131076:A:2", (effects) => {
      const made = riddleTable({ deckOf: ALLIES }, effects);
      const revealed = revealFromTop(made.state, made.ctx, "131076", []).state;
      expect(revealed.window).toMatchObject({ kind: "choose", options: ["answer", "resolve"] });
      const run = revealAnswering(made.state, made.ctx, "131076", ["answer", "ally"]);
      expect(inDiscard(run.state, "01013")).toBe(2);
      expect(progressOf(run.state)).toBe(2);
    }));

  it("131077:A:2 The Wargs' Glade: a sphere, 1 card", () =>
    proves("131077:A:2", (effects) => {
      const made = riddleTable({ deckOf: ALLIES }, effects);
      const run = revealAnswering(made.state, made.ctx, "131077", ["answer", "leadership"]);
      expect(inDiscard(run.state, "01013")).toBe(1);
      expect(progressOf(run.state)).toBe(1);
    }));

  it("131080:A:2 Come Down Little Bird: a type and a cost, 3 cards", () =>
    proves("131080:A:2", (effects) => {
      const made = riddleTable({ deckOf: ALLIES }, effects);
      const run = revealAnswering(made.state, made.ctx, "131080", ["answer", "ally", "2"]);
      expect(inDiscard(run.state, "01013")).toBe(3);
      expect(progressOf(run.state)).toBe(3);
    }));

  it("131082:A:2 Hiding in the Trees: a type and a sphere, 3 cards", () =>
    proves("131082:A:2", (effects) => {
      const made = riddleTable({ deckOf: ALLIES }, effects);
      const run = revealAnswering(made.state, made.ctx, "131082", ["answer", "ally", "leadership"]);
      expect(inDiscard(run.state, "01013")).toBe(3);
      expect(progressOf(run.state)).toBe(3);
    }));

  it("131081:A:2 It Likes Riddles?: a cost, 2 cards", () =>
    proves("131081:A:2", (effects) => {
      const made = riddleTable({ deckOf: ALLIES }, effects);
      const run = revealAnswering(made.state, made.ctx, "131081", ["2"]);
      expect(inDiscard(run.state, "01013")).toBe(2);
      expect(progressOf(run.state)).toBe(2);
    }));

  it("131083:A:2 What's In My Pocket?: a sphere and a cost, 2 cards", () =>
    proves("131083:A:2", (effects) => {
      const made = riddleTable({ deckOf: ALLIES }, effects);
      const run = revealAnswering(made.state, made.ctx, "131083", ["leadership", "2"]);
      expect(inDiscard(run.state, "01013")).toBe(2);
      expect(progressOf(run.state)).toBe(2);
    }));

  it("131081:A:1 the first player must answer; with a match, encounter cards are discarded until another riddle card, which he answers", () =>
    proves("131081:A:1", (effects) => {
      const made = riddleTable({ deck: ["131074", "131079", "f0", "131076", "f0"], deckOf: ALLIES }, effects);
      const revealed = revealFromTop(stacked(made.state, ["f0", "131076"]), made.ctx, "131081", []).state;
      expect(revealed.window?.kind === "choose" ? revealed.window.options : []).not.toContain("answer");
      const run = revealAnswering(stacked(made.state, ["f0", "131076"]), made.ctx, "131081", ["2", "ally"]);
      expect(zoneOf(run.state, "131076")).toBe("encounterDiscard");
      expect(progressOf(run.state)).toBe(4);
    }));

  it("131083:A:1 the first player must answer: no choice is offered, and the first name is asked at once", () =>
    proves("131083:A:1", (effects) => {
      const made = riddleTable({ deckOf: ALLIES }, effects);
      const revealed = revealFromTop(made.state, made.ctx, "131083", []).state;
      expect(revealed.window?.kind === "choose" ? revealed.window.options : []).toEqual(["leadership", "spirit", "lore", "tactics", "baggins"]);
    }));

  // The removal is barred by 131030:B:2 (rr.cannot, recorded reading in docs/scenarios/the-hobbit/dungeons-deep-and-caverns-dim.md, Dungeons Deep and Caverns Dim): what the card still does is name a type and discard 3 cards.
  it("131084:A:1 Not Fair! Not Fair!: the first player names a type and the top 3 encounter cards are discarded; stage 2 keeps its progress", () =>
    proves("131084:A:1", (effects) => {
      const made = riddleTable({ deck: ["131074", "131079", "f0", "f0", "treachery", "f0", "f0"] }, effects);
      const state = updateCard(stacked(made.state, ["f0", "f0", "treachery"]), idOf(made.state, "131030"), { progress: 5 });
      const run = revealAnswering(state, made.ctx, "131084", ["enemy"]);
      expect(run.state.encounterDiscard.map((id) => run.state.cards[id]?.code).sort()).toEqual(["131084", "f0", "f0", "treachery"]);
      expect(progressOf(run.state)).toBe(5);
    }));
});

describe("what the cards leave alone", () => {
  it("131076:A:1 gives Wild Wargs no more Attack when its shadow card has no riddle", () => {
    const made = riddleTable({ engaged: [{ code: "131076", seat: 0 }], deck: ["131074", "131079", "f0", "f0", "f0"] });
    const steps: EngineStep[] = [];
    const next = settle(dealOneShadow(made.state, idOf(made.state, "131076"), steps, made.ctx), made.ctx, steps);
    expect(modifiedStat(next, next.cards[idOf(next, "131076")]!, "attack", made.ctx.cards)).toBe(3);
  });
});

describe("131078:A:4 Lake in the Cavern", () => {
  it("131078:A:4 Forced: after the players advance to stage 3 it is removed from the game", () =>
    proves("131078:A:4", (effects) => {
      const made = riddleTable({}, effects);
      expect(zoneOf(stage3(made), "131078")).toBe("removed");
    }));

  it("131078:A:2 lets the players travel to another location while Lake in the Cavern is in the staging area", () => {
    const made = riddleTable({ phase: "Travel", staging: ["131078", "place"] });
    const opened = settle({ ...made.state, ...{ window: { kind: "travel" } }, mode: "stopped" }, made.ctx, []);
    expect(legalIntents(opened, made.ctx).some((intent) => intent.type === "Travel")).toBe(true);
  });
});

describe("131079:A:1 to A:3 Bilbo's Magic Ring", () => {
  it("131079:A:1 lies on Bilbo Baggins, the one hero it attaches to", () => {
    const made = riddleTable();
    const ring = idOf(made.state, "131079");
    expect(made.state.cards[ring]).toMatchObject({ zone: "attached", host: made.bilbo });
    expect(legalTargets(made.state, { type: "PlayCard", cardId: ring }, made.ctx)).toEqual([]);
  });

  const action = (state: ScenarioState, made: ReturnType<typeof riddleTable>, id: string) => legalIntents({ ...state, window: { kind: "frameAction" }, passed: [], activeSeat: 0 }, made.ctx).find((intent) => intent.type === "Trigger" && intent.effectId === id);

  // The Action is asked inside the riddle step, of the answering first player, after the top cards come off: Bilbo spends 1 Baggins resource and 1 more card is discarded and checked for a match. The same Action is offered by no action window.
  it("131079:A:2 while answering, the first player spends 1 Baggins resource to discard 1 more card, which counts if it matches", () =>
    proves("131079:A:2", (effects) => {
      const made = riddleTable({ seats: 2, deckOf: ALLIES }, effects);
      const resourced = updateCard(made.state, made.bilbo, { resources: 1 });
      expect(action(resourced, made, "131079:action:1")).toBeUndefined();
      const revealed = { state: revealFromTop(resourced, made.ctx, "131076", []).state, steps: [] as EngineStep[] };
      const named = send(send(revealed, { type: "Choose", optionId: "answer" }, made.ctx), { type: "Choose", optionId: "ally" }, made.ctx);
      expect(named.state.window).toMatchObject({ kind: "choose", options: ["ring", "stop"], seat: made.state.firstPlayer });
      const used = send(named, { type: "Choose", optionId: "ring" }, made.ctx);
      expect(used.state.cards[made.bilbo]?.resources).toBe(0);
      expect(inDiscard(used.state, "01013")).toBe(3);
      expect(progressOf(used.state)).toBe(3);
    }));

  it("131079:A:3 exhausts the Ring and raises each player's threat by 2 to add 1 Baggins resource to Bilbo", () =>
    proves("131079:A:3", (effects) => {
      const made = riddleTable({ seats: 2 }, effects);
      const before = made.state.seats.map((one) => one.threat);
      const offered = action(made.state, made, "131079:action:2");
      expect(offered).toBeDefined();
      const run = send({ state: { ...made.state, window: { kind: "frameAction" }, passed: [], activeSeat: 0 }, steps: [] }, offered as PlayerIntent, made.ctx);
      expect(run.state.cards[idOf(run.state, "131079")]?.exhausted).toBe(true);
      expect(run.state.seats.map((one) => one.threat)).toEqual(before.map((threat) => threat + 2));
      expect(run.state.cards[made.bilbo]?.resources).toBe(1);
    }));

  it("131079:A:3 is not offered once the Ring is exhausted", () => {
    const made = riddleTable({ seats: 2 });
    expect(action(updateCard(made.state, idOf(made.state, "131079"), { exhausted: true }), made, "131079:action:2")).toBeUndefined();
  });
});

describe("131075:A:1 Great Gray Wolf, the delayed return", () => {
  it("131075:A:1 returns every Creature enemy, itself included, to the staging area at the end of the combat phase", () =>
    proves("131075:A:1", (effects) => {
      const made = riddleTable({ engaged: [{ code: "131075", seat: 0 }, { code: "131076", seat: 0 }, { code: "f0", seat: 0 }], deck: ["131074", "131079", "131077", "f0", "f0", "f0"] }, effects);
      const stacked77 = { ...made.state, encounterDeck: [made.state.encounterDeck.find((id) => made.state.cards[id]?.code === "131077") ?? "", ...made.state.encounterDeck.filter((id) => made.state.cards[id]?.code !== "131077")] };
      const steps: EngineStep[] = [];
      const dealt = settle(dealOneShadow(stacked77, idOf(stacked77, "131075"), steps, made.ctx), made.ctx, steps);
      expect(dealt.delayed.length).toBeGreaterThan(0);
      const due = settle(pushDue({ ...dealt, window: null, mode: "stopped" }, dealt.delayed[0]?.phase ?? "Combat", "endOfPhase", steps), made.ctx, steps);
      expect(zoneOf(due, "131075")).toBe("staging");
      expect(zoneOf(due, "131076")).toBe("staging");
      expect(due.seats[0]?.engaged.map((id) => due.cards[id]?.code)).toEqual(["f0"]);
    }));
});
