// Rules: rr.forced, rr.reveal, rr.shadow-effects, rr.then, rr.in-play-and-out-of-play, rr.attachment-cards, rr.optional-engagement, rr.travel, rr.search, rr.running-out-of-cards (data/rules/entries.json).
// An independent audit of Peril in Pelargir (card-audit): each test is written from the printed line and the rule spans, never from the record or the scenario's own tests, on the smallest table the scene kit builds, and each runs again
// without its line's records (`lineSpec`). A test that shows the engine not doing what the card prints is an `it.fails` under a `// FAULT:` comment; a reading no document settles is marked `// OPEN:`; a gap no play reaches is marked `// KNOWN:`.
import { expect, it } from "vitest";

import { updateCard, type ScenarioState } from "../../../rules/core/state.ts";
import { codesIn, fightEnemy, finish, idOf, legalIntents, revealedTop, send, start } from "../../../../test/harness/scene-kit.ts";
import { lineSpec } from "../../../../test/harness/line-spec.ts";
import { EFFECTS } from "../../../effects/index.ts";

import { tbl, scrolled, zoneOf, hasScroll, threatOf, engagedOf, scrollOn, scrollAction, passUntil, shadowFight, LOW, resourcesOn, engage, quested, quays } from "./audit-kit.ts";

// ---- more of the lines above, on the cases that are hardest to get right ----
it("05019:A:2 Forced: when the damage destroys the Scroll hero the Scroll is attached to the attacking enemy and is not left in the staging area", () => {
  const out = fightEnemy((layout) => scrolled(EFFECTS, layout), "f0", "05044", { seats: 1 as const }, { tweak: (state, made) => updateCard(state, made.hero, { damage: 4 }) });
  expect(out.run.state.cards[out.made.hero]?.zone, "4 + 3 damage on 6 hit points destroys the hero").not.toBe("heroes");
  expect(hasScroll(out.run.state, idOf(out.run.state, "05044")), "the Scroll went onto the enemy").toBe(true);
});
lineSpec("05020:A:1", "Forced: the threat raise of the refresh step (rr.step-7-3) is a raise: a Thug in the staging area engages the Scroll hero's player", (effects) => {
  const t = scrolled(effects, { phase: "Combat", staging: ["05020"] });
  const out = passUntil(start(t.state), t, (state) => state.round > t.state.round);
  expect(engagedOf(out.state), "engaged at the end of the round").toEqual(["05020"]);
});
lineSpec("05023:A:1", "Forced: a shadow card discarded from an enemy at the end of combat is not a discard from the top of the encounter deck", (effects) => {
  const shadow = shadowFight(effects, "place", { staging: ["05023"] }, { enemy: "f0" });
  expect(threatOf(shadow.run.state), "a location dealt as a shadow card raises nothing").toBe(28);
  expect(threatOf(revealedTop(tbl(effects, { staging: ["05023"], deck: ["place", "f0", "f0", "f0"] }), "05024")), "while a discard from the top does").toBe(31);
});
lineSpec("05037:A:1", "Forced: with 2 players the player Pickpocket attacks discards, and no other player", (effects) => {
  const t = fightEnemy((layout) => tbl(effects, layout), "f0", "f0", { seats: 2 as const, heroResources: 2, engaged: [{ code: "f0", seat: 0 }, { code: "05037", seat: 1 }] });
  const state = t.run.state;
  const handOfSeat = (seat: number): number => Object.values(state.cards).filter((card) => card.zone === "hand" && card.controller === seat).length;
  expect(handOfSeat(0), "the first player keeps both cards").toBe(2);
  expect(handOfSeat(1), "the second player discards 1 at random").toBe(1);
  expect(resourcesOn(state, t.made.hero) + resourcesOn(state, t.made.hero2), "the first player keeps his 4 resources").toBe(4);
  expect(resourcesOn(state, t.made.seat1Hero ?? ""), "the second player discards 1 of 2").toBe(1);
});
it("05044:A:1 Archery 2: players deal 2 damage to characters at the beginning of the combat phase, also while the enemy is in the staging area", () => {
  const staged = tbl(EFFECTS, { phase: "Encounter", staging: ["05044"] });
  const out = passUntil(send(start(staged.state), { type: "DeclineEngage" }, staged.ctx), staged, (state) => state.window?.kind === "archery" || state.phase === "Refresh");
  expect(out.state.window, "an archery window opens in the staging area").toMatchObject({ kind: "archery", total: 2 });
  const here = tbl(EFFECTS, { phase: "Encounter", engaged: [{ code: "05044", seat: 0 }] });
  const engagedOut = passUntil(send(start(here.state), { type: "DeclineEngage" }, here.ctx), here, (state) => state.window?.kind === "archery" || state.phase === "Refresh");
  expect(engagedOut.state.window, "and while engaged").toMatchObject({ kind: "archery", total: 2 });
});
lineSpec("05045:A:1", "When Revealed: a Scroll attached to a returned Brigand stays attached to it in the staging area", (effects) => {
  const t = scrollOn(tbl(effects, { engaged: [{ code: "05037", seat: 0 }], deck: ["f0"] }), "05037");
  const out = revealedTop(t, "05045");
  expect(zoneOf(out, "05037"), "returned").toBe("staging");
  expect(hasScroll(out, idOf(out, "05037")), "the Scroll went with it").toBe(true);
});
lineSpec("05041:A:1", "Counts as a Condition: when the attached hero triggers an ability the controller's threat is raised by 1", (effects) => {
  const eowyn = (host: "01007" | "dh1") => {
    const t = tbl(effects, { phase: "Quest", heroes: [{ code: "01007", seat: 0 }], hand: ["filler"], attached: [{ code: "05041", to: host, encounter: true }] }, ["01007"]);
    const offered = legalIntents(t.state, t.ctx).find((intent) => intent.type === "Trigger" && t.state.cards[intent.cardId]?.code === "01007");
    expect(offered, "Eowyn's Action is offered").toBeDefined();
    return threatOf(finish(send(start(t.state), offered as never, t.ctx), t.ctx).state);
  };
  expect(eowyn("01007"), "the Condition is on Eowyn").toBe(29);
  expect(eowyn("dh1"), "the Condition is on another hero").toBe(28);
});
lineSpec("05043:A:1", "Forced: only the engaged player's heroes lose resources", (effects) => {
  const t = engage(effects, "05043", "optional", { seats: 2, heroResources: 3 });
  expect(resourcesOn(t.state, t.t.hero), "the engaged player").toBe(2);
  expect(resourcesOn(t.state, t.t.seat1Hero ?? ""), "the other player").toBe(3);
});

