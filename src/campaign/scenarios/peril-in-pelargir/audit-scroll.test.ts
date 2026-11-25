// Rules: rr.forced, rr.reveal, rr.shadow-effects, rr.then, rr.in-play-and-out-of-play, rr.attachment-cards, rr.search, rr.running-out-of-cards (data/rules/entries.json).
// An audit of the Scroll's cards of Peril in Pelargir (05019 to 05024, 05037): each test is written from the printed line and the rule spans on the smallest table the scene kit builds, and runs again without its line's
// records (`lineSpec`). It holds the cases the scenario's own tests (`lines.test.ts`) do not reach.
import { expect } from "vitest";

import { updateCard, type GameEvent, type ScenarioState } from "../../../rules/core/state.ts";
import { codesIn, drive, engagedCodes, fightEnemy, finish, idOf, legalIntents, revealedTop, send, start, zoneOf, type Layout } from "../../../../test/harness/scene-kit.ts";
import { lineSpec } from "../../../../test/harness/line-spec.ts";

import { announced } from "../../../../test/scenarios/peril-in-pelargir/scroll.ts";

import { tbl, scrolled, hasScroll, threatOf, scrollOn, scrollAction, shadowFight, dmg, LOW, handOf, resourcesOn, type Es } from "./audit-kit.ts";

// ---- 05019 Alcaron's Scroll ----
lineSpec("05019:A:1", "unattached: when its enemy host is defeated the Scroll returns to the staging area and is not discarded", (effects) => {
  const t = scrollOn(tbl(effects, { phase: "PlayerAttacks", engaged: [{ code: "05020", seat: 0, damage: 2 }] }), "05020");
  let run = start(t.state);
  const attack = legalIntents(run.state, t.ctx).some((intent) => intent.type === "DeclareAttackers");
  expect(attack, "a player attack is offered").toBe(true);
  run = send(run, { type: "DeclareAttackers", enemyId: idOf(run.state, "05020"), attackerIds: [t.hero] }, t.ctx);
  run = finish(run, t.ctx);
  expect(zoneOf(run.state, "05020"), "the Thug (3 hit points, 2 damage) took 2 Attack - 1 Defense").not.toBe("engaged");
  expect(zoneOf(run.state, "05019"), "the Scroll is in the staging area").toBe("staging");
});
lineSpec("05019:A:1", "Action: not offered while the Scroll is attached to a hero, nor when every hero is exhausted", (effects) => {
  const held = scrolled(effects, { phase: "Planning" });
  expect(scrollAction(held.state, held), "attached to a hero").toBeUndefined();
  const loose = tbl(effects, { phase: "Planning", staging: ["05019"] });
  const tired = [loose.hero, loose.hero2].reduce((state, id) => updateCard(state, id, { exhausted: true }), loose.state);
  expect(scrollAction(tired, loose), "no ready hero").toBeUndefined();
  expect(scrollAction(loose.state, loose), "the same table with ready heroes").toBeDefined();
});
lineSpec("05019:A:1", "Action: not offered while the Scroll is attached to an enemy (it is not unattached)", (effects) => {
  const t = scrollOn(tbl(effects, { phase: "Planning", staging: ["05044"] }), "05044");
  expect(scrollAction(t.state, t), "attached to an enemy in the staging area").toBeUndefined();
  const loose = tbl(effects, { phase: "Planning", staging: ["05019"] });
  expect(scrollAction(loose.state, loose), "control: the same Scroll unattached").toBeDefined();
});
const damaged = (effects: Es, options: { undefended?: boolean; second?: boolean; enemy?: string } = {}) =>
  fightEnemy((layout) => scrolled(effects, layout), "f0", options.enemy ?? "05043", { seats: 1 as const }, { undefended: options.undefended, defender: options.second ? (made) => made.hero2 : undefined });
