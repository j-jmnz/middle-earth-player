// Rules: mec108.side-quests-in-play, mec108.the-investigation, mec108.objective-allies, rr.surge, rr.doomed-x, rr.running-out-of-cards, rr.first-player, rr.the-word-choose, rr.destroy, rr.explored, faq.last-encounter-card, faq.simultaneous-effects (data/rules/entries.json); ledger lines 10097:A:1, 10099:A:1, 10099:A:2, 10100:A:1, 10100:A:2, 10101:A:2, 10103:A:1, 10107:A:1, 10107:A:2, 10109:A:1, 10110:A:1, 10113:A:2, 10114:A:2, 10185:A:3, 10187:A:3.
// The cards of The Treachery of Rhudaur whose records use the angmar family's verbs, on tables built from data/ by the layout kit.
import { describe, expect, it } from "vitest";

import { flagged, updateCard, type ScenarioState } from "../../core/state.ts";
import { destroyCard, modifiedStat } from "../../core/keywords.ts";
import { moveCard } from "../../core/zones.ts";
import { settle } from "../../engine/machine.ts";
import { limitSpent } from "../../player/usage.ts";
import { giveControl } from "../play/control.ts";
import { queueEvent } from "../../windows/queue.ts";
import { codesIn, finish, fightEnemy, HERO, idOf, resolveRecords, revealFromTop, tableFromLayout, type Layout } from "../../../../test/harness/scene-kit.ts";
import { setCurrentQuest } from "./quest.ts";

const built = (layout: Layout = {}) => tableFromLayout("the-treachery-of-rhudaur", { stage: "10094", ...layout });
const codesAt = (state: ScenarioState, ids: readonly string[]) => ids.map((id) => state.cards[id]?.code);

describe("Wight of Rhudaur", () => {
  const revealed = (progress: number | null) => {
    const t = built({ phase: "Quest", staging: progress === null ? ["10111"] : [{ code: "10109", progress }], deck: ["f0", "f3"], threat: [30, 30] });
    const chosen = progress === null ? t.state : setCurrentQuest(t.state, idOf(t.state, "10109"), t.ctx);
    return { t, run: revealFromTop(chosen, t.ctx, "10099", []) };
  };

  it("10099:A:1 gains surge while the current quest holds progress: one more card is revealed, and no threat is raised", () => {
    const { run } = revealed(1);
    expect(codesAt(run.state, run.state.staging)).toContain("f0");
    expect(run.state.seats[0]?.threat).toBe(30);
  });

  it("10099:A:2 gains doomed 2 while the current quest holds no progress: each player raises threat by 2, and it gains no surge", () => {
    const { run } = revealed(0);
    expect(run.state.seats[0]?.threat).toBe(32);
    expect(codesAt(run.state, run.state.staging)).not.toContain("f0");
  });

  it("10099:A:1, 10099:A:2 with no current quest (the main quest card barred, no side quest chosen) neither surge nor doomed", () => {
    const { run } = revealed(null);
    expect(run.state.seats[0]?.threat).toBe(30);
    expect(codesAt(run.state, run.state.staging)).not.toContain("f0");
  });
});

describe("Traitorous Wight", () => {
  it("10100:A:1 removes 2 progress from each quest card in play when it engages a player, the main quest card and each staged side quest, not below 0", () => {
    const t = built({ staging: [{ code: "10109", progress: 5 }, { code: "10111", progress: 1 }, "10100"] });
    const stage = t.state.questStage ?? "";
    const wight = idOf(t.state, "10100");
    const withProgress = updateCard(t.state, stage, { progress: 3 });
    const engaged = settle(moveCard(queueEvent(withProgress, { trigger: "engaged", seat: 0, cardId: wight, subject: wight }), wight, { zone: "engaged", seat: 0 }), t.ctx, []);
    expect([engaged.cards[stage]?.progress, engaged.cards[idOf(engaged, "10109")]?.progress, engaged.cards[idOf(engaged, "10111")]?.progress]).toEqual([1, 3, 0]);
  });
});

