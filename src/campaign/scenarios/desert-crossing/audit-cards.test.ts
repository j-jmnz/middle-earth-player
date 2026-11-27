// Rules: hrd.heat-tracker, hrd.guarded-x, rr.forced, rr.running-out-of-cards, rr.response, rr.cannot, rr.modifiers, rr.exhausted, faq.side-quest-current-quest-text (data/rules/entries.json).
// An audit of Desert Crossing, second half (card-audit; the first half is audit.test.ts, split for the file size limit of .claude/rules/code-standards.md): the locations, the enemies and the shadows, each built from the printed words, the rule spans and the readings of docs/scenarios/haradrim/desert-crossing.md, and run again without its line's records, where it must fail.
import { describe, expect, it } from "vitest";

import type { Effect } from "../../../catalog/boundary.ts";
import { EFFECTS } from "../../../effects/index.ts";
import { temperatureOf } from "../../../rules/families/haradrim/heat.ts";
import { stagingThreat as stagingThreatOf } from "../../../rules/quest/quest.ts";
import type { ScenarioState } from "../../../rules/engine/reduce.ts";
import { lineSpec } from "../../../../test/harness/line-spec.ts";
import { playedLayout } from "../../../../test/harness/card-spec-play.ts";
import { attack, count, deckCount, endRound, reveal, rowProblems, travel, type Row } from "../../../../test/harness/card-spec.ts";
import { codesIn, drive, engagedCodes, fightEnemy, finish, idOf, idsOf, legalIntents, opened, send, statOf, tableFromLayout, zoneOf, type Layout } from "../../../../test/harness/scene-kit.ts";
import { IntentRefused } from "../../../../test/harness/scene.ts";
import { pick } from "../../../../test/harness/pick.ts";

const SID = "desert-crossing";
const BURNT = "16025";
const WORM = "16028";

type Made = ReturnType<typeof tableFromLayout>;
const make = (effects: readonly Effect[], layout: Layout, extra: readonly string[] = []): Made => tableFromLayout(SID, layout, { effects, extra });
const played = (effects: readonly Effect[], layout: Layout, act: Parameters<typeof playedLayout>[2]): ScenarioState => playedLayout(SID, layout, act, effects).run.state;
const damageIn = (state: ScenarioState): number => Object.values(state.cards).reduce((sum, card) => sum + (card.zone === "heroes" || card.zone === "play" ? card.damage : 0), 0);
const damageOf = (state: ScenarioState, code: string): number => idsOf(state, code).reduce((sum, id) => sum + (state.cards[id]?.damage ?? 0), 0);
const threatOf = (made: Made): number => stagingThreatOf(made.state, made.cards);

describe("16024 Carrion Bird", () => {
  const cost = (made: Made): number => statOf(made.state, made.cards, "16024", "engagementCost");
  lineSpec("16024:A:1", "its engagement cost is 40 less 1 for each damaged character in play (heroes and allies, any player), never below 0", (effects) => {
    expect(cost(make(effects, { staging: ["16024"], play: ["ally"] }))).toBe(40);
    expect(cost(make(effects, { staging: ["16024"], heroes: [{ code: "dh1", damage: 1 }], play: [{ code: "ally", damage: 1 }] }))).toBe(38);
    expect(cost(make(effects, { seats: 2, staging: ["16024"], play: [{ code: "ally", seat: 1, damage: 1 }, { code: "ally", damage: 1 }, "ally"] }))).toBe(38);
    expect(cost(make(effects, { staging: ["16024"], play: Array.from({ length: 41 }, () => ({ code: "ally", damage: 1 })) }))).toBe(0);
  });
  /** The first player engages the Carrion Bird (his threat is high enough), and answers the choices the Forced effect opens. */
  function engaged(effects: readonly Effect[], layout: Layout, choose?: (state: ScenarioState) => string): ScenarioState {
    const made = make(effects, { phase: "Encounter", threat: [45, 45], staging: ["16024"], ...layout });
    const sent = send(opened(made), { type: "Engage", enemyId: idOf(made.state, "16024") }, made.ctx);
    return finish(sent, made.ctx, choose).state;
  }
  lineSpec("16024:A:2", "after it engages you, you discard a damaged character you control, a hero included", (effects) => {
    const ally = engaged(effects, { play: [{ code: "ally", damage: 1 }] });
    expect(engagedCodes(ally)).toEqual(["16024"]);
    expect(zoneOf(ally, "ally")).toBe("discard");
    const hero = engaged(effects, { heroes: [{ code: "dh1", damage: 1 }] }, pick("dh1"));
    expect(hero.seats[0]?.heroes.map((id) => hero.cards[id]?.code)).toEqual(["dh1", "dh2"]);
    expect(Object.values(hero.cards).filter((card) => card.code === "dh1" && card.zone === "heroes")).toHaveLength(1);
  });
  lineSpec("16024:A:2", "with no damaged character nothing is discarded; a damaged character of another player is not touched", (effects) => {
    const none = engaged(effects, { play: ["ally", { code: "ally", damage: 1 }] });
    expect(idsOf(none, "ally").filter((id) => none.cards[id]?.zone === "play")).toHaveLength(1);
    const other = engaged(effects, { seats: 2, play: [{ code: "ally", damage: 1 }], heroes: [{ code: "dh3", seat: 1, damage: 1 }] });
    expect(zoneOf(other, "ally")).toBe("discard");
    expect(Object.values(other.cards).filter((card) => card.code === "dh3" && card.zone === "heroes")).toHaveLength(2);
  });
});

