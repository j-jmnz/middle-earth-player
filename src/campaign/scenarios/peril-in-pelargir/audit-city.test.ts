// Rules: rr.forced, rr.reveal, rr.shadow-effects, rr.then, rr.in-play-and-out-of-play, rr.attachment-cards, rr.optional-engagement, rr.travel, rr.search, rr.running-out-of-cards (data/rules/entries.json).
// An independent audit of Peril in Pelargir (card-audit): each test is written from the printed line and the rule spans, never from the record or the scenario's own tests, on the smallest table the scene kit builds, and each runs again
// without its line's records (`lineSpec`). A test that shows the engine not doing what the card prints is an `it.fails` under a `// FAULT:` comment; a reading no document settles is marked `// OPEN:`; a gap no play reaches is marked `// KNOWN:`.
import { expect, it } from "vitest";

import { updateCard, type ScenarioState } from "../../../rules/core/state.ts";
import { codesIn, finish, idOf, legalIntents, legalTargets, resolveRecords, revealedTop, send, start, type Layout, type LayoutTable } from "../../../../test/harness/scene-kit.ts";
import { lineSpec } from "../../../../test/harness/line-spec.ts";
import { EFFECTS } from "../../../effects/index.ts";

import { announced } from "../../../../test/scenarios/peril-in-pelargir/scroll.ts";

import { tbl, scrolled, zoneOf, hasScroll, threatOf, engagedOf, scrollOn, scrollAction, passUntil, raised, shadowFight, dmg, handOf, resourcesOn, engage, quested, quays, type Es } from "./audit-kit.ts";

// ---- 05038 City Street ----
it("05038:A:1 Surge: after City Street is revealed one more encounter card is revealed", () => {
  const out = revealedTop(tbl(EFFECTS, { deck: ["f0", "f0"] }), "05038");
  expect(codesIn(out, "staging"), "City Street and the card surge revealed").toEqual(["05038", "f0"]);
  expect(codesIn(out, "encounterDeck")).toEqual(["f0"]);
});
const travelTargets = (table: LayoutTable): string[] => legalTargets(table.state, { type: "Travel" }, table.ctx).map((id) => table.state.cards[id]?.code ?? "");
lineSpec("05038:A:2", "While City Street is in the staging area the players can travel only to a location titled City Street (not another City location)", (effects) => {
  const barred = tbl(effects, { phase: "Travel", staging: ["05038", "05023", "05038", "05039"] });
  expect(travelTargets(barred), "two City Street, no other location").toEqual(["05038", "05038"]);
  const free = tbl(effects, { phase: "Travel", staging: ["05023", "05039"], heroResources: 1 });
  expect(travelTargets(free).sort(), "no City Street in the staging area").toEqual(["05023", "05039"]);
});
lineSpec("05038:A:3", "Shadow: the attacking enemy gets +2 Attack", (effects) => {
  const out = shadowFight(effects, "05038", {}, { enemy: "f0", undefended: true });
  expect(dmg(out, out.made.hero), "Attack 1 + 2").toBe(3);
});

// ---- 05039 Market Square ----
lineSpec("05039:A:2", "Travel: each player spends 1 resource from one of his heroes' pools to travel there", (effects) => {
  const t = tbl(effects, { seats: 2, phase: "Travel", staging: ["05039"], heroResources: 1 });
  expect(travelTargets(t), "both players can pay").toEqual(["05039"]);
  let run = send(start(t.state), { type: "Travel", locationId: idOf(t.state, "05039") }, t.ctx);
  run = finish(run, t.ctx);
  expect(zoneOf(run.state, "05039"), "traveled").toBe("activeLocation");
  // The round goes on after the Travel and each hero gains 1 resource (rr.step-1-2): the first player's heroes held 2, paid 1 and gained 2; the second player's hero held 1, paid 1 and gained 1.
  expect(resourcesOn(run.state, t.hero) + resourcesOn(run.state, t.hero2), "the first player paid 1").toBe(3);
  expect(resourcesOn(run.state, t.seat1Hero ?? ""), "the second player paid 1").toBe(1);
});
lineSpec("05039:A:2", "Travel: when one player cannot pay the players cannot travel there", (effects) => {
  const t = tbl(effects, { seats: 2, phase: "Travel", staging: ["05039"], heroResources: 1 });
  const broke = updateCard(t.state, t.seat1Hero ?? "", { resources: 0 });
  expect(travelTargets({ ...t, state: broke }), "the second player has none").toEqual([]);
  const alone = tbl(effects, { phase: "Travel", staging: ["05039"] });
  expect(travelTargets(alone), "no resources at all").toEqual([]);
  const split = tbl(effects, { phase: "Travel", staging: ["05039"] });
  expect(travelTargets({ ...split, state: updateCard(split.state, split.hero2, { resources: 1 }) }), "one hero's pool is enough").toEqual(["05039"]);
});
lineSpec("05039:A:3", "Shadow: the defending player discards all resources in his heroes' pools, and no one else's", (effects) => {
  const out = shadowFight(effects, "05039", { seats: 2, heroResources: 3 }, { seats: 2 });
  expect(resourcesOn(out.run.state, out.made.hero) + resourcesOn(out.run.state, out.made.hero2), "both of his heroes").toBe(0);
  expect(resourcesOn(out.run.state, out.made.seat1Hero ?? ""), "the other player's hero keeps them").toBe(3);
});

