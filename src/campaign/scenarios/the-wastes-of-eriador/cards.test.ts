// Rules: mec108.day-and-night, mec108.side-quests-in-play, rr.reveal, rr.running-out-of-cards, rr.next-player, rr.optional-engagement, rr.travel, rr.the-word-choose, rr.first-player, faq.lasting-effects, faq.additional-attacks, faq.enemy-attacks-outside-combat, faq.next-player (data/rules/entries.json).
// The stages' When Revealed and Forced lines, Amarthiúl, Pack Leader and the ten encounter cards of The Wastes of Eriador on the scenario's own table. Each test starts its title with the line it covers; lines.test.ts holds Day and Night, pool.test.ts the pool cards.
import { describe, expect, it } from "vitest";

import type { EngineStep } from "../../../rules/core/intents.ts";
import type { ScenarioState } from "../../../rules/core/state.ts";
import { flagged, updateCard } from "../../../rules/core/state.ts";
import { moveCard } from "../../../rules/core/zones.ts";
import { modifiedStat } from "../../../rules/core/keywords.ts";
import { settle } from "../../../rules/engine/machine.ts";
import { checkCost } from "../../../rules/families/costs/stats.ts";
import { fireForced } from "../../../rules/windows/triggers.ts";
import { fightEnemy, finish, idOf, idsOf, legalIntents, resolveRecords, send, tableFromLayout, type Layout } from "../../../../test/harness/scene-kit.ts";

const ID = "the-wastes-of-eriador";
const DAYBREAK = "10011";
const NIGHTFALL = "10012";
const WARG = "10018";
const at = (layout: Layout = {}) => tableFromLayout(ID, { stage: "10013", phase: "Quest", staging: [DAYBREAK], ...layout });
const night = (layout: Layout = {}) => at({ ...layout, staging: [NIGHTFALL, ...(layout.staging ?? [])] });
const zoneOf = (state: ScenarioState, code: string): string | undefined => state.cards[idOf(state, code)]?.zone;
const timeCode = (state: ScenarioState): string | undefined => Object.values(state.cards).find((card) => card.code === DAYBREAK || card.code === NIGHTFALL)?.code;
const hear = (state: ScenarioState, ctx: ReturnType<typeof at>["ctx"], trigger: "becameNight" | "becameDay" | "engaged"): ScenarioState => {
  const steps: EngineStep[] = [];
  const pushed = fireForced(state, { trigger, seat: null }, ctx, steps);
  return finish({ state: settle({ ...pushed, window: null, mode: "stopped" }, ctx, steps), steps }, ctx).state;
};
const wargsIn = (state: ScenarioState, zone: string): number => Object.values(state.cards).filter((card) => card.zone === zone && ["10018", "10019", "10020", "10021", "10022"].includes(card.code)).length;

describe("10013:A:1 sets the scenario up", () => {
  it("10013:A:1 gives the first player control of Amarthiúl, shuffles the encounter deck and has each player reveal 1 card", () => {
    const t = at({ seats: 2, stage: "10013", setAside: ["10016", "10017"], deck: [WARG, WARG, "10027", "10027"], phase: "Planning" });
    const run = resolveRecords(t.state, t.ctx, "10013", "setup", idOf(t.state, "10013"));
    const amarthiul = run.state.cards[idOf(run.state, "10016")];
    expect(amarthiul?.zone).toBe("play");
    expect(amarthiul?.controller).toBe(0);
    expect(zoneOf(run.state, "10017")).toBe("setAside");
    expect(run.state.encounterDeck.length).toBeLessThan(4);
  });
});