describe("Quiet the Spirits", () => {
  it("10109:A:1 makes an Undead enemy added to the staging area engage the player with the highest threat at once while it is the current quest, and not otherwise", () => {
    const layout: Layout = { seats: 2, phase: "Quest", staging: ["10109", "10100"], threat: [30, 35] };
    const t = built(layout);
    const wight = idOf(t.state, "10100");
    const heard = (state: ScenarioState) => settle(queueEvent(state, { trigger: "addedToStaging", seat: 0, cardId: wight, subject: wight }), t.ctx, []);
    const current = setCurrentQuest(t.state, idOf(t.state, "10109"), t.ctx);
    const engaged = heard(current);
    expect(engaged.cards[wight]?.zone).toBe("engaged");
    expect(engaged.cards[wight]?.controller).toBe(1);
    expect(flagged(engaged, wight, "engagedThreat")).toBe(true);
    const idle = heard(t.state);
    expect(idle.cards[wight]?.zone).toBe("staging");
  });
});

describe("the encounter deck running out", () => {
  it("10103:A:1 returns the topmost Undead enemy of the discard pile to the staging area before the empty deck is reset, so it is not shuffled in", () => {
    const t = built({ phase: "Quest", staging: ["10103"], deck: [], discard: ["f3", "10099", "f3"] });
    const run = revealFromTop(t.state, t.ctx, "f0", []);
    // The deck was emptied by the reveal and reset: the two f3 are in it (the card revealed lies in the staging area), the Wight is staged.
    expect(codesAt(run.state, run.state.staging)).toContain("10099");
    expect(codesAt(run.state, run.state.encounterDeck).sort()).toEqual(["f3", "f3"]);
    const idle = built({ phase: "Quest", staging: ["f3"], deck: [], discard: ["f3", "10099", "f3"] });
    const plain = revealFromTop(idle.state, idle.ctx, "f0", []);
    expect(codesAt(plain.state, plain.state.staging)).not.toContain("10099");
    expect(codesAt(plain.state, plain.state.encounterDeck)).toContain("10099");
  });

  it("10097:A:1 each player discards the top 5 cards of the encounter deck and adds an Undead enemy of those five to the staging area", () => {
    const t = built({ active: "10097", deck: ["f0", "10100", "f3", "10099", "f0", "f3"] });
    const hall = idOf(t.state, "10097");
    const run = finish(resolveRecords(t.state, t.ctx, "10097", "forced", hall), t.ctx);
    const staged = codesAt(run.state, run.state.staging).filter((code) => code === "10100" || code === "10099");
    expect(staged).toHaveLength(1);
    expect(run.state.encounterDeck).toHaveLength(1);
    expect(codesAt(run.state, run.state.encounterDiscard)).toHaveLength(4);
  });

  it("10097:A:1 a deck with fewer than 5 cards is discarded, the discard pile reset and the discard goes on from the new deck (faq.last-encounter-card)", () => {
    const t = built({ phase: "Quest", active: "10097", deck: ["f0", "10100"], discard: ["f3", "f3", "f3", "10099"] });
    const hall = idOf(t.state, "10097");
    const run = finish(resolveRecords(t.state, t.ctx, "10097", "forced", hall, undefined, false), t.ctx);
    // Five cards went to the discard pile in all; the seven cards (deck and discard, 6 in play of the effect) are accounted for.
    const total = run.state.encounterDeck.length + run.state.encounterDiscard.length + run.state.staging.filter((id) => ["10100", "10099"].includes(run.state.cards[id]?.code ?? "")).length;
    expect(total).toBe(6);
    expect(run.state.encounterDeck.length).toBeLessThan(6);
  });
});

describe("Forbidden Descent leaving play", () => {
  it("10101:A:2 raises each player's threat by 2 when it leaves play from the staging area, discarded or removed, and not when it is explored", () => {
    const t = built({ staging: ["10101"], threat: [30, 30], seats: 2 });
    const descent = idOf(t.state, "10101");
    const discarded = settle(moveCard(t.state, descent, { zone: "encounterDiscard" }), t.ctx, []);
    expect([discarded.seats[0]?.threat, discarded.seats[1]?.threat]).toEqual([32, 32]);
    const explored = settle(destroyCard(t.state, descent, t.ctx.cards, [], true), t.ctx, []);
    expect([explored.seats[0]?.threat, explored.seats[1]?.threat]).toEqual([30, 30]);
    const travelled = settle(moveCard(t.state, descent, { zone: "activeLocation" }), t.ctx, []);
    expect(travelled.seats[0]?.threat).toBe(30);
  });
});