describe("16025 Burnt Sands", () => {
  lineSpec("16025:A:1", "while the temperature is 40 or higher it gets +2 Threat in the staging area, read live; below 40 it gets none", (effects) => {
    expect(threatOf(make(effects, { staging: [BURNT], temperature: 40 }))).toBe(4);
    expect(threatOf(make(effects, { staging: [BURNT], temperature: 39 }))).toBe(2);
    expect(threatOf(make(effects, { staging: [BURNT, BURNT], temperature: 49 }))).toBe(8);
    expect(threatOf(make(effects, { seats: 2, staging: [BURNT], temperature: 55 }))).toBe(4);
  });
  // An enemy that can be engaged (a Were-worm, cost 22) waits in the staging area, so the Encounter phase stops the play after the travel: the temperature read then is the card's alone, before the end of the round.
  const travelled = (effects: readonly Effect[], layout: Layout, to: string): ScenarioState => played(effects, { phase: "Travel", ...layout, staging: [...(layout.staging ?? []), WORM] }, travel(to));
  lineSpec("16025:A:2", "after it becomes the active location by travel the temperature rises by 2; another location raises nothing", (effects) => {
    expect(temperatureOf(travelled(effects, { temperature: 10, staging: [BURNT] }, BURNT))).toBe(12);
    expect(temperatureOf(travelled(effects, { seats: 2, temperature: 10, staging: [BURNT] }, BURNT))).toBe(12);
    expect(temperatureOf(travelled(effects, { temperature: 10, staging: [BURNT, "place"] }, "place"))).toBe(10);
  });
  lineSpec("16025:A:2", "a rise to 60 loses the game at once", (effects) => {
    expect(travelled(effects, { temperature: 58, staging: [BURNT] }, BURNT).lost).toBe(true);
    expect(travelled(effects, { temperature: 57, staging: [BURNT] }, BURNT).lost).toBe(false);
  });
});