describe("10014:A:1 and 10015:A:1 discard Wargs from the encounter deck into the staging area", () => {
  const deck = [WARG, "10027", "10019", "10027", "10020"];

  it("10014:A:1 discards cards until as many Warg enemies as players are discarded, and adds each Warg to the staging area, not revealed", () => {
    const t = at({ stage: "10014", seats: 2, deck, discard: ["10025"] });
    const run = resolveRecords(t.state, t.ctx, "10014", "whenRevealed", idOf(t.state, "10014"));
    expect(wargsIn(run.state, "staging")).toBe(2);
    // The non-Warg cards discarded on the way stay in the encounter discard pile; the shuffled-in discard pile and the deck are one pile.
    expect(run.state.encounterDiscard.every((id) => run.state.cards[id]?.code !== WARG)).toBe(true);
  });

  it("10014:A:1 discards a single Warg alone, and stops when the deck runs out", () => {
    const t = at({ stage: "10014", deck: [WARG, "10027"] });
    expect(wargsIn(resolveRecords(t.state, t.ctx, "10014", "whenRevealed", idOf(t.state, "10014")).state, "staging")).toBe(1);
    const short = at({ stage: "10014", seats: 2, deck: [WARG, "10027"] });
    expect(wargsIn(resolveRecords(short.state, short.ctx, "10014", "whenRevealed", idOf(short.state, "10014")).state, "staging")).toBe(1);
  });

  it("10015:A:1 flips the Time objective to Nightfall, adds Pack Leader and, with one player, discards no Warg (the pile is only shuffled in)", () => {
    const t = at({ stage: "10015", setAside: ["10017"], deck, discard: ["10025"] });
    const run = resolveRecords(t.state, t.ctx, "10015", "whenRevealed", idOf(t.state, "10015"));
    expect(timeCode(run.state)).toBe(NIGHTFALL);
    // Nightfall's own Forced effect (10012:A:2) revealed the top card of the shuffled deck as the flip was heard.
    expect(run.state.encounterDeck).toHaveLength(5);
    expect(zoneOf(run.state, "10017")).toBe("staging");
    expect(run.state.encounterDiscard).toHaveLength(0);
  });

  it("10015:A:1 discards 1 fewer Warg than players: 1 with two players, and 0 alone", () => {
    const run = (seats: 1 | 2) => {
      const t = night({ stage: "10015", seats, setAside: ["10017"], deck });
      return resolveRecords(t.state, t.ctx, "10015", "whenRevealed", idOf(t.state, "10015")).state;
    };
    expect(wargsIn(run(2), "staging")).toBe(1);
    expect(wargsIn(run(1), "staging")).toBe(0);
  });
});

describe("10014:B:1 and 10014:B:2 answer the change of time", () => {
  it("10014:B:1 has each player draw 1 card when it becomes Day", () => {
    const t = night({ stage: "10014", seats: 2, deckOf: ["filler", "filler"] });
    const out = hear(t.state, t.ctx, "becameDay");
    expect([out.seats[0]?.hand.length, out.seats[1]?.hand.length]).toEqual([1, 1]);
  });

  it("10014:B:2 has the first player discard 1 non-objective ally from play when it becomes Night, an ally of any player, and never Amarthiúl", () => {
    const t = at({ stage: "10014", seats: 2, play: ["ally", { code: "ally", seat: 1 }, "10016"] });
    const out = hear(t.state, t.ctx, "becameNight");
    const allies = idsOf(out, "ally").filter((id) => out.cards[id]?.zone === "play");
    expect(allies).toHaveLength(1);
    expect(zoneOf(out, "10016")).toBe("play");
  });

  it("10014:B:2 discards what there is when there are no allies, Amarthiúl staying in play", () => {
    const t = at({ stage: "10014", play: ["10016"] });
    expect(zoneOf(hear(t.state, t.ctx, "becameNight"), "10016")).toBe("play");
  });
});

describe("10015:B:1, 10015:B:2 and 10015:B:3 hold Pack Leader and the stage", () => {
  const leader = (progress: number, layout: Layout = {}) => at({ stage: "10015", progress, staging: [DAYBREAK, "10017"], ...layout });
  const takes = (t: ReturnType<typeof leader>): boolean => !flagged(t.state, idOf(t.state, "10017"), "cannotTakeDamage");

  it("10015:B:1 lets Pack Leader take no damage unless 5 or more progress is on the stage", () => {
    expect(takes(leader(4))).toBe(false);
    expect(takes(leader(5))).toBe(true);
    expect(takes(leader(9))).toBe(true);
  });

  it("10015:B:2 discards all progress from the stage when it becomes Day", () => {
    const t = leader(7, { staging: [NIGHTFALL, "10017"] });
    const out = hear(t.state, t.ctx, "becameDay");
    expect(out.cards[idOf(out, "10015")]?.progress).toBe(0);
  });

  it("10015:B:3 cannot be defeated while Pack Leader is in play, whatever the progress, and the players win when he is destroyed", () => {
    const t = leader(9);
    expect(settle({ ...t.state, window: null, mode: "stopped" }, t.ctx, []).questStage).toBe(idOf(t.state, "10015"));
    const slain = updateCard(t.state, idOf(t.state, "10017"), { damage: 20 });
    const out = settle({ ...slain, window: null, mode: "stopped" }, t.ctx, []);
    expect(out.stageCleared).toBe(true);
  });
});