// A Test of Will (01050) in the hand of a player with a spirit hero holding 1 resource: a cancel is offered for a revealed card whose When Revealed effect can be canceled.
const canceled = (code: string, deck: readonly string[]) => {
  const t = tbl(EFFECTS, { hand: ["01050"], heroes: [{ code: "01007", seat: 0, resources: 1 }], deck }, ["01050", "01007"]);
  const state = revealedTop(t, code);
  return { state, offered: legalIntents(state, t.ctx).some((intent) => intent.type === "Trigger" && state.cards[intent.cardId]?.code === "01050") };
};
it("05040:A:1 This effect cannot be canceled: A Test of Will is not offered against Lost in the City, while it is against Collateral Damage", () => {
  expect(canceled("05024", ["f0", "f0", "f0"]).offered, "control: Collateral Damage can be canceled").toBe(true);
  const out = canceled("05040", ["05023", "f0"]);
  expect(out.offered, "no cancel for Lost in the City").toBe(false);
  expect(codesIn(out.state, "staging"), "its effect ran").toHaveLength(1);
});
lineSpec("05019:A:1", "Action: not offered while the Scroll is attached to an enemy (it is not unattached)", (effects) => {
  const t = scrollOn(tbl(effects, { phase: "Planning", staging: ["05044"] }), "05044");
  expect(scrollAction(t.state, t), "attached to an enemy in the staging area").toBeUndefined();
  const loose = tbl(effects, { phase: "Planning", staging: ["05019"] });
  expect(scrollAction(loose.state, loose), "control: the same Scroll unattached").toBeDefined();
});
lineSpec("05019:A:1", "unattached: when its hero is discarded (Umbar Assassin engages by check) the Scroll returns to the staging area", (effects) => {
  const t = scrolled(effects, { phase: "Encounter", staging: ["05044"], threat: [45, 45] });
  const run = passUntil(send(start(t.state), { type: "DeclineEngage" }, t.ctx), t, (state) => state.phase !== "Encounter");
  expect(run.state.cards[t.hero]?.zone, "the first hero (the first option) is discarded").not.toBe("heroes");
  expect(zoneOf(run.state, "05019"), "the Scroll goes to the staging area, not the discard pile").toBe("staging");
});
// The first enemy of the staging step of the quest phase attacks the Scroll hero's player from the staging area, once for the round, with 2 players too.
lineSpec("05067:B:2", "Forced: in the staging step of a real round only the first enemy revealed attacks, and the next round's first enemy attacks again", (effects) => {
  const t = scrolled(effects, { ...quays, seats: 2, phase: "Planning", deck: ["05043", "05044", "f0", "f0", "f0", "f0"] }, "dh3");
  const attackers: string[] = [];
  const noteAttack = (state: ScenarioState): boolean => {
    const enemy = state.pendingAttack ? state.cards[state.pendingAttack.enemyId]?.code : undefined;
    if (enemy != null && state.window?.kind === "defense" && attackers.at(-1) !== `${enemy}:${state.round}`) attackers.push(`${enemy}:${state.round}`);
    return state.round > t.state.round + 1;
  };
  const run = passUntil(start(t.state), t, noteAttack);
  expect(run.state.lost, "the game goes on").toBeFalsy();
  const codes = attackers.map((one) => one.split(":")[0]);
  expect(codes[0], "round 1: the first enemy of the two revealed attacks").toBe("05043");
  expect(codes.filter((code) => code === "05044").length, "the second enemy revealed in the same round does not").toBe(0);
});

