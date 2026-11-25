// Rules: rr.forced, rr.reveal, rr.shadow-effects, rr.then, rr.in-play-and-out-of-play, rr.attachment-cards, rr.optional-engagement, rr.travel, rr.search (data/rules/entries.json).
// An audit of the City cards and the quest of Peril in Pelargir (05038 to 05045, 05065 to 05067): each test is written from the printed line and the rule spans on the smallest table the scene kit builds, and runs again without
// its line's records (`lineSpec`). It holds the cases the scenario's own tests (`lines.test.ts`) do not reach. A gap no play reaches is marked `// KNOWN:`.
import { expect, it } from "vitest";

import type { ScenarioState } from "../../../rules/core/state.ts";
import { codesIn, drive, engagedCodes, finish, idOf, legalIntents, legalTargets, resolveRecords, revealedTop, send, start, zoneOf, type Layout, type LayoutTable } from "../../../../test/harness/scene-kit.ts";
import { lineSpec } from "../../../../test/harness/line-spec.ts";
import { EFFECTS } from "../../../effects/index.ts";

import { announced } from "../../../../test/scenarios/peril-in-pelargir/scroll.ts";

import { tbl, scrolled, hasScroll, scrollOn, scrollAction, raised, shadowFight, dmg, handOf, resourcesOn, engage, quested, quays, type Es } from "./audit-kit.ts";