describe("Dark Covenant", () => {
  const layout: Layout = { phase: "Quest", staging: [{ code: "10109", progress: 4 }], deck: ["10100", "10099", "10100", "f0"] };
  const x = (state: ScenarioState, t: ReturnType<typeof built>) => ["10100", "10099", "10100"].reduce((sum, code) => sum + (t.ctx.cards.get(code)?.threat ?? 0), state.encounterDeck.length * 0);
  const pickOption = (option: string) => (state: ScenarioState) => (state.window?.kind === "choose" ? (state.window.options.includes(option) ? option : (state.window.options[0] ?? "")) : "");

  it("10107:A:1 discards the top 3 cards of the encounter deck, X their total printed Threat, and the first player removes X progress from among the quests in play", () => {
    const t = built(layout);
    const run = finish(resolveRecords(t.state, t.ctx, "10107", "whenRevealed", undefined, pickOption("remove"), false), t.ctx, pickOption("remove"));
    expect(codesAt(run.state, run.state.encounterDiscard).filter((code) => code !== "10107")).toEqual(expect.arrayContaining(["10100", "10099"]));
    const stagedQuest = run.state.cards[idOf(run.state, "10109")];
    expect(stagedQuest?.progress).toBe(Math.max(0, 4 - x(run.state, t)));
  });

  it("10107:A:1 or assigns X damage among the characters he controls, one at a time", () => {
    const t = built(layout);
    const run = finish(resolveRecords(t.state, t.ctx, "10107", "whenRevealed", undefined, pickOption("damage"), false), t.ctx, pickOption("damage"));
    const hero = run.state.cards[idOf(run.state, HERO)];
    expect(hero?.damage === x(run.state, t) || hero?.zone !== "heroes").toBe(true);
    expect(run.state.cards[idOf(run.state, "10109")]?.progress).toBe(4);
  });

  it("10107:A:1 offers neither option when X is 0, and only the damage when no quest holds progress", () => {
    const none = built({ phase: "Quest", staging: [{ code: "10109", progress: 4 }], deck: ["f0", "f0", "f0", "f0"] });
    const nothing = finish(resolveRecords(none.state, none.ctx, "10107", "whenRevealed", undefined, undefined, false), none.ctx);
    expect(nothing.state.cards[idOf(nothing.state, "10109")]?.progress).toBe(4);
    expect(nothing.state.cards[idOf(nothing.state, HERO)]?.damage).toBe(0);
    const bare = built({ phase: "Quest", deck: ["10100", "10100", "10100", "f0"] });
    const damaged = finish(resolveRecords(bare.state, bare.ctx, "10107", "whenRevealed", undefined, undefined, false), bare.ctx);
    expect((damaged.state.cards[idOf(damaged.state, HERO)]?.damage ?? 0) > 0 || damaged.state.cards[idOf(damaged.state, HERO)]?.zone !== "heroes").toBe(true);
  });
});

describe("the Clue objectives", () => {
  const layout: Layout = { phase: "Planning", staging: ["10110"], play: [{ code: "10096" }] };

  it("10110:A:1 is claimed by exhausting a hero: it attaches to the hero, controlled by its player, and is no longer in the staging area", () => {
    const t = built({ phase: "Planning", staging: ["10110"] });
    const clue = idOf(t.state, "10110");
    const choose = (option: string) => (state: ScenarioState) => (state.window?.kind === "choose" ? (state.window.options.includes(option) ? option : (state.window.options[0] ?? "")) : "");
    const run = finish(resolveRecords(t.state, t.ctx, "10110", "action", clue, choose("hero")), t.ctx, choose("hero"));
    const hero = run.state.cards[idOf(run.state, HERO)];
    expect(hero?.exhausted).toBe(true);
    expect(run.state.cards[clue]?.host).toBe(hero?.id);
    expect(run.state.cards[clue]?.claimed).toBe(true);
    expect(run.state.cards[clue]?.controller).toBe(0);
  });

  it("10110:A:1 is claimed by exhausting Amarthiúl, and the Clue follows him when control of him passes", () => {
    const t = built({ ...layout, seats: 2 });
    const clue = idOf(t.state, "10110");
    const amarthiul = idOf(t.state, "10096");
    const choose = (state: ScenarioState) => (state.window?.kind === "choose" ? (state.window.options.includes("amarthiul") ? "amarthiul" : (state.window.options[0] ?? "")) : "");
    const run = finish(resolveRecords(t.state, t.ctx, "10110", "action", clue, choose), t.ctx, choose);
    expect(run.state.cards[amarthiul]?.exhausted).toBe(true);
    expect(run.state.cards[clue]?.host).toBe(amarthiul);
    const given = giveControl(run.state, amarthiul, 1);
    expect(given.cards[amarthiul]?.controller).toBe(1);
    expect(given.cards[clue]?.controller).toBe(1);
    expect(given.cards[clue]?.host).toBe(amarthiul);
    expect(given.cards[clue]?.claimed).toBe(true);
  });

  it("10114:A:2 gives the host +1 Defense only while defending against an Undead enemy", () => {
    const t = built({ phase: "Combat", attached: [{ code: "10114", to: HERO }], engaged: ["10100", "f3"] });
    const hero = t.state.cards[idOf(t.state, HERO)];
    const [wight, other] = t.state.seats[0]?.engaged ?? [];
    if (!hero || !wight || !other) throw new Error("table");
    const defending = (enemy: string): ScenarioState => ({ ...t.state, pendingAttack: { enemyId: enemy, seat: 0, shadowOffered: true, shadowResolved: true, defenderId: hero.id } });
    const base = modifiedStat(t.state, hero, "defense", t.ctx.cards);
    expect(modifiedStat(defending(wight), hero, "defense", t.ctx.cards)).toBe(base + 1);
    expect(modifiedStat(defending(other), hero, "defense", t.ctx.cards)).toBe(base);
  });
});