lineSpec("05019:A:2", "Forced: damage that is not dealt to the Scroll hero (defended down to 0, or dealt to another hero) leaves the Scroll where it is; damage to the hero moves it", (effects) => {
  const none = damaged(effects, { enemy: "f0" });
  expect(none.run.state.cards[none.made.hero]?.damage ?? 0, "Attack 1 against Defense 2").toBe(0);
  expect(hasScroll(none.run.state, none.made.hero), "no damage: still on the hero").toBe(true);
  const other = damaged(effects, { undefended: true, second: true });
  expect(other.run.state.cards[other.made.hero2]?.damage, "the other hero took the damage").toBe(3);
  expect(hasScroll(other.run.state, other.made.hero), "the Scroll stays").toBe(true);
  const hit = damaged(effects, { undefended: true });
  expect(hasScroll(hit.run.state, idOf(hit.run.state, "05043")), "the Scroll hero took damage: it moves").toBe(true);
});
lineSpec("05019:A:2", "Forced: damage that is not dealt by an enemy attack (archery) leaves the Scroll on its hero, damage of an attack moves it", (effects) => {
  const archery = fightEnemy((layout) => scrolled(effects, layout, "dh2"), "f0", "05044", { seats: 1 as const });
  expect(archery.run.state.cards[archery.made.hero2]?.damage, "the 2 archery damage was dealt to the Scroll hero").toBe(2);
  expect(hasScroll(archery.run.state, archery.made.hero2), "archery is no attack: the Scroll stays").toBe(true);
  const attack = fightEnemy((layout) => scrolled(effects, layout, "dh2"), "f0", "05043", { seats: 1 as const }, { undefended: true, defender: (made) => made.hero2 });
  expect(hasScroll(attack.run.state, idOf(attack.run.state, "05043")), "the attack damaged the Scroll hero: it moves").toBe(true);
});

// ---- 05020 Harbor Thug ----
lineSpec("05020:A:1", "Forced: the threat raise of the refresh step (rr.step-7-3) is a raise: a Thug in the staging area engages the Scroll hero's player", (effects) => {
  const t = scrolled(effects, { phase: "Combat", staging: ["05020"] });
  const out = drive(t, start(t.state), (state) => state.round > t.state.round);
  expect(engagedCodes(out.state), "engaged at the end of the round").toEqual(["05020"]);
});

// ---- 05021 The Leaping Fish ----
const questBegins = { trigger: "beginningOfPhase", seat: null, phase: "Quest" } as GameEvent;
lineSpec("05021:A:1", "Forced: the Fish in the staging area gains the Forced effect too; a discarded treachery is discarded, not revealed", (effects) => {
  const staged = announced(scrolled(effects, { staging: ["05021"], deck: ["05024", "05043", "05043"] }), questBegins);
  expect(codesIn(staged, "encounterDiscard"), "one card, Collateral Damage, only discarded").toEqual(["05024"]);
  expect(codesIn(staged, "encounterDeck"), "its When Revealed effect did not run").toEqual(["05043", "05043"]);
});
lineSpec("05021:A:1", "Forced: an empty encounter deck is reset from the discard pile and the discard goes on", (effects) => {
  const out = announced(scrolled(effects, { active: "05021", deck: [], discard: ["05043"] }), questBegins);
  expect(codesIn(out, "staging"), "the enemy from the reset deck is discarded and staged").toEqual(["05043"]);
});