// ---- 05040 Lost in the City ----
const cityRun = (effects: Es, layout: Layout) => revealedTop(tbl(effects, layout), "05040");
lineSpec("05040:A:1", "When Revealed: each player searches the encounter deck and discard pile for 1 City location and adds it to the staging area", (effects) => {
  const one = cityRun(effects, { deck: ["05023", "f0"], discard: ["05039"] });
  expect(codesIn(one, "staging").length, "1 player adds 1").toBe(1);
  expect(["05023", "05039"]).toContain(codesIn(one, "staging")[0]);
  const pair = cityRun(effects, { seats: 2, deck: ["05023", "f0"], discard: ["05039", "05038"] });
  expect(codesIn(pair, "staging").length, "2 players add 2").toBe(2);
});
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
lineSpec("05041:A:1", "Counts as a Condition: when the attached hero exhausts the controller's threat is raised by 1; another hero's exhaust does not", (effects) => {
  const trouble = { phase: "Quest" as const, attached: [{ code: "05041", to: "dh1", encounter: true as const }] };
  const mine = tbl(effects, trouble);
  const hit = send(start(mine.state), { type: "Commit", cardIds: [mine.hero] }, mine.ctx);
  expect(threatOf(finish(hit, mine.ctx).state), "dh1 exhausted to quest").toBe(29);
  const other = send(start(mine.state), { type: "Commit", cardIds: [mine.hero2] }, mine.ctx);
  expect(threatOf(finish(other, mine.ctx).state), "dh2 has none").toBe(28);
});
lineSpec("05041:A:1", "Counts as a Condition: when the attached hero readies the controller's threat is raised by 1", (effects) => {
  const run = (exhausted: "dh1" | "dh2") => {
    const t = tbl(effects, { phase: "Combat", attached: [{ code: "05041", to: "dh1", encounter: true }] });
    const state = updateCard(t.state, exhausted === "dh1" ? t.hero : t.hero2, { exhausted: true });
    return passUntil(start(state), t, (now) => now.round > t.state.round).state;
  };
  expect(threatOf(run("dh1")) as number - (threatOf(run("dh2")) as number), "readying the host costs 1 more").toBe(1);
});

