// Rules: rr.forced, rr.reveal, rr.shadow-effects, rr.then, rr.in-play-and-out-of-play, rr.attachment-cards, rr.optional-engagement, rr.travel, rr.search, rr.running-out-of-cards (data/rules/entries.json).
// An independent audit of Peril in Pelargir (card-audit): each test is written from the printed line and the rule spans, never from the record or the scenario's own tests, on the smallest table the scene kit builds, and each runs again
// without its line's records (`lineSpec`). A test that shows the engine not doing what the card prints is an `it.fails` under a `// FAULT:` comment; a reading no document settles is marked `// OPEN:`; a gap no play reaches is marked `// KNOWN:`.
import { expect } from "vitest";

import { updateCard, type GameEvent, type ScenarioState } from "../../../rules/core/state.ts";
import { codesIn, fightEnemy, finish, idOf, legalIntents, revealedTop, send, start, statOf, type Layout, type LayoutTable } from "../../../../test/harness/scene-kit.ts";
import { lineSpec } from "../../../../test/harness/line-spec.ts";

import { announced } from "../../../../test/scenarios/peril-in-pelargir/scroll.ts";

import { tbl, scrolled, zoneOf, hasScroll, threatOf, engagedOf, scrollOn, scrollAction, raised, shadowFight, dmg, LOW, handOf, type Es } from "./audit-kit.ts";

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
lineSpec("05019:A:1", "Action: exhaust a hero to attach the Scroll from the staging area to that hero, whose controller then controls it", (effects) => {
  const t = tbl(effects, { phase: "Planning", staging: ["05019"] });
  const offered = scrollAction(t.state, t);
  expect(offered, "an Action is offered while the Scroll is in the staging area").toBeDefined();
  const second = t.hero2;
  let run = send(start(t.state), offered as never, t.ctx);
  run = finish(run, t.ctx, () => second);
  expect(hasScroll(run.state, second), "attached to the second player's hero").toBe(true);
  expect(run.state.cards[second]?.exhausted, "the hero is exhausted").toBe(true);
  expect(run.state.cards[idOf(run.state, "05019")]?.controller, "its controller is the hero's").toBe(0);
});
lineSpec("05019:A:1", "Action: not offered while the Scroll is attached to a hero, nor when every hero is exhausted", (effects) => {
  const held = scrolled(effects, { phase: "Planning" });
  expect(scrollAction(held.state, held), "attached to a hero").toBeUndefined();
  const loose = tbl(effects, { phase: "Planning", staging: ["05019"] });
  const tired = [loose.hero, loose.hero2].reduce((state, id) => updateCard(state, id, { exhausted: true }), loose.state);
  expect(scrollAction(tired, loose), "no ready hero").toBeUndefined();
  expect(scrollAction(loose.state, loose), "the same table with ready heroes").toBeDefined();
});

const damaged = (effects: Es, options: { undefended?: boolean; second?: boolean; enemy?: string } = {}) => {
  const out = fightEnemy((layout) => scrolled(effects, layout), "f0", options.enemy ?? "05043", { seats: 1 as const }, { undefended: options.undefended, defender: options.second ? (made) => made.hero2 : undefined });
  return out;
};
lineSpec("05019:A:2", "Forced: the hero with the Scroll is damaged by an enemy attack: the Scroll attaches to that enemy", (effects) => {
  const out = damaged(effects, { undefended: true });
  expect(out.run.state.cards[out.made.hero]?.damage, "the attack dealt 3").toBe(3);
  expect(hasScroll(out.run.state, idOf(out.run.state, "05043")), "the Scroll is on the enemy").toBe(true);
  expect(hasScroll(out.run.state, out.made.hero), "no longer on the hero").toBe(false);
});
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