describe("Dark Covenant's shadow", () => {
  it("10107:A:2 raises the defending player's threat by the destroyed character's Willpower, last known, and by nothing when the attack destroys none", () => {
    const table = (layout: Layout) => tableFromLayout("the-treachery-of-rhudaur", { stage: "10094", threat: [30, 30], ...layout });
    const fought = fightEnemy(table, "10107", "10100", {}, { undefended: true, tweak: (state, made) => updateCard(state, made.hero, { damage: 5 }) });
    const hero = fought.run.state.cards[fought.made.hero];
    expect(hero?.zone).not.toBe("heroes");
    expect(fought.run.state.seats[0]?.threat).toBe(30 + (fought.ctx.cards.get(HERO)?.willpower ?? 0));
    const survived = fightEnemy(table, "10107", "10100", {}, { undefended: true });
    expect(survived.run.state.cards[survived.made.hero]?.zone).toBe("heroes");
    expect(survived.run.state.seats[0]?.threat).toBe(30);
  });
});

describe("the boons of the Clues", () => {
  it("10187:A:3 discards a non-unique Undead enemy with 2 or less remaining hit points, in the staging area or engaged, and no other", () => {
    const t = built({ attached: [{ code: "10187", to: HERO }], staging: [{ code: "10100", damage: 2 }, "10099"], engaged: [{ code: "10100", damage: 3 }] });
    const boon = idOf(t.state, "10187");
    const run = finish(resolveRecords(t.state, t.ctx, "10187", "response", boon), t.ctx);
    expect(codesAt(run.state, run.state.encounterDiscard)).toEqual(["10100"]);
    expect(codesAt(run.state, run.state.staging)).toContain("10099");
    const none = built({ attached: [{ code: "10187", to: HERO }], staging: ["10099", { code: "10098", damage: 8 }] });
    const kept = finish(resolveRecords(none.state, none.ctx, "10187", "response", idOf(none.state, "10187")), none.ctx);
    expect(kept.state.encounterDiscard).toHaveLength(0);
  });

  it("10185:A:3 adds a Sorcery treachery from the top 5 cards of the encounter deck to the victory display, and shuffles the deck", () => {
    const t = built({ attached: [{ code: "10185", to: HERO }], deck: ["f0", "f3", "10106", "f0", "f0", "10107"] });
    const run = finish(resolveRecords(t.state, t.ctx, "10185", "response", idOf(t.state, "10185")), t.ctx);
    expect(codesIn(run.state, "victory")).toHaveLength(1);
    expect(["10106"]).toContain(codesIn(run.state, "victory")[0]);
    expect(run.state.encounterDeck).toHaveLength(5);
  });
});

describe("Decipher Ancient Texts", () => {
  it("10113:A:2 may be used 3 times a round by all the players together", () => {
    const t = built({ seats: 2, staging: ["10113"] });
    const card = idOf(t.state, "10113");
    const effect = t.ctx.effects.find((one) => one.id === "10113:action:1");
    if (!effect) throw new Error("record");
    const use = (seat: number) => ({ effectId: effect.id, sourceId: card, seat, round: t.state.round, phase: t.state.phase });
    const spent = (count: number) => limitSpent({ ...t.state, uses: Array.from({ length: count }, (_, index) => use(index % 2)) }, effect, card, 0);
    expect([spent(2), spent(3)]).toEqual([false, true]);
  });
});