// ---- 05038 City Street, 05039 Market Square ----
lineSpec("05038:A:3", "Shadow: the attacking enemy gets +2 Attack", (effects) => {
  const out = shadowFight(effects, "05038", {}, { enemy: "f0", undefended: true });
  expect(dmg(out, out.made.hero), "Attack 1 + 2").toBe(3);
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
lineSpec("05039:A:3", "Shadow: the defending player discards all resources in his heroes' pools, and no one else's", (effects) => {
  const out = shadowFight(effects, "05039", { seats: 2, heroResources: 3 }, { seats: 2 });
  expect(resourcesOn(out.run.state, out.made.hero) + resourcesOn(out.run.state, out.made.hero2), "both of his heroes").toBe(0);
  expect(resourcesOn(out.run.state, out.made.seat1Hero ?? ""), "the other player's hero keeps them").toBe(3);
});

// ---- 05040 Lost in the City ----
const cityRun = (effects: Es, layout: Layout) => revealedTop(tbl(effects, layout), "05040");
lineSpec("05040:A:1", "When Revealed: a card with no City trait is not found", (effects) => {
  const none = cityRun(effects, { deck: ["place", "f0"], discard: ["05043"] });
  expect(codesIn(none, "staging"), "no City location to find").toEqual([]);
  const found = cityRun(effects, { deck: ["place", "05023"] });
  expect(codesIn(found, "staging"), "the City location is found past the other").toEqual(["05023"]);
});
// KNOWN: the engine adds a second copy of a unique location that is in play; rr.unique-cards speaks of a player who plays or puts a card into play and names no encounter search, so the span does not settle it for this verb, and only one Leaping Fish exists in a real game, so no play reaches it.
it.fails("05040:A:1 When Revealed: a unique location already in play (The Leaping Fish active) is not found and added to the staging area", () => {
  const out = cityRun(EFFECTS, { active: "05021", deck: ["05021"] });
  expect(codesIn(out, "staging")).toEqual([]);
});
lineSpec("05040:A:1", "When Revealed: the location is added, not revealed (City Street's surge does not happen)", (effects) => {
  const out = cityRun(effects, { deck: ["05038", "f0"] });
  expect(codesIn(out, "staging"), "City Street staged and the next card not revealed").toEqual(["05038"]);
  expect(codesIn(out, "encounterDeck")).toEqual(["f0"]);
});
lineSpec("05040:A:2", "Shadow: the defending player discards his hand, and no other player's", (effects) => {
  const out = shadowFight(effects, "05040", { seats: 2, hand: [{ code: "filler", seat: 0 }, { code: "filler", seat: 0 }, { code: "filler", seat: 1 }] }, { seats: 2 });
  expect(handOf(out.run.state), "only the other player's card is left").toBe(1);
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

// ---- 05041 Local Trouble ----
// Aragorn (01001) has the highest threat cost (12) next to the stand-in heroes (8).
const troubleOn = (state: ScenarioState): string[] => Object.values(state.cards).flatMap((host) => (host.attachments ?? []).filter((id) => state.cards[id]?.code === "05041").map(() => host.code));
lineSpec("05041:A:1", "When Revealed: attach to the hero with the highest threat cost that has no Local Trouble; a hero that has one is skipped", (effects) => {
  const t = tbl(effects, { heroes: [{ code: "01001", seat: 0 }], deck: ["f0"] }, ["01001"]);
  const first = revealedTop(t, "05041");
  expect(troubleOn(first), "Aragorn, threat 12").toEqual(["01001"]);
  const again = revealedTop({ ...t, state: first }, "05041");
  expect(troubleOn(again).sort(), "Aragorn has one: the next hero takes it").toHaveLength(2);
  expect(troubleOn(again).filter((code) => code === "01001"), "never a second on one hero").toHaveLength(1);
  const third = revealedTop({ ...t, state: again }, "05041");
  expect(troubleOn(third).sort(), "all three heroes carry one").toHaveLength(3);
  const fourth = revealedTop({ ...t, state: third }, "05041");
  expect(troubleOn(fourth), "with a copy on every hero a fourth attaches to none").toHaveLength(3);
  expect(codesIn(fourth, "encounterDiscard"), "and is discarded").toEqual(["05041"]);
});
lineSpec("05041:A:1", "When Revealed: the highest threat cost is read among every player's heroes", (effects) => {
  const t = tbl(effects, { seats: 2, heroes: [{ code: "01001", seat: 1 }], deck: ["f0"] }, ["01001"]);
  expect(troubleOn(revealedTop(t, "05041")), "the second player's Aragorn").toEqual(["01001"]);
});

// ---- 05042 Zealous Traitor, 05043 Lossarnach Bandit ----
const allies = { play: [{ code: "ally", seat: 0 }, { code: "ally", seat: 1 }], seats: 2 as const };
lineSpec("05042:A:1", "Forced: engaged by the player's choice it deals 1 damage to each ally he controls (not his heroes, not another player's ally)", (effects) => {
  const out = engage(effects, "05042", allies);
  const ally = (seat: number) => out.state.cards[Object.values(out.state.cards).find((card) => card.code === "ally" && card.controller === seat)?.id ?? ""];
  expect(ally(0)?.damage, "his ally").toBe(1);
  expect(ally(1)?.damage ?? 0, "the other player's ally").toBe(0);
  expect(out.state.cards[out.t.hero]?.damage ?? 0, "a hero").toBe(0);
});
lineSpec("05043:A:1", "Forced: only the engaged player's heroes lose resources", (effects) => {
  const t = engage(effects, "05043", { seats: 2, heroResources: 3 });
  expect(resourcesOn(t.state, t.t.hero), "the engaged player").toBe(2);
  expect(resourcesOn(t.state, t.t.seat1Hero ?? ""), "the other player").toBe(3);
});

// ---- 05045 Lurking in Shadows ----
lineSpec("05045:A:1", "When Revealed: with no Brigand engaged it gains surge", (effects) => {
  const t = tbl(effects, { engaged: [{ code: "05020", seat: 0 }], staging: ["05037"], deck: ["f0", "f0"] });
  const out = revealedTop(t, "05045");
  expect(codesIn(out, "encounterDeck"), "one more card was revealed").toHaveLength(1);
  expect(codesIn(out, "staging"), "the Brigand in the staging area is not 'returned'").toEqual(["05037", "f0"]);
});
lineSpec("05045:A:1", "When Revealed: a Scroll attached to a returned Brigand stays attached to it in the staging area", (effects) => {
  const t = scrollOn(tbl(effects, { engaged: [{ code: "05037", seat: 0 }], deck: ["f0"] }), "05037");
  const out = revealedTop(t, "05045");
  expect(zoneOf(out, "05037"), "returned").toBe("staging");
  expect(hasScroll(out, idOf(out, "05037")), "the Scroll went with it").toBe(true);
});

// ---- the quest ----
const questId = (state: ScenarioState): string => idOf(state, state.cards[Object.values(state.cards).find((card) => card.zone === "questStage")?.id ?? ""]?.code ?? "");
const stageCode = (state: ScenarioState): string => state.cards[Object.values(state.cards).find((card) => card.zone === "questStage")?.id ?? ""]?.code ?? "";
// The choices a record opens are answered by `pick`, and every seat that was asked is noted.
const asked: { seat: number; options: number }[] = [];
const noting = (take: (state: ScenarioState) => string) => (state: ScenarioState): string => {
  if (state.window?.kind === "choose") asked.push({ seat: state.window.seat, options: state.window.options.length });
  return take(state);
};
it("05065:A:1 Setup: with 2 players the first player may choose any player's hero for the Scroll", () => {
  asked.length = 0;
  const t = tbl(EFFECTS, { seats: 2, firstPlayer: 0, stage: "05065", side: "A" });
  resolveRecords(t.state, t.ctx, "05065", "setup", questId(t.state), noting((state) => (state.window?.kind === "choose" ? (state.window.options[0] ?? "") : "")));
  expect(asked, "the first player is asked among the 3 heroes").toEqual([{ seat: 0, options: 3 }]);
});
it("05065:A:1 Setup: with the second seat as first player that player is asked among every hero too", () => {
  asked.length = 0;
  const t = tbl(EFFECTS, { seats: 2, firstPlayer: 1, stage: "05065", side: "A" });
  resolveRecords(t.state, t.ctx, "05065", "setup", questId(t.state), noting((state) => (state.window?.kind === "choose" ? (state.window.options[0] ?? "") : "")));
  expect(asked, "seat 1 is asked among the 3 heroes").toEqual([{ seat: 1, options: 3 }]);
});
lineSpec("05065:B:2", "When Revealed: each player searches the encounter deck for a Harbor Thug and adds it to the staging area, only from the deck", (effects) => {
  const pair = tbl(effects, { seats: 2, stage: "05065", deck: ["05020", "f0", "05020"] });
  const two = resolveRecords(pair.state, pair.ctx, "05065", "whenRevealed", questId(pair.state));
  expect(codesIn(two.state, "staging"), "2 players, 2 Thugs").toEqual(["05020", "05020"]);
  const few = tbl(effects, { seats: 2, stage: "05065", deck: ["05020", "f0"] });
  expect(codesIn(resolveRecords(few.state, few.ctx, "05065", "whenRevealed", questId(few.state)).state, "staging"), "only 1 Thug there: 1 added").toEqual(["05020"]);
  const discard = tbl(effects, { stage: "05065", deck: ["f0"], discard: ["05020"] });
  expect(codesIn(resolveRecords(discard.state, discard.ctx, "05065", "whenRevealed", questId(discard.state)).state, "staging"), "the discard pile is not searched").toEqual([]);
});

const FIGHT = { stage: "05066", progress: 12 };
lineSpec("05066:B:2", "the stage advances once the Scroll is attached to a hero after the quest, and not while it is on an enemy", (effects) => {
  const t = tbl(effects, { ...FIGHT, staging: ["05019"], phase: "Quest" });
  const blocked = drive(t, send(start(t.state), { type: "Commit", cardIds: [t.hero] }, t.ctx), (state) => (state.cards[idOf(state, "05066")]?.progress ?? 0) > 12); // dh1 quests with Attack 2: 14 of 13 points, dh2 stays ready
  expect(stageCode(blocked.state)).toBe("05066");
  const action = scrollAction(blocked.state, t);
  expect(action, "the Scroll's Action is offered after the quest").toBeDefined();
  const attached = drive(t, finish(send(blocked, action as never, t.ctx), t.ctx), (state) => stageCode(state) === "05067" || state.round > blocked.state.round);
  expect(stageCode(attached.state), "advanced with the Scroll on a hero").toBe("05067");
  const onEnemy = scrollOn(tbl(effects, { ...FIGHT, engaged: [{ code: "05043", seat: 0 }] }), "05043");
  expect(stageCode(quested(onEnemy).state), "the Scroll is on an enemy").toBe("05066");
});
const reveal66 = (effects: Es, layout: Layout, pick: (state: ScenarioState) => string = () => "") => {
  const t = scrolled(effects, { stage: "05066", ...layout });
  return resolveRecords(t.state, t.ctx, "05066", "whenRevealed", questId(t.state), pick).state;
};
lineSpec("05066:B:3", "When Revealed: on a tie in engagement cost the first player chooses the enemy", (effects) => {
  asked.length = 0;
  reveal66(effects, { seats: 2, firstPlayer: 1, staging: ["05020", "05020"] }, noting((state) => (state.window?.kind === "choose" ? (state.window.options[0] ?? "") : "")));
  expect(asked, "the first player picks among the 2 Thugs").toEqual([{ seat: 1, options: 2 }]);
});

// ---- stage 3: Escape to the Quays ----
const engageable = (table: LayoutTable): number => legalTargets(table.state, { type: "Engage" }, table.ctx).length;
lineSpec("05067:B:1", "Enemies cannot be optionally engaged", (effects) => {
  expect(engageable(tbl(effects, { stage: "05066", phase: "Encounter", staging: ["05043"] })), "stage 2: an enemy may be engaged").toBe(1);
  expect(engageable(tbl(effects, { ...quays, phase: "Encounter", staging: ["05043"] })), "stage 3: none").toBe(0);
  const check = tbl(effects, { ...quays, phase: "Encounter", staging: ["05043"] });
  const checked = drive(check, start(check.state), (state) => state.phase !== "Encounter");
  expect(engagedCodes(checked.state), "the engagement check still engages it (Attack 3, cost 24 <= threat 28)").toEqual(["05043"]);
  const thug = scrolled(effects, { ...quays, staging: ["05020"] });
  expect(engagedCodes(announced(thug, raised(0))), "an effect that engages is not an optional engagement").toEqual(["05020"]);
});
const reveals = (effects: Es, layout: Layout, host = "dh1") => scrolled(effects, { ...quays, ...layout }, host);
const attacked = (state: ScenarioState): boolean => state.window?.kind === "defense" && state.pendingAttack != null;
lineSpec("05067:B:2", "Forced: the first enemy revealed from the encounter deck each round makes an immediate attack from the staging area against the player who controls the Scroll", (effects) => {
  const t = reveals(effects, { seats: 2, deck: ["f0", "f0", "f0"] }, "dh3");
  const first = revealedTop(t, "05043");
  expect(legalIntents(first, t.ctx).some((intent) => intent.type === "DeclareDefender"), "the defender may be declared").toBe(true);
  expect(first.encounterDeck.length, "the enemy is dealt a shadow card for this attack").toBe(2);
  expect(first.window, "the second player controls the Scroll and defends").toMatchObject({ kind: "defense", seat: 1 });
  expect(first.pendingAttack?.fromStaging, "it attacks from the staging area").toBe(true);
  expect(zoneOf(first, "05043"), "and stays in it").toBe("staging");
  const loose = revealedTop(tbl(effects, { ...quays, staging: ["05019"] }), "05043");
  expect(attacked(loose), "the Scroll is in the staging area: no one controls it").toBe(false);
  const onEnemy = scrollOn(tbl(effects, { ...quays, engaged: [{ code: "05044", seat: 0 }] }), "05044");
  expect(attacked(revealedTop(onEnemy, "05043")), "the Scroll is on an enemy").toBe(false);
});
lineSpec("05067:B:2", "Forced: the second enemy revealed in the round does not attack; a location or treachery revealed first does not use it up", (effects) => {
  const t = reveals(effects, {});
  const place = revealedTop(t, "place");
  expect(attacked(place), "a location is no enemy").toBe(false);
  const first = revealedTop({ ...t, state: place }, "05043");
  expect(attacked(first), "the first enemy attacks").toBe(true);
  const done = drive(t, send({ state: first, steps: [] }, { type: "Undefended", heroId: t.hero }, t.ctx), (state) => state.pendingAttack == null && state.window?.kind !== "defense");
  const second = revealedTop({ ...t, state: done.state }, "05044");
  expect(attacked(second), "the second enemy does not attack").toBe(false);
});