lineSpec("05019:A:2", "Forced: damage that is not dealt by an enemy attack (archery) leaves the Scroll on its hero, damage of an attack moves it", (effects) => {
  const archery = fightEnemy((layout) => scrolled(effects, layout, "dh2"), "f0", "05044", { seats: 1 as const });
  expect(archery.run.state.cards[archery.made.hero2]?.damage, "the 2 archery damage was dealt to the Scroll hero").toBe(2);
  expect(hasScroll(archery.run.state, archery.made.hero2), "archery is no attack: the Scroll stays").toBe(true);
  const attack = fightEnemy((layout) => scrolled(effects, layout, "dh2"), "f0", "05043", { seats: 1 as const }, { undefended: true, defender: (made) => made.hero2 });
  expect(hasScroll(attack.run.state, idOf(attack.run.state, "05043")), "the attack damaged the Scroll hero: it moves").toBe(true);
});
it("05066:B:1 Battle: characters use their Attack instead of Willpower when questing", () => {
  const t = tbl(EFFECTS, { stage: "05066", heroes: [{ code: "01005", seat: 0 }] }, ["01005"]);
  const step = quested(t, [idOf(t.state, "01005")]).steps.find((one) => one.kind === "quest");
  expect(step?.kind === "quest" ? step.willpower : -1, "Legolas has Willpower 1 and Attack 3").toBe(3);
});

lineSpec("05023:A:2", "Shadow: a Thug dealt face down as another enemy's shadow card is not in play and adds no card", (effects) => {
  const deck = ["05023", "05020", "f0", "f0", "f0", "f0"];
  const dealt = shadowFight(effects, "05023", { deck, threat: LOW, engaged: [{ code: "05043", seat: 0 }, { code: "f0", seat: 0 }] });
  expect(dealt.run.state.encounterDeck.length, "2 shadow cards dealt, none additional").toBe(4);
  const staged = shadowFight(effects, "05023", { deck, threat: LOW, staging: ["05020"], engaged: [{ code: "05043", seat: 0 }, { code: "f0", seat: 0 }] });
  expect(staged.run.state.encounterDeck.length, "control: a Thug in the staging area adds 1").toBe(3);
});

// Strength of Will (01047, Response: after you travel to a location, exhaust a spirit character to place 2 progress tokens on that location) is a player card effect that names the location.
const afterTravel = (location: string): number => {
  const t = tbl(EFFECTS, { phase: "Travel", staging: [location], heroes: [{ code: "01007", seat: 0, resources: 1 }], heroResources: 1, hand: ["01047"] }, ["01007", "01047"]);
  const run = finish(send(start(t.state), { type: "Travel", locationId: idOf(t.state, location) }, t.ctx), t.ctx);
  const offered = legalIntents(run.state, t.ctx).find((intent) => intent.type === "Trigger" && run.state.cards[intent.cardId]?.code === "01047");
  const after = offered ? finish(send(run, offered as never, t.ctx), t.ctx) : run;
  return after.state.cards[idOf(after.state, location)]?.progress ?? 0;
};
it("05039:A:1 Immune to player card effects: a player Response that places progress on Market Square places none, and does on another location", () => {
  expect(afterTravel("05023"), "control: 2 progress on Harbor Storehouse").toBe(2);
  expect(afterTravel("05039"), "Market Square ignores the player card").toBe(0);
});