// ---- 05020 Harbor Thug ----
lineSpec("05020:A:1", "Forced: when the player whose hero has the Scroll raises his threat the Thug engages that player; another player's raise, or no Scroll on a hero, does not engage it", (effects) => {
  const alone = scrolled(effects, { staging: ["05020"] });
  expect(engagedOf(announced(alone, raised(0))), "the Scroll hero's player raised").toEqual(["05020"]);
  const loose = tbl(effects, { staging: ["05020"], seats: 2 });
  expect(engagedOf(announced(loose, raised(0))), "the Scroll is not on a hero").toEqual([]);
  const two = scrolled(effects, { seats: 2, staging: ["05020"] }, "dh3");
  expect(engagedOf(announced(two, raised(0)), 0), "the other player raised").toEqual([]);
  expect(engagedOf(announced(two, raised(0)), 1)).toEqual([]);
  const mine = announced(two, raised(1));
  expect(engagedOf(mine, 1), "the Scroll hero's player raised").toEqual(["05020"]);
  expect(engagedOf(mine, 0)).toEqual([]);
});
lineSpec("05020:A:1", "Forced: a Thug engaged with another player moves to the player whose hero has the Scroll when he raises his threat", (effects) => {
  const two = scrolled(effects, { seats: 2, engaged: [{ code: "05020", seat: 0 }] }, "dh3");
  const out = announced(two, raised(1));
  expect(engagedOf(out, 1), "now engaged with the Scroll player").toEqual(["05020"]);
  expect(engagedOf(out, 0)).toEqual([]);
});

const SHADOW_REDIRECT = (line: string, shadow: string) => {
  lineSpec(line, "Shadow: all damage of the attack goes to the hero with the Scroll attached, not to the defender", (effects) => {
    const defended = shadowFight(effects, shadow, {}, { scrollOn: "dh2" });
    expect(dmg(defended, defended.made.hero), "the defender takes none (Attack 3 - Defense 2 = 1)").toBe(0);
    expect(dmg(defended, defended.made.hero2), "the Scroll hero takes it").toBe(1);
    const bare = shadowFight(effects, shadow, {}, { scrollOn: "dh2", undefended: true });
    expect(dmg(bare, bare.made.hero), "undefended: not the assigned hero").toBe(0);
    expect(dmg(bare, bare.made.hero2), "undefended: the Scroll hero takes 3").toBe(3);
  });
  lineSpec(line, "Shadow: with no hero holding the Scroll the defender takes the damage as normal; with 2 players the other player's hero takes it", (effects) => {
    const none = shadowFight(effects, shadow, {});
    expect(dmg(none, none.made.hero), "no Scroll hero, if able fails").toBe(1);
    const other = shadowFight(effects, shadow, { seats: 2 }, { scrollOn: "dh3", seats: 2 });
    expect(dmg(other, other.made.hero), "the defender of seat 0 takes none").toBe(0);
    expect(dmg(other, other.made.seat1Hero ?? ""), "the other player's Scroll hero takes it").toBe(1);
  });
};
SHADOW_REDIRECT("05020:A:2", "05020");
SHADOW_REDIRECT("05024:A:2", "05024");