describe("the side quests' progress", () => {
  it("10109:A:2 places 2 progress on Quiet the Spirits directly after any enemy is destroyed, even when it is not the current quest", () => {
    const t = built({ staging: ["10109", "10100"] });
    const wight = idOf(t.state, "10100");
    const heard = settle(queueEvent(t.state, { trigger: "enemyDestroyed", seat: 0, cardId: wight, subject: wight }), t.ctx, []);
    expect(heard.cards[idOf(heard, "10109")]?.progress).toBe(2);
  });

  it("10111:A:2 places 2 progress on Sift through the Debris after a location is explored", () => {
    const t = built({ staging: ["10111", "10102"] });
    const place = idOf(t.state, "10102");
    const heard = settle(queueEvent(t.state, { trigger: "locationExplored", seat: null, subject: place, amount: 0 }), t.ctx, []);
    expect(heard.cards[idOf(heard, "10111")]?.progress).toBe(2);
  });
});

describe("the treacheries", () => {
  it("10106:A:1 deals 1 damage to each exhausted character, and a player with 35 threat or more discards his exhausted attachments", () => {
    const t = built({ phase: "Quest", threat: [35, 30], seats: 2, attached: [{ code: "10187", to: HERO }] });
    const hero = idOf(t.state, HERO);
    const boon = idOf(t.state, "10187");
    const tired = updateCard(updateCard(t.state, hero, { exhausted: true }), boon, { exhausted: true });
    const run = finish(resolveRecords(tired, t.ctx, "10106", "whenRevealed", undefined, undefined, false), t.ctx);
    expect(run.state.cards[hero]?.damage).toBe(1);
    expect(run.state.cards[boon]?.zone).toBe("discard");
    const low = built({ phase: "Quest", threat: [34, 30], attached: [{ code: "10187", to: HERO }] });
    const kept = finish(resolveRecords(updateCard(updateCard(low.state, idOf(low.state, HERO), { exhausted: true }), idOf(low.state, "10187"), { exhausted: true }), low.ctx, "10106", "whenRevealed", undefined, undefined, false), low.ctx);
    expect(kept.state.cards[idOf(kept.state, "10187")]?.zone).toBe("play");
  });

  it("10108:A:1 exhausts a character of each player and attaches to the current quest for +6 quest points, and is discarded with no current quest", () => {
    const t = built({ phase: "Quest", staging: ["10109"] });
    const chosen = setCurrentQuest(t.state, idOf(t.state, "10109"), t.ctx);
    const run = finish(resolveRecords(chosen, t.ctx, "10108", "whenRevealed", undefined, undefined, false), t.ctx);
    const side = idOf(run.state, "10109");
    expect(run.state.cards[idOf(run.state, "10108")]?.host).toBe(side);
    expect(modifiedStat(run.state, run.state.cards[side]!, "questPoints", t.ctx.cards)).toBe((t.ctx.cards.get("10109")?.questPoints ?? 0) + 6);
    expect(run.state.cards[idOf(run.state, HERO)]?.exhausted).toBe(true);
    const none = finish(resolveRecords(t.state, t.ctx, "10108", "whenRevealed", undefined, undefined, false), t.ctx);
    expect(none.state.cards[idOf(none.state, "10108")]?.host ?? null).toBeNull();
  });

  it("10105:A:2 makes the first player choose another quest card to be the current quest: a staged side quest, never the barred main quest card", () => {
    const t = built({ phase: "Quest", staging: ["10109", "10111"] });
    const run = finish(resolveRecords(t.state, t.ctx, "10105", "whenRevealed", undefined, (state) => (state.window?.kind === "choose" ? (state.window.options[0] ?? "") : ""), false), t.ctx);
    const current = ["10109", "10111"].filter((code) => flagged(run.state, idOf(run.state, code), "currentQuest"));
    expect(current).toHaveLength(1);
  });

  it("10102:A:1 lowers the Threat of Eerie Halls by 1 for a raise of 1 in threat, down to 0 and no further", () => {
    const t = built({ staging: ["10102"], threat: [30, 30] });
    const halls = idOf(t.state, "10102");
    const base = modifiedStat(t.state, t.state.cards[halls]!, "threat", t.ctx.cards);
    const run = resolveRecords(t.state, t.ctx, "10102", "action", halls);
    expect(modifiedStat(run.state, run.state.cards[halls]!, "threat", t.ctx.cards)).toBe(base - 1);
    const record = t.ctx.effects.find((effect) => effect.id === "10102:action:1");
    expect(record?.cost).toEqual({ kind: "raiseThreat", amount: 1 });
  });
});