describe("16026 Scorched Hamada", () => {
  const HAMADA = "16026";
  lineSpec("16026:A:1", "X, its Threat, is the tens digit of the temperature, read live", (effects) => {
    expect(threatOf(make(effects, { staging: [HAMADA], temperature: 30 }))).toBe(3);
    expect(threatOf(make(effects, { staging: [HAMADA], temperature: 39 }))).toBe(3);
    expect(threatOf(make(effects, { staging: [HAMADA], temperature: 49 }))).toBe(4);
    expect(threatOf(make(effects, { staging: [HAMADA], temperature: 5 }))).toBe(0);
  });
  lineSpec("16026:A:2", "after it becomes the active location X damage is assigned among the characters in play, all of it", (effects) => {
    const state = played(effects, { phase: "Travel", temperature: 30, staging: [HAMADA] }, travel(HAMADA));
    expect(damageIn(state)).toBe(3);
    const two = played(effects, { seats: 2, phase: "Travel", temperature: 30, staging: [HAMADA], play: ["ally"] }, travel(HAMADA));
    expect(damageIn(two)).toBe(3);
    expect(damageIn(played(effects, { phase: "Travel", temperature: 5, staging: [HAMADA] }, travel(HAMADA)))).toBe(0);
  });
  lineSpec("16026:A:3", "shadow: the defending player raises his threat by X, the tens digit read when it resolves", (effects) => {
    const state = played(effects, { temperature: 30 }, attack("f0", { shadow: HAMADA, undefended: true }));
    expect(state.seats[0]?.threat).toBe(31);
    const low = played(effects, { temperature: 5 }, attack("f0", { shadow: HAMADA, undefended: true }));
    expect(low.seats[0]?.threat).toBe(28);
    const two = played(effects, { seats: 2, temperature: 49 }, attack("f0", { shadow: HAMADA, undefended: true }));
    expect(two.seats[0]?.threat).toBe(32);
    expect(two.seats[1]?.threat).toBe(28);
  });
});

describe("16027 Parched Wadi", () => {
  const WADI = "16027";
  const VIPER = "16054";
  const BIRD = "16024";
  const statOn = (made: Made, code: string, which: "threat" | "attack"): number => statOf(made.state, made.cards, code, which);
  lineSpec("16027:A:1", "while in the staging area each Creature enemy of any player gets +1 Threat and +1 Attack, and a non-Creature none", (effects) => {
    const made = make(effects, { seats: 2, staging: [WADI, VIPER, "f3"], engaged: [{ code: BIRD, seat: 1 }] });
    expect(statOn(made, VIPER, "threat")).toBe(5);
    expect(statOn(made, VIPER, "attack")).toBe(2);
    expect(statOn(made, BIRD, "threat")).toBe(3);
    expect(statOn(made, BIRD, "attack")).toBe(3);
    expect(statOn(made, "f3", "threat")).toBe(3);
    expect(statOn(made, "f3", "attack")).toBe(1);
  });
  lineSpec("16027:A:1", "two copies stack, and a Parched Wadi that is not in the staging area gives nothing", (effects) => {
    expect(statOn(make(effects, { staging: [WADI, WADI, VIPER] }), VIPER, "threat")).toBe(6);
    const apart = make(effects, { active: WADI, staging: [WADI, VIPER] });
    expect(statOn(apart, VIPER, "threat")).toBe(5);
    const none = make(effects, { active: WADI, staging: [VIPER] });
    expect(statOn(none, VIPER, "threat")).toBe(4);
  });
  lineSpec("16027:A:2", "after it becomes the active location the discard pile is shuffled in and a Creature enemy is found and added to the staging area, not revealed", (effects) => {
    const state = played(effects, { phase: "Travel", staging: [WADI], deck: ["f3", "f3"], discard: ["f0", VIPER] }, travel(WADI));
    expect(zoneOf(state, VIPER)).toBe("staging");
    expect(state.encounterDiscard.map((id) => state.cards[id]?.code)).not.toContain(VIPER);
    expect(codesIn(state, "staging")).toEqual([VIPER]);
  });
  lineSpec("16027:A:2", "with no Creature enemy in the deck and the discard pile the whole deck is discarded and nothing is added (recommended reading)", (effects) => {
    const state = played(effects, { phase: "Travel", staging: [WADI], deck: ["f3", "f3"], discard: ["f0"] }, travel(WADI));
    expect(state.encounterDeck).toHaveLength(0);
    expect(state.encounterDiscard).toHaveLength(3);
    expect(codesIn(state, "staging")).toEqual([]);
  });
});