describe("10016:A:1 and 10017 are the objective ally and the Pack Leader", () => {
  it("10016:A:1 lets the controller of Amarthiúl give him to the player an enemy engages", () => {
    const t = at({ seats: 2, play: ["10016"], staging: [DAYBREAK, "f3"] });
    const queued = { ...t.state, pendingEvents: [{ trigger: "engaged" as const, seat: 1, subject: idOf(t.state, "f3") }] };
    const rested = settle({ ...queued, window: null, mode: "stopped" }, t.ctx, []);
    const offer = legalIntents(rested, t.ctx).find((intent) => intent.type === "Trigger" && intent.cardId === idOf(rested, "10016"));
    expect(offer).toBeDefined();
    const run = send({ state: rested, steps: [] as EngineStep[] }, offer as never, t.ctx);
    expect(finish(run, t.ctx).state.cards[idOf(rested, "10016")]?.controller).toBe(1);
  });

  it("10017:A:2 cannot be optionally engaged", () => {
    const t = at({ staging: [DAYBREAK, "10017"] });
    expect(flagged(t.state, idOf(t.state, "10017"), "cannotBeOptionallyEngaged")).toBe(true);
  });

  it("10017:A:3 exhausts a character you control for each Warg enemy engaged with you, Pack Leader included", () => {
    const t = at({ staging: [DAYBREAK], engaged: [{ code: "10017", seat: 0 }, { code: "10018", seat: 0 }] });
    const out = hear(t.state, t.ctx, "engaged");
    void out;
    const run = resolveRecords(t.state, t.ctx, "10017", "forced", idOf(t.state, "10017"));
    const exhausted = Object.values(run.state.cards).filter((card) => card.zone === "heroes" && card.exhausted).length;
    expect(exhausted).toBe(2);
  });

  it("10017:A:3 exhausts one for himself alone, and as many as there are ready characters", () => {
    const alone = at({ engaged: [{ code: "10017", seat: 0 }] });
    expect(Object.values(resolveRecords(alone.state, alone.ctx, "10017", "forced", idOf(alone.state, "10017")).state.cards).filter((card) => card.zone === "heroes" && card.exhausted)).toHaveLength(1);
    const many = at({ engaged: [{ code: "10017", seat: 0 }, { code: "10018", seat: 0 }, { code: "10019", seat: 0 }] });
    expect(Object.values(resolveRecords(many.state, many.ctx, "10017", "forced", idOf(many.state, "10017")).state.cards).filter((card) => card.zone === "heroes" && card.exhausted)).toHaveLength(2);
  });
});

describe("10018:A:1 and 10018:A:2 are the Northern Warg's lines", () => {
  it("10018:A:1 gives each Warg enemy +1 Threat until the end of the phase, one that enters later and the Northern Warg itself included", () => {
    const t = at({ staging: [DAYBREAK, "10019"] });
    const run = resolveRecords(t.state, t.ctx, "10018", "whenRevealed");
    const warg = (id: string) => modifiedStat(run.state, run.state.cards[id]!, "threat", t.cards);
    const printed = t.cards.get("10019")?.threat ?? 0;
    expect(warg(idOf(run.state, "10019"))).toBe(printed + 1);
    expect(warg(run.id)).toBe((t.cards.get("10018")?.threat ?? 0) + 1);
  });

  it("10018:A:1 is recalculated: a Warg that enters play later in the phase gets the +1 as well, and one that is not a Warg gets none", () => {
    const t = at({ staging: [DAYBREAK], deck: ["10021"], discard: ["10025"] });
    const run = resolveRecords(t.state, t.ctx, "10018", "whenRevealed");
    const entered = moveCard(run.state, idOf(run.state, "10021"), { zone: "staging" });
    const threat = (state: ScenarioState, code: string) => modifiedStat(state, state.cards[idOf(state, code)]!, "threat", t.cards);
    expect(threat(entered, "10021")).toBe((t.cards.get("10021")?.threat ?? 0) + 1);
    const other = moveCard(run.state, idOf(run.state, "10025"), { zone: "staging" });
    expect(threat(other, "10025")).toBe(t.cards.get("10025")?.threat ?? 0);
  });

  it("10018:A:2 engages the next player after the attack and attacks again, with a second player", () => {
    const fight = fightEnemy((layout: Layout) => at(layout), "10018", "f3", { seats: 2, stage: "10013", phase: "Encounter", deckOf: ["filler", "filler"] });
    expect(fight.run.state.cards[idOf(fight.run.state, "f3")]?.controller).toBe(1);
    // The immediate attack is made against the player just engaged, not the defending player again: the second seat's hero takes it.
    const second = fight.run.state.seats[1]?.heroes[0] ?? "";
    expect(fight.run.state.cards[second]?.damage ?? 0).toBeGreaterThan(0);
  });

  it("10018:A:2 stays with the only player, who is not attacked again", () => {
    const fight = fightEnemy((layout: Layout) => at(layout), "10018", "f3", { stage: "10013", phase: "Encounter", deckOf: ["filler", "filler"] });
    expect(fight.run.state.cards[idOf(fight.run.state, "f3")]?.controller).toBe(0);
  });
});