// ---- 05021 The Leaping Fish ----
const questBegins = { trigger: "beginningOfPhase", seat: null, phase: "Quest" } as GameEvent;
lineSpec("05021:A:1", "Forced: at the beginning of the quest phase with the Scroll on a hero, discard X (the players) cards from the top of the encounter deck and add each enemy discarded to the staging area", (effects) => {
  const one = scrolled(effects, { active: "05021", deck: ["place", "05043", "05020"] });
  const out = announced(one, questBegins);
  expect(codesIn(out, "encounterDiscard"), "1 player: one card, a location, stays discarded").toEqual(["place"]);
  expect(codesIn(out, "staging")).toEqual([]);
  const enemy = announced(scrolled(effects, { active: "05021", deck: ["05043", "05020"] }), questBegins);
  expect(codesIn(enemy, "staging"), "the discarded enemy is added to the staging area").toEqual(["05043"]);
  expect(codesIn(enemy, "encounterDeck"), "only 1 card left the deck").toEqual(["05020"]);
  const pair = announced(scrolled(effects, { seats: 2, active: "05021", deck: ["place", "05043", "05020"] }), questBegins);
  expect(codesIn(pair, "staging"), "2 players: two cards discarded, the enemy staged").toEqual(["05043"]);
  expect(codesIn(pair, "encounterDiscard")).toEqual(["place"]);
  expect(codesIn(pair, "encounterDeck")).toEqual(["05020"]);
});
lineSpec("05021:A:1", "Forced: with the Scroll not on a hero (staging area, or attached to an enemy), or in another phase, nothing is discarded", (effects) => {
  const loose = announced(tbl(effects, { active: "05021", deck: ["05043", "05020"], staging: ["05019"] }), questBegins);
  expect(codesIn(loose, "encounterDeck"), "the Scroll is in the staging area").toEqual(["05020", "05043"]);
  const held = scrollOn(tbl(effects, { active: "05021", deck: ["05020"], engaged: [{ code: "05043", seat: 0 }] }), "05043");
  expect(codesIn(announced(held, questBegins), "encounterDeck"), "the Scroll is on an enemy").toEqual(["05020"]);
  const other = scrolled(effects, { active: "05021", deck: ["05043", "05020"] });
  expect(codesIn(announced(other, { trigger: "beginningOfPhase", seat: null, phase: "Planning" } as GameEvent), "encounterDeck"), "another phase").toEqual(["05020", "05043"]);
  expect(codesIn(announced(other, questBegins), "staging"), "the same table in the quest phase").toEqual(["05043"]);
});
lineSpec("05021:A:1", "Forced: the Fish in the staging area gains the Forced effect too; a discarded treachery is discarded, not revealed", (effects) => {
  const staged = announced(scrolled(effects, { staging: ["05021"], deck: ["05024", "05043", "05043"] }), questBegins);
  expect(codesIn(staged, "encounterDiscard"), "one card, Collateral Damage, only discarded").toEqual(["05024"]);
  expect(codesIn(staged, "encounterDeck"), "its When Revealed effect did not run").toEqual(["05043", "05043"]);
});
lineSpec("05021:A:1", "Forced: an empty encounter deck is reset from the discard pile and the discard goes on", (effects) => {
  const out = announced(scrolled(effects, { active: "05021", deck: [], discard: ["05043"] }), questBegins);
  expect(codesIn(out, "staging"), "the enemy from the reset deck is discarded and staged").toEqual(["05043"]);
});

// ---- 05022 Pelargir Docks ----
lineSpec("05022:A:1", "While the active location, enemies get +1 Attack and +1 Defense (engaged and staging); not while it is only in the staging area", (effects) => {
  const t = tbl(effects, { active: "05022", engaged: [{ code: "05043", seat: 0 }], staging: ["05020"] });
  const on = (table: LayoutTable, code: string, stat: "attack" | "defense"): number => statOf(table.state, table.ctx.cards, code, stat);
  expect(on(t, "05043", "attack"), "engaged, Attack 3").toBe(4);
  expect(on(t, "05043", "defense"), "engaged, Defense 3").toBe(4);
  expect(on(t, "05020", "attack"), "staging, Attack 3").toBe(4);
  expect(on(t, "05020", "defense"), "staging, Defense 1").toBe(2);
  const staged = tbl(effects, { staging: ["05022", "05020"], engaged: [{ code: "05043", seat: 0 }] });
  expect(on(staged, "05043", "attack"), "Docks not active").toBe(3);
  expect(on(staged, "05020", "defense")).toBe(1);
});