describe("16028 Were-worm", () => {
  const stats = (made: Made) => (["threat", "attack", "defense"] as const).map((name) => statOf(made.state, made.cards, WORM, name));
  lineSpec("16028:A:1", "its Threat, Attack and Defense are each X, the tens digit read live, in the staging area and engaged", (effects) => {
    expect(stats(make(effects, { staging: [WORM], temperature: 30 }))).toEqual([3, 3, 3]);
    expect(stats(make(effects, { staging: [WORM], temperature: 49 }))).toEqual([4, 4, 4]);
    expect(stats(make(effects, { staging: [WORM], temperature: 5 }))).toEqual([0, 0, 0]);
    expect(stats(make(effects, { seats: 2, engaged: [{ code: WORM, seat: 1 }], temperature: 20 }))).toEqual([2, 2, 2]);
  });
  /** The first player engages the Were-worm (cost 22) in the Encounter phase: the state when the immediate attack waits for a defender, and the state after dh1 takes it undefended. */
  function engagedByPlayer(effects: readonly Effect[], layout: Layout): { atDefense: ScenarioState; after: ScenarioState } {
    const made = make(effects, { phase: "Encounter", staging: [WORM], deck: ["f0", "f0", "f0"], ...layout });
    const run = finish(send(opened(made), { type: "Engage", enemyId: idOf(made.state, WORM) }, made.ctx), made.ctx);
    expect(run.state.window?.kind, "the immediate attack opens a defense window").toBe("defense");
    expect(run.state.pendingAttack?.immediate, "the attack is immediate").toBe(true);
    return { atDefense: run.state, after: send(run, { type: "Undefended", heroId: made.hero }, made.ctx).state };
  }
  lineSpec("16028:A:2", "after it engages you it makes an immediate attack, dealt no shadow card", (effects) => {
    const { atDefense, after } = engagedByPlayer(effects, { temperature: 30 });
    expect(atDefense.encounterDeck).toHaveLength(3);
    expect(damageOf(after, "dh1")).toBe(3);
    expect(engagedCodes(after)).toEqual([WORM]);
  });
  lineSpec("16028:A:2", "two players: it attacks the player it engaged only", (effects) => {
    const { after } = engagedByPlayer(effects, { seats: 2, temperature: 20 });
    expect(damageOf(after, "dh1")).toBe(2);
    expect(damageOf(after, "dh3")).toBe(0);
  });
  lineSpec("16028:A:3", "shadow: the attacking enemy gets +1 Attack, and +2 instead (not +3) at 40 or higher", (effects) => {
    expect(damageOf(played(effects, { temperature: 39 }, attack("f0", { shadow: WORM, undefended: true })), "dh1")).toBe(2);
    expect(damageOf(played(effects, { temperature: 40 }, attack("f0", { shadow: WORM, undefended: true })), "dh1")).toBe(3);
    expect(damageOf(played(effects, { seats: 2, temperature: 55 }, attack("f0", { shadow: WORM, undefended: true })), "dh1")).toBe(3);
  });
});

describe("16029 Unbearable Heat and 16051 Sandstorm", () => {
  lineSpec("16029:A:1", "each player assigns X damage among his own characters; X is 0 below 10", (effects) => {
    const two = played(effects, { seats: 2, temperature: 30 }, reveal("16029"));
    expect(damageOf(two, "dh3")).toBe(3);
    expect(damageOf(two, "dh1") + damageOf(two, "dh2")).toBe(3);
    expect(damageIn(played(effects, { temperature: 9 }, reveal("16029")))).toBe(0);
  });
  lineSpec("16029:A:2", "shadow: the attacking enemy gets +X Attack, X read when it resolves", (effects) => {
    expect(damageOf(played(effects, { temperature: 30 }, attack("f0", { shadow: "16029", undefended: true })), "dh1")).toBe(4);
    expect(damageOf(played(effects, { temperature: 9 }, attack("f0", { shadow: "16029", undefended: true })), "dh1")).toBe(1);
  });
  /** An undefended attack by f0 with the Sandstorm shadow on the table whose hero dh1 holds a Pendant (cost 1) and a Raiment (cost 3) or the attachments `attached`. */
  function stormed(effects: readonly Effect[], option: string, attached: readonly string[]): ScenarioState {
    const table = (layout: Layout): Made => tableFromLayout(SID, layout, { effects, extra: ["10157", "10191"] });
    const layout: Layout = { attached: attached.map((code) => ({ code, to: "dh1" })) };
    return fightEnemy(table, "16051", "f0", layout, { undefended: true, pick: (state) => (state.window?.kind === "choose" && state.window.options.includes(option) ? option : (state.window?.kind === "choose" ? (state.window.options[0] ?? "") : "")) }).run.state;
  }
  lineSpec("16051:A:2", "shadow, first option: the highest cost attachment the defending player controls is discarded", (effects) => {
    const state = stormed(effects, "discard", ["10157", "10191"]);
    expect(zoneOf(state, "10191")).toBe("discard");
    expect(zoneOf(state, "10157")).toBe("play");
    expect(damageIn(state)).toBe(1);
  });
  lineSpec("16051:A:2", "shadow, second option: X damage, X the attachments he controls", (effects) => {
    const state = stormed(effects, "damage", ["10157", "10191"]);
    expect(zoneOf(state, "10191")).toBe("play");
    expect(damageIn(state)).toBe(3);
  });
});