describe("10019:A:1 and 10020:A:2 are the Wargs that read the night and the wounded", () => {
  it("10019:A:1 engages the first player and attacks when it becomes Night, from the staging area only", () => {
    const t = at({ staging: [DAYBREAK, "10019"], deckOf: ["filler"], deck: ["f0", "f0"] });
    const out = hear(t.state, t.ctx, "becameNight");
    expect(zoneOf(out, "10019")).toBe("engaged");
    expect(out.cards[idOf(out, "10019")]?.controller).toBe(0);
    const engaged = at({ staging: [DAYBREAK], engaged: [{ code: "10019", seat: 0 }] });
    expect(zoneOf(hear(engaged.state, engaged.ctx, "becameNight"), "10019")).toBe("engaged");
  });

  it("10019:A:1 engages the first player, whichever seat holds the token, and not the player whose turn it is", () => {
    const t = at({ seats: 2, staging: [DAYBREAK, "10019"], deckOf: ["filler"], deck: ["f0", "f0"] });
    const second = { ...t.state, firstPlayer: 1 };
    const out = hear(second, t.ctx, "becameNight");
    expect(zoneOf(out, "10019")).toBe("engaged");
    expect(out.cards[idOf(out, "10019")]?.controller).toBe(1);
  });

  it("10020:A:2 lowers the cost it checks against a player by 1 for each damaged character they control, hero or ally, never below 0", () => {
    const t = at({ staging: [DAYBREAK, "10020"], play: ["ally"] });
    const hunting = t.state.cards[idOf(t.state, "10020")]!;
    const base = checkCost(t.state, hunting, 0, t.cards) ?? 0;
    const hurt = updateCard(updateCard(t.state, t.hero, { damage: 1 }), idOf(t.state, "ally"), { damage: 1 });
    expect(checkCost(hurt, hurt.cards[hunting.id]!, 0, t.cards)).toBe(Math.max(0, base - 2));
    const all = updateCard(hurt, t.hero2, { damage: 1 });
    expect(checkCost(all, all.cards[hunting.id]!, 0, t.cards)).toBe(Math.max(0, base - 3));
    expect(modifiedStat(all, all.cards[hunting.id]!, "engagementCost", t.cards)).toBe(base);
  });

  it("10020:A:2 counts only the damaged characters of the player making the check, and the cost it checks never falls below 0", () => {
    const t = at({ seats: 2, staging: [DAYBREAK, "10020"] });
    const hunting = t.state.cards[idOf(t.state, "10020")]!;
    const base = checkCost(t.state, hunting, 0, t.cards) ?? 0;
    // Only seat 0's hero is damaged: seat 0's check is 1 lower, seat 1's is the printed cost.
    const hurt = updateCard(t.state, t.state.seats[0]?.heroes[0] ?? "", { damage: 1 });
    expect(checkCost(hurt, hurt.cards[hunting.id]!, 0, t.cards)).toBe(base - 1);
    expect(checkCost(hurt, hurt.cards[hunting.id]!, 1, t.cards)).toBe(base);
    // With the cost brought down to 1 by another card, 2 damaged characters leave 0, not -1.
    const cheap = { ...hurt, modifiers: [...hurt.modifiers, { instanceId: hunting.id, sourceId: hunting.id, stat: "engagementCost" as const, amount: 1 - base, until: "endOfGame" as const }] };
    const wounded = updateCard(cheap, t.state.seats[0]?.heroes[1] ?? t.hero2, { damage: 1 });
    expect(checkCost(wounded, wounded.cards[hunting.id]!, 0, t.cards)).toBe(0);
  });
});