// ---- 05023 Harbor Storehouse ----
// A threat of 10 keeps a staged Thug (engagement cost 25) out of the engagement check, so it stays in the staging area for the attack.
// Collateral Damage (05024) discards the locations here: 2 threat each from its own line, so the Storehouse's 1 is the difference.
lineSpec("05023:A:1", "Forced: each location discarded from the top of the encounter deck raises each player's threat by 1; a card that is no location does not", (effects) => {
  const one = revealedTop(tbl(effects, { staging: ["05023"], deck: ["place", "f0", "f0", "f0"] }), "05024");
  expect(threatOf(one), "1 location: 2 from Collateral Damage and 1 from the Storehouse").toBe(31);
  const none = revealedTop(tbl(effects, { staging: ["05023"], deck: ["f0", "f0", "f0", "f0"] }), "05024");
  expect(threatOf(none), "no location discarded").toBe(28);
  const pair = revealedTop(tbl(effects, { seats: 2, staging: ["05023"], deck: ["place", "f0", "f0", "f0"] }), "05024");
  expect([threatOf(pair, 0), threatOf(pair, 1)], "each player").toEqual([31, 31]);
});
lineSpec("05023:A:1", "Forced: each Storehouse in play triggers for each location, and a Storehouse not in play does not (also when it is the card discarded)", (effects) => {
  const twice = revealedTop(tbl(effects, { staging: ["05023", "05023"], deck: ["place", "f0", "f0", "f0"] }), "05024");
  expect(threatOf(twice), "two Storehouses in play: 2 + 1 + 1").toBe(32);
  const itself = revealedTop(tbl(effects, { deck: ["05023", "f0", "f0", "f0"] }), "05024");
  expect(threatOf(itself), "a Storehouse discarded by the effect is out of play: only the 2 of Collateral Damage").toBe(30);
  const active = revealedTop(tbl(effects, { active: "05023", deck: ["place", "f0", "f0", "f0"] }), "05024");
  expect(threatOf(active), "as the active location it is in play too").toBe(31);
});
lineSpec("05023:A:2", "Shadow: the attacker is dealt an additional shadow card for each Thug in play, in the staging area too", (effects) => {
  const deck = ["05023", "f0", "f0", "f0", "f0", "f0", "f0"];
  const plain = shadowFight(effects, "05023", { deck, threat: LOW });
  expect(plain.run.state.encounterDeck.length, "no Thug in play: the 1 card dealt").toBe(6);
  const staged = shadowFight(effects, "05023", { deck, staging: ["05020", "05020"], threat: LOW });
  expect(staged.run.state.encounterDeck.length, "2 Thugs in the staging area: 2 more cards").toBe(4);
  const attacker = shadowFight(effects, "05023", { deck, threat: LOW }, { enemy: "05020" });
  expect(attacker.run.state.encounterDeck.length, "the attacking Thug counts: 1 more").toBe(5);
});
lineSpec("05023:A:2", "Shadow: a Thug engaged with another player counts, and each additional card's own shadow effect resolves", (effects) => {
  const t = shadowFight(effects, "05023", { seats: 2, deck: ["05023", "f0", "05038", "f0", "f0"], threat: [10, 10], engaged: [{ code: "05043", seat: 0 }, { code: "05020", seat: 1 }] }, { seats: 2, undefended: true });
  // The deal gives the Thug of the second player its own shadow card (the second card): 1 for the attacker, 1 for the Thug, 1 additional.
  expect(t.run.state.encounterDeck.length, "1 Thug in another player's area: 1 more card").toBe(2);
  expect(dmg(t, t.made.hero), "the additional City Street shadow gave +2 Attack: 3 + 2").toBe(5);
});