describe("16052 Heat Exhaustion", () => {
  lineSpec("16052:A:1", "with no ready character the player exhausts nothing and no damage is dealt", (effects) => {
    const some = played(effects, { exhaustedCards: ["dh1"] }, reveal("16052"));
    expect(damageOf(some, "dh2")).toBe(1);
    const none = played(effects, { exhaustedCards: ["dh1", "dh2"] }, reveal("16052"));
    expect(damageIn(none)).toBe(0);
  });
  lineSpec("16052:A:2", "shadow: with no ready character nothing is exhausted", (effects) => {
    const defended = played(effects, { exhaustedCards: ["dh1", "dh2"] }, attack("f0", { shadow: "16052", undefended: true }));
    expect(damageOf(defended, "dh1")).toBe(1);
    const ready = played(effects, {}, attack("f0", { shadow: "16052", undefended: true }));
    expect(ready.cards[idOf(ready, "dh1")]?.exhausted).toBe(true);
  });
});

describe("16054 Sand Viper", () => {
  const VIPER = "16054";
  const fightWith = (effects: readonly Effect[], enemy: string, layout: Layout = {}, options: Parameters<typeof fightEnemy<Made, Layout>>[4] = {}) => fightEnemy((one: Layout) => make(effects, one), "f0", enemy, layout, options);
  lineSpec("16054:A:1", "no defender can be declared against Sand Viper, for any seat; against another enemy one can", (effects) => {
    expect(() => fightWith(effects, VIPER)).toThrow(IntentRefused);
    expect(() => fightWith(effects, VIPER, { seats: 2 }, { defender: (made) => made.hero2 })).toThrow(IntentRefused);
    expect(damageOf(fightWith(effects, "f0").run.state, "dh1")).toBe(0);
    expect(damageOf(fightWith(effects, VIPER, {}, { undefended: true }).run.state, "dh1")).toBe(1);
  });
  /** The players travel to a place, with the Viper in the staging area or engaged as the layout says; a Were-worm in the staging area stops the play at the Encounter phase. */
  const travelled = (effects: readonly Effect[], layout: Layout, to = "place"): ScenarioState => played(effects, { phase: "Travel", ...layout, staging: [...(layout.staging ?? []), "place", WORM] }, travel(to));
  lineSpec("16054:A:2", "after the players travel it engages the first player, with no immediate attack", (effects) => {
    const state = travelled(effects, { staging: [VIPER] });
    expect(engagedCodes(state)).toContain(VIPER);
    expect(state.pendingAttack).toBeNull();
    const second = travelled(effects, { seats: 2, firstPlayer: 1, staging: [VIPER] });
    expect(engagedCodes(second, 1)).toContain(VIPER);
    expect(engagedCodes(second, 0)).not.toContain(VIPER);
  });
  lineSpec("16054:A:2", "a Sand Viper engaged with another player moves to the first player", (effects) => {
    const state = travelled(effects, { seats: 2, firstPlayer: 0, staging: [], engaged: [{ code: VIPER, seat: 1 }] });
    expect(engagedCodes(state, 0)).toContain(VIPER);
    expect(engagedCodes(state, 1)).not.toContain(VIPER);
  });
});