// ---- 05023 Harbor Storehouse ----
// A threat of 10 keeps a staged Thug (engagement cost 25) out of the engagement check, so it stays in the staging area for the attack.
// Collateral Damage (05024) discards the locations here: 2 threat each from its own line, so the Storehouse's 1 is the difference.
lineSpec("05023:A:1", "Forced: each Storehouse in play triggers for each location, and a Storehouse not in play does not (also when it is the card discarded)", (effects) => {
  const twice = revealedTop(tbl(effects, { staging: ["05023", "05023"], deck: ["place", "f0", "f0", "f0"] }), "05024");
  expect(threatOf(twice), "two Storehouses in play: 2 + 1 + 1").toBe(32);
  const itself = revealedTop(tbl(effects, { deck: ["05023", "f0", "f0", "f0"] }), "05024");
  expect(threatOf(itself), "a Storehouse discarded by the effect is out of play: only the 2 of Collateral Damage").toBe(30);
  const active = revealedTop(tbl(effects, { active: "05023", deck: ["place", "f0", "f0", "f0"] }), "05024");
  expect(threatOf(active), "as the active location it is in play too").toBe(31);
});
lineSpec("05023:A:1", "Forced: a shadow card discarded from an enemy at the end of combat is not a discard from the top of the encounter deck", (effects) => {
  const shadow = shadowFight(effects, "place", { staging: ["05023"] }, { enemy: "f0" });
  expect(threatOf(shadow.run.state), "a location dealt as a shadow card raises nothing").toBe(28);
  expect(threatOf(revealedTop(tbl(effects, { staging: ["05023"], deck: ["place", "f0", "f0", "f0"] }), "05024")), "while a discard from the top does").toBe(31);
});
lineSpec("05023:A:2", "Shadow: a Thug engaged with another player counts, and each additional card's own shadow effect resolves", (effects) => {
  const t = shadowFight(effects, "05023", { seats: 2, deck: ["05023", "f0", "05038", "f0", "f0"], threat: [10, 10], engaged: [{ code: "05043", seat: 0 }, { code: "05020", seat: 1 }] }, { seats: 2, undefended: true });
  // The deal gives the Thug of the second player its own shadow card (the second card): 1 for the attacker, 1 for the Thug, 1 additional.
  expect(t.run.state.encounterDeck.length, "1 Thug in another player's area: 1 more card").toBe(2);
  expect(dmg(t, t.made.hero), "the additional City Street shadow gave +2 Attack: 3 + 2").toBe(5);
});
lineSpec("05023:A:2", "Shadow: a Thug dealt face down as another enemy's shadow card is not in play and adds no card", (effects) => {
  const deck = ["05023", "05020", "f0", "f0", "f0", "f0"];
  const dealt = shadowFight(effects, "05023", { deck, threat: LOW, engaged: [{ code: "05043", seat: 0 }, { code: "f0", seat: 0 }] });
  expect(dealt.run.state.encounterDeck.length, "2 shadow cards dealt, none additional").toBe(4);
  const staged = shadowFight(effects, "05023", { deck, threat: LOW, staging: ["05020"], engaged: [{ code: "05043", seat: 0 }, { code: "f0", seat: 0 }] });
  expect(staged.run.state.encounterDeck.length, "control: a Thug in the staging area adds 1").toBe(3);
});

// ---- 05024 Collateral Damage ----
const collateral = (effects: Es, layout: Layout) => revealedTop(tbl(effects, layout), "05024");
const discarded = (state: ScenarioState, code: string): number => codesIn(state, "encounterDiscard").filter((one) => one === code).length;
lineSpec("05024:A:1", "When Revealed: a copy of Collateral Damage discarded by the first sentence counts for the additional discard", (effects) => {
  const out = collateral(effects, { deck: ["05024", "f0", "f0", "f0", "f0", "f0"] });
  expect(discarded(out, "f0"), "2 (one is the copy) + 2 more for that copy: 3 f0").toBe(3);
  expect(discarded(out, "05024"), "the copy discarded and the resolved card").toBe(2);
});
lineSpec("05024:A:1", "When Revealed: an empty deck is reset from the discard pile and the locations discarded still raise threat", (effects) => {
  const out = collateral(effects, { deck: [], discard: ["place", "place", "place"] });
  expect(threatOf(out), "2 locations discarded from the reset deck: 2 x 2").toBe(32);
});

// ---- 05037 Pickpocket ----
const pickpocket = (effects: Es, layout: Layout = {}) => fightEnemy((l) => tbl(effects, l), "f0", "05037", { seats: 1 as const, ...layout });
const pool = (state: ScenarioState): number => Object.values(state.cards).filter((card) => card.zone === "heroes").reduce((sum, card) => sum + (card.resources ?? 0), 0);
lineSpec("05037:A:1", "Forced: each part resolves as far as it can: no resources still discards the card, an empty hand still discards the resource", (effects) => {
  const poor = pickpocket(effects, {});
  expect(handOf(poor.run.state), "no resources: the card goes").toBe(1);
  const bare = pickpocket(effects, { heroResources: 1, hand: [] });
  expect(pool(bare.run.state), "no hand: the resource goes").toBe(1);
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