// ---- 05024 Collateral Damage ----
const collateral = (effects: Es, layout: Layout) => revealedTop(tbl(effects, layout), "05024");
const discarded = (state: ScenarioState, code: string): number => codesIn(state, "encounterDiscard").filter((one) => one === code).length;
lineSpec("05024:A:1", "When Revealed: discard 2 cards from the top of the encounter deck, and no threat is raised when none is a location", (effects) => {
  const out = collateral(effects, { deck: ["f0", "f0", "f0", "f0", "f0"] });
  expect(discarded(out, "f0"), "2 cards").toBe(2);
  expect(out.encounterDeck.length).toBe(3);
  expect(threatOf(out), "no location: the Then part raises nothing").toBe(28);
});
lineSpec("05024:A:1", "When Revealed: an additional 2 cards for each copy of Collateral Damage in the discard pile, not counting another treachery", (effects) => {
  const one = collateral(effects, { discard: ["05024"], deck: ["f0", "f0", "f0", "f0", "f0", "f0", "f0"] });
  expect(discarded(one, "f0"), "2 + 2 for one copy").toBe(4);
  const two = collateral(effects, { discard: ["05024", "05024"], deck: ["f0", "f0", "f0", "f0", "f0", "f0", "f0", "f0"] });
  expect(discarded(two, "f0"), "2 + 4 for two copies").toBe(6);
  const other = collateral(effects, { discard: ["05040"], deck: ["f0", "f0", "f0", "f0", "f0"] });
  expect(discarded(other, "f0"), "a Lost in the City in the discard pile adds nothing").toBe(2);
});
lineSpec("05024:A:1", "When Revealed: a copy of Collateral Damage discarded by the first sentence counts for the additional discard", (effects) => {
  const out = collateral(effects, { deck: ["05024", "f0", "f0", "f0", "f0", "f0"] });
  expect(discarded(out, "f0"), "2 (one is the copy) + 2 more for that copy: 3 f0").toBe(3);
  expect(discarded(out, "05024"), "the copy discarded and the resolved card").toBe(2);
});
lineSpec("05024:A:1", "Then: raise each player's threat by 2 for each location discarded by this effect, counting the additional discard", (effects) => {
  const one = collateral(effects, { deck: ["place", "f0", "f0"] });
  expect(threatOf(one), "1 location").toBe(30);
  const twice = collateral(effects, { seats: 2, discard: ["05024"], deck: ["f0", "f0", "place", "place", "f0", "f0"] });
  expect([threatOf(twice, 0), threatOf(twice, 1)], "2 locations in the 4 cards, each player").toEqual([32, 32]);
  const beyond = collateral(effects, { deck: ["f0", "f0", "place", "f0"] });
  expect(threatOf(beyond), "a location beyond the 2 cards is not discarded").toBe(28);
});
lineSpec("05024:A:1", "When Revealed: an empty deck is reset from the discard pile and the locations discarded still raise threat", (effects) => {
  const out = collateral(effects, { deck: [], discard: ["place", "place", "place"] });
  expect(threatOf(out), "2 locations discarded from the reset deck: 2 x 2").toBe(32);
});

// ---- 05037 Pickpocket ----
const pickpocket = (effects: Es, layout: Layout = {}) => fightEnemy((l) => tbl(effects, l), "f0", "05037", { seats: 1 as const, ...layout });
const pool = (state: ScenarioState): number => Object.values(state.cards).filter((card) => card.zone === "heroes").reduce((sum, card) => sum + (card.resources ?? 0), 0);
lineSpec("05037:A:1", "Forced: when Pickpocket attacks the defender discards 1 resource from one hero's pool and 1 card at random from his hand", (effects) => {
  const out = pickpocket(effects, { heroResources: 2 });
  expect(pool(out.run.state), "1 of the 4 resources on 2 heroes").toBe(3);
  expect(handOf(out.run.state), "1 of the 2 cards").toBe(1);
});
lineSpec("05037:A:1", "Forced: each part resolves as far as it can: no resources still discards the card, an empty hand still discards the resource", (effects) => {
  const poor = pickpocket(effects, {});
  expect(handOf(poor.run.state), "no resources: the card goes").toBe(1);
  const bare = pickpocket(effects, { heroResources: 1, hand: [] });
  expect(pool(bare.run.state), "no hand: the resource goes").toBe(1);
});
const attachments = (state: ScenarioState, hostCode: string): string[] => (state.cards[idOf(state, hostCode)]?.attachments ?? []).map((id) => state.cards[id]?.code ?? "").sort();
lineSpec("05037:A:2", "Shadow: the defending player discards 1 of his attachments, and not an encounter card attached to his hero", (effects) => {
  const out = shadowFight(effects, "05037", { attached: [{ code: "attachment", to: "dh1" }, { code: "attachment", to: "dh1" }, { code: "05041", to: "dh1", encounter: true }] }, { enemy: "f0" });
  expect(attachments(out.run.state, "dh1"), "one player attachment left and Local Trouble").toEqual(["05041", "attachment"]);
});
lineSpec("05037:A:2", "Shadow: an undefended attack discards all his attachments, not the encounter card", (effects) => {
  const out = shadowFight(effects, "05037", { attached: [{ code: "attachment", to: "dh1" }, { code: "attachment", to: "dh2" }, { code: "05041", to: "dh1", encounter: true }] }, { enemy: "f0", undefended: true });
  expect(attachments(out.run.state, "dh1"), "Local Trouble stays").toEqual(["05041"]);
  expect(attachments(out.run.state, "dh2"), "all of them").toEqual([]);
});