describe("16055 Giant Scorpion", () => {
  const SCORPION = "16055";
  // The stand-in "mild" is not loaded here: the Scorpion's own attack (3) against a defender of defense 2 deals 1 damage.
  lineSpec("16055:A:1", "after it damages a character that character cannot ready until the end of the round, through the refresh phase", (effects) => {
    const state = played(effects, { engaged: [SCORPION], deck: ["f0", "f0", "f0", "f0"] }, [attack(SCORPION), endRound]);
    expect(state.cards[idOf(state, "dh1")]?.exhausted).toBe(true);
    expect(damageOf(state, "dh1")).toBe(1);
  });
  lineSpec("16055:A:1", "an undefended attack: the hero takes the damage and cannot ready until the end of the round", (effects) => {
    const hurt = played(effects, { engaged: [SCORPION], deck: ["f0", "f0", "f0", "f0"] }, attack(SCORPION, { undefended: true }));
    expect(damageOf(hurt, "dh1")).toBe(3);
    expect(hurt.modifiers.some((modifier) => modifier.stat === "cannotReady" && modifier.instanceId === idOf(hurt, "dh1"))).toBe(true);
  });
  lineSpec("16055:A:2", "shadow: if the attack deals damage the defending character cannot ready until the end of the round; if it deals none, it can", (effects) => {
    // A Were-worm at 30 has Attack 3 against Defense 2: 1 damage. A stand-in enemy of Attack 1 deals none.
    const dealt = played(effects, { temperature: 30, deck: ["f0", "f0", "f0", "f0"] }, [attack(WORM, { shadow: SCORPION }), endRound]);
    expect(dealt.cards[idOf(dealt, "dh1")]?.exhausted).toBe(true);
    const none = played(effects, { deck: ["f0", "f0", "f0", "f0"] }, [attack("f3", { shadow: SCORPION }), endRound]);
    expect(none.cards[idOf(none, "dh1")]?.exhausted).toBe(false);
  });
  it("16055:A:2 shadow: an undefended attack has no defending character, so no character is kept from readying", () => {
    const undefended = played(EFFECTS, { temperature: 30, deck: ["f0", "f0", "f0", "f0"] }, attack(WORM, { shadow: SCORPION, undefended: true }));
    expect(damageOf(undefended, "dh1")).toBe(3);
    expect(undefended.modifiers.some((modifier) => modifier.stat === "cannotReady")).toBe(false);
  });
});

describe("16049 Towering Dunes", () => {
  const DUNES = "16049";
  const noProgress = (made: Made, id: string): number => statOf(made.state, made.cards, id, "noProgressPlaced");
  lineSpec("16049:A:1", "while in the staging area no progress is placed on the other locations in the staging area, a second Towering Dunes is exempt", (effects) => {
    const made = make(effects, { staging: [DUNES, BURNT, "place"] });
    expect(noProgress(made, BURNT)).toBe(1);
    expect(noProgress(made, "place")).toBe(1);
    const two = make(effects, { staging: [DUNES, DUNES] });
    expect(noProgress(two, DUNES)).toBe(0);
    const apart = make(effects, { active: DUNES, staging: [BURNT] });
    expect(noProgress(apart, BURNT)).toBe(0);
    const none = make(effects, { staging: [BURNT] });
    expect(noProgress(none, BURNT)).toBe(0);
  });
  lineSpec("16049:A:2", "after it becomes the active location the top card of the encounter deck is revealed", (effects) => {
    const state = played(effects, { phase: "Travel", staging: [DUNES, WORM], deck: ["f3", "f0"] }, travel(DUNES));
    expect(codesIn(state, "staging")).toContain("f3");
    expect(state.encounterDeck).toHaveLength(1);
    expect(codesIn(played(effects, { phase: "Travel", staging: ["place", WORM], deck: ["f3", "f0"] }, travel("place")), "staging")).not.toContain("f3");
  });
});