// ---- 05042 Zealous Traitor, 05043 Lossarnach Bandit, 05044 Umbar Assassin ----
// An enemy engaged by the player's choice (step 5.2) or by the engagement check (step 5.3, a threat of 45 reaches Umbar Assassin's 40).
const allies = { play: [{ code: "ally", seat: 0 }, { code: "ally", seat: 1 }], seats: 2 as const };
lineSpec("05042:A:1", "Forced: engaged by the player's choice it deals 1 damage to each ally he controls (not his heroes, not another player's ally)", (effects) => {
  const out = engage(effects, "05042", "optional", allies);
  const ally = (seat: number) => out.state.cards[Object.values(out.state.cards).find((card) => card.code === "ally" && card.controller === seat)?.id ?? ""];
  expect(ally(0)?.damage, "his ally").toBe(1);
  expect(ally(1)?.damage ?? 0, "the other player's ally").toBe(0);
  expect(out.state.cards[out.t.hero]?.damage ?? 0, "a hero").toBe(0);
});
lineSpec("05042:A:1", "Forced: engaged by an engagement check it deals 2 damage to each ally he controls", (effects) => {
  const out = engage(effects, "05042", "check", allies);
  const mine = Object.values(out.state.cards).find((card) => card.code === "ally" && card.controller === 0);
  expect(mine?.zone, "the ally (2 hit points) took 2 damage and is destroyed").not.toBe("play");
  const theirs = Object.values(out.state.cards).find((card) => card.code === "ally" && card.controller === 1);
  expect(theirs?.zone, "the other player's ally is untouched").toBe("play");
  expect(theirs?.damage ?? 0).toBe(0);
});
lineSpec("05043:A:1", "Forced: engaged by the player's choice the player discards 1 resource from each hero's pool; a hero with none discards none", (effects) => {
  const t = engage(effects, "05043", "optional", { heroResources: 3 });
  expect(resourcesOn(t.state, t.t.hero), "1 from each").toBe(2);
  expect(resourcesOn(t.state, t.t.hero2)).toBe(2);
  const poor = engage(effects, "05043", "optional", {});
  expect(resourcesOn(poor.state, poor.t.hero), "none to discard").toBe(0);
});
lineSpec("05043:A:1", "Forced: engaged by an engagement check the player discards 2 resources from each hero's pool, or all there are", (effects) => {
  const t = engage(effects, "05043", "check", { heroResources: 3 });
  expect(resourcesOn(t.state, t.t.hero), "2 from each of 3").toBe(1);
  expect(resourcesOn(t.state, t.t.hero2)).toBe(1);
  const little = engage(effects, "05043", "check", { heroResources: 1 });
  expect(resourcesOn(little.state, little.t.hero), "only 1 there").toBe(0);
});
lineSpec("05044:A:2", "Forced: engaged by the player's choice the player deals 3 damage to a hero he controls", (effects) => {
  const t = engage(effects, "05044", "optional");
  const total = (id: string) => t.state.cards[id]?.damage ?? 0;
  expect(total(t.t.hero) + total(t.t.hero2), "3 damage on one hero in all").toBe(3);
  expect([total(t.t.hero), total(t.t.hero2)].sort(), "all on the same hero").toEqual([0, 3]);
});
lineSpec("05044:A:2", "Forced: engaged by an engagement check the player discards a hero he controls instead", (effects) => {
  const t = engage(effects, "05044", "check");
  const here = [t.t.hero, t.t.hero2].filter((id) => t.state.cards[id]?.zone === "heroes");
  expect(here, "one hero discarded, the other left undamaged").toHaveLength(1);
  expect(t.state.cards[here[0] ?? ""]?.damage ?? 0).toBe(0);
});