describe("16050 Desert Oasis", () => {
  const OASIS = "16050";
  /** The quest with the Oasis active (2 quest points) is played out and the first player uses the Response of the Oasis when it is explored. */
  function explored(effects: readonly Effect[], layout: Layout): ScenarioState {
    const made = make(effects, { active: OASIS, ...layout });
    let run = send(opened(made), { type: "Commit", cardIds: [made.hero, made.hero2] }, made.ctx);
    run = send(run, { type: "Pass" }, made.ctx);
    const offered = (state: ScenarioState): boolean => legalIntents(state, made.ctx).some((intent) => intent.type === "Trigger" && intent.cardId === idOf(state, OASIS));
    run = drive(made, run, (state) => offered(state) || state.phase !== "Quest");
    expect(offered(run.state), "the Response of the Oasis is offered when it is explored").toBe(true);
    const trigger = legalIntents(run.state, made.ctx).find((intent) => intent.type === "Trigger" && intent.cardId === idOf(run.state, OASIS));
    return finish(send(run, trigger as never, made.ctx), made.ctx).state;
  }
  const hurtAllies = (seat0: number, seat1 = 0): Layout["play"] => [...Array.from({ length: seat0 }, () => ({ code: "ally", damage: 1 })), ...Array.from({ length: seat1 }, () => ({ code: "ally", seat: 1, damage: 1 }))];
  lineSpec("16050:A:1", "while active, when explored it heals 4 damage in total from the characters in play, and cannot stop while a damaged character remains", (effects) => {
    const state = explored(effects, { play: hurtAllies(6) });
    expect(damageIn(state)).toBe(2);
  });
  lineSpec("16050:A:1", "the characters of every player are healed from, and less than 4 damage heals what there is", (effects) => {
    const two = explored(effects, { seats: 2, play: hurtAllies(3, 3) });
    expect(damageIn(two)).toBe(2);
    const few = explored(effects, { play: hurtAllies(2) });
    expect(damageIn(few)).toBe(0);
  });
  lineSpec("16050:A:2", "after it becomes the active location each player exhausts a ready character he controls; with none ready nothing happens", (effects) => {
    const state = played(effects, { seats: 2, phase: "Travel", staging: [OASIS, WORM] }, travel(OASIS));
    expect(state.cards[idOf(state, "dh1")]?.exhausted).toBe(true);
    expect(state.cards[idOf(state, "dh2")]?.exhausted).toBe(false);
    expect(state.cards[idOf(state, "dh3")]?.exhausted).toBe(true);
    const none = played(effects, { phase: "Travel", exhaustedCards: ["dh1", "dh2"], staging: [OASIS, WORM] }, travel(OASIS));
    expect(none.window?.kind).not.toBe("choose");
  });
});

describe("16022:A:1 Mirage with no location anywhere", () => {
  // The whole deck is discarded (as for Parched Wadi). In the quest phase the empty deck then gets the discard pile back (rr.running-out-of-cards); in any other phase it stays empty.
  it("16022:A:1 in the quest phase the deck is discarded, then runs out and the discard pile is reset into it", () => {
    const row: Row = { line: "16022:A:1", layout: { phase: "Quest", deck: ["f0"], discard: ["f3"] }, act: reveal("16022"), expect: [deckCount(3), count("f0", "encounterDeck", 1), count("f3", "encounterDeck", 1), count("16022", "encounterDeck", 1)] };
    expect(rowProblems(SID, row, EFFECTS)).toEqual([]);
  });
  it("16022:A:1 outside the quest phase the whole deck is discarded and stays empty", () => {
    const row: Row = { line: "16022:A:1", layout: { phase: "Travel", deck: ["f0"], discard: ["f3"] }, act: reveal("16022"), expect: [deckCount(0), count("f0", "encounterDiscard", 1), count("f3", "encounterDiscard", 1), count("16022", "encounterDiscard", 1)] };
    expect(rowProblems(SID, row, EFFECTS)).toEqual([]);
  });
});

// The Surge lines are keywords the engine reads from the card, so no record names them and there is nothing to take away: the plain play shows the next card is revealed.
describe("16023:A:1 and 16030:A:1 Surge", () => {
  it("16030:A:1 Scorching Sun has Surge: the next encounter card is revealed too", () => {
    const state = played(EFFECTS, { temperature: 10, deck: ["f0", "f3"] }, reveal("16030"));
    expect(codesIn(state, "staging")).toEqual(["f0"]);
    expect(state.encounterDeck).toHaveLength(1);
  });
  it("16023:A:1 Seek Shade has Surge: the next encounter card is revealed too", () => {
    const state = played(EFFECTS, { deck: ["f0", "f3"] }, reveal("16023"));
    expect(codesIn(state, "staging")).toEqual(["16023", "f0"].sort());
    expect(state.encounterDeck).toHaveLength(1);
  });
});