// ---- 05045 Lurking in Shadows ----
lineSpec("05045:A:1", "When Revealed: all Brigand enemies engaged with any player return to the staging area; a Thug stays; with some returned there is no surge", (effects) => {
  const t = tbl(effects, { seats: 2, engaged: [{ code: "05037", seat: 0 }, { code: "05042", seat: 1 }, { code: "05020", seat: 0 }], deck: ["f0", "f0"] });
  const out = revealedTop(t, "05045");
  expect(codesIn(out, "staging"), "both Brigands, in the staging area").toEqual(["05037", "05042"]);
  expect(engagedOf(out, 0), "the Thug stays").toEqual(["05020"]);
  expect(engagedOf(out, 1)).toEqual([]);
  expect(codesIn(out, "encounterDeck"), "no surge: the next card stays on the deck").toEqual(["f0", "f0"]);
});
lineSpec("05045:A:1", "When Revealed: with no Brigand engaged it gains surge", (effects) => {
  const t = tbl(effects, { engaged: [{ code: "05020", seat: 0 }], staging: ["05037"], deck: ["f0", "f0"] });
  const out = revealedTop(t, "05045");
  expect(codesIn(out, "encounterDeck"), "one more card was revealed").toHaveLength(1);
  expect(codesIn(out, "staging"), "the Brigand in the staging area is not 'returned'").toEqual(["05037", "f0"]);
});
lineSpec("05045:A:2", "Shadow: the attacking enemy deals its damage and then returns to the staging area", (effects) => {
  const out = shadowFight(effects, "05045", {}, { enemy: "05043", undefended: true });
  expect(dmg(out, out.made.hero), "the attack dealt its 3 first").toBe(3);
  expect(zoneOf(out.run.state, "05043"), "then it goes back to the staging area").toBe("staging");
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

lineSpec("05065:A:1", "Setup: the Scroll is attached to a hero, not an ally, and its controller controls it", (effects) => {
  const t = tbl(effects, { seats: 2, firstPlayer: 1, stage: "05065", side: "A", play: [{ code: "ally", seat: 1 }] });
  const out = resolveRecords(t.state, t.ctx, "05065", "setup", questId(t.state));
  expect(hasScroll(out.state, t.seat1Hero ?? ""), "the first player's only hero").toBe(true);
  expect(out.state.cards[idOf(out.state, "05019")]?.controller, "its controller is that hero's").toBe(1);
  const alone = tbl(effects, { stage: "05065", side: "A", play: [{ code: "ally", seat: 0 }] });
  const done = resolveRecords(alone.state, alone.ctx, "05065", "setup", questId(alone.state), (state) => (state.window?.kind === "choose" ? (state.window.options[0] ?? "") : ""));
  expect([hasScroll(done.state, alone.hero), hasScroll(done.state, alone.hero2)].filter(Boolean), "on one of the 2 heroes").toHaveLength(1);
});
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
it("05065:B:1 Battle: characters use their Attack instead of Willpower when questing", () => {
  const t = tbl(EFFECTS, { stage: "05065", heroes: [{ code: "01005", seat: 0 }] }, ["01005"]);
  const run = quested(t, [idOf(t.state, "01005")]);
  const step = run.steps.find((one) => one.kind === "quest");
  expect(step?.kind === "quest" ? step.willpower : -1, "Legolas has Willpower 1 and Attack 3").toBe(3);
  const plain = tbl(EFFECTS, { stage: "05067", heroes: [{ code: "01005", seat: 0 }] }, ["01005"]);
  const other = quested(plain, [idOf(plain.state, "01005")]).steps.find((one) => one.kind === "quest");
  expect(other?.kind === "quest" ? other.willpower : -1, "stage 3 has no Battle").toBe(1);
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
lineSpec("05066:B:2", "The players cannot advance to the next stage unless the Scroll is attached to a hero: the progress goes on the stage but it stays", (effects) => {
  const blocked = quested(tbl(effects, { ...FIGHT, staging: ["05019"] }));
  expect(stageCode(blocked.state), "the Scroll is in the staging area").toBe("05066");
  expect(blocked.state.cards[idOf(blocked.state, "05066")]?.progress, "Battle: 2 + 2 more than the 13 points").toBe(16);
  const free = quested(scrolled(effects, FIGHT));
  expect(stageCode(free.state), "with the Scroll on a hero the stage advances").toBe("05067");
});
lineSpec("05066:B:2", "the stage advances once the Scroll is attached to a hero after the quest, and not while it is on an enemy", (effects) => {
  const t = tbl(effects, { ...FIGHT, staging: ["05019"], phase: "Quest" });
  const blocked = passUntil(send(start(t.state), { type: "Commit", cardIds: [t.hero] }, t.ctx), t, (state) => (state.cards[idOf(state, "05066")]?.progress ?? 0) > 12); // dh1 quests with Attack 2: 14 of 13 points, dh2 stays ready
  expect(stageCode(blocked.state)).toBe("05066");
  const action = scrollAction(blocked.state, t);
  expect(action, "the Scroll's Action is offered after the quest").toBeDefined();
  const attached = passUntil(finish(send(blocked, action as never, t.ctx), t.ctx), t, (state) => stageCode(state) === "05067" || state.round > blocked.state.round);
  expect(stageCode(attached.state), "advanced with the Scroll on a hero").toBe("05067");
  const onEnemy = scrollOn(tbl(effects, { ...FIGHT, engaged: [{ code: "05043", seat: 0 }] }), "05043");
  expect(stageCode(quested(onEnemy).state), "the Scroll is on an enemy").toBe("05066");
});

const scrollHost = (state: ScenarioState): string | undefined => {
  const host = Object.values(state.cards).find((card) => (card.attachments ?? []).some((id) => state.cards[id]?.code === "05019"));
  return host?.code;
};
const reveal66 = (effects: Es, layout: Layout, pick: (state: ScenarioState) => string = () => "") => {
  const t = scrolled(effects, { stage: "05066", ...layout });
  return resolveRecords(t.state, t.ctx, "05066", "whenRevealed", questId(t.state), pick).state;
};
lineSpec("05066:B:3", "When Revealed: the Scroll is attached to the enemy in play with the highest engagement cost, in the staging area or engaged", (effects) => {
  const staged = reveal66(effects, { engaged: [{ code: "05043", seat: 0 }], staging: ["05044"] });
  expect(scrollHost(staged), "Umbar Assassin (40) in the staging area beats Bandit (24)").toBe("05044");
  expect(hasScroll(staged, idOf(staged, "dh1")), "it left the hero").toBe(false);
  const engaged = reveal66(effects, { engaged: [{ code: "05044", seat: 0 }], staging: ["05043"] });
  expect(scrollHost(engaged), "the engaged one is the highest").toBe("05044");
  const pair = reveal66(effects, { seats: 2, engaged: [{ code: "05043", seat: 0 }, { code: "05044", seat: 1 }] });
  expect(scrollHost(pair), "an enemy engaged with another player counts").toBe("05044");
});
lineSpec("05066:B:3", "When Revealed: with no enemy in play the Scroll goes to the staging area", (effects) => {
  const out = reveal66(effects, {});
  expect(zoneOf(out, "05019"), "in the staging area").toBe("staging");
  expect(hasScroll(out, idOf(out, "dh1")), "not on the hero").toBe(false);
});
lineSpec("05066:B:3", "When Revealed: on a tie in engagement cost the first player chooses the enemy", (effects) => {
  asked.length = 0;
  reveal66(effects, { seats: 2, firstPlayer: 1, staging: ["05020", "05020"] }, noting((state) => (state.window?.kind === "choose" ? (state.window.options[0] ?? "") : "")));
  expect(asked, "the first player picks among the 2 Thugs").toEqual([{ seat: 1, options: 2 }]);
});

// ---- stage 3: Escape to the Quays ----
lineSpec("05067:A:1", "When Revealed: each player searches the encounter deck and discard pile for 1 enemy and adds it to the staging area", (effects) => {
  const pair = tbl(effects, { seats: 2, stage: "05067", side: "A", deck: ["05043", "place"], discard: ["05044"] });
  expect(codesIn(resolveRecords(pair.state, pair.ctx, "05067", "whenRevealed", questId(pair.state)).state, "staging"), "2 players, 2 enemies").toEqual(["05043", "05044"]);
  const alone = tbl(effects, { stage: "05067", side: "A", deck: ["place", "05043"], discard: ["05044"] });
  expect(codesIn(resolveRecords(alone.state, alone.ctx, "05067", "whenRevealed", questId(alone.state)).state, "staging").length, "1 player, 1 enemy, no location").toBe(1);
  const none = tbl(effects, { stage: "05067", side: "A", deck: ["place"] });
  expect(codesIn(resolveRecords(none.state, none.ctx, "05067", "whenRevealed", questId(none.state)).state, "staging"), "no enemy to find").toEqual([]);
});
const engageable = (table: LayoutTable): number => legalTargets(table.state, { type: "Engage" }, table.ctx).length;
lineSpec("05067:B:1", "Enemies cannot be optionally engaged", (effects) => {
  expect(engageable(tbl(effects, { stage: "05066", phase: "Encounter", staging: ["05043"] })), "stage 2: an enemy may be engaged").toBe(1);
  expect(engageable(tbl(effects, { ...quays, phase: "Encounter", staging: ["05043"] })), "stage 3: none").toBe(0);
  const check = tbl(effects, { ...quays, phase: "Encounter", staging: ["05043"] });
  const checked = passUntil(start(check.state), check, (state) => state.phase !== "Encounter");
  expect(engagedOf(checked.state), "the engagement check still engages it (Attack 3, cost 24 <= threat 28)").toEqual(["05043"]);
  const thug = scrolled(effects, { ...quays, staging: ["05020"] });
  expect(engagedOf(announced(thug, raised(0))), "an effect that engages is not an optional engagement").toEqual(["05020"]);
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
  const done = passUntil(send({ state: first, steps: [] }, { type: "Undefended", heroId: t.hero }, t.ctx), t, (state) => state.pendingAttack == null && state.window?.kind !== "defense");
  const second = revealedTop({ ...t, state: done.state }, "05044");
  expect(attacked(second), "the second enemy does not attack").toBe(false);
});
lineSpec("05067:B:3", "The players cannot defeat this stage unless the Scroll is attached to a hero, and defeating it wins the game", (effects) => {
  const loose = quested(tbl(effects, { ...quays, progress: 14, staging: ["05019"] }));
  expect(loose.state.stageCleared, "the Scroll is in the staging area").toBeFalsy();
  const won = quested(scrolled(effects, { ...quays, progress: 14 }));
  expect(won.state.stageCleared, "with the Scroll on a hero the game is won").toBe(true);
  expect(won.state.lost).toBeFalsy();
});

